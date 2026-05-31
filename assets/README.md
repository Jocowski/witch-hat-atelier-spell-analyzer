# assets/

Shared images and static media used by **both** the app and the docs.

Drop reusable files here (logos, diagrams, screenshots, shared glyph art) so
there's a single source of truth instead of copies under `src/` and `docs/`.

Suggested layout:

```
assets/
  images/      # raster art (.webp / .png / .jpg)
  icons/       # small UI / svg icons
```

## Referencing assets

**From the app (Vite, `src/`)** — import the file so it gets hashed and bundled:

```jsx
import logo from '../../assets/images/logo.webp'

<img src={logo} alt="Spell Analyzer" />
```

(The dev server can already read outside `src/` — see `fs.allow` in
[vite.config.js](../vite.config.js).)

**From the docs (markdown in `docs/`)** — use a relative path:

```md
![Spell Analyzer](../assets/images/logo.webp)
```

## Conventions

- Prefer `.webp` for art (consistent with the existing `docs/**/images/`).
- Keep glyph/sigil SVGs that are part of the *engine data* in `data/*.json`
  (the `svgPath` fields) — this folder is for standalone image files, not
  data-driven shapes.
