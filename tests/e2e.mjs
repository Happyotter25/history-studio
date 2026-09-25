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
  const text = JSON.stringify(obj);
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
  map: { title: '명량 해전', places: [{ name: '명량', lon: 126.31, lat: 34.57, kind: 'battle' }, { name: '한양', lon: 126.98, lat: 37.57, kind: 'capital' }], routes: [{ from: '명량', to: '한양', label: '서해 진출 저지' }] }
};

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
  for (const t of ['script', 'video', 'story', 'map', 'board', 'chalk', 'settings', 'source']) await page.click(`#tabs button[data-tab=${t}]`);
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
  assert.equal(r.type, 'video/webm');
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
  await pg.evaluate(() => { localStorage.setItem('hs.key', 'sk-ant-test'); localStorage.removeItem('hs.project'); });
  await pg.reload();
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

await test('휴대폰 폭에서 가로로 넘치지 않는다', async () => {
  const pg = await open({ width: 375, height: 800 });
  await pg.click('#src-sample'); await pg.click('#btn-generate');
  for (const t of ['source', 'script', 'video', 'story', 'map', 'board', 'chalk', 'settings']) {
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
