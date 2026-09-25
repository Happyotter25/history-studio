# AGENTS.md — 사관 스튜디오 (history-studio) handover for coding agents

Read this first. The user-facing guide is `README.md` (Korean).

## What this is
A static web app that helps a Korean high-school history teacher make history YouTube videos.
Pipeline: source text → script (scenes) → animated illustration video (WebM), story PPTX,
historical map (PNG / WebM), blackboard-style PPTX, and hand drawing → chalk drawing.
Talk to the user in Korean. They prefer you to proceed without asking many questions.
This repo was started from the same author's 어전회의 (eojeon) project and follows its conventions.

## Run
- Open `index.html` directly in a browser (works from `file://`). No server, no build step.
- Optional AI mode: the user pastes an Anthropic API key in 설정. It is stored only in
  `localStorage` (`hs.key`) and is never written to project backups.
  Calls use the vendored Anthropic JS SDK (`assets/vendor/anthropic-sdk.js`, `window.AnthropicSDK`),
  streaming + structured output (`output_config.format` json_schema). Default model `claude-opus-5`
  with server-side refusal fallback (`fallbacks: 'default'`).

## Test (run before every commit)
```
npm install
npm test          # node tests/e2e.mjs — 26 Playwright tests, Claude API is mocked (SSE, routed by system prompt)
```
`CHROMIUM_PATH=/path/to/chromium npm test` uses a specific browser.
Headless Chromium renames non-ASCII download names to `download`; tests read the name
the app chose by wrapping `HS.download`.

## Layout
| Path | Role |
|---|---|
| `index.html` | Layout, all CSS, tab markup; script order matters (see bottom of file) |
| `assets/app.js` | `window.HS` namespace: project state + autosave to IndexedDB (`hs` db, `kv` store, key `project`; localStorage fallback), `HS.ready`, utils, `HS.callClaude` |
| `assets/scriptgen.js` | Source → script. `HS.generateAI` (schema `HS.SCRIPT_SCHEMA`), offline `HS.generateSimple`, `HS.rewriteScene`, `HS.factCheck` |
| `assets/board.js` | Board line syntax (`HS.parseBoardLine`), chalkboard background, `HS.drawBoardSlide` (with `progress` for the writing animation), `HS.boardChars` |
| `assets/scene-art.js` | Procedural mood backgrounds for scenes without an image (`HS.drawSceneArt`) |
| `assets/ai-art.js` | Claude-drawn SVG illustrations in 3 layers (`far/mid/near`) for parallax; `HS.cleanSvg` sanitizes (no script/image/text/external refs) |
| `assets/voice.js` | Per-scene narration audio (mic via MediaRecorder or file), `HS.playNarration` schedules it on the timeline (speakers or a MediaStream destination for recording) |
| `assets/video.js` | Timeline (voice length drives scene length), Ken Burns / SVG parallax / map scenes + crossfade + subtitles (`HS.drawVideoFrame`), `HS.recordCanvas` (MediaRecorder → WebM, optional audio) |
| `assets/map.js` | Equirectangular map on Natural Earth coastlines, regions (shaded polygons), places, animated route arrows (`HS.drawMap`, `HS.mapView`, `HS.mapUnproject`) |
| `assets/chalk.js` | Adaptive-threshold ink extraction + chalk texture (`HS.convertToChalk`), drawing-reveal animation (`HS.drawChalkReveal`), photo stroke tracing (`HS.traceStrokes`: Zhang-Suen thinning + nearest-next ordering) |
| `assets/export.js` | PPTX export via PptxGenJS: `HS.exportStoryPptx`, `HS.exportBoardPptx` |
| `assets/upload.js` | ⑧ tab: `HS.srt` (from `HS.subtitleCues`, same timing as burned-in subtitles), `HS.chapters`, `HS.generateUploadAI` / `HS.uploadSimple`, `HS.drawThumbnail`; wires its own UI |
| `assets/ui.js` | Wires tabs, inputs and buttons |
| `content/places.js` | Gazetteer (name, aliases, lon/lat, kind) used by offline map extraction — extend freely |
| `content/sample.js` | Sample source (임진왜란) |
| `content/geo.js` | **Generated** by `tools/vendor.mjs` (Natural Earth 1:50m, East Asia). Never edit by hand |
| `assets/vendor/*` | Vendored libraries (Anthropic SDK, PptxGenJS bundle) with licenses |
| `tools/vendor.mjs` | Copies PptxGenJS and builds `content/geo.js` from npm packages |
| `tools/screens.mjs` | Regenerates `docs/*.png` for README |
| `tests/e2e.mjs` | Playwright tests |

## Data model (`HS.project`, saved to IndexedDB, exported as backup JSON)
```
{ version, title, source, options:{length,audience,tone}, mapStyle,
  scenes:[{heading, narration, visual, prompt, mood, motion, useMap,
           image(dataURL|null), svg(string|null), audio(dataURL|null), audioDur}],
  board:[{title, text, drawing(dataURL|null), dw, dh}],
  map:{title, view([lon0,lat0,lon1,lat1]|null=auto), places:[{name,lon,lat,kind}], routes:[{from,to,label}],
       regions:[{name,color,points:[[lon,lat],...]}]},
  checks:{at, summary, items:[{scene(1-based), claim, verdict(ok|unsupported|wrong|debated), note, quote}]}|null,
  upload:{titles, description, tags, thumbTexts, pinned}|null, thumb:{scene, main, sub, color, layout}|null }
```
Scene picture priority: `useMap` → `image` → `svg` → procedural background.
Startup is async: wait for `HS.ready` (the UI sets `body[data-ready]` when done).
mood ∈ dawn|day|dusk|night|war|sea|court|snow, motion ∈ zoomIn|zoomOut|panLeft|panRight,
kind ∈ capital|city|battle. Keep `HS.SCRIPT_SCHEMA` in sync when changing fields.

## Conventions
- Plain ES5-style browser JS, no frameworks or bundler. Must keep working from `file://`.
- UI text and comments are Korean (polite 해요체/합니다체 in the UI).
- `localStorage` keys are prefixed `hs.` (key, model, cost, tab, format). The project itself lives in IndexedDB. Backups never include `hs.key`.
- Keep the mobile layout free of horizontal overflow (tested).
- After visual changes, look at screenshots (`node tools/screens.mjs`), not just the tests.

## Ideas / next steps
- Raster image generation via an external image API (needs another provider key) as an alternative to SVG art.
- Cloud TTS (e.g. a Korean TTS API) so narration can be generated instead of recorded.
- Prepared historical-border datasets per era instead of hand-drawn/AI-approximated regions.
- Photo drawings: vectorize (skeleton → strokes) so they animate stroke by stroke like pad drawings.
- MP4 is recorded natively when `MediaRecorder` supports it (setting `hs.format`); otherwise WebM. A WebM→MP4 converter would need ffmpeg.wasm (large).
- Thumbnail: face/character cut-outs, more layouts, A/B variants.
