// 빠른 점검: 브라우저 없이 모든 스크립트의 문법만 확인합니다 (npm run check).
// 인터넷이 막힌 곳(Codex 샌드박스 등)에서도 돌아갑니다. 동작 시험은 npm test.
import fs from 'node:fs';
import vm from 'node:vm';
let bad = 0;
const files = fs.readdirSync('assets').filter(f => f.endsWith('.js')).map(f => 'assets/' + f)
  .concat(fs.readdirSync('content').filter(f => f.endsWith('.js')).map(f => 'content/' + f));
for (const f of files) {
  try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); }
  catch (e) { bad++; console.log('✗', f, '\n ', e.message); }
}
// index.html 이 부르는 스크립트가 모두 있는지
const html = fs.readFileSync('index.html', 'utf8');
for (const m of html.matchAll(/<script src="([^"]+)"/g)) if (!fs.existsSync(m[1])) { bad++; console.log('✗ index.html 이 부르는 파일이 없음:', m[1]); }
// 작업 일지: "기록" 아래에 기록이 하나 이상, 각 기록에 네 칸이 있는지
const log = fs.existsSync('docs/HANDOFF.md') ? fs.readFileSync('docs/HANDOFF.md', 'utf8') : '';
const entries = log.split('\n## 기록')[1] ? log.split('\n## 기록')[1].split(/\n### /).slice(1) : [];
if (!entries.length) { bad++; console.log('✗ docs/HANDOFF.md 에 작업 기록이 없음'); }
entries.forEach((e, i) => ['**한 일', '**확인한 것', '**확인하지 못한 것', '**다음 할 일'].forEach(h => { if (!e.includes(h)) { bad++; console.log(`✗ HANDOFF 기록 ${i + 1}(${e.split('\n')[0]})에 "${h.slice(2)}" 칸이 없음`); } }));
console.log(bad ? `\n${bad}곳 문제` : `✓ ${files.length}개 파일 문법 이상 없음`);
process.exit(bad ? 1 : 0);
