/* 사관 스튜디오 — 공통 바탕: 프로젝트 상태, 저장, Claude 호출, 작은 도구들 */
(function(){
  'use strict';
  var HS = window.HS = {};

  /* ── 저장소 (localStorage, 키는 모두 hs. 로 시작) ───────────── */
  function load(k, d){ try{ var v = localStorage.getItem(k); return v == null ? d : v; }catch(e){ return d; } }
  function save(k, v){ try{ localStorage.setItem(k, v); return true; }catch(e){ return false; } }
  HS.load = load; HS.save = save;

  HS.CFG = {
    key: load('hs.key', ''),
    model: load('hs.model', 'claude-opus-5')
  };

  /* ── 프로젝트 ───────────────────────────────────────── */
  HS.blankProject = function(){
    return {
      version: 1,
      title: '',
      source: '',
      options: { length: 'mid', audience: '중고등학생', tone: '친근한 설명체' },
      scenes: [],   // {heading, narration, visual, prompt, mood, motion, image, svg, audio, audioDur}
      board: [],    // {title, text, drawing, dw, dh}
      map: { title: '', view: null, places: [], routes: [], regions: [] }, // places {name, lon, lat, kind}; routes {from, to, label}; regions {name, color, points}
      checks: null  // 사실 확인 결과
    };
  };
  HS.project = HS.blankProject();

  /* 프로젝트는 IndexedDB 에 둡니다 (그림·목소리까지 넉넉히 들어감). 쓸 수 없으면 localStorage 로 */
  var DB = null;
  function idb(){
    if(DB) return DB;
    DB = new Promise(function(ok, fail){
      if(!window.indexedDB){ fail(new Error('no idb')); return; }
      var rq = indexedDB.open('hs', 1);
      rq.onupgradeneeded = function(){ rq.result.createObjectStore('kv'); };
      rq.onsuccess = function(){ ok(rq.result); };
      rq.onerror = function(){ fail(rq.error); };
    });
    return DB;
  }
  function idbGet(k){
    return idb().then(function(db){ return new Promise(function(ok, fail){
      var rq = db.transaction('kv').objectStore('kv').get(k);
      rq.onsuccess = function(){ ok(rq.result); }; rq.onerror = function(){ fail(rq.error); };
    }); });
  }
  function idbPut(k, v){
    return idb().then(function(db){ return new Promise(function(ok, fail){
      var tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k);
      tx.oncomplete = function(){ ok(); }; tx.onerror = function(){ fail(tx.error); };
    }); });
  }
  function fill(p){
    var b = HS.blankProject();
    for(var k in b) if(p[k] === undefined) p[k] = b[k];
    if(!p.map.regions) p.map.regions = [];
    return p;
  }
  // 시작할 때 한 번 읽습니다. 다른 파일은 HS.ready 뒤에 화면을 그립니다
  HS.ready = idbGet('project').catch(function(){ return null; }).then(function(p){
    if(!p){ try{ p = JSON.parse(load('hs.project', 'null')); }catch(e){ p = null; } }
    if(p && p.version) HS.project = fill(p);
  });

  var saveTimer = null, listeners = [];
  HS.changed = function(what){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(HS.persist, 300);
    listeners.forEach(function(fn){ try{ fn(what || 'all'); }catch(e){ console.error(e); } });
  };
  HS.onChange = function(fn){ listeners.push(fn); };
  HS.persist = function(){
    clearTimeout(saveTimer);
    var snap = JSON.parse(JSON.stringify(HS.project));
    return idbPut('project', snap).then(function(){
      try{ localStorage.removeItem('hs.project'); }catch(e){}
    }).catch(function(){
      if(!save('hs.project', JSON.stringify(snap))){
        // 그림이 많으면 저장 한도를 넘을 수 있어, 그림·목소리를 뺀 채로라도 저장합니다
        snap.scenes.forEach(function(s){ s.image = null; s.audio = null; s.svg = null; });
        snap.board.forEach(function(b){ b.drawing = null; });
        save('hs.project', JSON.stringify(snap));
        HS.toast && HS.toast('브라우저 저장소가 작아 그림·목소리를 빼고 저장했습니다. 백업(.json)으로 보관하세요.');
      }
    });
  };
  HS.setProject = function(p){
    HS.project = fill(p);
    HS.changed('all');
  };

  /* ── 작은 도구 ───────────────────────────────────────── */
  HS.$ = function(id){ return document.getElementById(id); };
  HS.esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  HS.download = function(name, blobOrUrl){
    var url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    if(typeof blobOrUrl !== 'string') setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  };
  HS.fileName = function(ext){
    var t = (HS.project.title || '사관스튜디오').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 40) || '사관스튜디오';
    return t + ext;
  };
  HS.readFile = function(file, asText){
    return new Promise(function(ok, fail){
      var r = new FileReader();
      r.onload = function(){ ok(r.result); };
      r.onerror = function(){ fail(r.error); };
      asText ? r.readAsText(file, 'utf-8') : r.readAsDataURL(file);
    });
  };
  HS.loadImage = function(src){
    return new Promise(function(ok, fail){
      var im = new Image();
      im.onload = function(){ ok(im); };
      im.onerror = function(){ fail(new Error('그림을 읽지 못했습니다')); };
      im.src = src;
    });
  };
  // 큰 사진은 저장소를 금방 채우므로 긴 변을 max 로 줄여 JPEG 로 바꿉니다
  HS.shrinkImage = function(dataUrl, max, type){
    return HS.loadImage(dataUrl).then(function(im){
      var s = Math.min(1, max / Math.max(im.width, im.height));
      var c = document.createElement('canvas');
      c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      return c.toDataURL(type || 'image/jpeg', 0.86);
    });
  };
  // 글줄 바꿈 (캔버스)
  HS.wrap = function(ctx, text, maxW){
    var out = [];
    String(text || '').split('\n').forEach(function(para){
      var line = '';
      for(var i = 0; i < para.length; i++){
        var t = line + para[i];
        if(ctx.measureText(t).width > maxW && line){
          // 낱말 가운데서 끊기지 않게 마지막 빈칸에서 자릅니다
          var sp = line.lastIndexOf(' ');
          if(sp > line.length * 0.5){ out.push(line.slice(0, sp)); line = line.slice(sp + 1) + para[i]; }
          else { out.push(line); line = para[i]; }
        } else line = t;
      }
      out.push(line);
    });
    return out;
  };
  // 결정적인 난수 (같은 장면은 늘 같은 그림)
  HS.rng = function(seed){
    var s = 0;
    for(var i = 0; i < String(seed).length; i++) s = (s * 31 + String(seed).charCodeAt(i)) | 0;
    s = s || 1;
    return function(){ s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  };
  HS.toast = function(msg){
    var el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#2b2520;color:#fff;padding:10px 16px;border-radius:8px;z-index:99;max-width:90vw;font-size:14px';
    document.body.appendChild(el);
    setTimeout(function(){ el.remove(); }, 3500);
  };

  /* ── Claude 호출 (저장소 안의 Anthropic SDK 사용) ───────────── */
  var sdkPromise = null;
  function loadSDK(){
    if(window.AnthropicSDK) return Promise.resolve(window.AnthropicSDK);
    if(sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function(ok, fail){
      var sc = document.createElement('script');
      sc.src = 'assets/vendor/anthropic-sdk.js'; sc.charset = 'utf-8';
      sc.onload = function(){ window.AnthropicSDK ? ok(window.AnthropicSDK) : fail(new Error('SDK를 불러오지 못했습니다')); };
      sc.onerror = function(){ sdkPromise = null; fail(new Error('SDK 파일을 찾지 못했습니다')); };
      document.head.appendChild(sc);
    });
    return sdkPromise;
  }

  var PRICE = { 'claude-opus-5': [5, 25], 'claude-sonnet-5': [2, 10], 'claude-haiku-4-5': [1, 5] }, KRW = 1400;
  HS.cost = (function(){ try{ return JSON.parse(load('hs.cost', '{"krw":0,"calls":0}')); }catch(e){ return { krw: 0, calls: 0 }; } })();
  function addCost(msg){
    var u = msg.usage || {}, pr = PRICE[msg.model] || PRICE[HS.CFG.model] || PRICE['claude-opus-5'];
    var inTok = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1;
    var usd = inTok / 1e6 * pr[0] + (u.output_tokens || 0) / 1e6 * pr[1];
    HS.cost.last = Math.round(usd * KRW);
    HS.cost.krw += usd * KRW; HS.cost.calls++;
    save('hs.cost', JSON.stringify(HS.cost));
  }

  // 흘려 받으며(onText) 구조화된 JSON 으로 답을 받습니다
  HS.callClaude = function(system, messages, schema, onText, effort){
    return loadSDK().then(function(Anthropic){
      var client = new Anthropic({ apiKey: HS.CFG.key, dangerouslyAllowBrowser: true });
      var req = {
        model: HS.CFG.model,
        max_tokens: 32000,
        output_config: { effort: effort || 'medium' },
        system: system,
        messages: messages
      };
      if(HS.CFG.model !== 'claude-haiku-4-5') req.thinking = { type: 'adaptive' };
      else delete req.output_config.effort; // Haiku 4.5 는 effort 를 받지 않습니다
      if(schema) req.output_config.format = { type: 'json_schema', schema: schema };
      if(!Object.keys(req.output_config).length) delete req.output_config;
      var st;
      if(HS.CFG.model === 'claude-opus-5'){ // 거절되면 서버가 알맞은 모델로 다시 돌립니다
        req.betas = ['server-side-fallback-2026-07-01'];
        req.fallbacks = 'default';
        st = client.beta.messages.stream(req);
      } else st = client.messages.stream(req);
      if(onText) st.on('text', function(delta, snapshot){ try{ onText(snapshot); }catch(e){} });
      return st.finalMessage();
    }).then(function(res){
      addCost(res);
      if(res.stop_reason === 'refusal') throw new Error('Claude가 이 요청을 처리하지 않았습니다');
      if(res.stop_reason === 'max_tokens') throw new Error('답이 너무 길어 끊겼습니다. 소스를 나눠 넣어 보세요');
      var txt = res.content.filter(function(b){ return b.type === 'text'; }).map(function(b){ return b.text; }).join('');
      return { data: schema ? JSON.parse(txt) : null, text: txt };
    });
  };
  HS.whyFail = function(err){
    return (err && err.status === 401) ? 'API 키가 맞지 않습니다'
      : (err && err.status === 429) ? '요청이 너무 잦습니다. 잠시 뒤 다시 해 보세요'
      : (err && err.message) ? String(err.message).slice(0, 120) : '연결되지 않았습니다';
  };
})();
