/* ⑨ 수업 자료 — 영상과 짝을 이루는 퀴즈·빈칸 요약·활동·토론 질문
 *  - Claude 가 대본(과 소스)을 보고 짓습니다. 키가 없으면 연도·지명으로 빈칸 문제를 만듭니다.
 *  - 학습지(학생용/교사용 답 포함)는 인쇄하기 좋은 HTML 로, 퀴즈는 문제→정답 슬라이드가 번갈아 나오는 PPT 로 받습니다.
 */
(function(){
  'use strict';
  var HS = window.HS, $ = HS.$, P = function(){ return HS.project; };

  var SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['goals', 'quiz', 'summary', 'activity', 'discussion'],
    properties: {
      goals: { type: 'array', items: { type: 'string' } },
      quiz: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['type', 'question', 'choices', 'answer', 'explain', 'scene'],
        properties: {
          type: { type: 'string', enum: ['choice', 'ox', 'short'] },
          question: { type: 'string' }, choices: { type: 'array', items: { type: 'string' } },
          answer: { type: 'string' }, explain: { type: 'string' }, scene: { type: 'integer' }
        } } },
      summary: { type: 'string' },
      activity: { type: 'object', additionalProperties: false, required: ['title', 'steps'], properties: { title: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } } } },
      discussion: { type: 'array', items: { type: 'string' } }
    }
  };
  HS.generateLessonAI = function(){
    var p = P();
    var sys = [
      '너는 고등학교 역사 교사를 돕는 수업 설계자다. 아래 영상 대본을 수업에서 쓸 자료로 만든다. 대본과 소스에 있는 내용만으로 문제를 낸다.',
      '- goals: 학습 목표 2~3개 ("~할 수 있다" 꼴).',
      '- quiz: 8문제. choice(4지선다, choices 4개, answer 는 정답 보기의 글 그대로) 5개, ox(choices ["O","X"]) 2개, short(단답, choices 빈 배열) 1개.',
      '  쉬운 사실 확인에서 인과·비교를 묻는 문제로 차례로 어려워지게. 오답 보기는 그럴듯하되 명백히 틀리게. explain 은 한두 문장 해설. scene 은 근거 장면 번호(1부터).',
      '- summary: 영상 내용을 5~7문장으로 요약하되, 핵심어(인물·연도·장소·개념) 6~8개를 [[핵심어]] 처럼 겹대괄호로 감싼다. 학생용에서는 빈칸이 된다.',
      '- activity: 모둠 활동 하나. title 과 차례 steps 3~5개 (예: 사료 읽고 인물의 선택 평가하기, 지도에 경로 그리기).',
      '- discussion: 정답이 하나로 정해지지 않는 토론 질문 2~3개.'
    ].join('\n');
    var script = p.scenes.map(function(s, k){ return '[' + (k + 1) + '] ' + s.heading + '\n' + s.narration; }).join('\n\n');
    return HS.callClaude(sys, [{ role: 'user', content: HS.userContent('<script>\n' + script + '\n</script>') }], SCHEMA, null, 'medium').then(function(r){
      p.lesson = r.data; HS.changed('lesson'); return p.lesson;
    });
  };

  // 키가 없을 때: 연도·지명이 든 문장으로 빈칸 문제를 만듭니다
  HS.generateLessonSimple = function(){
    var p = P(), quiz = [], keys = [];
    var years = [], places = [];
    p.scenes.forEach(function(s){
      (s.narration.match(/\d{3,4}년/g) || []).forEach(function(y){ if(years.indexOf(y) < 0) years.push(y); });
      HS.findPlaces(s.narration).forEach(function(pl){ if(places.indexOf(pl.name) < 0) places.push(pl.name); });
    });
    p.scenes.forEach(function(s, i){
      (s.narration.match(/[^.!?。]+[.!?。]?/g) || []).forEach(function(sent){
        if(quiz.length >= 8) return;
        sent = sent.trim();
        var y = sent.match(/\d{3,4}년/), pl = HS.findPlaces(sent)[0], ans = null, pool = null;
        if(pl && sent.indexOf(pl.name) >= 0 && places.length >= 3){ ans = pl.name; pool = places; }
        else if(y && years.length >= 3){ ans = y[0]; pool = years; }
        if(!ans || keys.indexOf(ans) >= 0) return;
        keys.push(ans);
        var others = pool.filter(function(x){ return x !== ans; }).slice(0, 3), choices = others.concat([ans]);
        // 정답 자리를 문제마다 바꿉니다
        var k = quiz.length % choices.length; choices.splice(choices.length - 1, 1); choices.splice(k, 0, ans);
        quiz.push({ type: 'choice', question: sent.replace(ans, '______') + ' 빈칸에 들어갈 말은?', choices: choices, answer: ans, explain: sent, scene: i + 1 });
      });
    });
    var summary = p.scenes.slice(1).map(function(s){ return (s.narration.match(/[^.!?。]+[.!?。]?/) || [''])[0].trim(); }).join(' ');
    keys.forEach(function(k){ summary = summary.replace(k, '[[' + k + ']]'); });
    p.lesson = {
      goals: [(p.title || '이 사건') + '의 전개 과정을 순서대로 설명할 수 있다.', '주요 장소를 지도에서 찾을 수 있다.'],
      quiz: quiz, summary: summary,
      activity: { title: '지도에 흐름 그리기', steps: ['영상에 나온 장소를 백지도에 표시한다.', '사건의 순서대로 화살표로 잇는다.', '가장 중요한 전환점을 골라 이유를 쓴다.'] },
      discussion: [(p.title || '이 사건') + '에서 가장 결정적인 선택은 무엇이었을까?']
    };
    HS.changed('lesson');
    return p.lesson;
  };

  /* ── 학습지 HTML (인쇄용) ───────────────────────────── */
  function esc(s){ return HS.esc(s); }
  var NUM = ['①', '②', '③', '④', '⑤', '⑥'];
  HS.worksheetHtml = function(teacher){
    var p = P(), L = p.lesson, title = p.title || '역사 영상 학습지', n = 0;
    var summary = esc(L.summary).replace(/\[\[(.+?)\]\]/g, function(m, k){ n++; return teacher ? '<u><b>' + k + '</b></u>' : '<span class="blank">(' + n + ')</span>'; });
    var q = L.quiz.map(function(x, i){
      var body = '<li><p>' + esc(x.question) + '</p>';
      if(x.type === 'choice') body += '<ol class="choices">' + x.choices.map(function(c, k){ return '<li' + (teacher && c === x.answer ? ' class="ans"' : '') + '>' + NUM[k] + ' ' + esc(c) + '</li>'; }).join('') + '</ol>';
      else if(x.type === 'ox') body += '<p class="ox">O &nbsp; / &nbsp; X</p>';
      else body += '<p class="line"></p>';
      if(teacher) body += '<p class="exp">정답: <b>' + esc(x.answer) + '</b> — ' + esc(x.explain) + (x.scene ? ' (장면 ' + x.scene + ')' : '') + '</p>';
      return body + '</li>';
    }).join('');
    return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + esc(title) + (teacher ? ' (교사용)' : ' 학습지') + '</title><style>' +
      "body{font-family:'Noto Sans KR','Malgun Gothic',sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#222;line-height:1.6}" +
      'h1{font-size:22px;border-bottom:3px double #333;padding-bottom:6px}h2{font-size:16px;margin-top:22px;background:#f1ece2;padding:4px 8px}' +
      '.meta{display:flex;gap:24px;font-size:14px}.meta span{border-bottom:1px solid #999;min-width:120px;display:inline-block}' +
      '.blank{display:inline-block;min-width:90px;border-bottom:1px solid #333;text-align:center;color:#999;font-size:12px}' +
      '.choices{list-style:none;padding-left:0;display:grid;grid-template-columns:1fr 1fr;gap:2px 16px}' +
      '.ans{font-weight:700;color:#b8322a}.exp{font-size:13px;color:#555;margin:2px 0 8px}.line{border-bottom:1px solid #999;height:24px}' +
      '.ox{letter-spacing:4px}.box{border:1px solid #999;min-height:90px;margin:6px 0}.teacher{color:#b8322a;font-size:13px}' +
      '@media print{body{margin:0}h2{break-after:avoid}li{break-inside:avoid}}' +
      '</style></head><body>' +
      '<h1>' + esc(title) + (teacher ? ' <span class="teacher">(교사용 · 답 포함)</span>' : '') + '</h1>' +
      '<div class="meta"><div>학번 <span></span></div><div>이름 <span></span></div></div>' +
      '<h2>학습 목표</h2><ul>' + L.goals.map(function(g){ return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>' +
      '<h2>영상 내용 정리 — 빈칸 채우기</h2><p>' + summary + '</p>' +
      '<h2>확인 문제</h2><ol>' + q + '</ol>' +
      '<h2>모둠 활동: ' + esc(L.activity.title) + '</h2><ol>' + L.activity.steps.map(function(s){ return '<li>' + esc(s) + '</li>'; }).join('') + '</ol><div class="box"></div>' +
      '<h2>생각 나누기</h2><ol>' + L.discussion.map(function(d){ return '<li>' + esc(d) + '<div class="box"></div></li>'; }).join('') + '</ol>' +
      '</body></html>';
  };
  /* ── 퀴즈 PPT: 문제 → 정답 ───────────────────────────── */
  HS.exportQuizPptx = function(opt){
    opt = opt || {};
    var p = P(), L = p.lesson;
    if(!L || !L.quiz.length) return Promise.reject(new Error('퀴즈가 없습니다'));
    var pptx = new window.PptxGenJS(), W = 13.333, sans = 'Noto Sans KR';
    pptx.layout = 'LAYOUT_WIDE'; pptx.title = (p.title || '퀴즈') + ' 퀴즈';
    var cover = pptx.addSlide(); cover.background = { color: '1F3B2D' };
    cover.addText((p.title || '역사') + ' 퀴즈', { x: 0.5, y: 2.6, w: W - 1, h: 1.4, fontFace: 'Nanum Pen Script', fontSize: 60, color: 'F3F1E7', align: 'center' });
    cover.addText(L.quiz.length + '문제', { x: 0.5, y: 4.0, w: W - 1, h: 0.6, fontFace: sans, fontSize: 20, color: 'F6E27A', align: 'center' });
    L.quiz.forEach(function(x, i){
      [false, true].forEach(function(reveal){
        var sl = pptx.addSlide(); sl.background = { color: reveal ? 'FFFDF7' : 'F4EFE4' };
        sl.addText('Q' + (i + 1) + (reveal ? ' 정답' : ''), { x: 0.5, y: 0.35, w: 3, h: 0.6, fontFace: sans, fontSize: 22, bold: true, color: '9B2D20' });
        sl.addText(x.question, { x: 0.6, y: 1.0, w: W - 1.2, h: 1.6, fontFace: sans, fontSize: 28, bold: true, color: '2B2520', valign: 'top', fit: 'shrink' });
        var ch = x.type === 'short' ? [] : x.choices;
        ch.forEach(function(c, k){
          var right = reveal && c === x.answer, col = k % 2, row = Math.floor(k / 2);
          sl.addText((x.type === 'choice' ? NUM[k] + ' ' : '') + c, {
            x: 0.6 + col * 6.1, y: 2.9 + row * 1.25, w: 5.9, h: 1.05, fontFace: sans, fontSize: 24, color: right ? 'FFFFFF' : '2B2520',
            fill: { color: right ? '3C8D5A' : 'FFFFFF' }, line: { color: right ? '3C8D5A' : 'DDD3C2', width: 1.5 }, margin: 10, valign: 'middle'
          });
        });
        if(reveal){
          if(x.type === 'short') sl.addText(x.answer, { x: 0.6, y: 3.0, w: W - 1.2, h: 1.0, fontFace: sans, fontSize: 32, bold: true, color: '3C8D5A' });
          sl.addText(x.explain, { x: 0.6, y: 5.6, w: W - 1.2, h: 1.3, fontFace: sans, fontSize: 18, color: '5A5048', valign: 'top', fit: 'shrink' });
        }
      });
    });
    return pptx.write({ outputType: 'blob' }).then(function(blob){ if(!opt.noDownload) HS.download(HS.fileName(' 퀴즈.pptx'), blob); return blob; });
  };

  /* ── 화면 ──────────────────────────────────────────── */
  function status(msg, err){ var el = $('lesson-status'); el.textContent = msg || ''; el.classList.toggle('err', !!err); }
  HS.renderLesson = function(){
    var L = P().lesson, box = $('lesson-view');
    $('lesson-dl').hidden = $('lesson-dl-t').hidden = $('lesson-quiz').hidden = !L;
    if(!L){ box.innerHTML = '<p class="small">아직 없습니다. "수업 자료 만들기"를 누르세요.</p>'; return; }
    var frame = document.createElement('iframe');
    frame.title = '학습지 미리보기'; frame.style.cssText = 'width:100%;height:70vh;border:1px solid var(--line);border-radius:8px;background:#fff';
    box.innerHTML = ''; box.appendChild(frame);
    frame.srcdoc = HS.worksheetHtml($('lesson-teacher').checked);
  };
  $('lesson-generate').addEventListener('click', function(){
    var btn = this;
    if(!P().scenes.length){ status('대본이 없습니다', true); return; }
    if(!HS.CFG.key){ HS.generateLessonSimple(); status('API 키가 없어 연도·지명 빈칸 문제로 만들었습니다'); HS.renderLesson(); return; }
    btn.disabled = true; status('Claude가 수업 자료를 짓는 중…');
    HS.generateLessonAI().then(function(){ status('만들었습니다 (약 ' + (HS.cost.last || 0) + '원)'); HS.renderLesson(); })
      .catch(function(e){ status(HS.whyFail(e), true); }).then(function(){ btn.disabled = false; });
  });
  $('lesson-teacher').addEventListener('change', HS.renderLesson);
  function dl(teacher){ HS.download(HS.fileName(teacher ? ' 학습지(교사용).html' : ' 학습지.html'), new Blob([HS.worksheetHtml(teacher)], { type: 'text/html;charset=utf-8' })); }
  $('lesson-dl').addEventListener('click', function(){ dl(false); });
  $('lesson-dl-t').addEventListener('click', function(){ dl(true); });
  $('lesson-quiz').addEventListener('click', function(){
    HS.exportQuizPptx().then(function(b){ status('퀴즈 PPT를 받았습니다 (' + Math.round(b.size / 1024) + 'KB)'); }, function(e){ status(e.message, true); });
  });
})();
