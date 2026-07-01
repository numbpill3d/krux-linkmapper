# krux linkmapper

terminalcore link mapper. crawl any url, watch it bloom into a force-directed graph of 88x31 retro badges. hover to preview pages. double-click to expand deeper. cursed links shake.

![screenshot](https://raw.githubusercontent.com/numbpill3d/krux-linkmapper/main/.github/screen.png)

## quick start

```bash
# one-shot install (arch/debian)
./install.sh

# or manual
pip install -e .
pip install pywebview  # optional: dedicated window

# run
krux
```

opens a dedicated gtk window by default (pywebview + webkit2gtk).  
if webview is unavailable, falls back to chrome/firefox app mode, then xdg-open.

```
krux --no-webview    # force browser mode
krux --version       # show version
```

## usage

1. enter a url in the prompt
2. set crawl depth (1-3)
3. hit scan
4. watch the graph populate
5. hover any badge to preview that page
6. double-click a badge to expand that node's links
7. dump .dot to export as graphviz
8. the spell button opens a ritual circle visualization of the crawl

click a badge to open the url. zoom and pan with scroll/drag.

## api

```json
post /api/crawl   { "url": "...", "depth": 1, "max_links": 100 }
get  /api/status/{session_id}
get  /api/graph/{session_id}
post /api/expand  { "session_id": "...", "node_url": "..." }
get  /api/proxy?url=...
get  /api/sessions
```

## features

- **async crawler** - aiohttp, respects robots.txt, rate-limited per domain
- **cursed detection** - marks dead/slow/tiny pages; cursed nodes shake
- **recursive expansion** - start shallow, expand nodes deeper on demand
- **88x31 badges** - retro web button aesthetic, generated live on canvas
- **crtscanlines** - because every terminalcore app needs them
- **dot export** - graphviz dump of the entire crawl
- **ritual circle viz** - occult data visualization for the spell enthusiasts
- **zoom + pan** - d3 force graph with scrollwheel zoom

## project

```
krux-linkmapper/
├── server/
│   ├── main.py       # fastapi endpoints
│   ├── crawler.py    # async web crawler
│   ├── cli.py        # cli entry point (webview + fallback)
│   └── config.py     # port, depth caps, user-agent
├── client/
│   ├── index.html    # entry point
│   ├── style.css     # crt terminal aesthetic
│   ├── app.js        # main app logic + event wiring
│   ├── graph.js      # d3 force graph with zoom/pan
│   └── renderer.js   # 88x31 badge canvas + spell viz
├── install.sh        # one-shot setup (system deps + pip)
├── pyproject.toml
└── requirements.txt
```

## depends on

- python 3.11+
- fastapi, uvicorn, aiohttp
- d3@7 (loaded from cdn by the client)
- optional: pywebview (for native window)

system deps for pywebview on arch: `webkit2gtk`, `gobject-introspection`, `libsoup3`
