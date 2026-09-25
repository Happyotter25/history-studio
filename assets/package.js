/* 한 번에 만들기 · 모두 받기
 *  - 한 번에 만들기: 대본 → (AI 그림) → (사실 확인) → 업로드 정보 → 수업 자료를 차례로 돌립니다. 도중에 멈출 수 있습니다.
 *  - 모두 받기: 대본·자막·챕터·업로드 정보·PPT 3종·학습지·썸네일·지도·장면 그림·캐릭터·백업을 ZIP 하나로.
 *    (영상은 실제 시간만큼 녹화해야 하므로 ZIP 에 넣지 않습니다)
 */
(function(){
  'use strict';
  var HS = window.HS, $ = HS.$, P = function(){ return HS.project; };

  function canvasBlob(c, type){ return new Promise(function(ok){ c.toBlob(ok, type || 'image/png', 0.9); }); }
  function dataUrlBytes(u){ var b = atob(u.slice(u.indexOf(',') + 1)), a = new Uint8Array(b.length); for(var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  function safe(s){ return String(s || '').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 40) || '이름없음'; }

  HS.uploadText = function(){
    var u = P().upload; if(!u) return '';
    return ['[제목 후보]'].concat(u.titles.map(function(t, i){ return (i + 1) + '. ' + t; }),
      ['', '[설명]', u.description + HS.descriptionSuffix(), '', '[태그]', u.tags.join(', '), '', '[고정 댓글]', u.pinned]).join('\n');
  };

  // 모두 받기: onStep(글) 로 진행을 알립니다. noDownload 면 Blob 만 돌려줍니다
  HS.exportAll = function(onStep, noDownload){
    var p = P(), zip = new window.JSZip(), root = zip.folder(safe(p.title || '사관스튜디오'));
    var step = onStep || function(){};
    if(!p.scenes.length) return Promise.reject(new Error('대본이 없습니다'));
    step('대본·자막 넣는 중');
    root.file('대본.txt', HS.scriptText());
    root.file('자막.srt', HS.srt());
    root.file('챕터.txt', HS.chaptersText());
    if(p.upload) root.file('업로드 정보.txt', HS.uploadText());
    if(p.lesson){ root.file('학습지(학생용).html', HS.worksheetHtml(false)); root.file('학습지(교사용).html', HS.worksheetHtml(true)); }
    var backup = JSON.parse(JSON.stringify(p));
    root.file('프로젝트 백업.json', JSON.stringify(backup));
    return HS.preloadImages().then(function(){
      step('장면 그림 넣는 중');
      var fs = HS.frameSize(), pics = root.folder('장면 그림');
      return Promise.all(p.scenes.map(function(s, i){
        return canvasBlob(HS.sceneStill(s, fs[0] * 1.5, fs[1] * 1.5), 'image/jpeg').then(function(b){ pics.file(pad2(i + 1) + ' ' + safe(s.heading) + '.jpg', b); });
      }));
    }).then(function(){
      (p.characters || []).forEach(function(c){ root.folder('캐릭터').file(safe(c.name) + '.png', dataUrlBytes(c.image)); });
      step('썸네일·지도 그리는 중');
      var th = document.createElement('canvas'); th.width = 1280; th.height = 720;
      HS.drawThumbnail(th.getContext('2d'), 1280, 720, p.thumb || { scene: 0, main: p.title || '', sub: '', color: 'yellow', layout: 'left' });
      var jobs = [canvasBlob(th).then(function(b){ root.file('썸네일.png', b); })];
      if(p.map.places.length){
        var m = document.createElement('canvas'); m.width = 1920; m.height = 1080;
        HS.drawMap(m.getContext('2d'), 1920, 1080, p.map, { style: p.mapStyle || 'old' });
        jobs.push(canvasBlob(m).then(function(b){ root.file('지도.png', b); }));
      }
      return Promise.all(jobs);
    }).then(function(){
      step('스토리 PPT 만드는 중');
      return HS.exportStoryPptx({ noDownload: true, mapStyle: p.mapStyle }).then(function(b){ root.file('스토리.pptx', b); });
    }).then(function(){
      if(!p.board.length) return;
      step('판서 PPT 만드는 중');
      return HS.exportBoardPptx({ noDownload: true }).then(function(b){ root.file('판서.pptx', b); });
    }).then(function(){
      if(!p.lesson || !p.lesson.quiz.length) return;
      step('퀴즈 PPT 만드는 중');
      return HS.exportQuizPptx({ noDownload: true }).then(function(b){ root.file('퀴즈.pptx', b); });
    }).then(function(){
      root.file('읽어 주세요.txt', [
        (p.title || '사관 스튜디오') + ' — 사관 스튜디오에서 만든 자료',
        '',
        '· 대본.txt / 자막.srt(유튜브 스튜디오 → 자막 → 파일 업로드) / 챕터.txt(설명란에 붙여 넣기)',
        '· 스토리.pptx, 판서.pptx' + (p.lesson ? ', 퀴즈.pptx, 학습지(학생용·교사용).html' : ''),
        '· 썸네일.png' + (p.map.places.length ? ', 지도.png' : '') + ', 장면 그림 폴더',
        '· 프로젝트 백업.json: 사관 스튜디오 설정 탭의 "백업 불러오기"로 다시 열 수 있습니다.',
        '· 영상은 사관 스튜디오의 ③ 삽화 영상 탭에서 "영상 녹화"로 따로 만듭니다.'
      ].join('\r\n'));
      step('묶는 중');
      return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }).then(function(blob){
      if(!noDownload) HS.download(HS.fileName(' 전체.zip'), blob);
      return blob;
    });
  };

  /* ── 한 번에 만들기 ─────────────────────────────────── */
  var STEPS = [
    { id: 'script', label: '대본·판서·지도', ai: 300, run: function(ai, say){ return ai ? HS.generateAI(say) : Promise.resolve().then(HS.generateSimple); } },
    { id: 'art', label: '빈 장면 AI 그림', aiOnly: true, perScene: 200, run: function(ai, say, ctl){
      var img = HS.imageOn();
      var todo = P().scenes.map(function(s, i){ return (!s.image && !s.svg && HS.needsPicture(s)) ? i : -1; }).filter(function(i){ return i >= 0; }), k = 0;
      return (function next(){
        if(ctl.stopped || k >= todo.length) return Promise.resolve();
        var i = todo[k++]; say('#' + (i + 1) + ' 그리는 중 (' + k + '/' + todo.length + ')');
        return (img ? HS.drawSceneImage(i) : HS.drawSceneAI(i)).then(next);
      })();
    } },
    { id: 'check', label: '사실 확인', aiOnly: true, ai: 200, run: function(){ return HS.factCheck(); } },
    { id: 'upload', label: '제목·설명·태그', ai: 100, run: function(ai){ return ai ? HS.generateUploadAI() : Promise.resolve().then(HS.uploadSimple); } },
    { id: 'lesson', label: '수업 자료', ai: 200, run: function(ai){ return ai ? HS.generateLessonAI() : Promise.resolve().then(HS.generateLessonSimple); } }
  ];
  HS.PIPELINE_STEPS = STEPS;
  function aiOn(){ return !!HS.CFG.key; }
  // 예상 비용(원, 어림): 장면 수는 영상 길이로 짐작합니다
  HS.estimateCost = function(chosen){
    var scenes = P().scenes.length || { short: 5, mid: 11, long: 18 }[P().options.length] || 11, won = 0;
    STEPS.forEach(function(s){ if(chosen.indexOf(s.id) >= 0) won += s.perScene ? (HS.imageOn() ? HS.imageCostWon() : s.perScene) * scenes : s.ai; });
    return aiOn() || HS.imageOn() ? won : 0;
  };
  function chosen(){ return STEPS.filter(function(s){ var c = $('pipe-' + s.id); return c && c.checked && !c.disabled; }).map(function(s){ return s.id; }); }
  function drawPlan(){
    var on = aiOn();
    $('pipe-steps').innerHTML = STEPS.map(function(s){
      var dis = s.aiOnly && !on && !(s.id === 'art' && HS.imageOn());
      return '<label class="inline" style="margin-right:12px"><input type="checkbox" id="pipe-' + s.id + '"' + (dis ? ' disabled' : ' checked') + (s.id === 'script' ? ' disabled checked' : '') + '> ' + s.label + (dis ? ' (AI 필요)' : '') + '</label>';
    }).join('');
    var sc = $('pipe-script'); if(sc) sc.disabled = true;
    drawCost();
  }
  function drawCost(){
    var won = HS.estimateCost(chosen().concat(['script']));
    $('pipe-cost').textContent = aiOn() || HS.imageOn() ? '예상 비용 약 ' + won.toLocaleString() + '원 (어림)' : 'AI 없이 간이 방식으로 만듭니다 (무료)';
  }
  HS.drawPipelinePlan = drawPlan;
  var ctl = null;
  HS.runPipeline = function(ids, onLog){
    var ai = aiOn(), log = onLog || function(){};
    ctl = { stopped: false };
    var list = STEPS.filter(function(s){ return s.id === 'script' || ids.indexOf(s.id) >= 0; }), done = [];
    return HS.snapshot('한 번에 만들기 전').then(function(){
      return list.reduce(function(chain, s){
        return chain.then(function(){
          if(ctl.stopped) return;
          log(s.id, 'run', s.label + ' 만드는 중…');
          return s.run(ai, function(m){ log(s.id, 'run', s.label + ' — ' + m); }, ctl).then(function(){ done.push(s.id); log(s.id, 'ok', s.label + ' 완료'); });
        });
      }, Promise.resolve());
    }).then(function(){ return { done: done, stopped: ctl.stopped }; }, function(e){ e.done = done; throw e; });
  };
  HS.stopPipeline = function(){ if(ctl) ctl.stopped = true; HS.cancelAI(); };

  // 화면
  $('pipe-open').addEventListener('click', function(){ $('pipe-card').hidden = !$('pipe-card').hidden; drawPlan(); });
  $('pipe-steps').addEventListener('change', drawCost);
  $('pipe-run').addEventListener('click', function(){
    var btn = this;
    if(!HS.hasSource()){ $('pipe-log').textContent = '소스를 먼저 넣으세요'; return; }
    if(P().scenes.length && !confirm('지금 대본과 자료를 새로 만든 것으로 바꿉니다. (지금 상태는 되돌리기 기록에 남습니다) 계속할까요?')) return;
    btn.disabled = true; $('pipe-stop').hidden = false; $('pipe-zip').hidden = true;
    var lines = {};
    function log(id, state, msg){
      lines[id] = (state === 'ok' ? '✅ ' : state === 'err' ? '⚠️ ' : '⏳ ') + msg;
      $('pipe-log').innerHTML = HS.PIPELINE_STEPS.filter(function(s){ return lines[s.id]; }).map(function(s){ return '<div>' + HS.esc(lines[s.id]) + '</div>'; }).join('');
    }
    HS.runPipeline(chosen(), log).then(function(r){
      $('pipe-log').insertAdjacentHTML('beforeend', '<div><b>' + (r.stopped ? '멈췄습니다. 여기까지 만든 것은 남아 있습니다.' : '다 만들었습니다! 탭을 돌아보며 다듬고, 아래에서 모두 받으세요.') + '</b></div>');
      $('pipe-zip').hidden = false;
    }).catch(function(e){
      $('pipe-log').insertAdjacentHTML('beforeend', '<div class="status err">' + HS.esc(HS.whyFail(e)) + '</div>');
      if(e.done && e.done.length) $('pipe-zip').hidden = false;
    }).then(function(){ btn.disabled = false; $('pipe-stop').hidden = true; });
  });
  $('pipe-stop').addEventListener('click', HS.stopPipeline);
  function zipClick(statusEl){
    return function(){
      var btn = this; btn.disabled = true;
      HS.exportAll(function(m){ statusEl().textContent = m + '…'; })
        .then(function(b){ statusEl().textContent = '받았습니다 (' + (b.size / 1048576).toFixed(1) + 'MB)'; })
        .catch(function(e){ statusEl().textContent = e.message; })
        .then(function(){ btn.disabled = false; });
    };
  }
  $('pipe-zip').addEventListener('click', zipClick(function(){ return $('pipe-zip-status'); }));
  $('up-zip').addEventListener('click', zipClick(function(){ return $('up-status'); }));
})();
