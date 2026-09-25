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
console.log(bad ? `\n${bad}곳 문제` : `✓ ${files.length}개 파일 문법 이상 없음`);
process.exit(bad ? 1 : 0);
