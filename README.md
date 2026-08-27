# The Closet

A modernist, mobile-first personal wardrobe app — photograph and organise your
wardrobe, get outfit suggestions guided by a taste-learning "Fashion IQ"
engine (never randomness), plan outfits around events, and manage your own
categories/tags. Implemented from a Claude Design handoff as a dependency-free
static site (HTML/CSS/vanilla JS, ES modules).

## Running it

Any static file server works, e.g.:

```
npx serve .
# or
python3 -m http.server 8080
```

Then open the printed URL in a browser.

## Data & photos

Everything is local-first: wardrobe items, photos, favourites, wear counts,
Fashion IQ ratings, planned outfits, and taxonomy are stored in the browser's
IndexedDB. Settings → Wardrobe data has Export/Import backup (JSON, with
photos embedded as base64) for moving data between devices or browsers.

## Structure

- `index.html` — app shell
- `styles.css` — full visual system (Archivo + Instrument Serif, paper/ink/
  vermilion palette, responsive breakpoints for phone/tablet/desktop)
- `js/constants.js` — taxonomy, outfit slot definitions, Fashion IQ pair list
- `js/state.js` — app state + business logic (outfit picking, wear counting,
  Fashion IQ scoring, wizard, taxonomy management)
- `js/db.js` — IndexedDB wrapper (app state + photo blobs)
- `js/photos.js` — photo blob → object URL cache
- `js/backup.js` — export/import backup
- `js/render.js`, `js/dom.js`, `js/icons.js` — DOM rendering
- `js/main.js` — bootstrap, focus-preserving re-render, file input wiring
