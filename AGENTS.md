# AGENTS.md — 사관 스튜디오 (history-studio) handover for coding agents

Read this first. It is written for any coding agent — OpenAI Codex (CLI / cloud), Claude Code
(`CLAUDE.md` points here), or others. The user-facing guide is `README.md` (Korean); the user's guide
to connecting Codex is `docs/CODEX.md`.

## Start here: the work log
Codex and Claude Code take turns on this project. **Before you start, read `docs/HANDOFF.md`** (newest entry first:
what was done, what is verified / not verified, what is next). **Before you finish, add one entry at the top of its
"기록" section** in the template given there — in Korean, short and factual, separating what you verified from what you
could not (mocked-only counts as not verified), and listing concrete next steps. Commit it with your work.
Never rewrite older entries; correct them in a new entry.

## Working agreement (all agents)
- Talk to the user in Korean, plainly (they are a history teacher, not a developer). Proceed without many questions.
- Before every commit: `npm run check` (syntax, offline) and `npm test` (Playwright end-to-end). Both must pass.
  If Chromium cannot be installed in your sandbox, run `npm run check`, say that `npm test` could not run, and why.
- After visual changes, regenerate and look at screenshots (`npm run screens`), not just the tests.
- Never commit API keys. Keys live only in the browser's `localStorage` (`hs.key`, `hs.imgKey`) and are excluded from backups.
- Don't edit generated/vendored files by hand: `content/geo.js`, `assets/vendor/*`.
- Keep `README.md` (Korean, for the user) and this file in sync when you add features or change the data model.
- Work on a branch and let the user merge; `main` is what the user downloads as ZIP.
- One agent at a time: before starting, make sure the previous agent's work is merged into `main` and pull it.
  If `docs/HANDOFF.md`'s newest entry mentions an unmerged branch, tell the user before building on top of it.

## What this is
A static web app that helps a Korean high-school history teacher make history YouTube videos.
Primary workflow: narration → Codex semantic scene boundaries → human split/merge review → one slide per scene (text/board/image) → human approval → PNG/PPT.
Legacy material workflow remains: finished narration → editable material proposal → explicit user confirmation →
local Codex CLI generation/preview or subscription image order/import, separate illustration/map/quote/comparison/board PNG ZIPs, story PPTX and board PPTX.
The user prefers Codex/ChatGPT subscriptions, not paid API automation. Do not rewrite finished narration or generate
all illustrations before the proposal is confirmed. Video rendering is a secondary legacy tool.
General proposals use local paragraph/quote/place rules, not AI reasoning; the provided Myeongnyang script has a curated example plan.
Optional subscription planning handoff exports an editable plan JSON + instructions and validates returned identity/types before import.
Talk to the user in Korean. They prefer you to proceed without asking many questions.
This repo was started from the same author's 어전회의 (eojeon) project and follows its conventions.

## Run
- Open `index.html` directly in a browser (works from `file://`). No build step. Local CLI image generation uses the optional server described below.
- Optional AI mode: the user pastes an Anthropic API key in 설정. It is stored only in
  `localStorage` (`hs.key`) and is never written to project backups.
  Calls use the vendored Anthropic JS SDK (`assets/vendor/anthropic-sdk.js`, `window.AnthropicSDK`),
  streaming + structured output (`output_config.format` json_schema). Default model `claude-opus-5`
  with server-side refusal fallback (`fallbacks: 'default'`).

## Setup and test
```
npm run setup     # npm install + npx playwright install chromium (needs internet)
npm run check     # syntax of every script + index.html script list (offline, a second)
npm test          # node tests/e2e.mjs — 83 Playwright tests (Chromium runs with a fake microphone);
                  # Claude / OpenAI / Gemini / YouTube oEmbed are all mocked, so no keys or network are needed
```
Codex sandboxes usually have no network while the agent runs: do `npm run setup` in the environment's setup
step (Codex cloud: environment setup script), or point `CHROMIUM_PATH` at an installed Chromium.
`CHROMIUM_PATH=/path/to/chromium npm test` uses a specific browser.
Headless Chromium renames non-ASCII download names to `download`; tests read the name
the app chose by wrapping `HS.download`.

## Layout
| Path | Role |
|---|---|
| `index.html` | Layout, base CSS, tab markup; script order matters (see bottom of file) |
| `assets/app.js` | `window.HS` namespace: project state + multiple projects in IndexedDB (`hs` db, `kv` store: `projects` index, `current`, `project:<id>`, undo `history:<id>`; migrates the old single `project`/`history` keys; localStorage fallback), `HS.ready`, `HS.openProject/newProject/addProject/duplicateProject/deleteProject`, undo snapshots (`HS.snapshot`/`HS.restoreSnapshot`, last 10 per project), utils, `HS.callClaude` (SDK `maxRetries: 4`, `HS.cancelAI` aborts active streams, `HS.whyFail` maps status codes to Korean messages) |
| `assets/scriptgen.js` | Source → script. `HS.generateAI` (schema `HS.SCRIPT_SCHEMA`), offline `HS.generateSimple`, `HS.rewriteScene`, `HS.factCheck`; `HS.userContent` puts attached PDFs/images first as document/image blocks with `cache_control` on the last one, then `<source>`, then reference videos (`<reference_video>` = facts, rewritten not copied; `<style_reference>` = structure/tone only); `HS.cleanTranscript` cleans pasted YouTube transcripts; `HS.YT_ID` |
| `assets/board.js` | Board line syntax (`HS.parseBoardLine`), chalkboard background, `HS.drawBoardSlide` (with `progress` for the writing animation), `HS.boardChars` |
| `assets/scene-art.js` | Procedural mood backgrounds for scenes without an image (`HS.drawSceneArt`) |
| `assets/scene-kinds.js` | History scene types drawn instead of a picture: `source` (scroll, original text written vertically + translation + citation), `timeline`, `people` (relationship diagram), `compare` (two-column table). `HS.drawDataScene(ctx,w,h,scene,k)` animates by progress k; `HS.sceneKind`, `HS.needsPicture`, `HS.kindToText/textToKind` (editor line formats) |
| `assets/shots.js` | Core image feature. Shot lists per scene (`scene.shots`), art style + cast sheet (`project.art`), `HS.planShotsAI` / `HS.planShotsSimple`, `HS.shotPrompt` (style + shot + cast looks + aspect + no-text), `HS.shotStarts`/`HS.drawShots` (switch shots at narration sentences, crossfade), map shots drawn with the illustrated map, image order sheet ZIP for Codex/ChatGPT (`HS.exportImageOrder`, file names `S03-2_<id>.png`), `HS.importShotFiles` (match by file name), `HS.setShotImage` (previous image kept in `shot.candidates`, max 6), `HS.pickCandidate`, `HS.revisePrompt(shot, feedback)` (Claude rewrites the English prompt from Korean feedback), order-sheet modes `missing|all|redo|selected` |
| `assets/queue.js` | Image queue (`HS.Q`, `HS.enqueueShots(ids, variants)`, `HS.queueStart/Pause/RetryFailed/ClearDone/SetConcurrency`, `HS.queueIdle`): concurrency 1–3, retries 429/5xx twice, pauses everything on 401/403. In-memory per window |
| `assets/shots-ui.js` | 🎨 이미지 tab (style, cast, plan, order sheet, import, shot board) |
| `assets/image-gen.js` | Raster scene images from OpenAI (`/v1/images/generations`, default `gpt-image-1`) or Google Gemini (`generateContent` with `responseModalities: ['IMAGE']`, default `gemini-2.5-flash-image`); key in `hs.imgKey`; `HS.drawSceneImage(i)` → `scene.image` |
| `assets/ai-art.js` | Claude-drawn SVG illustrations in 3 layers (`far/mid/near`) for parallax; `HS.cleanSvg` sanitizes (no script/image/text/external refs) |
| `assets/voice.js` | Per-scene narration audio (mic via MediaRecorder or file), `HS.playNarration` schedules voices + background music (gain curve `HS.bgmGainAt`: fade in/out, ducking under `HS.voiceSpans`) on the timeline (speakers or a MediaStream destination for recording) |
| `assets/video.js` | Timeline (voice length drives scene length), `HS.frameSize` (16:9 or 9:16 from `project.aspect`), Ken Burns / SVG parallax (cover-fit) / map scenes, transitions (fade/ink/wipe/cut), captions (lower-third name tags), subtitles (`HS.drawVideoFrame`), `HS.recordCanvas` (MediaRecorder → WebM, optional audio) |
| `assets/map.js` | Equirectangular map on Natural Earth coastlines, regions (shaded polygons), places, animated route arrows (`HS.drawMap`, `HS.mapView`, `HS.mapUnproject`) |
| `assets/chalk.js` | Adaptive-threshold ink extraction + chalk texture (`HS.convertToChalk`), drawing-reveal animation (`HS.drawChalkReveal`), photo stroke tracing (`HS.traceStrokes`: Zhang-Suen thinning + nearest-next ordering) |
| `assets/export.js` | PPTX export via PptxGenJS: `HS.exportStoryPptx`, `HS.exportBoardPptx` |
| `assets/character.js` | "My characters": `HS.makeSticker` (removes only paper connected to the border via flood fill, optional chalk/outline), `HS.addCharacter`, `HS.drawSceneCharacter` (enter, bob, bounce while speaking) |
| `assets/package.js` | `HS.exportAll` (JSZip from the PptxGenJS bundle → one ZIP with everything), one-click pipeline `HS.runPipeline` / `HS.stopPipeline` / `HS.estimateCost` |
| `assets/lesson.js` | ⑨ tab: `HS.generateLessonAI` / `HS.generateLessonSimple`, `HS.worksheetHtml(teacher)` (print-ready HTML), `HS.exportQuizPptx` (question → answer slides); wires its own UI |
| `assets/upload.js` | ⑧ tab: `HS.descriptionSuffix` (chapters + `HS.referencesText`, appended to the description and stripped when edited), `HS.srt` (from `HS.subtitleCues`, same timing as burned-in subtitles), `HS.chapters`, `HS.generateUploadAI` / `HS.uploadSimple`, `HS.drawThumbnail`; wires its own UI |
| `assets/materials.js` | Finished-script material planning (`proposeMaterials`, `confirmMaterials`, `materialApproved`), validated subscription plan JSON round-trip, separate 1920×1080 PNG ZIP exports. `project.materials` keeps the original script, plannedScript, proposal groups, method and an approval fingerprint. Each group has id, selected, title, text (immutable excerpt), kind, count, brief, board, detail, cite, places. Approval replaces scenes/board with strict undo snapshot; scenes carry materialId/materialPlaces. Images keep IDs/candidates on reapproval and changed prompts are marked redo. Map exports use registered locations without inferred routes. |
| `assets/materials-ui.js` | Material planning workflow UI: review/edit/confirm, subscription order/import and individual PNG/PPT download actions. Outputs blocked for stale or unconfirmed plans. |
| `content/material-sample.js` | User-provided complete Myeongnyang narration; preserved as input, not fact-checked historical claims. |
| `assets/ui.js` | Wires tabs, inputs and buttons |
| `assets/scene-edit.js` | `HS.editScenes(action,index,value,options)` for split-at-cursor, merge-next, move, delete. Requires a successful undo snapshot (`HS.snapshot(label,true)`); remaps thumbnail, check and quiz scene references. Split/merge reset duration and invalidate checks; recorded audio is removed only with `resetAudio` consent from the UI. Split copies continuing shots with new IDs; merge connects illustration shots, freezes SVG/procedural backgrounds as stills, and keeps first-scene kind/data/character/transition. Blocks edits during running image queue jobs and rejects concurrent stale edits. |
| `content/places.js` | Gazetteer (name, aliases, lon/lat, kind) used by offline map extraction — extend freely |
| `content/sample.js` | Sample source (임진왜란) |
| `content/geo.js` | **Generated** by `tools/vendor.mjs` (Natural Earth 1:50m, East Asia). Never edit by hand |
| `assets/vendor/*` | Vendored libraries (Anthropic SDK, PptxGenJS bundle) with licenses |
| `tools/vendor.mjs` | Copies PptxGenJS and builds `content/geo.js` from npm packages |
| `tools/screens.mjs` | Regenerates `docs/*.png` for README |
| `tests/e2e.mjs` | Playwright tests |

## Data model (`HS.project`, saved to IndexedDB, exported as backup JSON)
```
{ version, id, title, materials(null|{script,plannedScript,groups[],approved,method}), aspect('16:9'|'9:16'), source, sourceFiles:[{name, mediaType, data(base64), size}], refs:[{id, title, url, channel, transcript, role(fact|style)}], options:{length,audience,tone}, mapStyle,
  bgm:{name, data(dataURL), dur, volume, duck}|null,
  art:{style(webtoon|ink|oil|textbook|minhwa|docu), extra, cast:[{name, look}]},
  scenes:[{materialId(optional), materialPlaces(optional), heading, narration, visual, prompt, mood, motion, shots:[{id(4 chars), type(wide|scene|portrait|closeup|map), desc, prompt, sentence, places[], image, candidates[], redo, feedback}], kind(illust|map|source|timeline|people|compare), useMap(= kind is map),
           data:{original, translation, cite, events[{year,label}], people[{name,role}], links[{from,to,label}], left, right, rows[{label,left,right}]},
           caption, transition(fade|ink|wipe|cut), keywords[] (yellow in subtitles), character:{id, side}|null,
           image(dataURL|null), svg(string|null), audio(dataURL|null), audioDur, dur(seconds override|null)}],
  board:[{title, text, drawing(dataURL|null), dw, dh}],
  map:{title, view([lon0,lat0,lon1,lat1]|null=auto), places:[{name,lon,lat,kind}], routes:[{from,to,label}],
       regions:[{name,color,points:[[lon,lat],...]}]},
  checks:{at, summary, items:[{scene(1-based), claim, verdict(ok|unsupported|wrong|debated), note, quote}]}|null,
  upload:{titles, description, tags, thumbTexts, pinned}|null, thumb:{scene, main, sub, color, layout}|null,
  characters:[{id, name, image(PNG dataURL), w, h}],
  lesson:{goals, quiz:[{type(choice|ox|short), question, choices, answer, explain, scene}], summary('[[key]]' marks blanks), activity:{title, steps}, discussion}|null }
```
Scene picture priority: data scene kinds → shots that are ready (image, or map) → `useMap` → `image` → `svg` → procedural background.
Map styles: `illust` (default; base layer cached per view), `old`, `modern`, `board`.
The user generates images with a ChatGPT/Codex subscription via the order sheet, because a browser page cannot use subscription accounts; keep that flow working (file names are the contract).
Startup is async: wait for `HS.ready` (the UI sets `body[data-ready]` when done).
mood ∈ dawn|day|dusk|night|war|sea|court|snow, motion ∈ zoomIn|zoomOut|panLeft|panRight,
kind ∈ capital|city|battle. Keep `HS.SCRIPT_SCHEMA` in sync when changing fields.

Drawing code sizes things by `Math.min(w, h) / 720` so the same code serves 16:9, 9:16 and small thumbnails.

## Conventions
- Plain ES5-style browser JS, no frameworks or bundler. Must keep working from `file://`.
- UI text and comments are Korean (polite 해요체/합니다체 in the UI).
- `localStorage` keys are prefixed `hs.` (key, model, cost, tab, format, imgProvider, imgKey, imgModel). The project itself lives in IndexedDB. Backups never include `hs.key`.
- Keep the mobile layout free of horizontal overflow (tested).
- `.btn` sets `display`, so a global `[hidden]{display:none !important}` keeps the `hidden` attribute working.
- After visual changes, look at screenshots (`node tools/screens.mjs`), not just the tests.

## Ideas / next steps
- Long video → Shorts extraction (pick the best 60 s, re-cut to 9:16).
- Curriculum (2022 개정 교육과정 성취기준) based series planning.
- Classroom presentation mode (step through scenes, board writing, quiz reveal).
- Cloud TTS (e.g. a Korean TTS API) so narration can be generated instead of recorded.
- Prepared historical-border datasets per era instead of hand-drawn/AI-approximated regions.
- Photo drawings: vectorize (skeleton → strokes) so they animate stroke by stroke like pad drawings.
- MP4 is recorded natively when `MediaRecorder` supports it (setting `hs.format`); otherwise WebM. A WebM→MP4 converter would need ffmpeg.wasm (large).
- Thumbnail: face/character cut-outs, more layouts, A/B variants.

## Local Codex image bridge
- Optional: `npm start` or macOS `사관 스튜디오 실행.command`. Node server binds 127.0.0.1:4318 and serves the same app. File-origin projects must be backed up/imported on the HTTP origin.
- `tools/studio-server.mjs`: same-origin token/Host checks, fixed CLI arguments (no shell), isolated temporary job directory, serial jobs, timeout/cancel, PNG validation and local `output/codex-images/` archive. Uses ChatGPT login and ignores user config/API-key environment variables; no paid API fallback. Native image-tool availability varies by CLI. CLI JSONL does not reliably expose native image calls, so PNG validation is not proof of image provenance.
- `assets/codex-cli.js`: confirmed material plan only; one/all missing/redo images, progress, previews, auto-attach guarded by project object/shot ID/prompt/image/approval. Reload interrupts polling; archived images remain on disk.
- Run `npm run test:cli` in addition to regular checks for bridge changes. Tests inject a fake generator; document actual CLI generation separately.

## Studio UI
- `assets/studio.css`: application-only theme, desktop sidebar, responsive navigation, focus states and dark mode; never change canvas/PPT output styling from this stylesheet.
- Material workflow indicator in `assets/materials-ui.js` uses `aria-current=step` based on current plan/approval state. Existing element IDs remain the event/test contract.

## Teaching material workspace
- `assets/teaching.js` / `assets/teaching-ui.js`: `teaching` tab, using existing scenes. `scene.teaching` stores `{kind(auto|photo|artifact|illust|map|quote|title), image(dataURL|null), shotId?, credit,url,rights,checked,checkedBasis?,caption,quote,include?,intro?,marks[],crop,basis}`. Marks/crop coordinates are normalized 0..1. Defaults are created lazily for old projects. Data lives in existing project backups/IndexedDB.
- Source images are contained (not cropped) in 1920×1080. `basis` fingerprints rendered source inputs; replacing a source disables stale marks/crops. Manual/source uploads clear source credit verification. Imported/generated image provenance must not be claimed automatically; users record sources.
- `exportTeachingPack`: snapshots selected scenes and map; exports ready base, optional title, marks and crop PNGs + JSON/TXT source manifest with skipped reasons. `exportTeachingPptx`: selected scenes must all be ready, same sequence, right speaker space, editable caption, full narration/source notes. Existing storyboard exports remain available separately.
- Reconfirming material plans preserves teaching settings for matching material IDs with unchanged narration. Changing imagery invalidates annotations by fingerprint. A stale material plan blocks exports.
- `docs/CHANNEL_ANALYSIS.md`: observational sample of all 10 public videos, not whole-channel full-duration viewing or historical fact validation.
- `TEST_FILTER='강의 자료:' npm test` runs the focused teaching tests. Full `npm test` still required before committing (now 83 cases).

- Teaching readiness is metadata-based (image decode still happens at preview/export). `checkedBasis` binds the user source confirmation to the rendered source; changed sources are unverified. Explicit missing shot selections never fall back to unrelated scene images. `tools/screens.mjs` also captures the teaching readiness UI.

- Teaching preview falls back from zoom to marked on scene/source navigation if no valid crop exists; choosing a drawing tool returns to marked mode. Individual PNG filenames snapshot the scene number, heading and Korean variant before asynchronous encoding. Preview errors must not be overwritten by generic instructions.

- `HS.replaceTeachingImage(scene,image)` requires an undo snapshot before replacing/removing an uploaded photo and clearing its credit. Snapshot failure or concurrent project/settings edits leave the existing photo untouched. UI uploads use a revision token so earlier reads cannot replace newer selections.

- Legacy teaching remains available in `teaching`; the current main is `studio`. Legacy saved `materials`/`teaching` opens studio; other saved tabs still resume. Empty projects accept a script in teaching, then hand off to the existing proposal/review/explicit-confirm flow. Scene navigation, original narration/brief, readiness filters/search and expected PNG count are workspace UI state; filtering never changes export selection.

## Scene-by-scene studio (current main)
- `assets/scene-studio.js` / `scene-studio-ui.js`, tab `studio`, are the main authoring flow. `project.studio={script,analyzedScript,method,mode(input|review|compose),backMode?,slides[]}` is independent of legacy scenes/materials. Slides store id,start,end (exact contiguous original offsets),title,reason,type(text|board|image),content,prompt,image,imagePrompt,credit,reviewed,candidates (max3). Backups/undo retain this state; snapshot handles projects with studio slides only.
- Semantic analysis sends numbered sentence units to the existing CLI bridge with kind=analysis. Model outputs increasing inclusive 1-based end unit indices, titles/reasons/types/content/prompts. Client validates full coverage and bounds atomically; original narration is never rewritten. Paragraph fallback is explicitly labeled non-AI. Max12000 chars,500 units,80 slides. Split/merge only in review; affected slides reset with undo.
- Composition is one scene/one slide. Review binds to content fingerprint. Changes invalidate review. Image generation affects only the selected scene, requires explicit click, and rejects stale project/slide completion. Archives remain available via local bridge. All slides must be reviewed for whole-deck PNG/PPT exports; one raster slide each, narration in notes.
- `/api/jobs` accepts kind image(default)|analysis|prompt; same token/origin checks, serial execution and cancellation. Analysis uses result.json in isolated CLI workspace; archives `output/codex-plans`. Image behavior is preserved. `npm run test:cli` required for server changes (5 tests currently).
- Real short-narration CLI analysis verified this turn; image UI bridge tested with fake generator, not a newly generated actual image.

- Studio image prompt drafting uses kind=prompt, returning validated nonempty <=2000-char `generatedPrompt`. Uses current narration/title/reason/existing prompt; no image generation. UI stages a suggestion and applies only via explicit button with undo and stale-context guard. Edits hide stale suggestions. Prompt jobs archive JSON in `output/codex-prompts`.

- Studio batch panel: confirmed compose mode only; scope missing/all/failed, prompt-only or prompt+image sequential generation. All target types become image, preserving content. Existing prompts reused except all mode. project.studio.imageStyle stores common style; slide.production={state,message} stores progress/errors (not review fingerprint). Snapshot required before starting; full plan/project guard across awaits; completed scenes saved individually; cancel stops later scenes. Refresh requires manual resume via missing scope; stale running labels shown as interrupted. Image candidates and human review gates remain. Test batch failure/retry, preservation, cancellation and reload.

- Studio PPT speaker notes include slide title/type, text or board content (image slides: prompt), full scene narration and credit. Existing per-scene image output and approval gate are unchanged.
