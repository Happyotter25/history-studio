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
npm test          # node tests/e2e.mjs — 12 Playwright tests, Claude API is mocked (SSE)
```
`CHROMIUM_PATH=/path/to/chromium npm test` uses a specific browser.
Headless Chromium renames non-ASCII download names to `download`; tests read the name
the app chose by wrapping `HS.download`.

## Layout
| Path | Role |
|---|---|
| `index.html` | Layout, all CSS, tab markup; script order matters (see bottom of file) |
| `assets/app.js` | `window.HS` namespace: project state + autosave (`hs.project`), utils, `HS.callClaude` |
| `assets/scriptgen.js` | Source → script. `HS.generateAI` (schema `HS.SCRIPT_SCHEMA`) and offline `HS.generateSimple` |
| `assets/board.js` | Board line syntax (`HS.parseBoardLine`), chalkboard background, `HS.drawBoardSlide` |
| `assets/scene-art.js` | Procedural mood backgrounds for scenes without an image (`HS.drawSceneArt`) |
| `assets/video.js` | Timeline, Ken Burns + crossfade + subtitles (`HS.drawVideoFrame`), `HS.recordCanvas` (MediaRecorder → WebM) |
| `assets/map.js` | Equirectangular map on Natural Earth coastlines, places, animated route arrows (`HS.drawMap`) |
| `assets/chalk.js` | Adaptive-threshold ink extraction + chalk texture (`HS.convertToChalk`) |
| `assets/export.js` | PPTX export via PptxGenJS: `HS.exportStoryPptx`, `HS.exportBoardPptx` |
| `assets/ui.js` | Wires tabs, inputs and buttons |
| `content/places.js` | Gazetteer (name, aliases, lon/lat, kind) used by offline map extraction — extend freely |
| `content/sample.js` | Sample source (임진왜란) |
| `content/geo.js` | **Generated** by `tools/vendor.mjs` (Natural Earth 1:50m, East Asia). Never edit by hand |
| `assets/vendor/*` | Vendored libraries (Anthropic SDK, PptxGenJS bundle) with licenses |
| `tools/vendor.mjs` | Copies PptxGenJS and builds `content/geo.js` from npm packages |
| `tools/screens.mjs` | Regenerates `docs/*.png` for README |
| `tests/e2e.mjs` | Playwright tests |

## Data model (`HS.project`, saved to `localStorage['hs.project']`, exported as backup JSON)
```
{ version, title, source, options:{length,audience,tone},
  scenes:[{heading, narration, visual, prompt, mood, motion, image(dataURL|null)}],
  board:[{title, text, drawing(dataURL|null), dw, dh}],
  map:{title, view([lon0,lat0,lon1,lat1]|null=auto), places:[{name,lon,lat,kind}], routes:[{from,to,label}]} }
```
mood ∈ dawn|day|dusk|night|war|sea|court|snow, motion ∈ zoomIn|zoomOut|panLeft|panRight,
kind ∈ capital|city|battle. Keep `HS.SCRIPT_SCHEMA` in sync when changing fields.

## Conventions
- Plain ES5-style browser JS, no frameworks or bundler. Must keep working from `file://`.
- UI text and comments are Korean (polite 해요체/합니다체 in the UI).
- `localStorage` keys are prefixed `hs.` (project, key, model, cost, tab). Backups never include `hs.key`.
- Keep the mobile layout free of horizontal overflow (tested).
- After visual changes, look at screenshots (`node tools/screens.mjs`), not just the tests.

## Ideas / next steps
- AI illustration: call an image-generation API with each scene's `prompt`, or generate SVG
  illustrations with Claude; parallax layers (foreground/background split) for more motion.
- Narration audio: TTS per scene and mux into the WebM (Web Speech cannot be recorded; needs an API).
- Map: historical borders per era (GeoJSON layers), region shading, per-scene map shots in the video.
- Board: step-by-step "writing" animation video of the board slides.
- Hand drawing: stroke smoothing / vectorizing so drawings can be animated as if drawn in chalk.
- Scene-level regeneration with Claude (rewrite one scene, shorten, change tone), fact-check pass with citations.
