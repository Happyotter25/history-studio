/* 소스 → 대본 · 판서 · 지도
 *  - AI: Claude 에게 구조화된 JSON 으로 한 번에 받습니다.
 *  - 간이: 키가 없을 때 소스 문장을 장면으로 나누고 지명·연도를 뽑습니다.
 */
(function(){
  'use strict';
  var HS = window.HS;
  var MOODS = ['dawn', 'day', 'dusk', 'night', 'war', 'sea', 'court', 'snow'];
  var MOTIONS = ['zoomIn', 'zoomOut', 'panLeft', 'panRight'];

  var SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['title', 'scenes', 'board', 'map'],
    properties: {
      title: { type: 'string' },
      scenes: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['heading', 'narration', 'visual', 'prompt', 'mood', 'motion'],
        properties: {
          heading: { type: 'string' },
          narration: { type: 'string' },
          visual: { type: 'string' },
          prompt: { type: 'string' },
          mood: { type: 'string', enum: MOODS },
          motion: { type: 'string', enum: MOTIONS }
        } } },
      board: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'lines'],
        properties: { title: { type: 'string' }, lines: { type: 'array', items: { type: 'string' } } } } },
      map: {
        type: 'object', additionalProperties: false,
        required: ['title', 'places', 'routes'],
        properties: {
          title: { type: 'string' },
          places: { type: 'array', items: {
            type: 'object', additionalProperties: false,
            required: ['name', 'lon', 'lat', 'kind'],
            properties: { name: { type: 'string' }, lon: { type: 'number' }, lat: { type: 'number' }, kind: { type: 'string', enum: ['capital', 'city', 'battle'] } } } },
          routes: { type: 'array', items: {
            type: 'object', additionalProperties: false,
            required: ['from', 'to', 'label'],
            properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' } } } }
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
      '- board: 칠판 판서 슬라이드 3~6장. lines 는 칠판에 쓸 짧은 줄들이다.',
      '  줄 앞 "-" 는 들여쓰기, "*" 는 노란 분필(핵심어·연도), "!" 는 분홍 분필(주의·반전), "[ ]" 로 감싸면 네모 칸, "→" 로 인과를 잇는다. 한 장에 8줄 이하.',
      '- map: 소스에 나오는 장소를 지도에 찍는다. lon/lat 는 십진수 경위도(동경·북위는 양수). kind 는 capital(수도)|city|battle(전투지).',
      '  routes 는 이동·진격·피란 경로를 순서대로 from/to(places 의 name 과 같게)와 짧은 label 로 적는다. 장소가 없으면 빈 배열.'
    ].join('\n');
  }

  HS.generateAI = function(onProgress){
    var p = HS.project;
    return HS.callClaude(systemPrompt(p.options), [{ role: 'user', content: '다음 소스로 영상 대본을 지어 주세요.\n\n<source>\n' + p.source + '\n</source>' }], SCHEMA, function(snap){
      var n = (snap.match(/"narration"/g) || []).length;
      onProgress && onProgress(n ? '장면 ' + n + '개째 쓰는 중…' : '구상하는 중…');
    }, 'high').then(function(r){ applyResult(r.data); return r.data; });
  };

  function applyResult(d){
    var p = HS.project;
    p.title = p.title || d.title;
    p.scenes = d.scenes.map(function(s){
      return { heading: s.heading, narration: s.narration, visual: s.visual, prompt: s.prompt, mood: s.mood, motion: s.motion, image: null };
    });
    p.board = d.board.map(function(b){ return { title: b.title, text: b.lines.join('\n'), drawing: null }; });
    p.map = { title: d.map.title, view: null, places: d.map.places, routes: d.map.routes };
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

  HS.generateSimple = function(){
    var p = HS.project, sents = sentences(p.source);
    if(!sents.length) throw new Error('소스가 비어 있습니다');
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
        mood: guessMood(text), motion: MOTIONS[scenes.length % MOTIONS.length], image: null
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
    p.map = { title: title, view: null, places: places, routes: routes };
    HS.changed('all');
  };

  HS.scriptText = function(){
    var p = HS.project;
    return [p.title, ''].concat(p.scenes.map(function(s, i){
      return '#' + (i + 1) + ' ' + s.heading + '\n[화면] ' + s.visual + '\n[내레이션] ' + s.narration + (s.prompt ? '\n[이미지 프롬프트] ' + s.prompt : '');
    })).join('\n\n');
  };
})();
