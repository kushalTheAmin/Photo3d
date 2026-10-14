# Universal Play: Video Play Browser

Paste any video link or webpage URL and it plays. The app looks at the link and picks a playback engine:

| Link type | Engine |
| --- | --- |
| `.mp4` `.webm` `.ogg` `.mov` `.mkv` | HTML5 `<video>` with custom controls |
| `.m3u8` (HLS) | [hls.js](https://github.com/video-dev/hls.js) (native HLS on Safari) |
| `.mpd` (MPEG-DASH) | [dash.js](https://github.com/Dash-Industry-Forum/dash.js) |
| YouTube, Vimeo, Twitch, Dailymotion, Streamable | Embedded player with clutter removed (watch links, short links and embed links all work) |
| Any other webpage | Sandboxed built-in browser with a video sniffer |

The app has two parts: a React + Tailwind frontend (Vite) and a small Node/Express **proxy server**. The proxy is required. Browsers do not let page JavaScript set `Referer`, `User-Agent` or `Cookie`, and they do not let it read cross-origin streams that lack CORS headers. Only a server-side relay can do those things.

---

## Quick start

Requirements: **Node.js 18.17+** (20 or 22 recommended).

```bash
cd video-player
npm install
npm run dev
```

Open **http://localhost:5173**. `npm run dev` starts two processes:

- the Vite dev server on `:5173`, which forwards `/api/*` to the proxy, and
- the proxy server on `:8787`, which restarts when you edit a file.

### Production

```bash
npm run build        # type-check + bundle into dist/
npm start            # one Node process serves dist/ and /api on :8787
```

Open **http://localhost:8787**.

### Docker

```bash
docker build -t universal-play .
docker run -p 8787:8787 universal-play
```

### Tests

```bash
npm test             # 50 unit + integration tests (detection, subtitles, diagnostics, proxy server)
npm run typecheck
```

The proxy integration tests start a real upstream HTTP server. They check HLS rewriting, text/plain playlist detection, redirects, `Range` passthrough, custom header injection, probing, the sandboxed page proxy and the server-side sniffer.

---

## Configuration

Copy `.env.example` to `.env`, or set these variables in your shell:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | Port for the proxy and production server |
| `ALLOW_PRIVATE_NETWORKS` | `0` | Set to `1` so the proxy can reach LAN or localhost media (Jellyfin, Plex, a NAS). **Leave it at `0` on anything internet-facing.** |
| `MAX_TEXT_BYTES` | `8388608` | Largest manifest or HTML page the proxy will buffer for rewriting or sniffing |
| `UPSTREAM_TIMEOUT_MS` | `20000` | Timeout for upstream requests |
| `VITE_PROXY_BASE` | `/api` | Build-time default proxy endpoint, for when the frontend is hosted separately from the proxy. You can also change it at runtime in **Advanced Stream Options**. |

---

## Features

### Link input
- **Paste & Play** reads the clipboard with `navigator.clipboard.readText()`.
- **Ctrl/⌘ + V anywhere** outside a text field plays the pasted link.
- **Drag and drop** works for links, local video files, and `.srt` / `.vtt` subtitle files.
- **Deep links:** `http://localhost:8787/?url=<encoded link>` opens a link directly.
- **Auto-detection order:** manual override → known platform domain → file extension → MIME type from a server-side probe → webpage. Use the mode dropdown to force a specific engine.

### Network, CORS and restricted streams
- **Advanced Stream Options** drawer: `Referer`, `Origin`, `User-Agent` (with presets), `Authorization`, `Cookie`, and any extra `X-*` headers. The proxy adds them on the server side.
- **Path-based proxy:** URLs look like `/api/p/<headers-token>/https/host/dir/file.m3u8`. Because the upstream folder structure is kept, relative segment URLs resolve correctly. HLS playlists are rewritten line by line, including `URI="…"` attributes such as AES keys, alternate audio and subtitles. DASH manifests get a proxied `<BaseURL>`. Redirects are followed and checked one hop at a time.
- **Failure diagnosis:** when playback fails, the proxy probes the same URL to get the real HTTP status, which the browser hides behind CORS errors. You then see one of these results, with one-click recovery actions:
  - CORS Blocked → *Route via CORS proxy*
  - Mixed Content → *Route via CORS proxy*
  - Access Forbidden (403) → *Retry with page Referer*
  - Expired / Invalid Token → *Re-extract from page*
  - Geo-restricted (451 or geo wording) → *proxy / fallback iframe*
  - Unsupported Codec (HEVC/AC3) or Unsupported Container (.mkv) → *open original*
  - DRM, 404, 5xx, DNS, timeout, Proxy offline, Wrong engine → *Play as HLS/DASH/file*
- **Auto-retry via proxy** is an option that retries silently when a stream is CORS-blocked.
- **Fallback iframe mode** frames the original URL directly. The browser's built-in player can often play a file there even without CORS.

### Built-in browser and video sniffer
- **Proxied + Sniffer** (the default for webpages): the proxy fetches the page, strips `X-Frame-Options` and CSP, adds a `<base>` tag, and injects a small sniffer script. The page then runs in `sandbox="allow-scripts allow-forms …"`, which gives it **no** `allow-same-origin`, `allow-popups` or `allow-top-navigation`. It gets an opaque origin, cannot open popups, and cannot redirect the app. The response also carries `Content-Security-Policy: sandbox …`, so the page stays sandboxed even if someone opens the proxy URL directly.
- The sniffer reports media found in `<video>`/`<source>` tags, `og:video` meta tags, links, **XHR and `fetch()` calls**, and `PerformanceObserver` resource entries. That last source catches streams loaded by players built on MSE. Clicks on links inside the page navigate through the proxy, with back/forward history.
- **Extract / Sniff Video** also runs a server-side scan of the raw HTML. It catches JSON-escaped URLs inside inline scripts, JSON-LD, and embedded YouTube/Vimeo iframes.
- Every result has a **Play** button and a **Proxy + Referer** button. The second sends the page as `Referer`/`Origin`, which gets past most hotlink protection.
- **Direct** mode frames the real site, sandboxed, with nothing injected. Use it for sites that allow embedding but break when loaded through the proxy.

### Player
- Play/pause, a seek bar with a hover time tooltip and a **thumbnail preview** (direct files), and a buffered-range bar.
- **Volume up to 200%** through Web Audio (gain → limiter). Boost needs CORS-readable audio, so direct files are first tried with `crossOrigin="anonymous"`. If that fails the file still plays, but boost is capped at 100% and you are told to route through the proxy.
- **Speed** from 0.25× to 4×.
- **Aspect ratio:** Fit, Fill/Crop, 16:9 or 4:3.
- **Theater mode**, **fullscreen** and **Picture-in-Picture**.
- **Quality / bitrate** switching (Auto shows the level currently playing), **multi-audio** tracks, and in-stream **HLS/DASH subtitles**.
- **Local subtitle files:** `.srt` is converted to WebVTT as it loads, with a sync offset adjustable in ±0.1 s and ±1 s steps.
- **Live streams** show a LIVE badge and a jump-to-live-edge button.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` / `K` | Play / pause |
| `←` / `→` | Seek 5 s |
| `J` / `L` | Seek 10 s |
| `↑` / `↓` | Volume ±5 % (up to 200 %) |
| `M` | Mute |
| `F` | Fullscreen |
| `P` | Picture-in-Picture |
| `T` | Theater mode |
| `C` | Toggle subtitles |
| `<` / `>` | Slower / faster |
| `0`–`9` | Jump to 0–90 % |
| `/` | Focus the URL bar |
| `?` | Shortcut help |

### History, resume and playlists
- History is stored in `localStorage`. Each entry keeps its last position, duration, play count and, for platform links, an oEmbed title and thumbnail.
- **Resume:** reopening a link continues from where you stopped and shows a *Start over* button. This also works for YouTube and Vimeo embeds, which report their position through their postMessage APIs.
- **Bookmarks and playlists:** create, rename, delete and reorder playlists, and *Play all*. When an item finishes, the next one starts automatically, including for YouTube and Vimeo embeds.
- **Export / import** the whole library as JSON.
- Custom headers, including Cookie and Authorization, are kept in memory only and are **never** saved to disk.

---

## Architecture

```
video-player/
├── server/                  Node proxy (Express, no build step)
│   ├── index.js             createApp(): /api routes + static dist/
│   ├── routes.js            /api/p/* proxy, /api/probe, /api/sniff, /api/page, /api/oembed
│   ├── upstream.js          http(s) client: manual redirects, decompression, bounded reads
│   ├── netguard.js          SSRF guard (private-IP check in the DNS lookup of every hop)
│   ├── manifest.js          path-proxy mapping + HLS / DASH rewriting
│   ├── sniff.js             static HTML video sniffer
│   ├── sniffer-client.js    script injected into proxied pages
│   └── token.js             header token encode/decode + sanitizing
├── src/
│   ├── lib/                 detection, platforms, proxy URLs, diagnostics, subtitles, controller
│   ├── engines/             PlaybackEngine interface: native / hls.js / dash.js (lazy-loaded)
│   ├── store/               zustand: session (in memory) + library (persisted)
│   ├── hooks/               global paste/drag-drop, keyboard shortcuts
│   └── components/          Header, AdvancedOptions, Sidebar, BrowserView, SniffPanel,
│                            EmbedPlayer, player/{VideoPlayer, Controls, SeekBar, SettingsMenu, ErrorOverlay}
└── tests/                   vitest suites (jsdom for UI logic, node for the server)
```

Things to know about the design:
- Every link goes through one entry point, `openUrl()` in `src/lib/controller.ts`. It handles detection, the resume position and history recording. Recovery actions reopen the link with changed options, for example `useProxy`, new headers or a different engine.
- The player component is keyed by `loadId`, so each load gets a fresh `<video>` element. This is necessary because a Web Audio `MediaElementSource` can never be detached from an element.
- hls.js and dash.js are split into separate chunks with dynamic `import()`. A plain MP4 loads about 86 kB of gzipped JS instead of about 450 kB.

---

## Security notes

- Without `ALLOW_PRIVATE_NETWORKS=1`, the proxy refuses loopback, private, link-local, CGNAT and multicast addresses. The check runs inside the socket's DNS `lookup` on every connection and redirect hop, so DNS rebinding cannot get around it.
- Only `http:` and `https:` targets are allowed. Hop-by-hop headers and CRLF characters are removed from custom headers.
- Proxied pages are sandboxed twice, by the iframe `sandbox` attribute and by a CSP `sandbox` response header, so they cannot read app storage or reach the parent window.
- The proxy relays whatever it is asked to fetch. On a public deployment, put it behind authentication or rate limiting.

## Limitations

- **DRM** streams (Widevine, PlayReady, FairPlay) cannot play outside their own sites. The app detects them and suggests opening the original page.
- **Codecs** depend on the browser. HEVC, AC3/E-AC3 and DTS are often not supported, and the error screen says so.
- Some sites only work when loaded from their own origin. For those, use **Direct** mode or open the original page.
- When you run builds inside the parent Photo3D repo without its Expo dependencies installed, esbuild prints a harmless warning about `expo/tsconfig.base`. It comes from the parent project's `tsconfig.json` and does not affect this app.
