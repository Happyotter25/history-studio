/* 🎨 이미지 기획 — 대본에 맞는 그림을 장면마다 여러 장(샷) 준비합니다.
 *  - 화풍 하나와 등장인물 설정집(생김새)을 모든 프롬프트에 넣어, 영상 전체의 그림이 한 사람이 그린 것처럼 이어지게 합니다.
 *  - 샷은 내레이션의 문장에 맞춰 바뀝니다 (scene.shots[j].sentence = 그 샷이 시작하는 문장 번호).
 *  - 그림 지도 샷은 이미지 생성 대신 앱의 지도(정확한 해안선·지명)를 그림 지도 양식으로 그립니다.
 *  - 이미지는 ① 이미지 주문서(ZIP)를 Codex·ChatGPT 등 구독 도구에 맡겨 만든 뒤 파일 이름으로 불러오거나,
 *    ② 설정의 이미지 API 키로 바로 만들거나, ③ 샷마다 파일을 넣을 수 있습니다.
 * scene.shots = [{id, type(wide|scene|portrait|closeup|map), desc(한국어), prompt(영어), sentence, places[], image}]
 * project.art = {style, extra, cast:[{name, look}]}
 */
(function(){
  'use strict';
  var HS = window.HS, $ = HS.$, P = function(){ return HS.project; };

  var TYPES = { wide: '전경', scene: '사건 장면', portrait: '인물', closeup: '유물·사물', map: '그림 지도' };
  var STYLES = {
    webtoon: { label: '역사 웹툰', prompt: 'Korean history webtoon illustration, clean confident line art, soft cel shading, expressive faces' },
    ink: { label: '수묵 담채', prompt: 'traditional Korean ink-wash painting (sumukhwa) with light color washes, visible brush strokes on textured hanji paper' },
    oil: { label: '역사화(유화)', prompt: 'cinematic historical oil painting, dramatic chiaroscuro lighting, rich textured brushwork, epic composition' },
    textbook: { label: '교과서 삽화', prompt: 'clear educational textbook illustration, flat colors, clean simple shapes, friendly and readable' },
    minhwa: { label: '민화풍', prompt: 'Korean folk painting (minhwa) style, bold outlines, flat vivid mineral pigments, decorative patterns' },
    docu: { label: '다큐 재연 사진', prompt: 'photorealistic documentary reenactment still, natural light, shallow depth of field, film grain' }
  };
  HS.SHOT_TYPES = TYPES; HS.ART_STYLES = STYLES;
  function art(){ var p = P(); p.art = p.art || { style: 'webtoon', extra: '', cast: [] }; if(!p.art.cast) p.art.cast = []; return p.art; }
  HS.art = art;
  function newId(){ return Math.random().toString(36).slice(2, 6); }
  function pad2(n){ return (n < 10 ? '0' : '') + n; }

  /* ── 프롬프트 ───────────────────────────────────────── */
  // 샷 설명에 나오는 인물의 생김새를 붙여 같은 인물이 늘 같은 모습이 되게 합니다
  HS.shotPrompt = function(shot){
    var a = art(), st = STYLES[a.style] || STYLES.webtoon, text = (shot.prompt || '') + ' ' + (shot.desc || '');
    var cast = a.cast.filter(function(c){ return c.name && c.look && text.indexOf(c.name) >= 0; });
    return [
      'Style: ' + st.prompt + (a.extra ? ', ' + a.extra : '') + '.',
      shot.prompt || shot.desc || '',
      cast.length ? 'Characters (keep these looks consistent): ' + cast.map(function(c){ return c.name + ' — ' + c.look; }).join(' ') : '',
      'Historically accurate costume, armor, architecture and ships for the period.',
      P().aspect === '9:16' ? 'Vertical 9:16 composition, subject centered.' : 'Wide 16:9 composition.',
      'No text, letters, captions, signatures or watermarks anywhere in the image.'
    ].filter(Boolean).join('\n');
  };
  HS.shotFile = function(si, sj, shot){ return 'S' + pad2(si + 1) + '-' + (sj + 1) + '_' + shot.id + '.png'; };

  /* ── 기획: Claude ───────────────────────────────────── */
  var SCHEMA = {
    type: 'object', additionalProperties: false, required: ['cast', 'shots'],
    properties: {
      cast: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'look'], properties: { name: { type: 'string' }, look: { type: 'string' } } } },
      shots: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['scene', 'sentence', 'type', 'desc', 'prompt', 'places'],
        properties: { scene: { type: 'integer' }, sentence: { type: 'integer' }, type: { type: 'string', enum: Object.keys(TYPES) },
          desc: { type: 'string' }, prompt: { type: 'string' }, places: { type: 'array', items: { type: 'string' } } } } }
    }
  };
  function sentencesOf(t){ return (String(t || '').match(/[^.!?。]+[.!?。]?/g) || []).map(function(x){ return x.trim(); }).filter(Boolean); }
  HS.planShotsAI = function(onProgress){
    var p = P(), a = art();
    var sys = [
      '너는 역사 다큐 유튜브의 미술 감독이다. 대본을 보고 장면마다 보여 줄 그림(샷) 목록을 짠다. 시청자가 내레이션을 들으며 "지금 말하는 것"을 눈으로 보게 하는 것이 목표다.',
      '- 장면마다 1~3샷. 내레이션이 길면 3샷, 짧으면 1샷. sentence 는 그 샷이 시작하는 문장 번호(0부터). 한 장면 안에서 sentence 는 늘어나야 한다.',
      '- kind 가 source/timeline/people/compare 인 장면은 앱이 따로 그리므로 샷을 만들지 않는다. kind 가 map 인 장면은 type map 샷 하나.',
      '- type: wide(시대·장소를 보여 주는 전경), scene(사건의 한 순간), portrait(인물), closeup(유물·무기·문서·배 같은 사물), map(그림 지도 — 앱이 정확한 지도로 그린다).',
      '  같은 type 이 연달아 나오지 않게 섞는다. 이동·진격·위치가 중요한 문장에는 map 을 쓰고 places 에 지도에 찍을 지명(아래 지명 목록에서)을 넣는다. map 이 아니면 places 는 빈 배열.',
      '- desc: 한국어 한두 문장 (무엇을 어떻게 보여 줄지).',
      '- prompt: 이미지 생성용 영어 프롬프트. 구도(원경/근경/시점), 주인공, 동작, 시대 고증(복식·갑옷·건축·배), 빛과 분위기를 구체적으로. 화풍 말은 쓰지 않는다(앱이 붙인다). 글자·간판·깃발 글씨를 넣지 말 것. map 샷은 빈 문자열.',
      '  인물은 "Yi Sun-sin (이순신)" 처럼 로마자와 한글 이름을 함께 쓴다.',
      '- cast: 샷에 나오는 인물마다 생김새를 영어 한두 문장으로 고정한다(나이, 얼굴, 수염, 체격, 옷·갑옷 색). 사료로 알 수 없는 부분은 시대에 맞게 무난하게. 실존 인물을 희화화하지 않는다.',
      '- 화풍: ' + (STYLES[a.style] || STYLES.webtoon).label + '. 전쟁 장면도 교육용이므로 잔혹한 묘사는 피한다.'
    ].join('\n');
    var script = p.scenes.map(function(s, i){
      return '[장면 ' + (i + 1) + '] ' + s.heading + ' (kind: ' + HS.sceneKind(s) + ')\n' + sentencesOf(s.narration).map(function(t, k){ return '  (' + k + ') ' + t; }).join('\n');
    }).join('\n\n');
    var places = p.map.places.map(function(x){ return x.name; }).join(', ') || '(없음)';
    return HS.callClaude(sys, [{ role: 'user', content: '<script>\n' + script + '\n</script>\n\n지명 목록: ' + places + (a.cast.length ? '\n\n이미 정한 인물 설정(그대로 쓰고 필요하면 더함):\n' + a.cast.map(function(c){ return c.name + ': ' + c.look; }).join('\n') : '') }], SCHEMA, function(snap){
      var n = (snap.match(/"prompt"/g) || []).length; onProgress && onProgress(n ? '샷 ' + n + '개째…' : '구상하는 중…');
    }, 'medium').then(function(r){ applyPlan(r.data); return r.data; });
  };
  function applyPlan(d){
    var p = P(), a = art();
    // 인물 설정: 이미 있던 사람은 선생님이 고친 것을 지킵니다
    d.cast.forEach(function(c){ if(!a.cast.some(function(x){ return x.name === c.name; })) a.cast.push({ name: c.name, look: c.look }); });
    p.scenes.forEach(function(s){ s.shots = []; });
    d.shots.forEach(function(sh){
      var s = p.scenes[sh.scene - 1]; if(!s || HS.isDataScene(s)) return;
      s.shots.push({ id: newId(), type: TYPES[sh.type] ? sh.type : 'scene', desc: sh.desc, prompt: sh.prompt, sentence: Math.max(0, sh.sentence | 0), places: sh.places || [], image: null });
    });
    p.scenes.forEach(function(s){ s.shots.sort(function(x, y){ return x.sentence - y.sentence; }); });
    HS.changed('shots');
  }
  HS.applyShotPlan = applyPlan;

  /* ── 기획: 키 없이 (장면 설명 → 샷, 지명이 있으면 그림 지도 샷) ─── */
  HS.planShotsSimple = function(){
    var p = P(), names = p.map.places.map(function(x){ return x.name; });
    p.scenes.forEach(function(s, i){
      if(HS.isDataScene(s)){ s.shots = []; return; }
      var sents = sentencesOf(s.narration), shots = [];
      if(HS.sceneKind(s) === 'map'){ s.shots = [{ id: newId(), type: 'map', desc: '지도로 흐름 보기', prompt: '', sentence: 0, places: [], image: null }]; return; }
      // 대본의 프롬프트에서 화풍·금지 문구는 걷어 냅니다 (화풍은 이미지 탭에서 정한 것을 씀)
      var base = String(s.prompt || '').replace(/Korean history webtoon illustration,?\s*(soft painterly,?)?\s*/i, '').replace(/,?\s*(historically accurate costume and architecture|no text|no watermark)/gi, '').trim();
      var pr = i === 0 ? 'Atmospheric establishing illustration for a Korean history video titled "' + (p.title || s.heading) + '": period landscape and architecture, sense of drama'
        : 'Depict this moment from Korean history: ' + (sents[0] || s.heading) + (base && base !== s.heading ? ' (' + base + ')' : '');
      shots.push({ id: newId(), type: i === 0 ? 'wide' : 'scene', desc: s.visual && s.visual !== '제목 화면' ? s.visual : s.heading + ' 전경', prompt: pr, sentence: 0, places: [], image: null });
      // 지명이 나오는 문장이 있으면 그 문장에서 그림 지도로
      for(var k = 1; k < sents.length; k++){
        var found = names.filter(function(n){ return sents[k].indexOf(n) >= 0; });
        if(found.length){ shots.push({ id: newId(), type: 'map', desc: found.join('·') + ' 위치', prompt: '', sentence: k, places: found, image: null }); break; }
      }
      s.shots = shots;
    });
    HS.changed('shots');
  };

  /* ── 영상에서: 지금 보일 샷 ──────────────────────────── */
  // 샷마다 장면 안에서 시작하는 비율 (내레이션 글자 수 기준)
  HS.shotStarts = function(s){
    var sents = sentencesOf(s.narration), total = sents.join('').length || 1, acc = [0];
    sents.forEach(function(t, i){ acc[i + 1] = acc[i] + t.length; });
    var shots = s.shots || [], n = shots.length;
    var st = shots.map(function(sh, j){ return j === 0 ? 0 : (sh.sentence < sents.length ? acc[sh.sentence] / total : 1); });
    // 문장 번호가 없거나 차례가 어긋나면(짧은 내레이션 등) 샷을 고르게 나눕니다
    var bad = st.some(function(v, j){ return j > 0 && (v <= st[j - 1] || v > 0.9); });
    return bad ? shots.map(function(sh, j){ return j / n; }) : st;
  };
  function ready(sh){ return sh.type === 'map' ? HS.project.map.places.length > 0 : !!sh.image; }
  HS.readyShots = function(s){ return (s.shots || []).filter(ready); };
  function focusMap(sh){
    var m = HS.project.map, names = (sh.places || []).filter(function(n){ return m.places.some(function(p){ return p.name === n; }); });
    if(!names.length) return m;
    var pl = m.places.filter(function(p){ return names.indexOf(p.name) >= 0; });
    // 한 곳만이면 주변이 보이게 이웃 지명도 함께 (보기 범위만)
    return { title: sh.desc || m.title, view: null, places: pl, regions: m.regions, routes: m.routes.filter(function(r){ return names.indexOf(r.from) >= 0 && names.indexOf(r.to) >= 0; }) };
  }
  var MOTIONS = ['zoomIn', 'panRight', 'zoomOut', 'panLeft'];
  function drawOne(ctx, w, h, s, sh, j, k){
    if(sh.type === 'map'){ HS.drawMap(ctx, w, h, focusMap(sh), { style: HS.project.mapStyle || 'illust', progress: Math.min(1, k * 1.4) }); return; }
    var img = HS.sceneImage({ image: sh.image }); if(!img) return;
    var motion = MOTIONS[(MOTIONS.indexOf(s.motion) + j + 4) % 4];
    var r = HS.motionRect(motion, k, img.width, img.height, w, h);
    ctx.drawImage(img, r[0], r[1], r[2], r[3]);
  }
  // f: 장면의 내레이션 진행(0~1). 샷이 바뀔 때 0.12 동안 겹칩니다
  HS.drawShots = function(ctx, w, h, s, f){
    var shots = (s.shots || []), starts = HS.shotStarts(s), list = [];
    shots.forEach(function(sh, j){ if(ready(sh)) list.push({ sh: sh, j: j, st: starts[j] }); });
    if(!list.length) return false;
    list[0].st = 0;
    var cur = 0;
    for(var i = 0; i < list.length; i++) if(f >= list[i].st) cur = i;
    var a = list[cur], end = cur + 1 < list.length ? list[cur + 1].st : 1.05;
    var k = Math.max(0, Math.min(1, (f - a.st) / Math.max(0.05, end - a.st)));
    var fade = Math.min(1, (f - a.st) / 0.12);
    if(cur > 0 && fade < 1){
      var b = list[cur - 1];
      drawOne(ctx, w, h, s, b.sh, b.j, 1);
      ctx.save(); ctx.globalAlpha = fade; drawOne(ctx, w, h, s, a.sh, a.j, k); ctx.restore();
    } else drawOne(ctx, w, h, s, a.sh, a.j, k);
    return true;
  };
  HS.firstShotImage = function(s){ var r = HS.readyShots(s).filter(function(x){ return x.image; })[0]; return r ? r.image : null; };

  /* ── 이미지 주문서 (Codex·ChatGPT 등 구독 도구용) ──────────── */
  HS.pendingShots = function(all){
    var out = [];
    P().scenes.forEach(function(s, i){ (s.shots || []).forEach(function(sh, j){ if(sh.type !== 'map' && (all || !sh.image)) out.push({ si: i, sj: j, s: s, sh: sh }); }); });
    return out;
  };
  HS.exportImageOrder = function(all, noDownload){
    var p = P(), list = HS.pendingShots(all);
    if(!list.length) return Promise.reject(new Error(all ? '샷이 없습니다. 먼저 이미지 기획을 하세요' : '만들 그림이 없습니다 (모두 채워졌거나 샷이 없음)'));
    var portrait = p.aspect === '9:16', size = portrait ? '1024x1536' : '1536x1024';
    var items = list.map(function(x){
      return { file: HS.shotFile(x.si, x.sj, x.sh), scene: x.si + 1, shot: x.sj + 1, heading: x.s.heading, type: TYPES[x.sh.type], desc_ko: x.sh.desc, size: size, aspect: portrait ? '9:16' : '16:9', prompt: HS.shotPrompt(x.sh) };
    });
    var zip = new window.JSZip(), root = zip.folder('이미지 주문서');
    root.file('prompts.json', JSON.stringify({ project: p.title || '', style: (STYLES[art().style] || STYLES.webtoon).label, count: items.length, images: items }, null, 2));
    root.folder('images').file('여기에 그림을 저장.txt', 'prompts.json 의 file 이름 그대로 이 폴더에 저장하세요.');
    root.file('CODEX_PROMPT.txt', [
      'Generate the images listed in prompts.json in this folder.',
      'For each item: use your image generation tool with the "prompt" text exactly as written, aspect ratio "' + (portrait ? '9:16 (portrait, ' : '16:9 (landscape, ') + size + ')".',
      'Save each image as PNG into ./images/ using the exact "file" name (e.g. images/' + items[0].file + ').',
      'Do not add any text, letters or watermarks to the images. Do not modify prompts.json.',
      'Work through all ' + items.length + ' items in order, then list any file that could not be generated.',
      '',
      '(한국어) 이 폴더의 prompts.json 에 있는 그림 ' + items.length + '장을 차례로 만들어, file 이름 그대로 images 폴더에 PNG 로 저장해 주세요. 그림에 글자를 넣지 마세요.'
    ].join('\n'));
    root.file('읽어 주세요.md', [
      '# 이미지 주문서 — ' + (p.title || '사관 스튜디오'),
      '',
      '그림 ' + items.length + '장의 목록과 프롬프트가 `prompts.json`에 있습니다. 파일 이름(예: `' + items[0].file + '`)을 그대로 지켜 `images` 폴더에 저장하면,',
      '사관 스튜디오의 **🎨 이미지 → 만든 이미지 불러오기**에서 한꺼번에 불러와 장면에 자동으로 붙습니다.',
      '',
      '## Codex로 만들기',
      '1. 이 폴더(압축 푼 곳)에서 터미널을 열고 `codex` 를 실행합니다.',
      '2. `CODEX_PROMPT.txt` 의 내용을 붙여 넣습니다.',
      '3. 다 되면 `images` 폴더의 그림들을 사관 스튜디오에서 불러옵니다.',
      '',
      '> Codex 에서 이미지 생성을 쓸 수 있는지는 요금제와 Codex 버전에 따라 다릅니다. 이미지 생성 도구가 없다고 하면 아래 ChatGPT 방법을 쓰세요.',
      '',
      '## ChatGPT 앱으로 만들기 (한 장씩)',
      '1. `prompts.json` 에서 prompt 를 복사해 ChatGPT에 붙여 넣고 그림을 만들어 달라고 합니다.',
      '   (사관 스튜디오의 🎨 이미지 탭에서 샷마다 "프롬프트 복사" 단추를 눌러도 됩니다.)',
      '2. 받은 그림을 file 이름으로 저장하거나, 스튜디오에서 그 샷의 "파일 넣기"로 바로 넣습니다.',
      '',
      '## 목록',
      '| 파일 | 장면 | 종류 | 설명 |',
      '|---|---|---|---|'
    ].concat(items.map(function(x){ return '| ' + x.file + ' | ' + x.scene + '. ' + x.heading + ' | ' + x.type + ' | ' + String(x.desc_ko || '').replace(/\|/g, '/') + ' |'; })).join('\n'));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(function(blob){
      if(!noDownload) HS.download(HS.fileName(' 이미지 주문서.zip'), blob);
      return { blob: blob, count: items.length };
    });
  };

  /* ── 만든 그림 불러오기: 파일 이름(S03-2_ab12.png)으로 샷을 찾습니다 ─── */
  HS.matchShotFile = function(name){
    var m = String(name).match(/S(\d{1,3})-(\d{1,2})(?:_([a-z0-9]{4}))?/i); if(!m) return null;
    var sc = P().scenes, hit = null;
    if(m[3]) sc.forEach(function(s){ (s.shots || []).forEach(function(sh){ if(sh.id === m[3].toLowerCase()) hit = sh; }); });
    if(!hit){ var s = sc[+m[1] - 1]; hit = s && s.shots && s.shots[+m[2] - 1] || null; }
    return hit;
  };
  HS.importShotFiles = function(files){
    var ok = 0, miss = [];
    return Array.prototype.slice.call(files).filter(function(f){ return /^image\//.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name); })
      .reduce(function(chain, f){
        return chain.then(function(){
          var sh = HS.matchShotFile(f.name);
          if(!sh){ miss.push(f.name); return; }
          return HS.readFile(f).then(function(u){ return HS.shrinkImage(u, 1920); }).then(function(u){ sh.image = u; ok++; });
        });
      }, Promise.resolve()).then(function(){ HS.changed('shots'); return { ok: ok, miss: miss }; });
  };

  // 이미지 API 키가 있으면 샷을 바로 만듭니다
  HS.generateShotImage = function(sh){
    return HS.generateImage(HS.shotPrompt(sh), P().aspect).then(function(u){ return HS.shrinkImage(u, 1920); }).then(function(u){ sh.image = u; HS.changed('shots'); return u; });
  };
  HS.shotStats = function(){
    var n = 0, done = 0;
    P().scenes.forEach(function(s){ (s.shots || []).forEach(function(sh){ if(sh.type === 'map') return; n++; if(sh.image) done++; }); });
    return { total: n, done: done };
  };
})();
