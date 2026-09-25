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
    ({ source: renderSource, script: renderScript, video: renderVideo, story: renderStory, map: renderMap, board: renderBoard, chalk: renderChalk, settings: renderSettings })[tab]();
  }
  HS.onChange(function(what){ if(what === 'all') { $('proj-title').value = P().title || ''; render(current); } });

  $('proj-title').addEventListener('input', function(){ P().title = this.value; HS.changed('title'); });

  /* ── ① 소스 ─────────────────────────────────────── */
  function renderSource(){
    var p = P();
    $('src-text').value = p.source;
    $('opt-length').value = p.options.length; $('opt-audience').value = p.options.audience; $('opt-tone').value = p.options.tone;
  }
  $('src-text').addEventListener('input', function(){ P().source = this.value; HS.changed('source'); });
  ['opt-length', 'opt-audience', 'opt-tone'].forEach(function(id){
    $(id).addEventListener('change', function(){ P().options[{ 'opt-length': 'length', 'opt-audience': 'audience', 'opt-tone': 'tone' }[id]] = this.value; HS.changed('options'); });
  });
  $('src-file').addEventListener('change', function(){
    var f = this.files[0]; if(!f) return;
    HS.readFile(f, true).then(function(t){ P().source = t; $('src-text').value = t; HS.changed('source'); });
  });
  $('src-sample').addEventListener('click', function(){ P().source = window.SAMPLE_SOURCE; $('src-text').value = P().source; HS.changed('source'); });
  $('btn-generate').addEventListener('click', function(){
    var btn = this;
    if(!P().source.trim()){ status('gen-status', '소스를 먼저 넣으세요', true); return; }
    if(P().scenes.length && !confirm('지금 대본·판서·지도를 새로 만든 것으로 바꿀까요?')) return;
    if(!aiOn()){
      try{ HS.generateSimple(); status('gen-status', '간이 방식으로 장면 ' + P().scenes.length + '개를 만들었습니다.'); show('script'); }
      catch(e){ status('gen-status', e.message, true); }
      return;
    }
    btn.disabled = true; status('gen-status', 'Claude에게 보내는 중…');
    HS.generateAI(function(m){ status('gen-status', m); }).then(function(){
      status('gen-status', '장면 ' + P().scenes.length + '개, 판서 ' + P().board.length + '장, 지명 ' + P().map.places.length + '곳을 만들었습니다. (약 ' + (HS.cost.last || 0) + '원)');
      show('script');
    }).catch(function(e){ console.error(e); status('gen-status', HS.whyFail(e), true); })
      .then(function(){ btn.disabled = false; });
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
        '<span style="flex:1"></span>AI로 고치기 <select data-rw>' + opts(REWRITE_LABEL, 'short') + '</select><button class="btn" data-act="rewrite">고치기</button><span class="status" data-st></span></div></div>';
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
    P().scenes[+box.dataset.i][k] = e.target.value; HS.changed('scene');
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
      HS.rewriteScene(i, ins).then(function(){ renderScript(); HS.toast('#' + (i + 1) + ' 장면을 고쳤습니다'); })
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
  function renderVideo(){
    var p = P();
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
        '<div class="row small" style="margin-top:6px">카메라 <select data-k="motion">' + opts(MOTIONS, s.motion) + '</select> 분위기 <select data-k="mood">' + opts(MOODS, s.mood) + '</select> <span>약 ' + Math.round(HS.sceneDuration(s)) + '초</span></div></div>';
    }).join('') : '<p class="small">대본이 없습니다.</p>';
    status('vid-status', p.scenes.length ? '전체 약 ' + Math.round(HS.totalDuration()) + '초' : '');
    HS.preloadImages().then(function(){ drawVideoAt(Math.min(playT, HS.totalDuration())); });
  }
  function aiDraw(i, st){
    st = st || function(){};
    return HS.drawSceneAI(i, st).then(function(){ st(''); renderVideo(); });
  }
  $('vid-scenes').addEventListener('change', function(e){
    var box = e.target.closest('.scene'); if(!box) return;
    var s = P().scenes[+box.dataset.i], act = e.target.dataset.act;
    if(e.target.dataset.k){ s[e.target.dataset.k] = e.target.value; HS.changed('scene'); renderVideo(); return; }
    if(act === 'usemap'){ s.useMap = e.target.checked; HS.changed('scene'); renderVideo(); return; }
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
        drawVideoAt(playT);
        status('vid-status', Math.floor(playT) + ' / ' + Math.round(total) + '초');
        playing = requestAnimationFrame(loop);
      })(performance.now());
    });
  });
  $('vid-record').addEventListener('click', function(){
    var btn = this, total = HS.totalDuration(); if(!total) return;
    stopPlay(); btn.disabled = true;
    var voiced = P().scenes.some(function(s){ return s.audio; });
    HS.preloadImages().then(function(){
      return Promise.all(P().scenes.map(HS.sceneAudio)); // 소리를 미리 풀어 두어야 그림과 어긋나지 않습니다
    }).then(function(){
      return HS.recordCanvas(vc, total, drawVideoAt, function(t){ status('vid-status', '녹화 중… ' + Math.floor(t) + ' / ' + Math.round(total) + '초 (탭을 바꾸지 마세요)'); },
        voiced ? function(dest){ return HS.playNarration(0, dest); } : null);
    }).then(function(blob){ HS.download(HS.fileName(' 삽화영상.webm'), blob); status('vid-status', '녹화를 마쳤습니다 (' + Math.round(blob.size / 1024) + 'KB' + (voiced ? ', 목소리 포함' : '') + ')'); })
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
      .then(function(b){ HS.download(HS.fileName(' 지도.webm'), b); status('map-status', '녹화를 마쳤습니다'); })
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
    }).then(function(blob){ HS.download(HS.fileName(' 판서영상.webm'), blob); status('board-status', '녹화를 마쳤습니다'); drawBoardNow(); })
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
  var cs = $('chalk-src'), co = $('chalk-out'), csx = cs.getContext('2d'), lastChalk = null, chalkTimer = null, strokes = [];
  function clearPaper(){ csx.fillStyle = '#fff'; csx.fillRect(0, 0, cs.width, cs.height); strokes = []; }
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
      clearPaper(); csx.drawImage(img, 0, 0, cs.width, cs.height);
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
    var n = strokes.reduce(function(a, st){ return a + st.length; }, 0), dur = strokes.length ? Math.min(20, Math.max(3, n / 60)) : 4;
    var ctx = co.getContext('2d');
    btn.disabled = true;
    HS.recordCanvas(co, dur + 1.5, function(t){ HS.drawChalkReveal(ctx, co.width, co.height, full, strokes, Math.min(1, t / dur), bg); },
      function(t){ status('chalk-status', '녹화 중… ' + Math.floor(t) + '초'); })
      .then(function(b){ HS.download(HS.fileName(' 그리는영상.webm'), b); status('chalk-status', '녹화를 마쳤습니다'); convert(); })
      .catch(function(e){ status('chalk-status', e.message, true); })
      .then(function(){ btn.disabled = false; });
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
  function renderSettings(){
    $('cfg-key').value = HS.CFG.key; $('cfg-model').value = HS.CFG.model;
    $('cfg-cost').textContent = HS.cost.calls ? '지금까지 ' + HS.cost.calls + '번, 약 ' + Math.round(HS.cost.krw).toLocaleString() + '원 (어림).' : '';
  }
  $('cfg-save').addEventListener('click', function(){
    HS.CFG.key = $('cfg-key').value.trim(); HS.CFG.model = $('cfg-model').value;
    HS.save('hs.key', HS.CFG.key); HS.save('hs.model', HS.CFG.model);
    drawBadge(); HS.toast(HS.CFG.key ? 'AI를 켰습니다' : 'AI를 껐습니다 (간이 모드)');
  });
  $('proj-export').addEventListener('click', function(){
    // 백업에는 API 키를 넣지 않습니다 (프로젝트만)
    HS.download(HS.fileName('.json'), new Blob([JSON.stringify(P(), null, 1)], { type: 'application/json' }));
  });
  $('proj-import').addEventListener('change', function(){
    var f = this.files[0]; if(!f) return;
    HS.readFile(f, true).then(function(t){
      var p = JSON.parse(t);
      if(!p || !Array.isArray(p.scenes)) throw new Error('사관 스튜디오 백업 파일이 아닙니다');
      HS.setProject(p); status('proj-status', '불러왔습니다: ' + (p.title || '제목 없음'));
    }).catch(function(e){ status('proj-status', e.message, true); });
  });
  $('proj-new').addEventListener('click', function(){
    if(!confirm('지금 프로젝트를 비우고 새로 시작할까요? (백업을 먼저 받아 두세요)')) return;
    HS.setProject(HS.blankProject()); show('source');
  });

  /* ── 시작 ───────────────────────────────────────── */
  drawBadge();
  HS.ready.then(function(){
    $('proj-title').value = P().title || '';
    var startTab = 'source';
    try{ startTab = localStorage.getItem('hs.tab') || 'source'; }catch(e){}
    show(document.getElementById('tab-' + startTab) ? startTab : 'source');
    document.body.setAttribute('data-ready', '1');
  });
  // 웹 글꼴이 늦게 오면 캔버스를 다시 그립니다
  if(document.fonts && document.fonts.ready) Promise.all([HS.ready, document.fonts.ready]).then(function(){ render(current); });
})();
