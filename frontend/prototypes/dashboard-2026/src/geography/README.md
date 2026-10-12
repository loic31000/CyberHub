# Local geographic artwork

Source: Natural Earth, 1:110m land polygons, downloaded 2026-10-12.

- Data: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
- License: public domain — https://www.naturalearthdata.com/about/terms-of-use/
- Original file SHA-256: `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`

`generate.py` produces the local `earth.svg` using an orthographic projection centered at 12°W, 24°N. Coastlines come from the source coordinates; dots are sampled inside actual land polygons, excluding holes. Horizon visibility clips line segments. This illustration is not intended as a navigation map.

Regenerate with `python src/geography/generate.py` from the prototype directory. No network or third-party Python package is used for generation. The browser loads only the resulting local SVG; no geographic service or runtime mapping library is needed.

NetworkGlobe overlays illustrative routes between geographic city coordinates. These routes, nodes and counters do not represent actual traffic. CSS animates eight particles and a few local halos; reduced motion disables both.
