/* 🎨 이미지 탭 화면 — 화풍·등장인물 설정, 기획, 주문서·불러오기, 샷 보드 */
(function(){
  'use strict';
  var HS = window.HS, $ = HS.$, P = function(){ return HS.project; };
  function esc(s){ return HS.esc(s); }
  function opts(map, cur){ return Object.keys(map).map(function(k){ return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + (map[k].label || map[k]) + '</option>'; }).join(''); }
  function status(msg, err){ var el = $('shots-status'); el.textContent = msg || ''; el.classList.toggle('err', !!err); }
  function sentencesOf(t){ return (String(t || '').match(/[^.!?。]+[.!?。]?/g) || []).map(function(x){ return x.trim(); }).filter(Boolean); }

  function drawThumb(c, s, sh){
    var x = c.getContext('2d'), w = c.width, h = c.height;
    x.fillStyle = '#e9e2d3'; x.fillRect(0, 0, w, h);
    var fake = { shots: [sh], narration: s.narration, motion: s.motion };
    if(!HS.drawShots(x, w, h, fake, 0.6)){
      x.fillStyle = '#8a7d6b'; x.font = 'bold 15px sans-serif'; x.textAlign = 'center';
      x.fillText(HS.SHOT_TYPES[sh.type] + ' · 그림 없음', w / 2, h / 2 + 5); x.textAlign = 'left';
    }
  }
  function renderCast(){
    var a = HS.art();
    $('art-style').innerHTML = opts(HS.ART_STYLES, a.style);
    $('art-extra').value = a.extra || '';
    $('cast-list').innerHTML = a.cast.length ? a.cast.map(function(c, i){
      return '<div class="row cast" data-i="' + i + '"><input type="text" data-c="name" value="' + esc(c.name) + '" placeholder="이름" style="width:110px">' +
        '<input type="text" data-c="look" value="' + esc(c.look) + '" placeholder="생김새 (영어가 좋음: 50s, stern face, short beard, red armor…)" style="flex:1;min-width:160px">' +
        '<button class="btn" data-c-del style="padding:2px 8px">✕</button></div>';
    }).join('') : '<p class="small">아직 없습니다. "이미지 기획"을 하면 Claude가 등장인물의 생김새를 정해 줍니다. 직접 적어도 됩니다.</p>';
  }
  HS.renderShots = function(){
    var p = P(), st = HS.shotStats();
    renderCast();
    $('shots-gen-all').hidden = !HS.imageOn();
    $('shots-progress').textContent = st.total ? '그림 ' + st.total + '장 가운데 ' + st.done + '장 준비됨' + (st.done < st.total ? ' · ' + (st.total - st.done) + '장 남음' : ' · 모두 준비됨') : '';
    if(!p.scenes.length){ $('shots-board').innerHTML = '<p class="small">대본이 없습니다.</p>'; return; }
    $('shots-board').innerHTML = p.scenes.map(function(s, i){
      var kind = HS.sceneKind(s), sents = sentencesOf(s.narration);
      var head = '<div class="shot-scene" data-i="' + i + '"><div class="row"><span class="num">#' + (i + 1) + '</span><b style="flex:1">' + esc(s.heading) + '</b>';
      if(HS.isDataScene(s)) return head + '<span class="pill">' + HS.SCENE_KINDS[kind] + ' 장면 — 앱이 그림</span></div></div>';
      return head + '<button class="btn" data-act="add" style="padding:2px 10px">+ 샷</button></div>' +
        '<div class="shot-grid">' + (s.shots || []).map(function(sh, j){
          return '<div class="shot" data-j="' + j + '"><canvas width="240" height="' + (p.aspect === '9:16' ? 426 : 135) + '"></canvas>' +
            '<div class="row small"><b>' + (i + 1) + '-' + (j + 1) + '</b><select data-f="type">' + opts(HS.SHOT_TYPES, sh.type) + '</select>' +
            '<select data-f="sentence" title="이 문장부터 이 그림">' + sents.map(function(t, k){ return '<option value="' + k + '"' + (k === sh.sentence ? ' selected' : '') + '>' + (k + 1) + '. ' + esc(t.slice(0, 14)) + '…</option>'; }).join('') + '</select></div>' +
            '<input type="text" data-f="desc" value="' + esc(sh.desc) + '" placeholder="무엇을 보여 줄지 (한국어)">' +
            (sh.type === 'map' ? '<input type="text" data-f="places" value="' + esc((sh.places || []).join(', ')) + '" placeholder="지도에 찍을 지명 (쉼표로, 비우면 전체)">'
              : '<textarea data-f="prompt" placeholder="이미지 프롬프트 (영어)">' + esc(sh.prompt) + '</textarea>' +
                '<div class="row small"><button class="btn" data-act="copy">프롬프트 복사</button><label class="btn">파일 넣기<input type="file" accept="image/*" data-act="file" hidden></label>' +
                (HS.imageOn() ? '<button class="btn" data-act="gen">' + (sh.image ? '다시 생성' : 'API 생성') + '</button>' : '') +
                (sh.image ? '<button class="btn" data-act="noimg">그림 빼기</button>' : '') + '</div>') +
            '<div class="row small"><span class="status" data-st></span><span style="flex:1"></span><button class="btn" data-act="del" style="padding:1px 8px">샷 지우기</button></div></div>';
        }).join('') + '</div></div>';
    }).join('');
    HS.preloadImages().then(function(){
      Array.prototype.forEach.call(document.querySelectorAll('#shots-board .shot'), function(el){
        var i = +el.closest('.shot-scene').dataset.i, j = +el.dataset.j, s = P().scenes[i];
        if(s && s.shots[j]) drawThumb(el.querySelector('canvas'), s, s.shots[j]);
      });
    });
  };

  // 화풍·인물
  $('art-style').addEventListener('change', function(){ HS.art().style = this.value; HS.changed('art'); });
  $('art-extra').addEventListener('input', function(){ HS.art().extra = this.value; HS.changed('art'); });
  $('cast-add').addEventListener('click', function(){ HS.art().cast.push({ name: '', look: '' }); HS.changed('art'); renderCast(); });
  $('cast-list').addEventListener('input', function(e){
    var row = e.target.closest('.cast'), k = e.target.dataset.c; if(!row || !k) return;
    HS.art().cast[+row.dataset.i][k] = e.target.value; HS.changed('art');
  });
  $('cast-list').addEventListener('click', function(e){
    var b = e.target.closest('[data-c-del]'); if(!b) return;
    HS.art().cast.splice(+b.closest('.cast').dataset.i, 1); HS.changed('art'); renderCast();
  });

  // 기획
  $('shots-plan').addEventListener('click', function(){
    var btn = this;
    if(!P().scenes.length){ status('대본이 없습니다', true); return; }
    var has = P().scenes.some(function(s){ return (s.shots || []).length; });
    if(has && !confirm('지금 샷 목록을 새로 짠 것으로 바꿀까요? (지금 상태는 되돌리기 기록에 남습니다)')) return;
    btn.disabled = true;
    HS.snapshot('이미지 기획 전').then(function(){
      if(!HS.CFG.key){ HS.planShotsSimple(); status('API 키가 없어 장면 설명으로 간단히 짰습니다. 프롬프트를 다듬어 쓰세요'); return; }
      status('Claude가 샷을 짜는 중…');
      return HS.planShotsAI(function(m){ status(m); }).then(function(){ status('샷을 짰습니다 (약 ' + (HS.cost.last || 0) + '원)'); });
    }).catch(function(e){ status(HS.whyFail(e), true); }).then(function(){ btn.disabled = false; HS.renderShots(); });
  });

  // 주문서 · 불러오기 · 일괄 생성
  $('shots-order').addEventListener('click', function(){
    HS.exportImageOrder($('shots-order-all').checked).then(function(r){ status('주문서를 받았습니다 — 그림 ' + r.count + '장. 압축을 풀고 안의 "읽어 주세요.md"를 보세요'); }, function(e){ status(e.message, true); });
  });
  function importFiles(input){
    var files = input.files; if(!files || !files.length) return;
    status(files.length + '개 파일 읽는 중…');
    HS.importShotFiles(files).then(function(r){
      status(r.ok + '장을 샷에 붙였습니다' + (r.miss.length ? ' · 이름이 맞지 않아 못 붙인 파일 ' + r.miss.length + '개: ' + r.miss.slice(0, 3).join(', ') + (r.miss.length > 3 ? ' …' : '') : ''), !!r.miss.length && !r.ok);
      HS.renderShots();
    }).then(function(){ input.value = ''; });
  }
  $('shots-import').addEventListener('change', function(){ importFiles(this); });
  $('shots-import-dir').addEventListener('change', function(){ importFiles(this); });
  $('shots-gen-all').addEventListener('click', function(){
    var btn = this, list = HS.pendingShots(false);
    if(!list.length){ status('만들 그림이 없습니다'); return; }
    if(!confirm(list.length + '장을 ' + HS.imageProviderName() + ' API로 만듭니다. 대략 ' + (list.length * HS.imageCostWon()).toLocaleString() + '원입니다. 할까요?')) return;
    btn.disabled = true; var k = 0;
    (function next(){
      if(k >= list.length){ btn.disabled = false; status(list.length + '장을 만들었습니다'); HS.renderShots(); return; }
      var x = list[k++]; status('#' + (x.si + 1) + '-' + (x.sj + 1) + ' 만드는 중 (' + k + '/' + list.length + ')…');
      HS.generateShotImage(x.sh).then(next, function(e){ btn.disabled = false; status('#' + (x.si + 1) + '-' + (x.sj + 1) + ': ' + e.message, true); HS.renderShots(); });
    })();
  });

  // 샷 카드
  function at(el){ var sc = el.closest('.shot-scene'), sh = el.closest('.shot'), s = P().scenes[+sc.dataset.i]; return { i: +sc.dataset.i, s: s, j: sh ? +sh.dataset.j : -1, shot: sh ? s.shots[+sh.dataset.j] : null, el: sh }; }
  $('shots-board').addEventListener('input', function(e){
    var f = e.target.dataset.f; if(!f || e.target.tagName === 'SELECT') return;
    var a = at(e.target);
    a.shot[f] = f === 'places' ? e.target.value.split(/[,，]/).map(function(x){ return x.trim(); }).filter(Boolean) : e.target.value;
    HS.changed('shots');
    if(f === 'places') drawThumb(a.el.querySelector('canvas'), a.s, a.shot);
  });
  $('shots-board').addEventListener('change', function(e){
    var a = at(e.target), f = e.target.dataset.f;
    if(f === 'type' || f === 'sentence'){
      a.shot[f] = f === 'sentence' ? +e.target.value : e.target.value;
      if(f === 'sentence') a.s.shots.sort(function(x, y){ return x.sentence - y.sentence; });
      HS.changed('shots'); HS.renderShots(); return;
    }
    if(e.target.dataset.act === 'file' && e.target.files[0]){
      HS.readFile(e.target.files[0]).then(function(u){ return HS.shrinkImage(u, 1920); }).then(function(u){ a.shot.image = u; HS.changed('shots'); HS.renderShots(); });
    }
  });
  $('shots-board').addEventListener('click', function(e){
    var b = e.target.closest('button[data-act]'); if(!b) return;
    var a = at(b), act = b.dataset.act, st = a.el && a.el.querySelector('[data-st]');
    if(act === 'add'){
      var n = sentencesOf(a.s.narration).length, last = (a.s.shots || []).slice(-1)[0];
      (a.s.shots = a.s.shots || []).push({ id: Math.random().toString(36).slice(2, 6), type: 'scene', desc: '', prompt: '', sentence: Math.min(n - 1, last ? last.sentence + 1 : 0), places: [], image: null });
    } else if(act === 'del'){ if(a.shot.image && !confirm('그림이 있는 샷입니다. 지울까요?')) return; a.s.shots.splice(a.j, 1); }
    else if(act === 'noimg'){ a.shot.image = null; }
    else if(act === 'copy'){ navigator.clipboard && navigator.clipboard.writeText(HS.shotPrompt(a.shot)); HS.toast('프롬프트를 복사했습니다. ChatGPT 등에 붙여 넣으세요'); return; }
    else if(act === 'gen'){
      b.disabled = true; st.textContent = '만드는 중…';
      HS.generateShotImage(a.shot).then(function(){ HS.renderShots(); }, function(err){ st.textContent = err.message; b.disabled = false; });
      return;
    }
    HS.changed('shots'); HS.renderShots();
  });
})();
