#!/usr/bin/env python
"""
dashboard.py — a tiny, self-contained live training monitor.

Serves a local web page (default http://localhost:8799) that auto-refreshes with:
  • GPU: name, util %, memory, temperature, power draw, fan, clocks (via nvidia-smi)
  • CPU: overall % + per-core bars, RAM used/total (via psutil)
  • Training process: the python running train.py/finetune.py + its CPU%/RAM
  • Live tail of the training log (the background-bake .output file)

Zero project deps beyond psutil (stdlib http.server + subprocess nvidia-smi).
Run it with the SYSTEM python so it never touches the ml/ training venv:

    py -m pip install psutil          # one-time
    py ml/dashboard.py                # then open http://localhost:8799

Options:
    --port N     port (default 8799)
    --log PATH   training log to tail. Default: newest *.output under the Claude
                 background-task dir (auto-follows the latest bake).
"""

import argparse
import glob
import json
import os
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    import psutil
except ImportError:
    print("psutil not found. Install it with:  py -m pip install psutil")
    sys.exit(1)


def find_latest_log():
    """Newest *.output under %LOCALAPPDATA%\\Temp\\claude\\**\\tasks — the latest background job."""
    base = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Temp", "claude")
    if not os.path.isdir(base):
        return None
    candidates = glob.glob(os.path.join(base, "**", "tasks", "*.output"), recursive=True)
    if not candidates:
        return None
    return max(candidates, key=os.path.getmtime)


# nvidia-smi field list -> dict keys
GPU_FIELDS = [
    "name", "utilization.gpu", "utilization.memory", "memory.used", "memory.total",
    "temperature.gpu", "power.draw", "power.limit", "fan.speed", "clocks.sm", "clocks.mem",
]


def gpu_stats():
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=" + ",".join(GPU_FIELDS),
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=4,
        )
        if out.returncode != 0:
            return {"error": (out.stderr or "nvidia-smi failed").strip()}
        gpus = []
        for line in out.stdout.strip().splitlines():
            vals = [v.strip() for v in line.split(",")]
            gpus.append(dict(zip(GPU_FIELDS, vals)))
        return {"gpus": gpus}
    except FileNotFoundError:
        return {"error": "nvidia-smi not found (no NVIDIA driver?)"}
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}


def training_proc():
    """Find the python process running the bake (train/finetune/export) and report its load."""
    needles = ("train.py", "finetune.py", "export_onnx.py", "build_prototypes.py", "render_dataset")
    for p in psutil.process_iter(["pid", "name", "cmdline", "memory_info", "create_time"]):
        try:
            cmd = " ".join(p.info.get("cmdline") or [])
            if any(n in cmd for n in needles):
                stage = next((n for n in needles if n in cmd), "?")
                return {
                    "pid": p.info["pid"],
                    "stage": stage,
                    "cpu": p.cpu_percent(interval=0.0),
                    "rss_mb": round(p.info["memory_info"].rss / 1048576) if p.info.get("memory_info") else None,
                    "uptime_s": round(time.time() - p.info["create_time"]),
                }
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return None


def tail(path, n=200):
    if not path or not os.path.isfile(path):
        return f"(no log file: {path})"
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return "".join(f.readlines()[-n:])
    except Exception as e:  # noqa: BLE001
        return f"(error reading log: {e})"


def stats(log_path):
    vm = psutil.virtual_memory()
    return {
        "t": time.time(),
        "cpu_overall": psutil.cpu_percent(interval=0.0),
        "cpu_per": psutil.cpu_percent(interval=0.0, percpu=True),
        "ram_used_gb": round(vm.used / 1073741824, 1),
        "ram_total_gb": round(vm.total / 1073741824, 1),
        "ram_pct": vm.percent,
        "gpu": gpu_stats(),
        "proc": training_proc(),
        "log": tail(log_path),
        "log_path": log_path,
    }


PAGE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Training Monitor</title>
<style>
  :root { --bg:#1a1614; --panel:#241d18; --line:#3a2f26; --ink:#e8ddd0; --dim:#9b8b78;
          --accent:#d98a4a; --good:#6bbf6b; --warn:#d9a14a; --hot:#d95a4a; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font:14px/1.5 ui-monospace,Menlo,Consolas,monospace; }
  header { padding:12px 18px; border-bottom:1px solid var(--line); display:flex;
           align-items:center; gap:14px; }
  header h1 { font-size:15px; margin:0; font-weight:600; letter-spacing:.03em; }
  #status { color:var(--dim); font-size:12px; }
  .dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--good);
         margin-right:5px; vertical-align:middle; }
  .dot.stale { background:var(--hot); }
  main { display:grid; grid-template-columns:1fr 1fr; gap:14px; padding:14px; }
  @media (max-width:880px){ main{ grid-template-columns:1fr; } }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px; }
  .panel h2 { font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:var(--dim);
              margin:0 0 12px; }
  .row { display:flex; justify-content:space-between; gap:10px; margin:5px 0; }
  .row .k { color:var(--dim); } .row .v { font-variant-numeric:tabular-nums; }
  .bar { height:9px; background:#000; border-radius:5px; overflow:hidden; margin:3px 0 9px; }
  .bar > span { display:block; height:100%; background:var(--accent); transition:width .4s; }
  .bar.good>span{background:var(--good);} .bar.warn>span{background:var(--warn);} .bar.hot>span{background:var(--hot);}
  .cores { display:grid; grid-template-columns:repeat(auto-fill,minmax(34px,1fr)); gap:5px; margin-top:6px; }
  .core { height:42px; background:#000; border-radius:3px; position:relative; overflow:hidden; }
  .core > span { position:absolute; bottom:0; left:0; right:0; background:var(--accent); transition:height .4s; }
  .core small { position:absolute; top:2px; left:0; right:0; text-align:center; font-size:9px; color:var(--dim); }
  .full { grid-column:1/-1; }
  pre#log { background:#0e0b09; border:1px solid var(--line); border-radius:6px; padding:12px;
            max-height:340px; overflow:auto; font-size:12px; white-space:pre-wrap; margin:0; color:#cdbfae; }
  canvas { width:100%; height:48px; display:block; margin-top:4px; }
  .big { font-size:26px; font-weight:600; font-variant-numeric:tabular-nums; }
  .proc-on { color:var(--good); } .proc-off { color:var(--dim); }
</style></head>
<body>
<header>
  <h1>🔥 Training Monitor</h1>
  <span id="status"><span class="dot" id="dot"></span><span id="statustext">connecting…</span></span>
</header>
<main>
  <section class="panel">
    <h2>GPU</h2>
    <div id="gpu">…</div>
    <canvas id="gpuSpark" width="600" height="48"></canvas>
  </section>
  <section class="panel">
    <h2>CPU &amp; RAM</h2>
    <div class="row"><span class="k">CPU total</span><span class="v" id="cpuv">–</span></div>
    <div class="bar" id="cpubar"><span></span></div>
    <div class="cores" id="cores"></div>
    <div class="row" style="margin-top:12px"><span class="k">RAM</span><span class="v" id="ramv">–</span></div>
    <div class="bar" id="rambar"><span></span></div>
  </section>
  <section class="panel">
    <h2>Training process</h2>
    <div id="proc">…</div>
  </section>
  <section class="panel">
    <h2>Stages</h2>
    <div id="stages" style="font-size:13px; line-height:2;">
      render → pretrain → finetune → export → prototypes
    </div>
    <p style="color:var(--dim); font-size:12px; margin-top:10px;">
      Python buffers stdout, so the log may update in bursts. GPU/CPU graphs are real-time.
    </p>
  </section>
  <section class="panel full">
    <h2>Training log <span id="logpath" style="color:var(--dim); text-transform:none; font-weight:400;"></span></h2>
    <pre id="log">…</pre>
  </section>
</main>
<script>
const gpuHist = [], cpuHist = [], MAX = 80;
let lastOk = 0;

function cls(p){ return p>=85?'hot':p>=60?'warn':'good'; }
function bar(id,p){ const b=document.getElementById(id); b.className='bar '+cls(p); b.firstChild.style.width=Math.min(100,p)+'%'; }

function spark(canvas, hist, color){
  const c=canvas.getContext('2d'), w=canvas.width, h=canvas.height;
  c.clearRect(0,0,w,h);
  if(!hist.length) return;
  c.strokeStyle=color; c.lineWidth=2; c.beginPath();
  hist.forEach((v,i)=>{ const x=i/(MAX-1)*w, y=h-(v/100)*h; i?c.lineTo(x,y):c.moveTo(x,y); });
  c.stroke();
  c.globalAlpha=.12; c.lineTo(w,h); c.lineTo(0,h); c.closePath(); c.fillStyle=color; c.fill(); c.globalAlpha=1;
}

async function poll(){
  try{
    const r = await fetch('/stats'); const s = await r.json();
    lastOk = Date.now();
    // GPU
    const g = s.gpu;
    if(g.error){ document.getElementById('gpu').innerHTML = '<span style="color:var(--hot)">'+g.error+'</span>'; }
    else { document.getElementById('gpu').innerHTML = g.gpus.map(gp=>{
        const memPct = (+gp['memory.used'])/(+gp['memory.total'])*100;
        const util = +gp['utilization.gpu'];
        const row=(k,v)=>`<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
        const b=(p,c)=>`<div class="bar ${c}"><span style="width:${Math.min(100,p)}%"></span></div>`;
        return `<div class="big">${util}% <span style="font-size:13px;color:var(--dim)">${gp.name}</span></div>`
          + b(util,cls(util))
          + row('Memory', `${gp['memory.used']} / ${gp['memory.total']} MiB`)
          + b(memPct,cls(memPct))
          + row('Temp', `${gp['temperature.gpu']} °C`)
          + row('Power', `${gp['power.draw']} / ${gp['power.limit']} W`)
          + row('Fan', `${gp['fan.speed']} %`)
          + row('Clocks', `sm ${gp['clocks.sm']} · mem ${gp['clocks.mem']} MHz`);
      }).join('');
      const u=+g.gpus[0]['utilization.gpu']; gpuHist.push(u); if(gpuHist.length>MAX) gpuHist.shift();
      spark(document.getElementById('gpuSpark'), gpuHist, '#d98a4a');
    }
    // CPU
    document.getElementById('cpuv').textContent = s.cpu_overall.toFixed(0)+' %';
    bar('cpubar', s.cpu_overall);
    cpuHist.push(s.cpu_overall); if(cpuHist.length>MAX) cpuHist.shift();
    document.getElementById('cores').innerHTML = s.cpu_per.map((p,i)=>
      `<div class="core"><span style="height:${p}%;background:${p>=85?'#d95a4a':p>=60?'#d9a14a':'#d98a4a'}"></span><small>${i}</small></div>`).join('');
    document.getElementById('ramv').textContent = `${s.ram_used_gb} / ${s.ram_total_gb} GB (${s.ram_pct}%)`;
    bar('rambar', s.ram_pct);
    // Proc
    const pr=s.proc;
    document.getElementById('proc').innerHTML = pr
      ? `<div class="big proc-on">● running</div>`
        + `<div class="row"><span class="k">Stage</span><span class="v">${pr.stage}</span></div>`
        + `<div class="row"><span class="k">PID</span><span class="v">${pr.pid}</span></div>`
        + `<div class="row"><span class="k">CPU</span><span class="v">${pr.cpu.toFixed(0)} %</span></div>`
        + `<div class="row"><span class="k">RAM</span><span class="v">${pr.rss_mb} MB</span></div>`
        + `<div class="row"><span class="k">Uptime</span><span class="v">${pr.uptime_s}s</span></div>`
      : `<div class="big proc-off">○ idle</div><div style="color:var(--dim)">no bake process running (finished or not started)</div>`;
    // Log
    const log=document.getElementById('log'); const atBottom = log.scrollTop+log.clientHeight >= log.scrollHeight-30;
    log.textContent = s.log; if(atBottom) log.scrollTop = log.scrollHeight;
    document.getElementById('logpath').textContent = s.log_path ? '· '+s.log_path.split(/[\\/]/).pop() : '';
  }catch(e){ /* keep last view */ }
  const stale = Date.now()-lastOk > 4000;
  document.getElementById('dot').className = 'dot'+(stale?' stale':'');
  document.getElementById('statustext').textContent = stale ? 'reconnecting…' : 'live · updates every 1s';
}
poll(); setInterval(poll, 1000);
</script>
</body></html>"""


class Handler(BaseHTTPRequestHandler):
    log_path = None

    def _send(self, body, ctype):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/stats"):
            self._send(json.dumps(stats(self.log_path)), "application/json")
        else:
            self._send(PAGE, "text/html; charset=utf-8")

    def log_message(self, *args):  # silence per-request console spam
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8799)
    ap.add_argument("--log", default=None, help="training log path (default: newest bake .output)")
    args = ap.parse_args()

    log_path = args.log or find_latest_log()
    Handler.log_path = log_path
    psutil.cpu_percent(interval=None)  # prime the CPU sampler

    url = f"http://localhost:{args.port}"
    print(f"Training monitor -> {url}")
    print(f"Tailing log: {log_path}")
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
