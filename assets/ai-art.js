/* AI 삽화 — Claude 가 장면마다 SVG 그림을 그립니다.
 * 그림은 먼 배경(far) · 주인공(mid) · 앞 가림(near) 세 겹으로 받아, 영상에서 겹마다 다르게 움직여(시차) 깊이를 냅니다.
 * 받은 SVG 는 스크립트·바깥 링크를 모두 걷어 낸 뒤에만 씁니다.
 */
(function(){
  'use strict';
  var HS = window.HS;
  var LAYERS = ['far', 'mid', 'near'];

  var SYSTEM = [
    '너는 한국사 유튜브 채널의 삽화가다. 장면 설명을 받아 SVG 한 장을 그린다.',
    '규칙:',
    '- 출력은 <svg ...>...</svg> 하나뿐. 설명·코드 블록 표시(```) 없이 SVG 만 쓴다.',
    '- <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">.',
    '- 세 겹으로 나눈다: <g id="far"> 하늘·먼 산·먼 건물 (화면을 빈틈없이 채운다), <g id="mid"> 주인공 인물·배·성 등 장면의 중심, <g id="near"> 앞쪽의 풀·바위·나뭇가지·깃발 같은 테두리 요소(가운데는 비운다).',
    '- 겹마다 화면 밖으로 100px 쯤 넉넉히 그려, 움직여도 가장자리가 비지 않게 한다.',
    '- 화풍: 한국 역사 웹툰 풍의 부드러운 평면 채색. linearGradient/radialGradient 와 투명도를 써서 빛과 공기감을 낸다. 선은 짙은 갈색 계열.',
    '- 시대 고증: 복식(갓, 도포, 갑옷, 투구), 건축(기와, 단청), 배(판옥선, 거북선) 등을 시대에 맞게. 모르면 단순한 실루엣으로 처리한다.',
    '- 글자(<text>), <image>, <script>, <foreignObject>, 바깥 링크는 쓰지 않는다.',
    '- 파일은 30KB 안쪽으로. path 는 간결하게.'
  ].join('\n');

  // 위험한 요소를 걷어 낸 SVG 문자열 (없으면 null)
  HS.cleanSvg = function(text){
    var m = String(text || '').match(/<svg[\s\S]*<\/svg>/i);
    if(!m) return null;
    var doc = new DOMParser().parseFromString(m[0], 'image/svg+xml');
    var svg = doc.documentElement;
    if(!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
    var bad = ['script', 'foreignObject', 'image', 'iframe', 'a', 'text', 'use', 'feImage'];
    bad.forEach(function(tag){
      Array.prototype.slice.call(svg.getElementsByTagName(tag)).forEach(function(n){
        // <use href="#..."> 는 안쪽 참조라 괜찮습니다
        if(tag === 'use' && /^#/.test(n.getAttribute('href') || n.getAttribute('xlink:href') || '')) return;
        n.parentNode.removeChild(n);
      });
    });
    Array.prototype.slice.call(svg.getElementsByTagName('style')).forEach(function(n){
      if(/@import|url\(\s*['"]?(?!#)/i.test(n.textContent)) n.parentNode.removeChild(n);
    });
    Array.prototype.slice.call(svg.getElementsByTagName('*')).concat([svg]).forEach(function(n){
      Array.prototype.slice.call(n.attributes).forEach(function(a){
        var v = a.value || '';
        if(/^on/i.test(a.name)) n.removeAttribute(a.name);
        else if(/href$/i.test(a.name) && !/^#/.test(v)) n.removeAttribute(a.name);
        else if(/url\(\s*['"]?(?!#)/i.test(v)) n.removeAttribute(a.name);
      });
    });
    if(!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 1600 900');
    svg.setAttribute('width', '1600'); svg.setAttribute('height', '900');
    return new XMLSerializer().serializeToString(svg);
  };

  // SVG → 겹별 SVG 문자열. 겹이 없으면 통째로 한 겹
  HS.svgLayers = function(svgText){
    var doc = new DOMParser().parseFromString(svgText, 'image/svg+xml'), svg = doc.documentElement;
    var have = LAYERS.filter(function(id){ return doc.getElementById(id); });
    if(have.length < 2) return [{ id: 'all', svg: svgText }];
    return have.map(function(id){
      var d = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      LAYERS.forEach(function(other){ if(other !== id){ var g = d.getElementById(other); if(g) g.parentNode.removeChild(g); } });
      return { id: id, svg: new XMLSerializer().serializeToString(d.documentElement) };
    });
  };

  var cache = {};
  // 장면의 SVG 겹 그림들 (다 읽혔으면 [{id, img}], 아니면 null)
  HS.sceneLayers = function(scene){
    if(!scene.svg) return null;
    var c = cache[scene.svg];
    if(!c){
      c = cache[scene.svg] = { ok: false, layers: null };
      var parts = HS.svgLayers(scene.svg);
      c.promise = Promise.all(parts.map(function(p){
        return HS.loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(p.svg)).then(function(img){ return { id: p.id, img: img }; });
      })).then(function(ls){ c.layers = ls; c.ok = true; }, function(){ c.ok = false; });
    }
    return c.ok ? c.layers : null;
  };
  HS.sceneLayersReady = function(scene){ HS.sceneLayers(scene); var c = cache[scene.svg]; return c ? c.promise : Promise.resolve(); };

  // 겹을 시차로 그립니다. k: 장면 안의 진행(0~1)
  var DEPTH = { far: 0.35, mid: 0.7, near: 1.15, all: 0.8 };
  HS.drawLayers = function(ctx, w, h, layers, motion, k){
    layers.forEach(function(L){
      var d = DEPTH[L.id] || 0.8, z = 1.06, px = 0, py = 0;
      if(motion === 'zoomIn') z = 1.06 + 0.14 * k * d;
      else if(motion === 'zoomOut') z = 1.06 + 0.14 * (1 - k) * d;
      else { px = (motion === 'panLeft' ? (0.5 - k) : (k - 0.5)) * w * 0.07 * d; z = 1.06 + 0.04 * d; }
      if(L.id === 'near') py = Math.sin(k * Math.PI) * h * 0.006; // 앞 가림은 살짝 흔들립니다
      // 화면을 꽉 채우도록(cover) 맞춥니다 — 세로 화면에서는 그림 가운데를 잘라 씁니다
      var base = Math.max(w / (L.img.width || 1600), h / (L.img.height || 900)), dw = (L.img.width || 1600) * base * z, dh = (L.img.height || 900) * base * z;
      ctx.drawImage(L.img, (w - dw) / 2 - px, (h - dh) / 2 + py, dw, dh);
    });
  };

  // 한 장면을 Claude 에게 그려 달라 합니다
  HS.drawSceneAI = function(i, onProgress){
    var p = HS.project, s = p.scenes[i];
    var msg = [
      '영상 제목: ' + (p.title || ''),
      '장면 ' + (i + 1) + ' / ' + p.scenes.length + ': ' + s.heading,
      '분위기: ' + s.mood + ', 카메라: ' + s.motion,
      '화면 설명: ' + (s.visual || s.heading),
      '내레이션(참고): ' + s.narration,
      s.prompt ? '영어 프롬프트(참고): ' + s.prompt : ''
    ].filter(Boolean).join('\n');
    return HS.callClaude(SYSTEM, [{ role: 'user', content: msg }], null, function(snap){
      onProgress && onProgress(Math.round(snap.length / 1024) + 'KB 그리는 중…');
    }, 'medium').then(function(r){
      var svg = HS.cleanSvg(r.text);
      if(!svg) throw new Error('그림(SVG)을 받지 못했습니다');
      s.svg = svg;
      HS.changed('scene');
      return HS.sceneLayersReady(s);
    });
  };
})();
