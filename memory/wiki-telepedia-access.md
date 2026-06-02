---
name: wiki-telepedia-access
description: How to fetch the Witch Hat Atelier telepedia wiki (the source of most project data) when WebFetch fails
metadata:
  type: reference
---

The fan wiki at `https://witchhatatelier.telepedia.net/wiki/` is the proximate source of **most data in this project** (spell recipes, signs, sigils, dyes) — hence `origin: "wiki"` on that data. See [[provenance-origin-source]].

**WebFetch and the Defuddle skill return HTTP 402** on telepedia (bot block). To read a page, fetch with `curl` using a desktop browser User-Agent:

```bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
curl -sS -L -A "$UA" -o /tmp/page.html "https://witchhatatelier.telepedia.net/wiki/<Slug>"
```
This returns HTTP 200. Slugs use underscores and %-encoding (e.g. `Qifrey%27s_Water_Dragon`, `Serpent%27s_Bed_of_Sand`). MediaWiki serves 200 even for missing pages — detect stubs by checking the HTML for `noarticletext` / "currently no text in this page".

**Windows /tmp gotcha:** in the Bash tool, `/tmp` resolves to `C:\Users\Pichau\AppData\Local\Temp`, but Node launched from Bash reads `/tmp` as `C:\tmp`. When parsing the saved HTML in a Node script, use `os.tmpdir()` (matches Bash's /tmp) or pass `cygpath -w` paths — don't hand Node a `/tmp/...` literal.

**Key reference pages** (general system data): `Magic`, `Spells` (the navbox lists canonical spell names + which are "[unofficial name]"), `Signs_Explained`, `Sigils_Explained`, `Forbidden_Magic`, `Magical_Dye`. Each catalogued spell also has its own page (`/wiki/<Spell_Name>`), with Japanese name, Manga Debut chapter, recipe description, and usage — good for filling `source` citations.
