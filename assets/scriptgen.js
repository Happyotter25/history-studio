/* 소스 → 대본 · 판서 · 지도
 *  - AI: Claude 에게 구조화된 JSON 으로 한 번에 받습니다.
 *  - 간이: 키가 없을 때 소스 문장을 장면으로 나누고 지명·연도를 뽑습니다.
 */
(function(){
  'use strict';
  var HS = window.HS;
  var MOODS = ['dawn', 'day', 'dusk', 'night', 'war', 'sea', 'court', 'snow'];
  var MOTIONS = ['zoomIn', 'zoomOut', 'panLeft', 'panRight'];
  var TRANSITIONS = ['fade', 'ink', 'wipe', 'cut'];

  var SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['title', 'scenes', 'board', 'map'],
    properties: {
      title: { type: 'string' },
      scenes: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['heading', 'narration', 'visual', 'prompt', 'mood', 'motion', 'use_map', 'caption', 'transition', 'keywords'],
        properties: {
          heading: { type: 'string' },
          narration: { type: 'string' },
          visual: { type: 'string' },
          prompt: { type: 'string' },
          mood: { type: 'string', enum: MOODS },
          motion: { type: 'string', enum: MOTIONS },
          use_map: { type: 'boolean' },
          caption: { type: 'string' },
          transition: { type: 'string', enum: TRANSITIONS },
          keywords: { type: 'array', items: { type: 'string' } }
        } } },
      board: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'lines'],
        properties: { title: { type: 'string' }, lines: { type: 'array', items: { type: 'string' } } } } },
      map: {
        type: 'object', additionalProperties: false,
        required: ['title', 'places', 'routes', 'regions'],
        properties: {
          title: { type: 'string' },
          places: { type: 'array', items: {
            type: 'object', additionalProperties: false,
            required: ['name', 'lon', 'lat', 'kind'],
            properties: { name: { type: 'string' }, lon: { type: 'number' }, lat: { type: 'number' }, kind: { type: 'string', enum: ['capital', 'city', 'battle'] } } } },
          routes: { type: 'array', items: {
            type: 'object', additionalProperties: false,
            required: ['from', 'to', 'label'],
            properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' } } } },
          regions: { type: 'array', items: {
            type: 'object', additionalProperties: false,
            required: ['name', 'color', 'points'],
            properties: { name: { type: 'string' }, color: { type: 'string' }, points: { type: 'array', items: { type: 'array', items: { type: 'number' } } } } } }
        } }
    }
  };
  HS.SCRIPT_SCHEMA = SCHEMA;

  var LENGTH = { short: '약 1분 분량의 세로형 쇼츠(장면 4~6개, 내레이션 합계 300~400자)', mid: '5~8분 분량(장면 8~14개)', long: '10분 이상 분량(장면 14~24개)' };

  function systemPrompt(opt){
    return [
      '너는 한국사·세계사 역사 유튜브 채널의 작가이자 편집자다. 사용자는 고등학교 역사 교사다.',
      '사용자가 준 소스만을 근거로 영상 대본을 짓는다. 소스에 없는 사실을 지어내지 말고, 해석이 갈리는 부분은 "~라는 견해가 있다"처럼 말한다.',
      '영상 길이: ' + (LENGTH[opt.length] || LENGTH.mid) + '. 시청자: ' + opt.audience + '. 말투: ' + opt.tone + '.',
      '',
      '출력 JSON 필드:',
      '- title: 영상 제목 (클릭하고 싶지만 과장 없는 제목).',
      '- scenes: 장면 목록. 첫 장면은 궁금증을 여는 훅, 마지막 장면은 정리와 다음 영상 예고.',
      '  - heading: 장면 제목 (15자 안팎).',
      '  - narration: 소리 내어 읽을 내레이션. 문장은 짧게, 숫자와 연도는 읽기 쉽게.',
      '  - visual: 화면에 보일 삽화 설명 (한국어, 인물·장소·구도·분위기).',
      '  - prompt: 이미지 생성 도구에 넣을 영어 프롬프트. 시대 고증(복식, 건축, 무기)을 구체적으로, 스타일은 "Korean history webtoon illustration, soft painterly" 로 통일하고, 글자나 워터마크를 넣지 말라고 적는다.',
      '  - mood: ' + MOODS.join('|') + ' 가운데 하나.',
      '  - motion: 카메라 움직임 ' + MOTIONS.join('|') + ' 가운데 하나. 이웃 장면끼리 겹치지 않게.',
      '  - caption: 화면 왼쪽 위에 띄울 짧은 이름표. "1592년 4월 · 부산"처럼 연도·장소, 또는 "이순신 (1545~1598)"처럼 처음 나오는 인물. 20자 이내, 없으면 빈 문자열.',
      '  - transition: 앞 장면에서 넘어오는 방식 fade(부드럽게)|ink(먹 번짐, 시대·분위기가 크게 바뀔 때)|wipe(붓으로 쓸기, 장소 이동)|cut(바로, 긴박한 장면). 대부분 fade.',
      '  - keywords: 자막에서 노랗게 강조할 핵심어 1~4개(인물·연도·장소·개념). narration 에 글자 그대로 들어 있는 말만.',
      '  - use_map: 이 장면을 삽화 대신 지도(경로가 그려지는 모습)로 보여 주는 편이 좋으면 true. 전쟁의 진격로, 천도, 영토 변화 같은 장면. 영상 전체에서 1~3개.',
      '- board: 칠판 판서 슬라이드 3~6장. lines 는 칠판에 쓸 짧은 줄들이다.',
      '  줄 앞 "-" 는 들여쓰기, "*" 는 노란 분필(핵심어·연도), "!" 는 분홍 분필(주의·반전), "[ ]" 로 감싸면 네모 칸, "→" 로 인과를 잇는다. 한 장에 8줄 이하.',
      '- map: 소스에 나오는 장소를 지도에 찍는다. lon/lat 는 십진수 경위도(동경·북위는 양수). kind 는 capital(수도)|city|battle(전투지).',
      '  routes 는 이동·진격·피란 경로를 순서대로 from/to(places 의 name 과 같게)와 짧은 label 로 적는다. 장소가 없으면 빈 배열.',
      '  regions 는 그 시기 나라의 대략적인 판도나 점령지를 반투명하게 칠할 영역이다. points 는 [경도, 위도] 10~24개로 둘레를 시계 방향으로 잇는다.',
      '  바다를 크게 가로지르지 않게 해안을 따라 잡고, name 에는 "고구려(5세기, 대략)"처럼 시기와 "대략"을 적는다. color 는 "#b8322a" 같은 6자리 색. 필요 없으면 빈 배열.'
    ].join('\n');
  }

  /* 소스 묶음: 첨부한 PDF·사진은 문서·그림 블록으로, 붙여 넣은 글은 <source> 로.
   * 첨부는 여러 요청에 똑같이 앞에 두고 캐시 표시를 붙여, 장면 고치기·사실 확인을 되풀이할 때 값이 덜 들게 합니다. */
  function userContent(text){
    var p = HS.project, blocks = [];
    (p.sourceFiles || []).forEach(function(f){
      if(f.mediaType === 'application/pdf') blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data }, title: f.name });
      else blocks.push({ type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.data } });
    });
    if(blocks.length) blocks[blocks.length - 1].cache_control = { type: 'ephemeral' };
    var src = p.source.trim() ? '<source>\n' + p.source + '\n</source>\n\n' : '';
    if(blocks.length) src = '(첨부한 파일' + (src ? '과 아래 글' : '') + '이 소스입니다.)\n' + src;
    blocks.push({ type: 'text', text: src + text });
    return blocks;
  }
  HS.userContent = userContent;
  HS.hasSource = function(){ var p = HS.project; return !!(p.source.trim() || (p.sourceFiles && p.sourceFiles.length)); };

  HS.generateAI = function(onProgress){
    var p = HS.project;
    return HS.callClaude(systemPrompt(p.options), [{ role: 'user', content: userContent('이 소스로 영상 대본을 지어 주세요.') }], SCHEMA, function(snap){
      var n = (snap.match(/"narration"/g) || []).length;
      onProgress && onProgress(n ? '장면 ' + n + '개째 쓰는 중…' : '구상하는 중…');
    }, 'high').then(function(r){ applyResult(r.data); return r.data; });
  };

  function applyResult(d){
    var p = HS.project;
    p.title = p.title || d.title;
    p.scenes = d.scenes.map(function(s){
      return { heading: s.heading, narration: s.narration, visual: s.visual, prompt: s.prompt, mood: s.mood, motion: s.motion, useMap: !!s.use_map, caption: s.caption || '', transition: s.transition || 'fade', keywords: (s.keywords || []).filter(function(k){ return k && s.narration.indexOf(k) >= 0; }), image: null };
    });
    p.board = d.board.map(function(b){ return { title: b.title, text: b.lines.join('\n'), drawing: null }; });
    p.map = { title: d.map.title, view: null, places: d.map.places, routes: d.map.routes, regions: (d.map.regions || []).filter(function(r){ return r.points && r.points.length > 2; }) };
    p.checks = null;
    if(p.options.length === 'short') p.aspect = '9:16';
    HS.changed('all');
  }
  HS.applyScriptResult = applyResult;

  /* ── 간이 생성 (AI 없이) ───────────────────────────────── */
  function sentences(text){
    return String(text).replace(/\r/g, '').split(/\n+/).map(function(s){ return s.trim(); }).filter(Boolean)
      .reduce(function(acc, para){
        (para.match(/[^.!?。]+[.!?。]?["'”’)]*\s*/g) || [para]).forEach(function(s){ s = s.trim(); if(s) acc.push(s); });
        return acc;
      }, []);
  }
  function headingOf(sent){
    // 연도를 떼고 앞의 낱말 몇 개(10자 이상이 될 때까지)를 제목으로 씁니다
    var words = sent.replace(/^\d{3,4}년\s*(\d{1,2}월)?,?\s*/, '').replace(/[.。!?]$/, '').split(/\s+/), h = '';
    for(var i = 0; i < words.length && h.length < 10; i++) h += (h ? ' ' : '') + words[i];
    h = h.replace(/[,，]$/, '');
    return h.length > 20 ? h.slice(0, 18) + '…' : h;
  }
  function guessMood(t){
    if(/바다|수군|해전|함선|배를|해협|포구|항해/.test(t)) return 'sea';
    if(/전투|싸웠|패하|함락|쳐들어|침략|전쟁|반란|공격|진격/.test(t)) return 'war';
    if(/왕|궁|조정|즉위|신하|어전|회의/.test(t)) return 'court';
    if(/겨울|눈|추위/.test(t)) return 'snow';
    if(/밤|몰래|새벽/.test(t)) return 'night';
    return 'day';
  }
  function findPlaces(text){
    var found = [];
    (window.PLACES || []).forEach(function(pl){
      var names = [pl.name].concat(pl.alias || []), at = -1;
      names.forEach(function(n){ var i = text.indexOf(n); if(i >= 0 && (at < 0 || i < at)) at = i; });
      if(at >= 0) found.push({ at: at, place: { name: pl.name, lon: pl.lon, lat: pl.lat, kind: pl.kind } });
    });
    found.sort(function(a, b){ return a.at - b.at; });
    return found.map(function(f){ return f.place; });
  }
  HS.findPlaces = findPlaces;

  // 간이 핵심어: 연도와 지명
  function keywordsOf(text){
    var k = (text.match(/\d{3,4}년/g) || []).concat(findPlaces(text).map(function(p){ return p.name; }).filter(function(n){ return text.indexOf(n) >= 0; }));
    return k.filter(function(x, i){ return k.indexOf(x) === i; }).slice(0, 4);
  }
  // 간이 이름표: 첫 연도(월까지)와 처음 나오는 지명
  function captionOf(text){
    var y = text.match(/\d{3,4}년(\s*\d{1,2}월)?/), pl = findPlaces(text)[0];
    return [y && y[0], pl && pl.name].filter(Boolean).join(' · ');
  }
  HS.generateSimple = function(){
    var p = HS.project, sents = sentences(p.source);
    if(!sents.length) throw new Error(p.sourceFiles && p.sourceFiles.length ? 'PDF·사진 소스는 AI 모드(설정에서 API 키)에서만 읽을 수 있습니다. 글로 붙여 넣으면 간이 모드로도 만들 수 있습니다' : '소스가 비어 있습니다');
    var first = p.source.trim().split('\n')[0].trim();
    var title = first.length <= 30 && !/[.。]$/.test(first) ? first : headingOf(sents[0]);
    if(title === sents[0]) sents.shift();
    var per = p.options.length === 'short' ? 3 : 2;
    var scenes = [];
    for(var i = 0; i < sents.length; i += per){
      var chunk = sents.slice(i, i + per), text = chunk.join(' ');
      scenes.push({
        heading: headingOf(chunk[0]), narration: text,
        visual: headingOf(chunk[0]) + ' 장면을 그린 삽화',
        prompt: 'Korean history webtoon illustration, soft painterly, ' + headingOf(chunk[0]) + ', historically accurate costume and architecture, no text, no watermark',
        mood: guessMood(text), motion: MOTIONS[scenes.length % MOTIONS.length], caption: captionOf(text), keywords: keywordsOf(text), image: null
      });
    }
    scenes.unshift({ heading: title, narration: '오늘은 ' + title + ' 이야기를 해 보겠습니다.', visual: '제목 화면', prompt: '', mood: 'dusk', motion: 'zoomIn', image: null });
    // 판서: 장면 두 개씩 한 장, 연도는 노란 분필
    var board = [{ title: title, text: scenes.slice(1).map(function(s){ return (/\d{3,4}년/.test(s.narration) ? '*' + s.narration.match(/\d{3,4}년/)[0] + ' ' : '') + s.heading; }).join('\n→ '), drawing: null }];
    for(var j = 1; j < scenes.length; j += 2){
      var lines = [];
      scenes.slice(j, j + 2).forEach(function(s){
        lines.push('[' + s.heading + ']');
        sentences(s.narration).forEach(function(t){
          var y = t.match(/\d{3,4}년/);
          lines.push('- ' + (y ? '*' : '') + t.replace(/[.。]$/, '').slice(0, 34));
        });
      });
      board.push({ title: (j + 1) / 2 + '. ' + scenes[j].heading.replace(/[은는이가을를]$/, ''), text: lines.join('\n'), drawing: null });
    }
    var places = findPlaces(p.source), routes = [];
    for(var k = 1; k < places.length && k < 5; k++) routes.push({ from: places[k - 1].name, to: places[k].name, label: '' });
    p.title = p.title || title;
    p.scenes = scenes;
    p.board = board;
    p.map = { title: title, view: null, places: places, routes: routes, regions: [] };
    p.checks = null;
    if(p.options.length === 'short') p.aspect = '9:16';
    HS.changed('all');
  };

  HS.scriptText = function(){
    var p = HS.project;
    return [p.title, ''].concat(p.scenes.map(function(s, i){
      return '#' + (i + 1) + ' ' + s.heading + '\n[화면] ' + s.visual + '\n[내레이션] ' + s.narration + (s.prompt ? '\n[이미지 프롬프트] ' + s.prompt : '');
    })).join('\n\n');
  };

  /* ── 장면 하나만 AI로 고치기 ───────────────────────────── */
  var SCENE_SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['heading', 'narration', 'visual', 'prompt'],
    properties: { heading: { type: 'string' }, narration: { type: 'string' }, visual: { type: 'string' }, prompt: { type: 'string' } }
  };
  HS.REWRITES = {
    short: '내레이션을 지금의 절반 길이로 줄여 주세요. 핵심 사실은 남기세요.',
    easy: '중학생도 알아듣게 쉬운 말로 풀어 주세요. 어려운 한자어는 뜻을 곁들이세요.',
    drama: '이야기꾼처럼 더 긴장감 있게 써 주세요. 사실은 바꾸지 마세요.',
    quote: '소스에 있는 사료 구절을 한 문장 인용해 넣어 주세요. 소스에 사료가 없으면 인용하지 말고 그대로 두세요.',
    hook: '시청자가 계속 보고 싶어지게 질문으로 시작해 주세요.'
  };
  HS.rewriteScene = function(i, instruction){
    var p = HS.project, s = p.scenes[i];
    var outline = p.scenes.map(function(x, k){ return (k === i ? '▶ ' : '  ') + (k + 1) + '. ' + x.heading; }).join('\n');
    var sys = systemPrompt(p.options) + '\n\n지금은 대본 전체가 아니라 장면 하나만 고친다. 앞뒤 장면과 이어지게 하고, 출력은 heading/narration/visual/prompt 만.';
    var msg = '대본 차례:\n' + outline + '\n\n고칠 장면 (' + (i + 1) + '번):\n' +
      JSON.stringify({ heading: s.heading, narration: s.narration, visual: s.visual, prompt: s.prompt }, null, 1) + '\n\n요청: ' + instruction;
    return HS.callClaude(sys, [{ role: 'user', content: userContent(msg) }], SCENE_SCHEMA, null, 'medium').then(function(r){
      var d = r.data;
      s.heading = d.heading; s.narration = d.narration; s.visual = d.visual; s.prompt = d.prompt;
      HS.changed('scene');
      return d;
    });
  };

  /* ── 사실 확인: 대본의 주장을 소스와 맞대어 봅니다 ─────────────── */
  var CHECK_SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['summary', 'items'],
    properties: {
      summary: { type: 'string' },
      items: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['scene', 'claim', 'verdict', 'note', 'quote'],
        properties: {
          scene: { type: 'integer' }, claim: { type: 'string' },
          verdict: { type: 'string', enum: ['ok', 'unsupported', 'wrong', 'debated'] },
          note: { type: 'string' }, quote: { type: 'string' }
        } } }
    }
  };
  HS.VERDICT = { ok: '소스와 맞음', unsupported: '소스에 없음', wrong: '소스와 다름', debated: '해석이 갈림' };
  HS.factCheck = function(){
    var p = HS.project;
    var sys = [
      '너는 역사 교육 콘텐츠의 사실 확인 담당이다. 영상 대본의 사실 주장(인물·연도·장소·숫자·인과)을 하나씩 뽑아 소스와 맞대어 본다.',
      '- verdict: ok(소스가 뒷받침), unsupported(소스에 근거 없음 — 일반 상식이어도 소스에 없으면 여기), wrong(소스와 어긋남), debated(학계 해석이 갈리는 표현).',
      '- quote: 근거가 되는 소스 구절을 그대로 옮긴다. 없으면 빈 문자열.',
      '- note: 무엇을 어떻게 고치면 좋을지 한 문장. ok 면 빈 문자열이어도 된다.',
      '- scene: 장면 번호(1부터).',
      '- 문제가 되는 주장을 빠짐없이 싣고, ok 인 주장은 중요한 것만 싣는다.',
      '- summary: 전체 평가 두세 문장.'
    ].join('\n');
    var script = p.scenes.map(function(s, k){ return '[' + (k + 1) + '] ' + s.heading + '\n' + s.narration; }).join('\n\n');
    return HS.callClaude(sys, [{ role: 'user', content: userContent('<script>\n' + script + '\n</script>') }], CHECK_SCHEMA, null, 'high').then(function(r){
      p.checks = { at: new Date().toISOString(), summary: r.data.summary, items: r.data.items };
      HS.changed('checks');
      return p.checks;
    });
  };
})();
