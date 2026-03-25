https://creteeee.github.io/BoostEffectFontGenerator/

# BoostEffectFontGenerator

This project is a **local replica of STG Boost** (`spacetypegenerator.com/boost`). The UI, parameter panel, 3D glyph extrusion, and animation logic all come from the files you downloaded: `STG _v.Boost.html` / `STG _v.Boost_files/*` (migrated into this repository).

> Note: Your downloaded package **does not include** the original site's `boost_resources/` (fonts and the `transparency` background image). To match the visuals 1:1, you need to add those resources into this repo's `boost_resources/` folder (see `boost_resources/README.md`).

## Local preview

This is a static site, so you should run a local HTTP server (some browsers restrict `loadFont` when opened via `file://`):

```bash
# Example (from the project root)
npx --yes serve .
```

Open the printed URL in your browser.

## GitHub Pages

1. In the repo go to **Settings → Pages**: set **Source** to your deployment branch (e.g. `main`), and select **`/` (root)** as the folder.
2. Your site root will be `https://<username>.github.io/<repo>/`. This project uses **relative paths** everywhere, so no code changes are needed.

## Where to put fonts / how to change fonts (original replica layout)

- **Assets folder**: `boost_resources/`
- **How to add**: put font files (`.ttf` / `.otf`) and `transparency.png` into `boost_resources/`. File names must match the original ones.
- **Where the list is defined**: the original font loading logic is hardcoded in `preload()` inside `js/boost/sketch_boost.js` (e.g. `tFont[...] = loadFont("boost_resources/xxx.ttf")`).

## Code entry points

- **Page**: `index.html`
- **Styles**: `css/style.css`
- **Original scripts (local)**: `js/boost/*`
- **External dependencies (CDN)**: p5 / opentype / jquery / jquery-ui / h264 encoder (included in `index.html`)

