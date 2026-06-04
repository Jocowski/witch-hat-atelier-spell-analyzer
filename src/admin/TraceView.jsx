// TraceView.jsx — Admin "Trace image → SVG": upload an image OR draw a symbol, trace it to a
// monochrome SVG path normalised into the engine's centered viewBox, then copy/download the result
// to paste into data/sigils.json or data/signs.json (the browser twin of `npm run vectorize:*`).
import { useCallback, useRef, useState } from 'react'
import DrawingSurface from '../studio/DrawingSurface.jsx'
import { rasterizeImage, rasterizeStrokes, traceCanvas } from '../draw/imageTrace.js'

const DEFAULTS = { threshold: 128, turdSize: 8, simplify: 1, fit: true }

export default function TraceView() {
  const canvasRef = useRef(null)        // DrawingSurface (draw mode)
  const fileInputRef = useRef(null)
  const sourceCanvasRef = useRef(null)  // last rasterized source canvas (for re-trace on option change)

  const [mode, setMode] = useState('upload') // 'upload' | 'draw'
  const [opts, setOpts] = useState(DEFAULTS)
  const [result, setResult] = useState(null) // { rawSvg, combinedD, normalizedD }
  const [sourceUrl, setSourceUrl] = useState(null) // preview of the uploaded image
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(null) // 'path' | 'svg' | null
  const [busy, setBusy] = useState(false)

  // Trace whatever source canvas we have with the current options.
  const runTrace = useCallback((sourceCanvas, nextOpts) => {
    const cv = sourceCanvas || sourceCanvasRef.current
    if (!cv) { setError('Add a source first — upload an image or draw a symbol.'); return }
    setError(null); setBusy(true)
    try {
      const res = traceCanvas(cv, nextOpts || opts)
      if (!res.normalizedD) setError('Nothing traced — try a lower turd size or a different threshold.')
      setResult(res)
    } catch (e) {
      setError(e.message || 'Trace failed.')
    } finally {
      setBusy(false)
    }
  }, [opts])

  function handleFile(e) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    const url = URL.createObjectURL(f)
    setSourceUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url })
    const img = new Image()
    img.onload = () => {
      const cv = rasterizeImage(img)
      sourceCanvasRef.current = cv
      runTrace(cv)
    }
    img.onerror = () => setError('Could not load that image.')
    img.src = url
  }

  function handleTraceDrawing() {
    const strokes = canvasRef.current?.getStrokes() || []
    if (!strokes.length) { setError('Draw something first.'); return }
    const cv = rasterizeStrokes(strokes)
    sourceCanvasRef.current = cv
    runTrace(cv)
  }

  function setOpt(key, value) {
    const next = { ...opts, [key]: value }
    setOpts(next)
    if (sourceCanvasRef.current) runTrace(sourceCanvasRef.current, next)
  }

  async function copy(text, which) {
    try { await navigator.clipboard.writeText(text); setCopied(which); setTimeout(() => setCopied(null), 1600) }
    catch { setError('Clipboard not available.') }
  }

  function downloadSvg() {
    if (!result?.normalizedD) return
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100">\n  <path d="${result.normalizedD}" fill="currentColor" fill-rule="evenodd"/>\n</svg>\n`
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'symbol.svg'; a.click()
    URL.revokeObjectURL(a.href)
  }

  function switchMode(m) {
    setMode(m); setResult(null); setError(null); sourceCanvasRef.current = null
    if (m === 'upload' && sourceUrl) { /* keep last upload preview */ }
  }

  return (
    <div className="admin-trace-wrap">
      <h3 className="admin-section-title">Trace image → SVG</h3>
      <p className="admin-hint" style={{ marginBottom: 12 }}>
        Upload or draw a symbol, trace it, then copy the <code>svgPath</code> into
        {' '}<code>data/sigils.json</code> / <code>data/signs.json</code> (with <code>render:&quot;fill&quot;</code>).
        Output is normalised to the engine&apos;s centered <code>-50 -50 100 100</code> viewBox — the
        browser equivalent of <code>npm run vectorize:*</code>.
      </p>

      <div className="admin-trace-modes">
        <button className={`admin-tab admin-tab-sm${mode === 'upload' ? ' admin-tab-active' : ''}`} onClick={() => switchMode('upload')}>Upload image</button>
        <button className={`admin-tab admin-tab-sm${mode === 'draw' ? ' admin-tab-active' : ''}`} onClick={() => switchMode('draw')}>Draw it</button>
      </div>

      <div className="admin-trace-layout">
        {/* ── Source ── */}
        <div className="admin-trace-col">
          <h4 className="admin-subsection">Source</h4>
          {mode === 'upload' ? (
            <div className="admin-trace-source">
              <button className="admin-btn admin-btn-primary" onClick={() => fileInputRef.current?.click()}>Choose image…</button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
              {sourceUrl
                ? <img src={sourceUrl} alt="source" className="admin-trace-thumb" />
                : <p className="admin-hint">PNG/JPG line-art works best — dark mark on a light background.</p>}
            </div>
          ) : (
            <div className="admin-trace-source">
              <DrawingSurface ref={canvasRef} palette="bw" enableSymbols={false} compact />
              <div className="admin-train-actions">
                <button className="admin-btn" onClick={() => canvasRef.current?.clear()}>Clear</button>
                <button className="admin-btn admin-btn-primary" onClick={handleTraceDrawing}>Trace drawing</button>
              </div>
            </div>
          )}

          {/* ── Trace controls ── */}
          <div className="admin-trace-controls">
            <label className="admin-label admin-label-row">
              Threshold <span className="admin-hint">{opts.threshold}</span>
              <input type="range" min="20" max="240" value={opts.threshold} onChange={(e) => setOpt('threshold', +e.target.value)} />
            </label>
            <label className="admin-label admin-label-row">
              Despeckle <span className="admin-hint">{opts.turdSize}</span>
              <input type="range" min="0" max="40" value={opts.turdSize} onChange={(e) => setOpt('turdSize', +e.target.value)} />
            </label>
            <label className="admin-label admin-label-row">
              Simplify <span className="admin-hint">{opts.simplify}</span>
              <input type="range" min="0" max="4" step="0.5" value={opts.simplify} onChange={(e) => setOpt('simplify', +e.target.value)} />
            </label>
            <label className="admin-label admin-label-row" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={opts.fit} onChange={(e) => setOpt('fit', e.target.checked)} />
              Fit to viewBox (±42)
            </label>
          </div>
        </div>

        {/* ── Result ── */}
        <div className="admin-trace-col">
          <h4 className="admin-subsection">Traced symbol</h4>
          <div className="admin-trace-preview">
            {result?.normalizedD ? (
              <svg viewBox="-50 -50 100 100" className="admin-trace-svg" aria-label="traced preview">
                <path d={result.normalizedD} fill="currentColor" fillRule="evenodd" />
              </svg>
            ) : (
              <span className="admin-hint">{busy ? 'Tracing…' : 'No trace yet.'}</span>
            )}
          </div>

          {error && <p className="admin-error">{error}</p>}

          {result?.normalizedD && (
            <>
              <label className="admin-label" style={{ marginTop: 10 }}>svgPath (d)</label>
              <textarea className="admin-input admin-trace-out" readOnly rows={5} value={result.normalizedD} />
              <div className="admin-train-actions" style={{ marginTop: 8 }}>
                <button className="admin-btn admin-btn-primary" onClick={() => copy(result.normalizedD, 'path')}>
                  {copied === 'path' ? 'Copied ✓' : 'Copy path'}
                </button>
                <button className="admin-btn" onClick={downloadSvg}>Download .svg</button>
                <button className="admin-btn admin-btn-ghost" onClick={() => copy(JSON.stringify({ svgPath: result.normalizedD, render: 'fill' }, null, 2), 'svg')}>
                  {copied === 'svg' ? 'Copied ✓' : 'Copy JSON fields'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
