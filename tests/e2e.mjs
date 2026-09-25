// 사관 스튜디오 — 끝에서 끝까지 시험
//
//   npm install   (처음 한 번)
//   npm test
//
// 실제 Claude API 는 부르지 않습니다. api.anthropic.com 요청을 가로채 흘려 보내는(SSE) 가짜 답을 돌려줍니다.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_ = 'file://' + path.join(root, 'index.html');
const executablePath = process.env.CHROMIUM_PATH || undefined;

function sse(obj) {
  const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  let body = ev('message_start', { message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 2000, output_tokens: 1 } } });
  body += ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
  for (let i = 0; i < text.length; i += 50) body += ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: text.slice(i, i + 50) } });
  body += ev('content_block_stop', { index: 0 });
  body += ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 3000 } });
  body += ev('message_stop', {});
  return body;
}
const AI_ANSWER = {
  title: '이순신은 어떻게 바다를 지켰나',
  scenes: [
    { heading: '13척의 배', narration: '1597년, 조선 수군에게 남은 배는 13척뿐이었습니다.', visual: '울돌목의 거센 물살', prompt: 'Myeongnyang strait, Joseon panokseon, no text', mood: 'sea', motion: 'zoomIn' },
    { heading: '울돌목', narration: '이순신은 물살이 빠른 울돌목을 싸움터로 골랐습니다. 좁은 물길에서는 많은 배가 한꺼번에 들어올 수 없었습니다.', visual: '지도 위 좁은 해협', prompt: 'narrow strait map view, no text', mood: 'sea', motion: 'panLeft' },
    { heading: '정리', narration: '명량 해전은 숫자보다 지형과 준비가 중요하다는 것을 보여 줍니다.', visual: '노을 진 바다', prompt: 'sunset sea, no text', mood: 'dusk', motion: 'zoomOut' }
  ],
  board: [
    { title: '명량 해전 (1597)', lines: ['[배경]', '- 칠천량 패배 → 13척', '*울돌목 = 좁고 빠른 물살', '!숫자가 아니라 지형'] },
    { title: '의의', lines: ['정유재란의 흐름을 바꿈', '→ 서해 진출 저지'] }
  ],
  map: { title: '명량 해전', places: [{ name: '명량', lon: 126.31, lat: 34.57, kind: 'battle' }, { name: '한양', lon: 126.98, lat: 37.57, kind: 'capital' }], routes: [{ from: '명량', to: '한양', label: '서해 진출 저지' }],
    regions: [{ name: '조선(대략)', color: '#2f6db3', points: [[124.5, 40], [129.5, 42.5], [129.5, 35], [126.5, 34.3], [126.2, 37.5]] }] }
};
AI_ANSWER.scenes[1].use_map = true;
// 삽화가 답: 위험한 것(스크립트, 바깥 그림, onload)을 섞어 걸러지는지 봅니다
const SVG_ANSWER = '그림입니다.\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" onload="alert(1)">' +
  '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#335"/><stop offset="1" stop-color="#e96"/></linearGradient></defs>' +
  '<script>alert(2)</script><image href="https://evil.example/x.png" width="10" height="10"/>' +
  '<g id="far"><rect x="-100" y="-100" width="1800" height="1100" fill="url(#sky)"/></g>' +
  '<g id="mid"><rect x="600" y="400" width="400" height="300" fill="#00ff00"/></g>' +
  '<g id="near"><rect x="-100" y="800" width="1800" height="200" fill="#202020"/></g></svg>';
const REWRITE_ANSWER = { heading: '짧아진 장면', narration: '짧게 고친 내레이션입니다.', visual: '고친 화면', prompt: 'short prompt' };
const CHECK_ANSWER = { summary: '대체로 소스와 맞으나 한 곳은 소스에 없습니다.', items: [
  { scene: 1, claim: '남은 배는 13척', verdict: 'ok', note: '', quote: '13척' },
  { scene: 2, claim: '물살이 빠르다', verdict: 'unsupported', note: '소스에 물살 이야기가 없습니다.', quote: '' }] };
const UPLOAD_ANSWER = { titles: ['13척으로 이긴 명량 해전', '이순신은 왜 울돌목을 골랐나', 'b', 'c', 'd'], description: '명량 해전을 정리합니다.\n\n#한국사',
  tags: ['명량 해전', '이순신', '한국사'], thumbnail_texts: ['13척의\n기적', '울돌목'], pinned_comment: '여러분이라면 어디서 싸웠을까요?' };
function answerFor(body) {
  const sys = typeof body.system === 'string' ? body.system : JSON.stringify(body.system);
  if (sys.includes('삽화가')) return SVG_ANSWER;
  if (sys.includes('장면 하나만 고친다')) return REWRITE_ANSWER;
  if (sys.includes('사실 확인 담당')) return CHECK_ANSWER;
  if (sys.includes('업로드 정보')) return UPLOAD_ANSWER;
  return AI_ANSWER;
}

const results = [];
async function test(name, fn) {
  try { await fn(); results.push([true, name]); console.log('  ✓', name); }
  catch (e) { results.push([false, name]); console.log('  ✗', name, '\n    ', e.message.split('\n').slice(0, 4).join('\n     ')); }
}

const browser = await chromium.launch({ executablePath });
async function open(viewport = { width: 1300, height: 900 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(URL_);
  await page.waitForSelector('body[data-ready]');
  return page;
}
// 헤드리스 크롬은 한글 파일 이름을 'download' 로 바꿔 버리므로, 앱이 붙인 이름은 HS.download 를 엿들어 봅니다
async function download(page, selector) {
  await page.evaluate(() => { if (!HS._spy) { const orig = HS.download; HS.download = (n, b) => { window.__lastName = n; return orig(n, b); }; HS._spy = 1; } });
  const [d] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
  const file = await d.path();
  return { name: await page.evaluate(() => window.__lastName), buf: fs.readFileSync(file) };
}
const isZip = b => b[0] === 0x50 && b[1] === 0x4b;

console.log('사관 스튜디오 시험');

await test('처음 열면 오류 없이 소스 탭이 보인다', async () => {
  const page = await open();
  assert.ok(await page.isVisible('#tab-source'));
  for (const t of ['script', 'video', 'story', 'map', 'board', 'chalk', 'upload', 'settings', 'source']) await page.click(`#tabs button[data-tab=${t}]`);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

let page = await open();
await test('키 없이 간이 방식으로 대본·판서·지도를 만든다', async () => {
  await page.click('#src-sample');
  await page.click('#btn-generate');
  await page.waitForSelector('#tab-script.on');
  const p = await page.evaluate(() => HS.project);
  assert.ok(p.scenes.length >= 5, '장면 ' + p.scenes.length);
  assert.equal(p.title, '임진왜란');
  assert.ok(p.board.length >= 2);
  const names = p.map.places.map(x => x.name);
  for (const n of ['부산', '한양', '명량']) assert.ok(names.includes(n), n + ' 없음');
  assert.equal(await page.locator('#scene-list .scene').count(), p.scenes.length);
});

await test('대본을 고치면 저장되고 다시 열어도 남는다', async () => {
  await page.fill('#scene-list .scene[data-i="1"] textarea[data-k=narration]', '고친 내레이션입니다.');
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('body[data-ready]');
  const n = await page.evaluate(() => HS.project.scenes[1].narration);
  assert.equal(n, '고친 내레이션입니다.');
});

await test('삽화 영상 프레임을 그리고 짧게 녹화할 수 있다', async () => {
  await page.click('#tabs button[data-tab=video]');
  const r = await page.evaluate(async () => {
    const c = document.getElementById('video-canvas'), ctx = c.getContext('2d');
    HS.drawVideoFrame(ctx, 1280, 720, 6, {});
    const px = ctx.getImageData(640, 300, 1, 1).data;
    const blob = await HS.recordCanvas(c, 1.5, t => HS.drawVideoFrame(ctx, 1280, 720, t, {}));
    return { px: Array.from(px), size: blob.size, type: blob.type, total: HS.totalDuration() };
  });
  assert.ok(r.px[0] + r.px[1] + r.px[2] > 0, '검은 화면');
  assert.ok(r.size > 0, '녹화 비어 있음');
  assert.ok(['video/webm', 'video/mp4'].includes(r.type), r.type);
  assert.ok(r.total > 20);
});

await test('장면에 그림을 넣으면 영상과 PPT에 쓰인다', async () => {
  await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const x = c.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 400, 300);
    HS.project.scenes[1].image = c.toDataURL('image/png');
    HS.changed('all');
  });
  const px = await page.evaluate(async () => {
    await HS.preloadImages();
    const c = HS.sceneStill(HS.project.scenes[1], 160, 90);
    return Array.from(c.getContext('2d').getImageData(80, 45, 1, 1).data);
  });
  assert.ok(px[0] > 200 && px[1] < 40, '빨간 그림이 아님: ' + px);
});

await test('스토리 PPT를 받는다 (pptx, 장면 수 + 지도)', async () => {
  await page.click('#tabs button[data-tab=story]');
  const { name, buf } = await download(page, '#btn-story-pptx');
  assert.match(name, /스토리\.pptx$/);
  assert.ok(isZip(buf) && buf.length > 20000);
  const slides = (buf.toString('latin1').match(/ppt\/slides\/slide\d+\.xml/g) || []);
  const n = await page.evaluate(() => HS.project.scenes.length);
  assert.ok(new Set(slides).size === n + 1, '슬라이드 ' + new Set(slides).size + ' / 장면 ' + n);
});

await test('지도: 경로 글을 고치면 경로가 바뀌고 PNG로 받는다', async () => {
  await page.click('#tabs button[data-tab=map]');
  await page.fill('#map-routes', '부산 > 한양 : 일본군 북상\n한양 > 의주 : 선조 피란');
  const routes = await page.evaluate(() => HS.project.map.routes);
  assert.deepEqual(routes, [{ from: '부산', to: '한양', label: '일본군 북상' }, { from: '한양', to: '의주', label: '선조 피란' }]);
  for (const st of ['old', 'modern', 'board']) await page.selectOption('#map-style', st);
  const { name, buf } = await download(page, '#map-png');
  assert.match(name, /지도\.png$/);
  assert.equal(buf.slice(1, 4).toString(), 'PNG');
});

await test('손그림을 분필 그림으로 바꿔 판서에 넣는다', async () => {
  await page.click('#tabs button[data-tab=chalk]');
  const box = await page.locator('#chalk-src').boundingBox();
  await page.mouse.move(box.x + 100, box.y + 100); await page.mouse.down();
  for (let i = 0; i <= 20; i++) await page.mouse.move(box.x + 100 + i * 12, box.y + 100 + Math.sin(i / 3) * 60);
  await page.mouse.up();
  await page.evaluate(() => HS.convertChalkNow());
  await page.click('#chalk-to-board');
  await page.waitForFunction(() => HS.project.board[0] && HS.project.board[0].drawing);
  const d = await page.evaluate(() => ({ w: HS.project.board[0].dw, h: HS.project.board[0].dh, png: HS.project.board[0].drawing.slice(0, 22) }));
  assert.equal(d.png, 'data:image/png;base64,');
  assert.ok(d.w > 100 && d.h > 50, JSON.stringify(d));
});

await test('판서 PPT를 받는다 (편집 가능한 글자)', async () => {
  await page.click('#tabs button[data-tab=board]');
  await page.fill('#board-text', '[배경]\n- *1592년* 부산 상륙\n!주의: 과장 금지\n→ 결과');
  const parsed = await page.evaluate(() => ['[배경]', '- *1592년* 부산', '!주의', '→ *결과'].map(HS.parseBoardLine));
  assert.equal(parsed[0].box, true);
  assert.equal(parsed[1].indent, 1);
  assert.equal(parsed[1].parts[0].c, 'yellow');
  assert.equal(parsed[2].color, 'pink');
  assert.equal(parsed[3].text, '→ 결과');
  assert.equal(parsed[3].color, 'yellow');
  const { name, buf } = await download(page, '#btn-board-pptx');
  assert.match(name, /판서\.pptx$/);
  assert.ok(isZip(buf));
  assert.ok(buf.includes(Buffer.from('Nanum Pen Script')), '분필 글꼴 이름 없음');
});

await test('백업에는 API 키가 들어가지 않고, 불러오면 그대로 돌아온다', async () => {
  await page.click('#tabs button[data-tab=settings]');
  await page.fill('#cfg-key', 'sk-ant-test-SECRET');
  await page.click('#cfg-save');
  const { buf } = await download(page, '#proj-export');
  const txt = buf.toString('utf8');
  assert.ok(!txt.includes('SECRET'));
  const data = JSON.parse(txt);
  assert.ok(data.scenes.length > 0);
  await page.click('#proj-new', { noWaitAfter: true }).catch(() => {});
});
await page.context().close();

await test('AI 모드: Claude에게 구조화된 대본을 받아 채운다', async () => {
  const pg = await open();
  let body = null;
  await pg.context().route('https://api.anthropic.com/**', async route => {
    body = JSON.parse(route.request().postData());
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(AI_ANSWER) });
  });
  await pg.evaluate(() => { localStorage.setItem('hs.key', 'sk-ant-test'); });
  await pg.reload();
  await pg.waitForSelector('body[data-ready]');
  await pg.fill('#src-text', '명량 해전에 관한 소스');
  await pg.click('#btn-generate');
  await pg.waitForSelector('#tab-script.on', { timeout: 15000 });
  const p = await pg.evaluate(() => HS.project);
  assert.equal(p.title, AI_ANSWER.title);
  assert.equal(p.scenes.length, 3);
  assert.equal(p.board[0].text, AI_ANSWER.board[0].lines.join('\n'));
  assert.equal(p.map.places.length, 2);
  assert.equal(body.model, 'claude-opus-5');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.ok(body.messages[0].content.includes('명량 해전에 관한 소스'));
  assert.deepEqual(pg.errors, []);
  await pg.context().close();
});

// AI 가 켜진 창 하나로 새 기능들을 이어서 시험합니다
const ai = await open();
const aiBodies = [];
await ai.context().route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  aiBodies.push(body);
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(answerFor(body)) });
});
ai.on('dialog', d => d.accept(d.type() === 'prompt' ? '조선 영역' : undefined));
await ai.evaluate(() => localStorage.setItem('hs.key', 'sk-ant-test'));
await ai.reload(); await ai.waitForSelector('body[data-ready]');
await ai.fill('#src-text', '1597년 조선 수군에게 남은 배는 13척이었다. 이순신은 명량에서 싸웠다.');
await ai.click('#btn-generate');
await ai.waitForSelector('#tab-script.on');

await test('AI 대본에 지도 장면과 영역이 들어오고, 지도 장면은 지도로 그려진다', async () => {
  const p = await ai.evaluate(() => HS.project);
  assert.equal(p.scenes[1].useMap, true);
  assert.equal(p.map.regions.length, 1);
  assert.equal(aiBodies[0].output_config.format.schema.properties.map.required.includes('regions'), true);
  const same = await ai.evaluate(() => {
    const a = HS.sceneStill(HS.project.scenes[1], 320, 180).toDataURL();
    const m = document.createElement('canvas'); m.width = 320; m.height = 180;
    HS.drawMap(m.getContext('2d'), 320, 180, HS.project.map, { style: HS.project.mapStyle || 'old' });
    return a === m.toDataURL();
  });
  assert.ok(same, '지도 장면이 지도로 그려지지 않음');
});

await test('장면 하나를 AI로 고친다', async () => {
  await ai.selectOption('#scene-list .scene[data-i="0"] select[data-rw]', 'short');
  await ai.click('#scene-list .scene[data-i="0"] button[data-act=rewrite]');
  await ai.waitForFunction(() => HS.project.scenes[0].heading === '짧아진 장면');
  const last = aiBodies[aiBodies.length - 1];
  assert.ok(last.messages[0].content.includes('절반 길이'));
  assert.equal(await ai.evaluate(() => HS.project.scenes[1].heading), '울돌목', '다른 장면이 바뀜');
});

await test('사실 확인 결과가 보이고 해당 장면에 표시된다', async () => {
  await ai.click('#btn-factcheck');
  await ai.waitForSelector('#check-panel:not([hidden]) .check');
  assert.equal(await ai.locator('#check-panel .check').count(), 2);
  assert.ok(await ai.locator('#scene-list .scene[data-i="1"] .flag.unsupported').count() === 1);
});

await test('AI 삽화: SVG를 걸러 세 겹으로 받아 영상에 쓴다', async () => {
  await ai.click('#tabs button[data-tab=video]');
  await ai.click('#vid-scenes .scene[data-i="0"] button[data-act=aidraw]');
  await ai.waitForFunction(() => HS.project.scenes[0].svg && HS.sceneLayers(HS.project.scenes[0]));
  const r = await ai.evaluate(() => {
    const s = HS.project.scenes[0], svg = s.svg;
    const c = HS.sceneStill(s, 160, 90), px = Array.from(c.getContext('2d').getImageData(80, 50, 1, 1).data);
    return { script: /<script|onload|evil\.example|<image/i.test(svg), layers: HS.sceneLayers(s).map(l => l.id), px };
  });
  assert.equal(r.script, false, '위험한 것이 남음');
  assert.deepEqual(r.layers, ['far', 'mid', 'near']);
  assert.ok(r.px[1] > 200 && r.px[0] < 80, '가운데 초록 사각형이 안 보임: ' + r.px);
});

await test('목소리: 소리 파일을 넣으면 길이가 맞춰지고 녹화에 소리가 들어간다', async () => {
  const r = await ai.evaluate(async () => {
    // 1.5초짜리 사인파 WAV 를 만들어 넣습니다
    const rate = 16000, n = rate * 1.5, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / rate * 2 * Math.PI * 440) * 8000, true);
    let bin = ''; new Uint8Array(buf).forEach(b => bin += String.fromCharCode(b));
    const s = HS.project.scenes[2];
    await HS.setSceneAudio(s, 'data:audio/wav;base64,' + btoa(bin));
    const c = document.getElementById('video-canvas'), ctx = c.getContext('2d');
    const blob = await HS.recordCanvas(c, 1.5, t => HS.drawVideoFrame(ctx, 1280, 720, t, {}), null, dest => HS.playNarration(HS.timeline()[2].start, dest));
    const text = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    return { dur: s.audioDur, sceneDur: HS.sceneDuration(s), opus: /A_OPUS|Opus|mp4a/.test(text) };
  });
  assert.ok(Math.abs(r.dur - 1.5) < 0.05, '길이 ' + r.dur);
  assert.ok(Math.abs(r.sceneDur - (Math.max(3, 1.5 + 0.6 + 0.5) + 0.8)) < 0.05, '장면 길이 ' + r.sceneDur);
  assert.ok(r.opus, '녹화에 소리 트랙이 없음');
});

await test('지도에서 영역을 직접 그린다', async () => {
  await ai.click('#tabs button[data-tab=map]');
  const before = await ai.evaluate(() => HS.project.map.regions.length);
  await ai.click('#map-region-draw');
  const box = await ai.locator('#map-canvas').boundingBox();
  for (const [x, y] of [[0.3, 0.3], [0.6, 0.3], [0.5, 0.7]]) await ai.mouse.click(box.x + box.width * x, box.y + box.height * y);
  await ai.click('#map-region-draw');
  const rg = await ai.evaluate(() => HS.project.map.regions);
  assert.equal(rg.length, before + 1);
  assert.equal(rg[rg.length - 1].name, '조선 영역');
  assert.equal(rg[rg.length - 1].points.length, 3);
});

await test('판서가 한 글자씩 써지는 영상을 녹화한다', async () => {
  await ai.click('#tabs button[data-tab=board]');
  const diff = await ai.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const s = { title: '제목', text: '가나다라' }, x = c.getContext('2d');
    HS.drawBoardSlide(x, 320, 180, s, null, { progress: 0 }); const a = c.toDataURL();
    HS.drawBoardSlide(x, 320, 180, s, null, { progress: 1 }); const b = c.toDataURL();
    HS.drawBoardSlide(x, 320, 180, s, null, {}); const full = c.toDataURL();
    return { changes: a !== b, fullSame: b === full, chars: HS.boardChars(s, false) };
  });
  assert.ok(diff.changes && diff.fullSame);
  assert.equal(diff.chars, 6);
  await ai.evaluate(() => { HS.project.board = [{ title: '짧은 판서', text: '가나', drawing: null }]; HS.changed('all'); });
  const [d] = await Promise.all([ai.waitForEvent('download', { timeout: 20000 }), ai.click('#board-record')]);
  assert.ok(fs.statSync(await d.path()).size > 1000);
});

await test('손그림이 획 순서대로 그려지는 영상을 녹화한다', async () => {
  await ai.click('#tabs button[data-tab=chalk]');
  const box = await ai.locator('#chalk-src').boundingBox();
  await ai.mouse.move(box.x + 50, box.y + 50); await ai.mouse.down();
  for (let i = 0; i <= 10; i++) await ai.mouse.move(box.x + 50 + i * 20, box.y + 50 + i * 10);
  await ai.mouse.up();
  const r = await ai.evaluate(() => {
    const src = document.getElementById('chalk-src'), full = HS.chalkFull(src, { sens: 14, color: '#ffffff' });
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'), st = HS.chalkStrokes(), ink = () => { const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) n += d[i + 3]; return n; };
    HS.drawChalkReveal(x, c.width, c.height, full, st, 0.3, 'none'); const a = ink();
    HS.drawChalkReveal(x, c.width, c.height, full, st, 1, 'none'); const b = ink();
    return { strokes: st.length, a, b };
  });
  assert.equal(r.strokes, 1);
  assert.ok(r.a > 0 && r.b > r.a * 1.5, JSON.stringify(r));
  const [d] = await Promise.all([ai.waitForEvent('download', { timeout: 20000 }), ai.click('#chalk-record')]);
  assert.ok(fs.statSync(await d.path()).size > 1000);
});

await test('업로드 준비: 자막 SRT·챕터가 영상 시각과 맞는다', async () => {
  await ai.click('#tabs button[data-tab=upload]');
  const r = await ai.evaluate(() => ({ srt: HS.srt(), cues: HS.subtitleCues(), ch: HS.chapters(), tl: HS.timeline(), total: HS.totalDuration() }));
  const blocks = r.srt.trim().split(/\n\n/);
  assert.equal(blocks.length, r.cues.length);
  assert.match(blocks[0], /^1\n\d\d:\d\d:\d\d,\d{3} --> \d\d:\d\d:\d\d,\d{3}\n/);
  for (let i = 1; i < r.cues.length; i++) assert.ok(r.cues[i].start >= r.cues[i - 1].start && r.cues[i].end > r.cues[i].start);
  assert.equal(r.ch[0].start, 0);
  for (let i = 1; i < r.ch.length; i++) assert.ok(r.ch[i].start - r.ch[i - 1].start >= 10);
  const { name, buf } = await download(ai, '#up-srt');
  assert.match(name, /자막\.srt$/);
  assert.ok(buf.toString('utf8').includes('-->'));
});

await test('업로드 준비: 제목·설명·태그를 짓고 설명에 챕터가 붙는다', async () => {
  await ai.click('#up-generate');
  await ai.waitForSelector('#up-desc');
  const desc = await ai.inputValue('#up-desc');
  assert.ok(desc.startsWith('명량 해전을 정리합니다.'));
  assert.ok(desc.includes('0:00 '), '챕터 없음');
  assert.equal(await ai.inputValue('#up-tags'), '명량 해전, 이순신, 한국사');
  assert.equal(await ai.inputValue('#thumb-main'), '13척의\n기적');
});

await test('썸네일 PNG를 받는다 (고른 색 글씨가 그려짐)', async () => {
  await ai.selectOption('#thumb-color', 'red');
  const reds = await ai.evaluate(async () => {
    await HS.preloadImages();
    const c = document.createElement('canvas'); c.width = 640; c.height = 360;
    HS.drawThumbnail(c.getContext('2d'), 640, 360, HS.project.thumb);
    const d = c.getContext('2d').getImageData(0, 0, 640, 360).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 230 && d[i + 1] < 100 && d[i + 2] < 90) n++;
    return n;
  });
  assert.ok(reds > 500, '빨간 글씨 화소 ' + reds);
  const { name, buf } = await download(ai, '#thumb-png');
  assert.match(name, /썸네일\.png$/);
  assert.equal(buf.slice(1, 4).toString(), 'PNG');
});

await test('사진 손그림도 선을 따라 획 순서로 그려진다', async () => {
  await ai.click('#tabs button[data-tab=chalk]');
  // 원 두 개가 그려진 "사진"을 만들어 파일로 넣습니다
  const png = await ai.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const x = c.getContext('2d');
    x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 600, 400); x.strokeStyle = '#333'; x.lineWidth = 7;
    x.beginPath(); x.arc(170, 200, 110, 0, 7); x.stroke(); x.beginPath(); x.moveTo(350, 100); x.lineTo(520, 300); x.stroke();
    return c.toDataURL('image/png').split(',')[1];
  });
  await ai.setInputFiles('#chalk-file', { name: 'drawing.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await ai.waitForFunction(() => document.getElementById('chalk-src').width === 600);
  const r = await ai.evaluate(() => {
    const src = document.getElementById('chalk-src'), x = src.getContext('2d');
    const t0 = performance.now();
    const st = HS.traceStrokes(HS.inkMask(x.getImageData(0, 0, src.width, src.height), 14), src.width, src.height);
    const ms = performance.now() - t0, len = st.reduce((a, s) => a + s.length, 0);
    // 선 위의 점이어야 합니다
    const d = x.getImageData(0, 0, src.width, src.height).data;
    const onInk = st.flat().filter(([px, py]) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const i = ((Math.round(py) + dy) * src.width + Math.round(px) + dx) * 4; if (d[i] < 120) return true; } return false; }).length;
    return { n: st.length, len, onInk, ms };
  });
  assert.ok(r.n >= 2 && r.n <= 12, '획 ' + r.n);
  assert.ok(r.onInk / r.len > 0.95, '선 밖의 점 ' + JSON.stringify(r));
  assert.ok(r.ms < 3000, '너무 느림 ' + r.ms);
  const [d] = await Promise.all([ai.waitForEvent('download', { timeout: 40000 }), ai.click('#chalk-record')]);
  assert.ok(fs.statSync(await d.path()).size > 1000);
});

await test('MP4를 고르면 MP4로 녹화된다 (브라우저가 지원할 때)', async () => {
  const r = await ai.evaluate(async () => {
    localStorage.setItem('hs.format', 'mp4');
    const ok = MediaRecorder.isTypeSupported('video/mp4');
    const c = document.getElementById('video-canvas'), ctx = c.getContext('2d');
    const blob = await HS.recordCanvas(c, 1.5, t => HS.drawVideoFrame(ctx, 1280, 720, t, {}));
    const head = new TextDecoder('latin1').decode(new Uint8Array(await blob.slice(0, 64).arrayBuffer()));
    localStorage.setItem('hs.format', 'webm');
    const blob2 = await HS.recordCanvas(c, 1.2, t => HS.drawVideoFrame(ctx, 1280, 720, t, {}));
    return { ok, type: blob.type, ftyp: head.includes('ftyp'), ext: HS.videoExt(blob), type2: blob2.type };
  });
  if (r.ok) { assert.equal(r.type, 'video/mp4'); assert.ok(r.ftyp); assert.equal(r.ext, '.mp4'); }
  assert.equal(r.type2, 'video/webm');
});

await test('그림·목소리가 든 프로젝트가 IndexedDB에 저장되어 다시 열어도 남는다', async () => {
  await ai.evaluate(() => HS.persist());
  await ai.reload(); await ai.waitForSelector('body[data-ready]');
  const r = await ai.evaluate(() => ({ svg: !!HS.project.scenes[0].svg, audio: !!HS.project.scenes[2].audio, ls: localStorage.getItem('hs.project') }));
  assert.ok(r.svg && r.audio);
  assert.equal(r.ls, null);
  assert.deepEqual(ai.errors, []);
});
await ai.context().close();

await test('휴대폰 폭에서 가로로 넘치지 않는다', async () => {
  const pg = await open({ width: 375, height: 800 });
  await pg.click('#src-sample'); await pg.click('#btn-generate');
  for (const t of ['source', 'script', 'video', 'story', 'map', 'board', 'chalk', 'upload', 'settings']) {
    await pg.click(`#tabs button[data-tab=${t}]`);
    const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 0, t + ' 탭이 ' + over + 'px 넘침');
  }
  await pg.context().close();
});

await browser.close();
const bad = results.filter(r => !r[0]);
console.log(`\n${results.length - bad.length} / ${results.length} 통과`);
process.exit(bad.length ? 1 : 0);
