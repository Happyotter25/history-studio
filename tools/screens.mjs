// README 에 쓰는 화면 사진을 docs/ 에 새로 찍습니다:  node tools/screens.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const pg = await b.newPage({ viewport: { width: 1300, height: 860 } });
await pg.goto('file://' + path.join(root, 'index.html'));
await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.continue().catch(() => {}));
await pg.waitForSelector('body[data-ready]');
await pg.click('#tabs button[data-tab=materials]');
await pg.screenshot({ path: path.join(root, 'docs/materials-start.png') });
await pg.click('#material-sample'); await pg.click('#material-propose');
await pg.locator('#material-review').scrollIntoViewIfNeeded();
await pg.screenshot({ path: path.join(root, 'docs/materials-plan.png') });
await pg.click('#tabs button[data-tab=source]');
await pg.click('#src-sample'); await pg.click('#btn-generate');
await pg.screenshot({ path: path.join(root, 'docs/script.png') });
await pg.click('#tabs button[data-tab=video]');
await pg.evaluate(() => HS.drawVideoFrame(document.getElementById('video-canvas').getContext('2d'), 1280, 720, 12, {}));
await pg.locator('#video-canvas').screenshot({ path: path.join(root, 'docs/video.png') });
await pg.evaluate(() => { HS.project.map.regions = [{ name: '조선(대략)', color: '#2f6db3', points: [[124.4, 40.1], [126.8, 41.7], [128.1, 41.9], [129.7, 42.4], [130, 42.3], [129.7, 41], [128.4, 40], [127.5, 39.3], [128.4, 38.6], [129.4, 37.1], [129.4, 35.5], [128.6, 35], [127.4, 34.6], [126.3, 34.4], [126.4, 35.6], [126.7, 36.9], [126.1, 37.7], [125.1, 37.8], [124.7, 38.7], [125.1, 39.5]] }]; HS.changed('all'); });
await pg.click('#tabs button[data-tab=map]'); await pg.waitForTimeout(300);
await pg.locator('#map-canvas').screenshot({ path: path.join(root, 'docs/map.png') });
await pg.click('#tabs button[data-tab=chalk]');
await pg.evaluate(() => { const c = document.getElementById('chalk-src').getContext('2d'); c.strokeStyle = '#222'; c.fillStyle = '#222'; c.lineWidth = 6;
  c.beginPath(); c.arc(400, 290, 140, 0, 7); c.stroke(); c.beginPath(); c.arc(345, 260, 14, 0, 7); c.fill(); c.beginPath(); c.arc(455, 260, 14, 0, 7); c.fill();
  c.beginPath(); c.arc(400, 320, 60, 0.3, 2.8); c.stroke(); c.beginPath(); c.moveTo(250, 200); c.lineTo(400, 110); c.lineTo(550, 200); c.stroke(); HS.convertChalkNow(); });
await pg.click('#chalk-to-board');
await pg.locator('#tab-chalk .grid2').screenshot({ path: path.join(root, 'docs/chalk.png') });
await pg.click('#tabs button[data-tab=board]'); await pg.waitForTimeout(300);
await pg.locator('#board-canvas').screenshot({ path: path.join(root, 'docs/board.png') });
await pg.evaluate(() => { HS.uploadSimple(); HS.project.thumb = { scene: 3, main: '임진왜란\n7년 전쟁', sub: '한국사 10분 정리', color: 'yellow', layout: 'left' }; HS.changed('upload'); });
await pg.click('#tabs button[data-tab=upload]'); await pg.waitForTimeout(400);
await pg.screenshot({ path: path.join(root, 'docs/upload.png') });
await pg.locator('#thumb-canvas').screenshot({ path: path.join(root, 'docs/thumbnail.png') });
// 이미지 기획 탭 (샷 보드) — 한 샷에는 그림을 넣어 둡니다
await pg.click('#tabs button[data-tab=shots]'); await pg.click('#shots-plan');
await pg.waitForFunction(() => HS.project.scenes[1].shots && HS.project.scenes[1].shots.length);
await pg.evaluate(() => { HS.project.art.cast = [{ name: '이순신', look: '50s Joseon admiral, stern face, neat black beard, dark red armor' }];
  const c = document.createElement('canvas'); c.width = 640; c.height = 360; HS.drawSceneArt(c.getContext('2d'), 640, 360, { heading: 'x', mood: 'war' }, 0);
  HS.project.scenes[2].shots[0].image = c.toDataURL('image/jpeg'); HS.changed('all'); });
await pg.click('#tabs button[data-tab=script]'); await pg.click('#tabs button[data-tab=shots]'); await pg.waitForTimeout(500);
await pg.screenshot({ path: path.join(root, 'docs/shots.png') });
await pg.evaluate(() => HS.generateLessonSimple());
await pg.click('#tabs button[data-tab=lesson]'); await pg.waitForTimeout(600);
await pg.screenshot({ path: path.join(root, 'docs/lesson.png') });
await pg.evaluate(() => { HS.project.aspect = '9:16'; HS.changed('aspect'); });
await pg.click('#tabs button[data-tab=video]'); await pg.waitForTimeout(300);
await pg.evaluate(() => { const c = document.getElementById('video-canvas'), tl = HS.timeline(); HS.drawVideoFrame(c.getContext('2d'), c.width, c.height, tl[1].start + 3, {}); });
await pg.locator('#video-canvas').screenshot({ path: path.join(root, 'docs/shorts.png') });
// 내 캐릭터가 나오는 장면
await pg.evaluate(() => {
  HS.project.aspect = '16:9';
  const c = document.createElement('canvas'); c.width = 500; c.height = 600; const x = c.getContext('2d');
  x.fillStyle = '#efe9dc'; x.fillRect(0, 0, 500, 600); x.lineWidth = 7; x.strokeStyle = '#222';
  x.fillStyle = '#fff'; x.beginPath(); x.ellipse(250, 300, 120, 140, 0, 0, 7); x.fill(); x.stroke();
  x.fillStyle = '#222'; x.beginPath(); x.ellipse(250, 150, 190, 22, 0, 0, 7); x.fill(); x.fillRect(190, 60, 120, 95);
  x.beginPath(); x.arc(205, 290, 10, 0, 7); x.arc(295, 290, 10, 0, 7); x.fill();
  x.beginPath(); x.arc(250, 340, 40, 0.3, 2.8); x.stroke();
  x.fillStyle = '#3a6ea5'; x.fillRect(150, 440, 200, 150); x.strokeRect(150, 440, 200, 150);
  HS.addCharacter('선비', HS.makeSticker(c, { outline: true }));
  HS.project.scenes.forEach((s, i) => { if (i) s.character = { id: HS.project.characters[0].id, side: 'left' }; });
  HS.changed('all');
});
await pg.click('#tabs button[data-tab=video]'); await pg.waitForTimeout(400);
await pg.evaluate(async () => { await HS.preloadImages(); const c = document.getElementById('video-canvas'), tl = HS.timeline(); HS.drawVideoFrame(c.getContext('2d'), c.width, c.height, tl[1].start + 3, {}); });
await pg.locator('#video-canvas').screenshot({ path: path.join(root, 'docs/character.png') });
// 역사 장면 종류 네 가지를 한 장에
const kinds = await pg.evaluate(() => {
  const S = [
    { heading: '선조, 한양을 떠나다', keywords: ['의주'], kind: 'source', data: { original: '上出宮門百官不從者多', translation: '임금이 궁궐 문을 나서니, 따르지 않은 관리가 많았다. 행렬은 개성을 지나 평양을 거쳐 의주로 향하였다.', cite: '선조수정실록 25년 4월' } },
    { heading: '임진왜란의 흐름', kind: 'timeline', data: { events: [{ year: '1592', label: '부산 상륙' }, { year: '1592', label: '한산도 대첩' }, { year: '1593', label: '행주 대첩' }, { year: '1597', label: '명량 해전' }, { year: '1598', label: '노량 해전' }] } },
    { heading: '전쟁을 이끈 사람들', kind: 'people', data: { people: [{ name: '선조', role: '조선의 왕' }, { name: '이순신', role: '삼도수군통제사' }, { name: '원균', role: '경상우수사' }, { name: '류성룡', role: '영의정' }], links: [{ from: '류성룡', to: '이순신', label: '천거' }, { from: '선조', to: '이순신', label: '파직·재기용' }, { from: '원균', to: '이순신', label: '갈등' }] } },
    { heading: '1592년, 두 나라의 군대', kind: 'compare', data: { left: '조선', right: '일본', rows: [{ label: '주력 무기', left: '활, 화포', right: '조총' }, { label: '바다', left: '판옥선 · 화포', right: '백병전 중심' }, { label: '전쟁 경험', left: '오랜 평화', right: '전국 시대 백 년' }] } }];
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const x = c.getContext('2d');
  S.forEach((s, i) => { const t = document.createElement('canvas'); t.width = 1280; t.height = 720; HS.drawDataScene(t.getContext('2d'), 1280, 720, s, 1); x.drawImage(t, (i % 2) * 640, Math.floor(i / 2) * 360, 640, 360); });
  return c.toDataURL('image/png').split(',')[1];
});
(await import('node:fs')).writeFileSync(path.join(root, 'docs/scene-kinds.png'), Buffer.from(kinds, 'base64'));
// 강의 자료 작업실은 별도 프로젝트 저장소에서 재현합니다.
const teaching = await b.newPage({viewport:{width:1440,height:1050}});
await teaching.goto('file://' + path.join(root,'index.html'));
await teaching.waitForSelector('body[data-ready]');
await teaching.click('#material-sample');await teaching.click('#material-propose');await teaching.click('#material-confirm');
await teaching.click('#tabs button[data-tab=teaching]');await teaching.selectOption('#teaching-scene','7');
await teaching.waitForFunction(()=>!document.getElementById('teaching-png').disabled);
await teaching.click('.teaching-coordinates summary');await teaching.click('#teaching-add');
await teaching.click('#teaching-summary');
await teaching.addStyleTag({content:'*{scroll-behavior:auto!important}'});
await teaching.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
await teaching.waitForTimeout(300);
await teaching.screenshot({path:path.join(root,'docs/teaching.png'),fullPage:true});
await b.close();
