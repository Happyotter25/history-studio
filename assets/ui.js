/* 화면 연결 — 탭, 입력칸, 버튼을 각 기능에 잇습니다 */
(function(){
  'use strict';
  var HS = window.HS, $ = HS.$, P = function(){ return HS.project; };
  var current = 'source';

  function status(id, msg, err){ var el = $(id); if(!el) return; el.textContent = msg || ''; el.classList.toggle('err', !!err); }
  function aiOn(){ return !!HS.CFG.key; }
  function drawBadge(){ var b = $('ai-badge'); b.textContent = aiOn() ? 'AI 켜짐 · ' + HS.CFG.model.replace('claude-', '') : 'AI 꺼짐 (간이 모드)'; }

  /* ── 탭 ─────────────────────────────────────────── */
  function show(tab){
    current = tab;
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function(b){ b.classList.toggle('on', b.dataset.tab === tab); });
    Array.prototype.forEach.call(document.querySelectorAll('section.tab'), function(s){ s.classList.toggle('on', s.id === 'tab-' + tab); });
    stopPlay();
    render(tab);
    try{ localStorage.setItem('hs.tab', tab); }catch(e){}
  }
  HS.show = show;
  document.getElementById('tabs').addEventListener('click', function(e){ var b = e.target.closest('button'); if(b) show(b.dataset.tab); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-go]'), function(b){ b.addEventListener('click', function(){ show(b.dataset.go); }); });

  function render(tab){
    ({ source: renderSource, script: renderScript, video: renderVideo, story: renderStory, map: renderMap, board: renderBoard, chalk: renderChalk, upload: HS.renderUpload, lesson: HS.renderLesson, settings: renderSettings })[tab]();
  }
  HS.onChange(function(what){ if(what === 'all') { $('proj-title').value = P().title || ''; render(current); drawProjects(); } });

  $('proj-title').addEventListener('input', function(){ P().title = this.value; HS.changed('title'); });

  /* ── ① 소스 ─────────────────────────────────────── */
  function renderSource(){
    var p = P();
    renderRefs();
    $('src-text').value = p.source;
    $('opt-length').value = p.options.length; $('opt-audience').value = p.options.audience; $('opt-tone').value = p.options.tone;
    $('src-files').innerHTML = (p.sourceFiles || []).map(function(f, i){
      return '<span class="pill" data-i="' + i + '">' + (f.mediaType === 'application/pdf' ? 'PDF' : '사진') + ' · ' + HS.esc(f.name) + ' (' + Math.max(1, Math.round(f.size / 1024)) + 'KB) <a href="#" data-act="del" title="빼기">✕</a></span>';
    }).join(' ');
  }
  $('src-text').addEventListener('input', function(){ P().source = this.value; HS.changed('source'); });

  /* 참고 영상 */
  function renderRefs(){
    var rs = P().refs || [];
    $('ref-list').innerHTML = rs.map(function(r, i){
      var n = (r.transcript || '').length;
      return '<div class="ref" data-i="' + i + '"><div class="row">' +
        '<input type="text" data-k="title" value="' + HS.esc(r.title || '') + '" placeholder="영상 제목" style="flex:1;min-width:140px">' +
        '<select data-k="role">' + opts({ fact: '사실 자료로 참고', style: '구성·말투만 참고' }, r.role || 'fact') + '</select>' +
        '<button class="btn" data-act="del" style="padding:2px 8px">✕</button></div>' +
        '<input type="text" data-k="url" value="' + HS.esc(r.url || '') + '" placeholder="영상 주소 (https://www.youtube.com/watch?v=…)" style="width:100%;margin-top:6px">' +
        '<textarea data-k="transcript" placeholder="여기에 스크립트를 붙여 넣으세요" style="margin-top:6px">' + HS.esc(r.transcript || '') + '</textarea>' +
        '<div class="row small"><span data-count>' + (n ? n.toLocaleString() + '자' : '비어 있음') + '</span><button class="btn" data-act="clean" style="padding:1px 8px">다시 정리</button></div></div>';
    }).join('');
  }
  HS.renderRefs = renderRefs;
  $('ref-add').addEventListener('click', function(){
    (P().refs = P().refs || []).push({ id: 'r' + Date.now().toString(36), title: '', url: '', transcript: '', role: 'fact' });
    HS.changed('refs'); renderRefs();
    var boxes = document.querySelectorAll('#ref-list .ref'); boxes[boxes.length - 1].querySelector('[data-k=url]').focus();
  });
  $('ref-list').addEventListener('input', function(e){
    var box = e.target.closest('.ref'), k = e.target.dataset.k; if(!box || !k) return;
    var r = P().refs[+box.dataset.i]; r[k] = e.target.value; HS.changed('refs');
    if(k === 'transcript') box.querySelector('[data-count]').textContent = r.transcript.length.toLocaleString() + '자';
  });
  // 붙여 넣으면 바로 정리합니다
  $('ref-list').addEventListener('paste', function(e){
    if(e.target.dataset.k !== 'transcript') return;
    var ta = e.target;
    setTimeout(function(){ ta.value = HS.cleanTranscript(ta.value); ta.dispatchEvent(new Event('input', { bubbles: true })); }, 0);
  });
  // 주소를 넣으면 제목을 채웁니다 (유튜브 oEmbed; 안 되면 그대로 둡니다)
  $('ref-list').addEventListener('change', function(e){
    var box = e.target.closest('.ref'); if(!box) return;
    var r = P().refs[+box.dataset.i];
    if(e.target.dataset.k === 'url' && !r.title && HS.YT_ID(r.url)){
      fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + HS.YT_ID(r.url)))
        .then(function(res){ return res.ok ? res.json() : null; })
        .then(function(j){ if(j && j.title && !r.title){ r.title = j.title; r.channel = j.author_name || ''; HS.changed('refs'); renderRefs(); } })
        .catch(function(){});
    }
  });
  $('ref-list').addEventListener('click', function(e){
    var b = e.target.closest('button[data-act]'); if(!b) return;
    var i = +b.closest('.ref').dataset.i, rs = P().refs;
    if(b.dataset.act === 'del'){ if(rs[i].transcript && !confirm('이 참고 영상을 뺄까요?')) return; rs.splice(i, 1); }
    if(b.dataset.act === 'clean') rs[i].transcript = HS.cleanTranscript(rs[i].transcript);
    HS.changed('refs'); renderRefs();
  });
  ['opt-length', 'opt-audience', 'opt-tone'].forEach(function(id){
    $(id).addEventListener('change', function(){ P().options[{ 'opt-length': 'length', 'opt-audience': 'audience', 'opt-tone': 'tone' }[id]] = this.value; HS.changed('options'); });
  });
  // 글 파일은 글칸에 붙이고, PDF·사진은 첨부로 둡니다 (사진은 긴 변 1600px 로 줄여서)
  function addSourceFile(f){
    var p = P();
    if(/\.(txt|md)$/i.test(f.name) || f.type === 'text/plain'){
      return HS.readFile(f, true).then(function(t){ p.source = p.source.trim() ? p.source + '\n\n' + t : t; });
    }
    if(f.type === 'application/pdf' || /\.pdf$/i.test(f.name)){
      if(f.size > 30 * 1024 * 1024) throw new Error(f.name + ': PDF가 30MB를 넘습니다. 필요한 쪽만 나눠 넣으세요');
      return HS.readFile(f).then(function(u){ p.sourceFiles.push({ name: f.name, mediaType: 'application/pdf', data: u.slice(u.indexOf(',') + 1), size: f.size }); });
    }
    if(/^image\//.test(f.type)){
      return HS.readFile(f).then(function(u){ return HS.shrinkImage(u, 1600); }).then(function(u){
        var data = u.slice(u.indexOf(',') + 1);
        p.sourceFiles.push({ name: f.name, mediaType: 'image/jpeg', data: data, size: Math.round(data.length * 0.75) });
      });
    }
    throw new Error(f.name + ': 읽을 수 없는 파일입니다');
  }
  $('src-file').addEventListener('change', function(){
    var files = Array.prototype.slice.call(this.files), input = this;
    P().sourceFiles = P().sourceFiles || [];
    files.reduce(function(chain, f){ return chain.then(function(){ return addSourceFile(f); }); }, Promise.resolve())
      .then(function(){ status('src-status', files.length + '개 파일을 넣었습니다'); }, function(e){ status('src-status', e.message, true); })
      .then(function(){ input.value = ''; HS.changed('source'); renderSource(); });
  });
  $('src-files').addEventListener('click', function(e){
    var a = e.target.closest('[data-act=del]'); if(!a) return;
    e.preventDefault();
    P().sourceFiles.splice(+a.closest('[data-i]').dataset.i, 1); HS.changed('source'); renderSource();
  });
  $('src-sample').addEventListener('click', function(){ P().source = window.SAMPLE_SOURCE; $('src-text').value = P().source; HS.changed('source'); });
  $('btn-generate').addEventListener('click', function(){
    var btn = this;
    if(!HS.hasSource()){ status('gen-status', '소스를 먼저 넣으세요', true); return; }
    if(P().scenes.length && !confirm('지금 대본·판서·지도를 새로 만든 것으로 바꿀까요? (지금 상태는 되돌리기 기록에 남습니다)')) return;
    btn.disabled = true;
    HS.snapshot('대본 새로 만들기 전').then(function(){
      if(!aiOn()){
        try{ HS.generateSimple(); status('gen-status', '간이 방식으로 장면 ' + P().scenes.length + '개를 만들었습니다.'); show('script'); }
        catch(e){ status('gen-status', e.message, true); }
        return;
      }
      status('gen-status', 'Claude에게 보내는 중…');
      return HS.generateAI(function(m){ status('gen-status', m); }).then(function(){
        status('gen-status', '장면 ' + P().scenes.length + '개, 판서 ' + P().board.length + '장, 지명 ' + P().map.places.length + '곳을 만들었습니다. (약 ' + (HS.cost.last || 0) + '원)');
        show('script');
      }).catch(function(e){ console.error(e); status('gen-status', HS.whyFail(e), true); });
    }).then(function(){ btn.disabled = false; });
  });

  /* ── ② 대본 ─────────────────────────────────────── */
  var MOODS = { dawn: '새벽', day: '낮', dusk: '노을', night: '밤', war: '전쟁', sea: '바다', court: '궁궐', snow: '눈' };
  var MOTIONS = { zoomIn: '다가가기', zoomOut: '물러나기', panLeft: '왼쪽으로', panRight: '오른쪽으로' };
  function opts(map, cur){ return Object.keys(map).map(function(k){ return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + map[k] + '</option>'; }).join(''); }

  function needAI(id){ if(aiOn()) return true; status(id, '설정에서 API 키를 넣어야 쓸 수 있습니다', true); return false; }
  var REWRITE_LABEL = { short: '짧게', easy: '쉽게', drama: '더 극적으로', quote: '사료 인용 넣기', hook: '질문으로 시작', custom: '직접 요청…' };

  function renderScript(){
    var list = $('scene-list'), p = P();
    renderChecks();
    if(!p.scenes.length){ list.innerHTML = '<p class="small">아직 대본이 없습니다. ① 소스 탭에서 "대본 만들기"를 누르세요.</p>'; return; }
    var chars = p.scenes.reduce(function(a, s){ return a + (s.narration || '').length; }, 0);
    status('script-status', '장면 ' + p.scenes.length + '개 · 내레이션 ' + chars + '자 · 약 ' + Math.round(HS.totalDuration() / 60 * 10) / 10 + '분');
    var flags = {};
    ((p.checks && p.checks.items) || []).forEach(function(c){ if(c.verdict !== 'ok') (flags[c.scene - 1] = flags[c.scene - 1] || []).push(c.verdict); });
    list.innerHTML = p.scenes.map(function(s, i){
      var fl = (flags[i] || []).map(function(v){ return '<span class="flag ' + v + '">' + HS.VERDICT[v] + '</span>'; }).join(' ');
      return '<div class="scene" data-i="' + i + '"><header class="row">' +
        '<span class="num">#' + (i + 1) + '</span><input type="text" data-k="heading" value="' + HS.esc(s.heading) + '">' + fl +
        '<button class="btn" data-act="up" title="위로">↑</button><button class="btn" data-act="down" title="아래로">↓</button><button class="btn" data-act="del" title="지우기">✕</button></header>' +
        '<textarea data-k="narration" placeholder="내레이션">' + HS.esc(s.narration) + '</textarea>' +
        '<div class="meta"><label class="small">화면(삽화) 설명<textarea data-k="visual">' + HS.esc(s.visual) + '</textarea></label>' +
        '<label class="small">이미지 생성 프롬프트 <button class="btn" data-act="copyprompt" style="padding:0 8px">복사</button><textarea data-k="prompt">' + HS.esc(s.prompt) + '</textarea></label></div>' +
        '<div class="row small" style="margin-top:6px">분위기 <select data-k="mood">' + opts(MOODS, s.mood) + '</select> 카메라 <select data-k="motion">' + opts(MOTIONS, s.motion) + '</select> <span>약 ' + Math.round(HS.sceneDuration(s)) + '초</span>' +
        '<label class="inline" style="flex:1;min-width:180px">자막 강조 <input type="text" data-k="keywords" value="' + HS.esc((s.keywords || []).join(', ')) + '" placeholder="쉼표로 (예: 이순신, 1597년)" style="flex:1"></label>' +
        'AI로 고치기 <select data-rw>' + opts(REWRITE_LABEL, 'short') + '</select><button class="btn" data-act="rewrite">고치기</button><span class="status" data-st></span></div></div>';
    }).join('');
  }
  function renderChecks(){
    var box = $('check-panel'), c = P().checks;
    if(!c){ box.hidden = true; return; }
    box.hidden = false;
    var bad = c.items.filter(function(x){ return x.verdict !== 'ok'; }).length;
    box.innerHTML = '<div class="row"><b style="flex:1">사실 확인 — 살펴볼 곳 ' + bad + '개</b><button class="btn" id="check-close">닫기</button></div>' +
      '<p class="small">' + HS.esc(c.summary) + '</p>' +
      c.items.map(function(x){
        return '<div class="check ' + x.verdict + '"><b>#' + x.scene + ' · ' + HS.VERDICT[x.verdict] + '</b> ' + HS.esc(x.claim) +
          (x.note ? '<br><span class="small">→ ' + HS.esc(x.note) + '</span>' : '') + (x.quote ? '<q>소스: “' + HS.esc(x.quote) + '”</q>' : '') + '</div>';
      }).join('');
    $('check-close').onclick = function(){ P().checks = null; HS.changed('checks'); renderScript(); };
  }
  $('btn-factcheck').addEventListener('click', function(){
    var btn = this;
    if(!P().scenes.length || !needAI('script-status')) return;
    btn.disabled = true; status('script-status', '소스와 맞대어 보는 중…');
    HS.factCheck().then(function(c){
      status('script-status', '사실 확인을 마쳤습니다 (약 ' + (HS.cost.last || 0) + '원)'); renderScript();
    }).catch(function(e){ status('script-status', HS.whyFail(e), true); }).then(function(){ btn.disabled = false; });
  });
  $('scene-list').addEventListener('input', function(e){
    var box = e.target.closest('.scene'), k = e.target.dataset.k; if(!box || !k) return;
    P().scenes[+box.dataset.i][k] = k === 'keywords' ? e.target.value.split(/[,，]/).map(function(x){ return x.trim(); }).filter(Boolean) : e.target.value;
    HS.changed('scene');
  });
  $('scene-list').addEventListener('change', function(e){ if(e.target.tagName === 'SELECT' && e.target.dataset.k) renderScript(); });
  $('scene-list').addEventListener('click', function(e){
    var b = e.target.closest('button[data-act]'); if(!b) return;
    var box = b.closest('.scene'), i = +box.dataset.i, sc = P().scenes, act = b.dataset.act;
    if(act === 'copyprompt'){ navigator.clipboard && navigator.clipboard.writeText(sc[i].prompt || ''); HS.toast('프롬프트를 복사했습니다'); return; }
    if(act === 'rewrite'){
      var st = box.querySelector('[data-st]');
      if(!aiOn()){ st.textContent = '설정에서 API 키를 넣어 주세요'; return; }
      var kind = box.querySelector('[data-rw]').value, ins = HS.REWRITES[kind];
      if(kind === 'custom'){ ins = prompt('이 장면을 어떻게 고칠까요?', '예: 조선 수군의 전술을 한 문장 더 설명해 주세요'); if(!ins) return; }
      b.disabled = true; st.textContent = '고치는 중…';
      HS.snapshot('#' + (i + 1) + ' 장면 AI로 고치기 전').then(function(){ return HS.rewriteScene(i, ins); }).then(function(){ renderScript(); HS.toast('#' + (i + 1) + ' 장면을 고쳤습니다'); })
        .catch(function(err){ st.textContent = HS.whyFail(err); b.disabled = false; });
      return;
    }
    if(act === 'del'){ if(!confirm('#' + (i + 1) + ' 장면을 지울까요?')) return; sc.splice(i, 1); }
    if(act === 'up' && i > 0) sc.splice(i - 1, 0, sc.splice(i, 1)[0]);
    if(act === 'down' && i < sc.length - 1) sc.splice(i + 1, 0, sc.splice(i, 1)[0]);
    HS.changed('scenes'); renderScript();
  });
  $('btn-add-scene').addEventListener('click', function(){
    P().scenes.push({ heading: '새 장면', narration: '', visual: '', prompt: '', mood: 'day', motion: 'zoomIn', image: null });
    HS.changed('scenes'); renderScript();
  });
  $('btn-copy-script').addEventListener('click', function(){ navigator.clipboard && navigator.clipboard.writeText(HS.scriptText()); HS.toast('대본을 복사했습니다'); });
  $('btn-dl-script').addEventListener('click', function(){ HS.download(HS.fileName(' 대본.txt'), new Blob([HS.scriptText()], { type: 'text/plain;charset=utf-8' })); });

  /* ── ③ 삽화 영상 ─────────────────────────────────── */
  var vc = $('video-canvas'), vctx = vc.getContext('2d'), playing = null, playT = 0, stopVoice = null, recStop = null, recIdx = -1;
  function drawVideoAt(t){ HS.drawVideoFrame(vctx, vc.width, vc.height, t, { subs: $('vid-subs').checked }); }
  function stopPlay(){
    if(playing){ cancelAnimationFrame(playing); playing = null; $('vid-play').textContent = '재생'; }
    if(stopVoice){ stopVoice(); stopVoice = null; }
    HS.stopSpeak();
  }
  var TRANS = { fade: '부드럽게', ink: '먹 번짐', wipe: '붓 쓸기', cut: '바로' };
  var MOOD_COLOR = { dawn: '#b9737a', day: '#6f8f6a', dusk: '#b4614f', night: '#2c3a60', war: '#7a2e22', sea: '#3c6a7d', court: '#9b6a45', snow: '#7c8995' };
  function fitCanvas(){
    var fs = HS.frameSize();
    if(vc.width !== fs[0] || vc.height !== fs[1]){ vc.width = fs[0]; vc.height = fs[1]; }
    vc.classList.toggle('portrait', fs[0] < fs[1]);
    $('vid-aspect').value = P().aspect === '9:16' ? '9:16' : '16:9';
  }
  // 장면 띠: 길이에 비례한 칸, 누르면 그 장면으로
  function drawTimeline(){
    var tl = HS.timeline(), total = HS.totalDuration() || 1, scenes = P().scenes;
    $('vid-timeline').innerHTML = tl.map(function(seg){
      var s = scenes[seg.i], w = (seg.i === tl.length - 1 ? seg.dur : seg.dur - 0.8) / total * 100;
      var on = playT >= seg.start && playT < seg.start + seg.dur - (seg.i === tl.length - 1 ? 0 : 0.8);
      return '<div data-t="' + (seg.start + (seg.i ? 0.9 : 0)) + '" class="' + (on ? 'on' : '') + '" style="width:' + w + '%;background:' + (s.useMap ? '#8a6a45' : MOOD_COLOR[s.mood] || '#555') + '">' + (seg.i + 1) + '. ' + HS.esc(s.heading) + '</div>';
    }).join('');
  }
  function renderVideo(){
    var p = P();
    fitCanvas();
    $('vid-scenes').innerHTML = p.scenes.length ? p.scenes.map(function(s, i){
      var pic = s.useMap ? '<span class="pill">지도 장면</span>'
        : s.image ? '<img src="' + s.image + '" alt="" style="height:40px;border-radius:4px"><button class="btn" data-act="noimg">그림 빼기</button>'
        : s.svg ? '<span class="pill">AI 그림</span><button class="btn" data-act="nosvg">빼기</button>'
        : '<span class="pill">기본 배경</span>';
      var voice = s.audio ? '<span class="pill">목소리 ' + (s.audioDur || 0).toFixed(1) + '초</span><button class="btn" data-act="playvoice">듣기</button><button class="btn" data-act="novoice">빼기</button>'
        : '<button class="btn" data-act="rec">' + (recIdx === i ? '■ 녹음 끝내기' : '● 녹음') + '</button><label class="btn">파일<input type="file" accept="audio/*" data-act="audiofile" hidden></label><button class="btn" data-act="tts" title="브라우저가 읽어 줍니다 (미리 듣기만, 녹화에는 들어가지 않음)">읽어 듣기</button>';
      return '<div class="scene" data-i="' + i + '"><div class="row"><span class="num">#' + (i + 1) + '</span><b style="flex:1">' + HS.esc(s.heading) + '</b>' + pic + '</div>' +
        '<div class="row small" style="margin-top:6px"><button class="btn" data-act="aidraw">' + (s.svg ? 'AI로 다시 그리기' : 'AI로 그리기') + '</button><label class="btn">그림 파일<input type="file" accept="image/*" data-act="img" hidden></label>' +
        '<label class="inline"><input type="checkbox" data-act="usemap"' + (s.useMap ? ' checked' : '') + '> 지도 장면</label><span class="status" data-st></span></div>' +
        '<div class="row small" style="margin-top:6px">목소리 ' + voice + '</div>' +
        '<div class="row small" style="margin-top:6px">카메라 <select data-k="motion">' + opts(MOTIONS, s.motion) + '</select> 분위기 <select data-k="mood">' + opts(MOODS, s.mood) + '</select> ' +
        '</div><div class="row small" style="margin-top:6px">캐릭터 <select data-act="char"><option value="">없음</option>' +
          (p.characters || []).map(function(c){ return '<option value="' + c.id + '"' + (s.character && s.character.id === c.id ? ' selected' : '') + '>' + HS.esc(c.name) + '</option>'; }).join('') + '</select>' +
          (s.character && s.character.id ? ' <select data-act="charside">' + opts({ left: '왼쪽', right: '오른쪽' }, s.character.side || 'left') + '</select>' : '') +
        '</div><div class="row small" style="margin-top:6px">이름표 <input type="text" data-k="caption" value="' + HS.esc(s.caption || '') + '" placeholder="예: 1592년 4월 · 부산" style="flex:1;min-width:120px">' +
        (i ? ' 전환 <select data-k="transition">' + opts(TRANS, s.transition || 'fade') + '</select> ' : ' ') +
        (s.audio ? '<span>목소리에 맞춰 약 ' + Math.round(HS.sceneDuration(s)) + '초</span>'
          : '<label class="inline">길이 <input type="number" data-k="dur" min="1.5" max="120" step="0.5" style="width:70px" value="' + (+s.dur > 0 ? s.dur : '') + '" placeholder="' + Math.round(HS.sceneDuration(Object.assign({}, s, { dur: 0 })) - 0.8) + '">초</label>') + '</div></div>';
    }).join('') : '<p class="small">대본이 없습니다.</p>';
    renderBgm(); renderChars();
    $('vid-seek').max = Math.max(0.1, HS.totalDuration()); $('vid-seek').value = playT;
    drawTimeline();
    status('vid-status', p.scenes.length ? '전체 약 ' + Math.round(HS.totalDuration()) + '초' : '');
    HS.preloadImages().then(function(){ drawVideoAt(Math.min(playT, HS.totalDuration())); });
  }
  function aiDraw(i, st){
    st = st || function(){};
    var before = P().scenes[i].svg ? HS.snapshot('#' + (i + 1) + ' 그림 다시 그리기 전') : Promise.resolve();
    return before.then(function(){ return HS.drawSceneAI(i, st); }).then(function(){ st(''); renderVideo(); });
  }
  $('vid-scenes').addEventListener('change', function(e){
    var box = e.target.closest('.scene'); if(!box) return;
    var s = P().scenes[+box.dataset.i], act = e.target.dataset.act;
    if(e.target.dataset.k === 'dur'){ var v = parseFloat(e.target.value); s.dur = v > 0 ? v : null; HS.changed('scene'); renderVideo(); return; }
    if(e.target.dataset.k){ s[e.target.dataset.k] = e.target.value; HS.changed('scene'); renderVideo(); return; }
    if(act === 'usemap'){ s.useMap = e.target.checked; HS.changed('scene'); renderVideo(); return; }
    if(act === 'char'){ s.character = e.target.value ? { id: e.target.value, side: (s.character && s.character.side) || 'left' } : null; HS.changed('scene'); renderVideo(); return; }
    if(act === 'charside'){ s.character.side = e.target.value; HS.changed('scene'); renderVideo(); return; }
    if(act === 'img' && e.target.files[0]){
      HS.readFile(e.target.files[0]).then(function(u){ return HS.shrinkImage(u, 1920); }).then(function(u){ s.image = u; s.svg = null; s.useMap = false; HS.changed('scene'); renderVideo(); });
    }
    if(act === 'audiofile' && e.target.files[0]){
      HS.readFile(e.target.files[0]).then(function(u){ return HS.setSceneAudio(s, u); }).then(renderVideo, function(err){ HS.toast(err.message); });
    }
  });
  $('vid-scenes').addEventListener('click', function(e){
    var b = e.target.closest('button[data-act]'); if(!b) return;
    var box = b.closest('.scene'), i = +box.dataset.i, s = P().scenes[i], act = b.dataset.act, st = box.querySelector('[data-st]');
    if(act === 'noimg'){ s.image = null; }
    else if(act === 'nosvg'){ s.svg = null; }
    else if(act === 'novoice'){ s.audio = null; s.audioDur = 0; }
    else if(act === 'tts'){ HS.speak(s.narration) || HS.toast('이 브라우저는 읽어 주기를 지원하지 않습니다'); return; }
    else if(act === 'playvoice'){
      stopPlay();
      HS.sceneAudio(s).then(function(buf){ if(!buf) return; var c = HS.audioCtx(), src = c.createBufferSource(); src.buffer = buf; src.connect(c.destination); src.start(); stopVoice = function(){ try{ src.stop(); }catch(x){} }; });
      return;
    }
    else if(act === 'rec'){
      if(recStop){ // 녹음 끝내기
        var stop = recStop; recStop = null; recIdx = -1;
        stop().then(function(u){ return HS.setSceneAudio(s, u); }).then(renderVideo, function(err){ HS.toast(err.message); renderVideo(); });
        return;
      }
      stopPlay();
      HS.recordVoice().then(function(stop){ recStop = stop; recIdx = i; renderVideo(); HS.toast('녹음 중입니다. 내레이션을 읽고 "녹음 끝내기"를 누르세요'); })
        .catch(function(err){ HS.toast(err.message || '마이크를 쓸 수 없습니다'); });
      return;
    }
    else if(act === 'aidraw'){
      if(!aiOn()){ st.textContent = '설정에서 API 키를 넣어 주세요'; return; }
      b.disabled = true;
      aiDraw(i, function(m){ st.textContent = m; }).catch(function(err){ st.textContent = HS.whyFail(err); b.disabled = false; });
      return;
    }
    HS.changed('scene'); renderVideo();
  });
  /* 프롬프터 연속 녹음: 한 장면씩 대본을 크게 보여 주며 녹음하고, "다음"이면 저장한 뒤 다음 장면을 곧바로 녹음합니다 */
  var PR = { i: 0, mic: null, stop: null };
  function prDraw(){
    var sc = P().scenes, s = sc[PR.i];
    $('pr-pos').textContent = (PR.i + 1) + ' / ' + sc.length;
    $('pr-head').textContent = s.heading;
    $('pr-text').textContent = s.narration || '(내레이션이 없습니다)';
    $('pr-text').scrollTop = 0;
    var st = $('pr-state');
    st.textContent = PR.stop ? '● 녹음 중' : s.audio ? '녹음됨 ' + (s.audioDur || 0).toFixed(1) + '초' : '아직 녹음 안 함';
    st.classList.toggle('rec', !!PR.stop);
    $('pr-rec').textContent = PR.stop ? '■ 멈추고 저장' : s.audio ? '● 다시 녹음' : '● 녹음 시작';
    $('pr-prev').disabled = PR.i === 0;
    $('pr-next').textContent = PR.i === sc.length - 1 ? '저장하고 끝내기' : '저장하고 다음 ▶';
  }
  function prSave(){
    if(!PR.stop) return Promise.resolve();
    var stop = PR.stop, s = P().scenes[PR.i]; PR.stop = null;
    return stop().then(function(u){ return HS.setSceneAudio(s, u); }).catch(function(e){ HS.toast(e.message); });
  }
  function prStart(){
    return HS.recordVoice(PR.mic).then(function(stop){ PR.stop = stop; prDraw(); });
  }
  function prClose(){
    prSave().then(function(){
      if(PR.mic){ PR.mic.getTracks().forEach(function(t){ t.stop(); }); PR.mic = null; }
      $('prompter').hidden = true; renderVideo();
    });
  }
  $('vid-prompter').addEventListener('click', function(){
    var sc = P().scenes; if(!sc.length) return;
    stopPlay();
    HS.openMic().then(function(mic){
      PR.mic = mic;
      var first = sc.map(function(s){ return !s.audio; }).indexOf(true);
      PR.i = first < 0 ? 0 : first;
      $('prompter').hidden = false; prDraw();
    }).catch(function(e){ HS.toast((e && e.message) || '마이크를 쓸 수 없습니다. 음성 파일을 넣는 방법을 쓰세요'); });
  });
  $('pr-rec').addEventListener('click', function(){
    if(PR.stop) prSave().then(prDraw); else prStart();
  });
  $('pr-next').addEventListener('click', function(){
    var last = PR.i === P().scenes.length - 1, wasRec = !!PR.stop;
    prSave().then(function(){
      if(last){ prClose(); return; }
      PR.i++; prDraw();
      if(wasRec) prStart(); // 녹음하던 흐름이면 다음 장면도 곧바로
    });
  });
  $('pr-prev').addEventListener('click', function(){ prSave().then(function(){ PR.i = Math.max(0, PR.i - 1); prDraw(); }); });
  $('pr-close').addEventListener('click', prClose);
  $('pr-size').addEventListener('input', function(){ $('pr-text').style.fontSize = this.value + 'px'; });
  document.addEventListener('keydown', function(e){
    if($('prompter').hidden) return;
    if(e.key === ' ' || e.key === 'ArrowRight'){ e.preventDefault(); $('pr-next').click(); }
    else if(e.key === 'Escape') prClose();
  });
  HS.prompter = PR;
  $('vid-draw-all').addEventListener('click', function(){
    var btn = this;
    if(!needAI('vid-status')) return;
    var todo = P().scenes.map(function(s, i){ return (!s.image && !s.svg && !s.useMap) ? i : -1; }).filter(function(i){ return i >= 0; });
    if(!todo.length){ status('vid-status', '그림이 없는 장면이 없습니다'); return; }
    if(!confirm(todo.length + '개 장면을 Claude가 그립니다. 장면마다 1~2분, 비용은 장면당 대략 100~300원입니다. 할까요?')) return;
    btn.disabled = true;
    var k = 0;
    (function next(){
      if(k >= todo.length){ btn.disabled = false; status('vid-status', todo.length + '개 장면을 그렸습니다'); return; }
      var i = todo[k++];
      status('vid-status', '#' + (i + 1) + ' 그리는 중 (' + k + '/' + todo.length + ')…');
      aiDraw(i, function(m){ status('vid-status', '#' + (i + 1) + ' ' + m + ' (' + k + '/' + todo.length + ')'); })
        .then(next, function(err){ btn.disabled = false; status('vid-status', '#' + (i + 1) + ': ' + HS.whyFail(err), true); });
    })();
  });
  $('vid-subs').addEventListener('change', function(){ drawVideoAt(playT); });
  $('vid-aspect').addEventListener('change', function(){
    stopPlay(); P().aspect = this.value; HS.changed('aspect'); renderVideo();
  });
  $('vid-timeline').addEventListener('click', function(e){
    var d = e.target.closest('[data-t]'); if(!d) return;
    stopPlay(); playT = +d.dataset.t; $('vid-seek').value = playT; drawVideoAt(playT); drawTimeline();
  });
  $('vid-seek').addEventListener('input', function(){
    stopPlay(); playT = +this.value;
    drawVideoAt(playT); drawTimeline();
    status('vid-status', Math.floor(playT) + ' / ' + Math.round(HS.totalDuration()) + '초');
  });
  function renderChars(){
    var cs2 = P().characters || [];
    $('char-list').innerHTML = cs2.length ? cs2.map(function(c){
      return '<div class="char" data-id="' + c.id + '"><img src="' + c.image + '" alt=""><input type="text" value="' + HS.esc(c.name) + '" aria-label="캐릭터 이름"><button class="btn" data-act="delchar" style="padding:1px 8px">지우기</button></div>';
    }).join('') : '<span class="small">아직 없습니다.</span>';
    $('char-all').disabled = !cs2.length;
  }
  $('char-list').addEventListener('change', function(e){
    var box = e.target.closest('.char'); if(!box || e.target.tagName !== 'INPUT') return;
    HS.characterById(box.dataset.id).name = e.target.value.trim() || '캐릭터'; HS.changed('characters'); renderVideo();
  });
  $('char-list').addEventListener('click', function(e){
    var b = e.target.closest('button[data-act=delchar]'); if(!b) return;
    var id = b.closest('.char').dataset.id;
    if(!confirm('이 캐릭터를 지울까요? 장면에서도 빠집니다.')) return;
    P().characters = P().characters.filter(function(c){ return c.id !== id; });
    P().scenes.forEach(function(sc){ if(sc.character && sc.character.id === id) sc.character = null; });
    if(P().thumb && P().thumb.character === id) P().thumb.character = '';
    HS.changed('characters'); renderVideo();
  });
  $('char-file').addEventListener('change', function(){
    var f = this.files[0], input = this; if(!f) return;
    HS.readFile(f).then(HS.loadImage).then(function(img){
      var k = Math.min(1, 1000 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      var st = HS.makeSticker(c, { outline: false });
      if(!st) throw new Error('그림을 찾지 못했습니다');
      HS.addCharacter(f.name.replace(/\.[^.]+$/, ''), st); renderVideo();
    }).catch(function(e){ HS.toast(e.message); }).then(function(){ input.value = ''; });
  });
  $('char-all').addEventListener('click', function(){
    var c = (P().characters || [])[0]; if(!c) return;
    P().scenes.forEach(function(sc, i){ if(i > 0 && !sc.useMap) sc.character = { id: c.id, side: 'left' }; });
    HS.changed('scenes'); renderVideo(); HS.toast('"' + c.name + '"을(를) 지도 장면을 뺀 모든 장면에 넣었습니다');
  });
  function renderBgm(){
    var b = P().bgm;
    $('bgm-name').textContent = b && b.data ? b.name + ' (' + Math.round(b.dur || 0) + '초, 반복)' : '없음';
    $('bgm-vol').value = b && b.volume != null ? b.volume : 0.25;
    $('bgm-duck').checked = !b || b.duck !== false;
    $('bgm-remove').disabled = !(b && b.data);
  }
  $('bgm-file').addEventListener('change', function(){
    var f = this.files[0], input = this; if(!f) return;
    HS.readFile(f).then(function(u){
      var b = { name: f.name, data: u, volume: +$('bgm-vol').value, duck: $('bgm-duck').checked };
      return HS.sceneAudio({ audio: u }).then(function(buf){
        if(!buf) throw new Error('음악 파일을 읽지 못했습니다');
        b.dur = buf.duration; P().bgm = b; HS.changed('bgm'); renderBgm();
      });
    }).catch(function(e){ HS.toast(e.message); }).then(function(){ input.value = ''; });
  });
  $('bgm-vol').addEventListener('change', function(){ if(P().bgm){ P().bgm.volume = +this.value; HS.changed('bgm'); } });
  $('bgm-duck').addEventListener('change', function(){ if(P().bgm){ P().bgm.duck = this.checked; HS.changed('bgm'); } });
  $('bgm-remove').addEventListener('click', function(){ P().bgm = null; HS.changed('bgm'); renderBgm(); });
  $('vid-play').addEventListener('click', function(){
    if(playing){ stopPlay(); return; }
    var total = HS.totalDuration(); if(!total) return;
    if(playT >= total) playT = 0;
    var btn = this;
    HS.preloadImages().then(function(){ return HS.playNarration(playT); }).then(function(stop){
      stopVoice = stop;
      var t0 = performance.now() - playT * 1000;
      btn.textContent = '멈춤';
      (function loop(now){
        playT = (now - t0) / 1000;
        if(playT >= total){ playT = total; drawVideoAt(total); stopPlay(); return; }
        drawVideoAt(playT); $('vid-seek').value = playT;
        if(Math.floor(playT * 2) !== Math.floor((playT - 0.017) * 2)) drawTimeline();
        status('vid-status', Math.floor(playT) + ' / ' + Math.round(total) + '초');
        playing = requestAnimationFrame(loop);
      })(performance.now());
    });
  });
  $('vid-record').addEventListener('click', function(){
    var btn = this, total = HS.totalDuration(); if(!total) return;
    stopPlay(); btn.disabled = true;
    var voiced = HS.hasAudio();
    HS.preloadImages().then(function(){
      return Promise.all(P().scenes.map(HS.sceneAudio).concat([HS.bgmBuffer()])); // 소리를 미리 풀어 두어야 그림과 어긋나지 않습니다
    }).then(function(){
      return HS.recordCanvas(vc, total, drawVideoAt, function(t){ status('vid-status', '녹화 중… ' + Math.floor(t) + ' / ' + Math.round(total) + '초 (탭을 바꾸지 마세요)'); },
        voiced ? function(dest){ return HS.playNarration(0, dest); } : null);
    }).then(function(blob){ HS.download(HS.fileName(' 삽화영상' + HS.videoExt(blob)), blob); status('vid-status', '녹화를 마쳤습니다 (' + Math.round(blob.size / 1024) + 'KB' + (voiced ? ', 소리 포함' : '') + ')'); })
      .catch(function(e){ status('vid-status', e.message, true); })
      .then(function(){ btn.disabled = false; });
  });

  /* ── ④ 스토리 PPT ────────────────────────────────── */
  function renderStory(){
    var box = $('story-thumbs'); box.innerHTML = '';
    if(!P().scenes.length){ box.innerHTML = '<p class="small">대본이 없습니다.</p>'; return; }
    HS.preloadImages().then(function(){
      P().scenes.forEach(function(s, i){
        var c = HS.sceneStill(s, 320, 180), ctx = c.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 140, 320, 40);
        ctx.fillStyle = '#fff'; ctx.font = "bold 15px 'Noto Sans KR',sans-serif"; ctx.fillText((i ? i + '. ' : '표지 · ') + s.heading, 10, 166);
        box.appendChild(c);
      });
    });
  }
  $('btn-story-pptx').addEventListener('click', function(){
    var btn = this; btn.disabled = true; status('story-status', '만드는 중…');
    HS.exportStoryPptx({ theme: $('story-theme').value, map: $('story-map').checked, mapStyle: $('map-style').value })
      .then(function(b){ status('story-status', '받았습니다 (' + Math.round(b.size / 1024) + 'KB)'); })
      .catch(function(e){ status('story-status', e.message, true); })
      .then(function(){ btn.disabled = false; });
  });

  /* ── ⑤ 지도 ─────────────────────────────────────── */
  var mc = $('map-canvas'), draft = null;
  function drawMapNow(progress){ HS.drawMap(mc.getContext('2d'), mc.width, mc.height, P().map, { style: $('map-style').value, progress: progress, draft: draft }); }
  var REGION_COLORS = ['#b8322a', '#2f6db3', '#3c8d5a', '#b07a1f', '#7d4bb3'];
  function renderMap(){
    var m = P().map;
    $('map-style').value = P().mapStyle || 'old';
    $('map-regions').innerHTML = (m.regions || []).map(function(r, i){
      return '<div class="region" data-i="' + i + '"><input type="color" data-k="color" value="' + HS.esc(r.color || '#b8322a') + '"><input type="text" data-k="name" value="' + HS.esc(r.name) + '"><span class="small">' + r.points.length + '점</span><button class="btn" data-act="del" style="padding:2px 8px">✕</button></div>';
    }).join('') || '<p class="small">영역이 없습니다.</p>';
    $('map-region-draw').textContent = draft ? '완성 (' + draft.points.length + '점)' : '영역 그리기';
    $('map-places').innerHTML = m.places.map(function(pl, i){
      return '<tr data-i="' + i + '"><td><input data-k="name" value="' + HS.esc(pl.name) + '"></td><td><input data-k="lon" value="' + pl.lon + '" inputmode="decimal"></td><td><input data-k="lat" value="' + pl.lat + '" inputmode="decimal"></td>' +
        '<td><select data-k="kind">' + opts({ capital: '수도', city: '도시', battle: '전투' }, pl.kind) + '</select></td><td><button class="btn" data-act="del" style="padding:2px 8px">✕</button></td></tr>';
    }).join('');
    if(document.activeElement !== $('map-routes')) $('map-routes').value = HS.routesToText(m.routes);
    drawMapNow(1);
  }
  $('map-places').addEventListener('change', function(e){
    var tr = e.target.closest('tr'), k = e.target.dataset.k; if(!tr || !k) return;
    var pl = P().map.places[+tr.dataset.i], v = e.target.value;
    if(k === 'lon' || k === 'lat'){ v = parseFloat(v); if(isNaN(v)) return; }
    if(k === 'name'){ // 이름을 바꾸면 경로도 따라 바꿉니다. 사전에 있는 지명이면 좌표도 채웁니다
      P().map.routes.forEach(function(r){ if(r.from === pl.name) r.from = v; if(r.to === pl.name) r.to = v; });
      var known = HS.findPlaces(v)[0]; if(known && (known.name === v)){ pl.lon = known.lon; pl.lat = known.lat; pl.kind = known.kind; }
    }
    pl[k] = v; HS.changed('map'); renderMap();
  });
  $('map-places').addEventListener('click', function(e){
    var b = e.target.closest('button[data-act=del]'); if(!b) return;
    P().map.places.splice(+b.closest('tr').dataset.i, 1); HS.changed('map'); renderMap();
  });
  $('map-add').addEventListener('click', function(){
    var v = HS.mapView(P().map, mc.width, mc.height);
    P().map.places.push({ name: '새 지명', lon: Math.round((v[0] + v[2]) / 2 * 100) / 100, lat: Math.round((v[1] + v[3]) / 2 * 100) / 100, kind: 'city' });
    HS.changed('map'); renderMap();
  });
  $('map-routes').addEventListener('input', function(){ P().map.routes = HS.textToRoutes(this.value); HS.changed('map'); drawMapNow(1); });
  $('map-style').addEventListener('change', function(){ P().mapStyle = this.value; HS.changed('map'); drawMapNow(1); });
  $('map-regions').addEventListener('input', function(e){
    var row = e.target.closest('.region'), k = e.target.dataset.k; if(!row || !k) return;
    P().map.regions[+row.dataset.i][k] = e.target.value; HS.changed('map'); drawMapNow(1);
  });
  $('map-regions').addEventListener('click', function(e){
    var b = e.target.closest('button[data-act=del]'); if(!b) return;
    P().map.regions.splice(+b.closest('.region').dataset.i, 1); HS.changed('map'); renderMap();
  });
  $('map-region-draw').addEventListener('click', function(){
    var m = P().map;
    if(!draft){
      // 그리는 동안 보기 범위가 바뀌지 않게 지금 범위를 고정합니다
      m.view = HS.mapView(m, mc.width, mc.height);
      draft = { name: '', color: REGION_COLORS[(m.regions || []).length % REGION_COLORS.length], points: [] };
      mc.style.cursor = 'crosshair';
      status('map-status', '지도 위를 차례로 눌러 둘레를 찍으세요');
    } else {
      if(draft.points.length >= 3){
        draft.name = prompt('영역 이름 (예: 고구려 5세기, 대략)', '') || '영역';
        (m.regions = m.regions || []).push(draft);
        HS.changed('map');
      }
      draft = null; mc.style.cursor = ''; status('map-status', '');
    }
    renderMap();
  });
  mc.addEventListener('click', function(e){
    if(!draft) return;
    var r = mc.getBoundingClientRect();
    draft.points.push(HS.mapUnproject(P().map, mc.width, mc.height, (e.clientX - r.left) * mc.width / r.width, (e.clientY - r.top) * mc.height / r.height));
    $('map-region-draw').textContent = '완성 (' + draft.points.length + '점)';
    drawMapNow(1);
  });
  $('map-fit').addEventListener('click', function(){ P().map.view = null; HS.changed('map'); drawMapNow(1); });
  $('map-png').addEventListener('click', function(){ drawMapNow(1); mc.toBlob(function(b){ HS.download(HS.fileName(' 지도.png'), b); }); });
  $('map-record').addEventListener('click', function(){
    var btn = this, dur = 2 + Math.max(1, P().map.routes.length) * 2.2;
    btn.disabled = true;
    HS.recordCanvas(mc, dur, function(t){ drawMapNow(Math.max(0, Math.min(1, (t - 1) / (dur - 2)))); }, function(t){ status('map-status', '녹화 중… ' + Math.floor(t) + '초'); })
      .then(function(b){ HS.download(HS.fileName(' 지도' + HS.videoExt(b)), b); status('map-status', '녹화를 마쳤습니다'); })
      .catch(function(e){ status('map-status', e.message, true); })
      .then(function(){ btn.disabled = false; });
  });

  /* ── ⑥ 판서 PPT ──────────────────────────────────── */
  var page = 0, bc = $('board-canvas');
  function renderBoard(){
    var b = P().board;
    if(!b.length) b.push({ title: P().title || '판서', text: '', drawing: null });
    page = Math.max(0, Math.min(page, b.length - 1));
    var s = b[page];
    $('board-title').value = s.title || ''; $('board-text').value = s.text || '';
    $('board-page').textContent = (page + 1) + ' / ' + b.length;
    drawBoardNow();
  }
  function drawBoardNow(){
    var s = P().board[page]; if(!s) return;
    var go = function(img){ HS.drawBoardSlide(bc.getContext('2d'), bc.width, bc.height, s, img); };
    if(s.drawing) HS.loadImage(s.drawing).then(go, function(){ go(null); }); else go(null);
  }
  $('board-title').addEventListener('input', function(){ P().board[page].title = this.value; HS.changed('board'); drawBoardNow(); });
  $('board-text').addEventListener('input', function(){ P().board[page].text = this.value; HS.changed('board'); drawBoardNow(); });
  $('board-prev').addEventListener('click', function(){ page--; renderBoard(); });
  $('board-next').addEventListener('click', function(){ page++; renderBoard(); });
  $('board-add').addEventListener('click', function(){ P().board.splice(page + 1, 0, { title: '새 판서', text: '', drawing: null }); page++; HS.changed('board'); renderBoard(); });
  $('board-del').addEventListener('click', function(){ if(!confirm('이 장을 지울까요?')) return; P().board.splice(page, 1); HS.changed('board'); renderBoard(); });
  $('board-record').addEventListener('click', function(){
    var btn = this, slides = P().board.filter(function(b){ return b.title || b.text; });
    if(!slides.length) return;
    btn.disabled = true;
    Promise.all(slides.map(function(b){ return b.drawing ? HS.loadImage(b.drawing).catch(function(){ return null; }) : null; })).then(function(imgs){
      // 장마다: 쓰기(글자 수 ÷ 초당 9자) + 다 쓴 모습 2초
      var segs = [], t = 0;
      slides.forEach(function(b, i){ var write = Math.max(2, HS.boardChars(b, !!imgs[i]) / 9); segs.push({ b: b, img: imgs[i], start: t, write: write }); t += write + 2; });
      var ctx = bc.getContext('2d');
      return HS.recordCanvas(bc, t, function(now){
        var seg = segs[0];
        segs.forEach(function(sg){ if(now >= sg.start) seg = sg; });
        HS.drawBoardSlide(ctx, bc.width, bc.height, seg.b, seg.img, { progress: Math.min(1, (now - seg.start) / seg.write) });
      }, function(now){ status('board-status', '녹화 중… ' + Math.floor(now) + ' / ' + Math.round(t) + '초'); });
    }).then(function(blob){ HS.download(HS.fileName(' 판서영상' + HS.videoExt(blob)), blob); status('board-status', '녹화를 마쳤습니다'); drawBoardNow(); })
      .catch(function(e){ status('board-status', e.message, true); })
      .then(function(){ btn.disabled = false; });
  });
  $('btn-board-pptx').addEventListener('click', function(){
    var btn = this; btn.disabled = true; status('board-status', '만드는 중…');
    HS.exportBoardPptx().then(function(b){ status('board-status', '받았습니다 (' + Math.round(b.size / 1024) + 'KB)'); })
      .catch(function(e){ status('board-status', e.message, true); })
      .then(function(){ btn.disabled = false; });
  });

  /* ── ⑦ 손그림 → 판서 ─────────────────────────────── */
  var cs = $('chalk-src'), co = $('chalk-out'), csx = cs.getContext('2d'), lastChalk = null, chalkTimer = null, strokes = [], photo = false;
  function clearPaper(){ csx.fillStyle = '#fff'; csx.fillRect(0, 0, cs.width, cs.height); strokes = []; photo = false; }
  clearPaper();
  function convert(){
    lastChalk = HS.convertToChalk(cs, co, { sens: +$('chalk-th').value, color: $('chalk-color').value, bg: $('chalk-bg').value });
    status('chalk-status', lastChalk.cropped ? '' : '선이 보이지 않습니다. 선 감도를 낮추거나 더 진한 그림을 넣어 보세요.');
  }
  function convertSoon(){ clearTimeout(chalkTimer); chalkTimer = setTimeout(convert, 120); }
  HS.convertChalkNow = convert;
  function renderChalk(){ convert(); }
  ['chalk-th', 'chalk-color', 'chalk-bg'].forEach(function(id){ $(id).addEventListener('input', convertSoon); });
  $('chalk-clear').addEventListener('click', function(){ clearPaper(); convert(); });
  $('chalk-file').addEventListener('change', function(){
    var f = this.files[0]; if(!f) return;
    HS.readFile(f).then(HS.loadImage).then(function(img){
      // 긴 변 1000px 안쪽으로 캔버스를 그림 비율에 맞춥니다
      var s = Math.min(1, 1000 / Math.max(img.width, img.height));
      cs.width = Math.round(img.width * s); cs.height = Math.round(img.height * s);
      clearPaper(); csx.drawImage(img, 0, 0, cs.width, cs.height); photo = true;
      convert();
    });
  });
  (function pad(){
    var down = false, last = null;
    function pt(e){ var r = cs.getBoundingClientRect(); return [(e.clientX - r.left) * cs.width / r.width, (e.clientY - r.top) * cs.height / r.height]; }
    cs.addEventListener('pointerdown', function(e){ down = true; last = pt(e); strokes.push([last]); cs.setPointerCapture(e.pointerId); });
    cs.addEventListener('pointermove', function(e){
      if(!down) return;
      var q = pt(e), pr = e.pressure && e.pointerType === 'pen' ? e.pressure : 0.6;
      csx.strokeStyle = '#111'; csx.lineWidth = 3 + pr * 5; csx.lineCap = 'round';
      csx.beginPath(); csx.moveTo(last[0], last[1]); csx.lineTo(q[0], q[1]); csx.stroke();
      last = q; strokes[strokes.length - 1].push(q);
    });
    function up(){ if(down){ down = false; convertSoon(); } }
    cs.addEventListener('pointerup', up); cs.addEventListener('pointercancel', up);
  })();
  HS.chalkStrokes = function(){ return strokes; };
  $('chalk-record').addEventListener('click', function(){
    var btn = this, opt = { sens: +$('chalk-th').value, color: $('chalk-color').value };
    var full = HS.chalkFull(cs, opt), bg = $('chalk-bg').value === 'none' ? 'board' : $('chalk-bg').value;
    // 사진이면 선을 따라 획을 찾아내고, 여기서 그린 그림이면 그린 획을 그대로 씁니다
    var order = photo ? HS.traceStrokes(HS.inkMask(csx.getImageData(0, 0, cs.width, cs.height), opt.sens), cs.width, cs.height) : strokes;
    var n = order.reduce(function(a, st){ return a + st.length; }, 0), dur = order.length ? Math.min(25, Math.max(3, n / 60)) : 4;
    var ctx = co.getContext('2d');
    btn.disabled = true;
    HS.recordCanvas(co, dur + 1.5, function(t){ HS.drawChalkReveal(ctx, co.width, co.height, full, order, Math.min(1, t / dur), bg); },
      function(t){ status('chalk-status', '녹화 중… ' + Math.floor(t) + '초'); })
      .then(function(b){ HS.download(HS.fileName(' 그리는영상' + HS.videoExt(b)), b); status('chalk-status', '녹화를 마쳤습니다'); convert(); })
      .catch(function(e){ status('chalk-status', e.message, true); })
      .then(function(){ btn.disabled = false; });
  });
  $('chalk-to-char').addEventListener('click', function(){
    var st = HS.makeSticker(cs, { sens: +$('chalk-th').value, chalk: $('char-chalk').checked, color: $('chalk-color').value, outline: $('char-outline').checked });
    if(!st){ status('chalk-status', '캐릭터로 쓸 그림이 없습니다', true); return; }
    var name = prompt('캐릭터 이름', '진행자'); if(name === null) return;
    var ch = HS.addCharacter(name, st);
    status('chalk-status', '"' + ch.name + '"을(를) 캐릭터로 저장했습니다. ③ 삽화 영상 탭에서 장면에 넣으세요.');
  });
  $('chalk-png').addEventListener('click', function(){ co.toBlob(function(b){ HS.download(HS.fileName(' 판서그림.png'), b); }); });
  $('chalk-to-board').addEventListener('click', function(){
    if(!lastChalk || !lastChalk.cropped){ status('chalk-status', '넣을 그림이 없습니다', true); return; }
    var b = P().board;
    if(!b.length) b.push({ title: P().title || '판서', text: '', drawing: null });
    var s = b[Math.min(page, b.length - 1)];
    HS.loadImage(lastChalk.cropped).then(function(img){
      s.drawing = lastChalk.cropped; s.dw = img.width; s.dh = img.height;
      HS.changed('board'); status('chalk-status', '판서 ' + (Math.min(page, b.length - 1) + 1) + '번째 장에 넣었습니다');
    });
  });

  /* ── 설정 ───────────────────────────────────────── */
  function renderUndo(){
    return HS.snapshots().then(function(h){
      $('undo-list').innerHTML = h.length ? h.map(function(x, i){
        var d = new Date(x.at);
        return '<div class="row" style="margin:4px 0"><span style="flex:1">' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.toTimeString().slice(0, 5) + ' · ' + HS.esc(x.label) +
          ' <span class="small">(' + HS.esc(x.title || '제목 없음') + ', 장면 ' + x.scenes + '개)</span></span><button class="btn" data-undo="' + i + '">이 상태로 되돌리기</button></div>';
      }).join('') : '<p class="small">아직 기록이 없습니다.</p>';
    });
  }
  $('undo-list').addEventListener('click', function(e){
    var b = e.target.closest('button[data-undo]'); if(!b) return;
    HS.restoreSnapshot(+b.dataset.undo).then(function(x){ HS.toast('"' + x.label + '" 때로 되돌렸습니다'); renderUndo(); }, function(err){ HS.toast(err.message); });
  });
  $('btn-undo').addEventListener('click', function(){ show('settings'); $('undo-list').scrollIntoView({ block: 'center' }); });
  function renderSettings(){
    renderUndo();
    $('cfg-key').value = HS.CFG.key; $('cfg-model').value = HS.CFG.model; $('cfg-format').value = HS.load('hs.format', 'mp4');
    $('cfg-cost').textContent = HS.cost.calls ? '지금까지 ' + HS.cost.calls + '번, 약 ' + Math.round(HS.cost.krw).toLocaleString() + '원 (어림).' : '';
  }
  $('cfg-save').addEventListener('click', function(){
    HS.CFG.key = $('cfg-key').value.trim(); HS.CFG.model = $('cfg-model').value;
    HS.save('hs.key', HS.CFG.key); HS.save('hs.model', HS.CFG.model); HS.save('hs.format', $('cfg-format').value);
    drawBadge(); HS.toast(HS.CFG.key ? 'AI를 켰습니다' : 'AI를 껐습니다 (간이 모드)');
  });
  /* 프로젝트 목록 (머리의 고르기 + 설정 탭의 표) */
  function drawProjects(){
    var list = HS.listProjects(), cur = P().id;
    if(!list.some(function(x){ return x.id === cur; })) list.unshift({ id: cur, title: P().title || '제목 없음', scenes: P().scenes.length, updated: '' });
    $('proj-select').innerHTML = list.map(function(x){ return '<option value="' + x.id + '"' + (x.id === cur ? ' selected' : '') + '>' + HS.esc(x.id === cur ? (P().title || '제목 없음') : x.title) + '</option>'; }).join('') + '<option value="__new">+ 새 프로젝트</option>';
    $('proj-list').innerHTML = list.map(function(x){
      var d = x.updated ? new Date(x.updated) : null;
      return '<div class="row" style="margin:3px 0"><span style="flex:1">' + (x.id === cur ? '▶ ' : '') + HS.esc(x.id === cur ? (P().title || '제목 없음') : x.title) +
        ' <span class="small">장면 ' + x.scenes + '개' + (d ? ' · ' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.toTimeString().slice(0, 5) : '') + '</span></span>' +
        (x.id === cur ? '' : '<button class="btn" data-open="' + x.id + '">열기</button>') + '</div>';
    }).join('');
  }
  HS.drawProjects = drawProjects;
  $('proj-select').addEventListener('change', function(){
    var v = this.value;
    stopPlay();
    (v === '__new' ? HS.newProject() : HS.openProject(v)).then(function(){ drawProjects(); if(v === '__new') show('source'); });
  });
  $('proj-list').addEventListener('click', function(e){
    var b = e.target.closest('button[data-open]'); if(!b) return;
    HS.openProject(b.dataset.open).then(drawProjects);
  });
  $('proj-dup').addEventListener('click', function(){ HS.duplicateProject().then(function(){ drawProjects(); HS.toast('복제했습니다. 지금 보는 것이 사본입니다'); }); });
  $('proj-del').addEventListener('click', function(){
    if(!confirm('"' + (P().title || '제목 없음') + '" 프로젝트를 지울까요? 되돌릴 수 없습니다. (백업을 먼저 받아 두세요)')) return;
    HS.deleteProject(P().id).then(function(){ drawProjects(); render(current); });
  });
  $('proj-title').addEventListener('change', drawProjects);
  $('cfg-format').addEventListener('change', function(){ HS.save('hs.format', this.value); });
  $('proj-export').addEventListener('click', function(){
    // 백업에는 API 키를 넣지 않습니다 (프로젝트만)
    HS.download(HS.fileName('.json'), new Blob([JSON.stringify(P(), null, 1)], { type: 'application/json' }));
  });
  $('proj-import').addEventListener('change', function(){
    var f = this.files[0]; if(!f) return;
    HS.readFile(f, true).then(function(t){
      var p = JSON.parse(t);
      if(!p || !Array.isArray(p.scenes)) throw new Error('사관 스튜디오 백업 파일이 아닙니다');
      return HS.addProject(p).then(function(){ status('proj-status', '새 프로젝트로 불러왔습니다: ' + (p.title || '제목 없음')); drawProjects(); });
    }).catch(function(e){ status('proj-status', e.message, true); });
  });
  $('proj-new').addEventListener('click', function(){
    HS.newProject().then(function(){ drawProjects(); show('source'); });
  });

  /* ── 시작 ───────────────────────────────────────── */
  drawBadge();
  HS.ready.then(function(){
    $('proj-title').value = P().title || '';
    drawProjects();
    var startTab = 'source';
    try{ startTab = localStorage.getItem('hs.tab') || 'source'; }catch(e){}
    show(document.getElementById('tab-' + startTab) ? startTab : 'source');
    document.body.setAttribute('data-ready', '1');
  });
  // 웹 글꼴이 늦게 오면 캔버스를 다시 그립니다
  if(document.fonts && document.fonts.ready) Promise.all([HS.ready, document.fonts.ready]).then(function(){ render(current); });
})();
