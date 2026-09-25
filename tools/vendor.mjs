// 외부 라이브러리와 지도 자료를 앱 안으로 들여오는 도구이옵니다 (npm install 뒤 npm run vendor).
// 산출물은 저장소에 함께 올리므로, 앱은 빌드 없이 file:// 로 바로 열리옵니다.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const topo = require('topojson-client');

// 1) PptxGenJS (JSZip 포함 번들)
fs.copyFileSync('node_modules/pptxgenjs/dist/pptxgen.bundle.js', 'assets/vendor/pptxgen.bundle.js');

// 2) 동아시아 지도 (Natural Earth 1:50m, world-atlas)
const world = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json', 'utf8'));
const fc = topo.feature(world, world.objects.countries);
const BOX = [70, 5, 160, 60]; // 서경, 남위, 동경, 북위
const r2 = (v) => Math.round(v * 100) / 100;
const out = [];
for (const f of fc.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = [];
  for (const p of polys) {
    const ring = p[0];
    let hit = false;
    for (const [x, y] of ring) if (x >= BOX[0] && x <= BOX[2] && y >= BOX[1] && y <= BOX[3]) { hit = true; break; }
    if (!hit) continue;
    const pts = [];
    let last = null;
    for (const [x, y] of ring) {
      const q = [r2(x), r2(y)];
      if (!last || q[0] !== last[0] || q[1] !== last[1]) pts.push(q);
      last = q;
    }
    if (pts.length > 3) rings.push(pts);
  }
  if (rings.length) out.push({ name: f.properties.name, rings });
}
fs.writeFileSync('content/geo.js',
  '// 생성된 파일이옵니다. 손으로 고치지 마옵소서 (tools/vendor.mjs).\n' +
  '// 자료: Natural Earth 1:50m (public domain), world-atlas 2.0.2\n' +
  'window.GEO = ' + JSON.stringify({ box: BOX, countries: out }) + ';\n');
console.log('countries', out.length, 'geo.js', fs.statSync('content/geo.js').size, 'bytes');
