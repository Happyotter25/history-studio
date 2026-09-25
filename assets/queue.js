/* 그림 대기열 — 여러 샷을 넣어 두고 한 번에 만듭니다 (이미지 API 키가 있을 때).
 *  - 샷마다 후보 수(1~4장)만큼 만들고, 새 그림이 샷에 들어가며 전 그림은 후보로 남습니다.
 *  - 동시에 1~3장씩 만들고, 멈췄다 이어 하고, 실패한 것만 다시 할 수 있습니다.
 *  - 잠깐의 붐빔(429·5xx)은 조금 기다렸다 두 번까지 다시 해 보고, 키 오류(401·403)면 대기열 전체를 멈춥니다.
 * 대기열은 이 창에만 있습니다(새로 고침하면 비워짐). 만든 그림은 프로젝트에 저장됩니다.
 */
(function(){
  'use strict';
  var HS = window.HS;
  var Q = HS.Q = { items: [], concurrency: +(HS.load('hs.qConc', '2')) || 2, running: 0, paused: true };
  var listeners = [];
  HS.onQueue = function(fn){ listeners.push(fn); };
  function emit(){ listeners.forEach(function(fn){ try{ fn(Q); }catch(e){ console.error(e); } }); }
  var seq = 0;

  HS.enqueueShots = function(ids, variants){
    var added = 0;
    ids.forEach(function(id){
      if(Q.items.some(function(it){ return it.shotId === id && (it.status === 'wait' || it.status === 'run'); })) return;
      var f = HS.findShot(id); if(!f || f.sh.type === 'map') return;
      Q.items.push({ key: ++seq, shotId: id, label: (f.si + 1) + '-' + (f.sj + 1) + ' ' + (f.sh.desc || f.s.heading), variants: Math.max(1, Math.min(4, variants || 1)), done: 0, status: 'wait', error: '' });
      added++;
    });
    emit();
    return added;
  };
  HS.queueStart = function(){
    if(!HS.imageOn()){ return false; }
    Q.paused = false; emit(); pump(); return true;
  };
  HS.queuePause = function(){ Q.paused = true; emit(); };
  HS.queueSetConcurrency = function(n){ Q.concurrency = Math.max(1, Math.min(3, n | 0)); HS.save('hs.qConc', String(Q.concurrency)); pump(); emit(); };
  HS.queueRetryFailed = function(){ Q.items.forEach(function(it){ if(it.status === 'fail'){ it.status = 'wait'; it.error = ''; } }); emit(); if(!Q.paused) pump(); };
  HS.queueClearDone = function(){ Q.items = Q.items.filter(function(it){ return it.status !== 'ok'; }); emit(); };
  HS.queueClearWaiting = function(){ Q.items = Q.items.filter(function(it){ return it.status !== 'wait'; }); emit(); };
  HS.queueCounts = function(){
    var c = { wait: 0, run: 0, ok: 0, fail: 0, total: Q.items.length, images: 0, imagesDone: 0 };
    Q.items.forEach(function(it){ c[it.status]++; c.images += it.variants; c.imagesDone += it.done; });
    return c;
  };
  // 모두 끝날 때까지 기다리는 약속 (시험·한 번에 만들기에서 씀)
  HS.queueIdle = function(){
    return new Promise(function(ok){
      (function check(){ var c = HS.queueCounts(); if(Q.paused || (!c.wait && !c.run)) ok(c); else setTimeout(check, 100); })();
    });
  };

  function sleep(ms){ return new Promise(function(ok){ setTimeout(ok, ms); }); }
  function once(sh, tries){
    return HS.generateShotImage(sh).catch(function(e){
      var st = e && e.status;
      if(tries > 0 && (st === 429 || st >= 500)) return sleep(tries === 2 ? 1500 : 4000).then(function(){ return once(sh, tries - 1); });
      throw e;
    });
  }
  function run(it){
    it.status = 'run'; Q.running++; emit();
    var f = HS.findShot(it.shotId);
    var job = !f ? Promise.reject(new Error('샷이 지워졌습니다')) : (function next(){
      if(it.done >= it.variants) return Promise.resolve();
      if(Q.paused && it.done > 0) return Promise.resolve(); // 멈추면 이 샷의 나머지 후보는 건너뜁니다
      return once(f.sh, 2).then(function(){ it.done++; emit(); return next(); });
    })();
    job.then(function(){
      it.status = it.done >= it.variants ? 'ok' : 'wait';
    }, function(e){
      it.status = 'fail'; it.error = (e && e.message) || '실패';
      if(e && (e.status === 401 || e.status === 403)) Q.paused = true; // 키가 틀리면 다른 것도 모두 실패하므로 멈춥니다
    }).then(function(){ Q.running--; emit(); pump(); });
  }
  function pump(){
    while(!Q.paused && Q.running < Q.concurrency){
      var next = Q.items.filter(function(it){ return it.status === 'wait'; })[0];
      if(!next) break;
      run(next);
    }
    if(!Q.running && !Q.items.some(function(it){ return it.status === 'wait'; }) && !Q.paused){ Q.paused = true; emit(); }
  }
})();
