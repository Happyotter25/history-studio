/* 삽화 영상 — 장면 그림에 켄 번스 움직임, 장면 사이 겹침(디졸브), 자막을 입혀 캔버스로 재생·녹화합니다. */
(function(){
  'use strict';
  var HS = window.HS;
  var FADE = 0.8, CPS = 6.5; // 겹침 시간(초), 내레이션 읽는 빠르기(글자/초)
  HS.VOICE_LEAD = 0.6;        // 장면이 시작하고 목소리가 나오기까지(초)
  var imgCache = {};

  HS.sceneImage = function(scene){
    if(!scene.image) return null;
    var c = imgCache[scene.image];
    if(!c){
      c = imgCache[scene.image] = { img: new Image(), ok: false };
      c.img.onload = function(){ c.ok = true; };
      c.img.src = scene.image;
    }
    return c.ok ? c.img : null;
  };
  HS.preloadImages = function(){
    return Promise.all([HS.preloadCharacters ? HS.preloadCharacters() : null].concat(HS.project.scenes.map(function(s){
      if(s.svg) return HS.sceneLayersReady(s);
      if(!s.image) return null;
      HS.sceneImage(s);
      var c = imgCache[s.image];
      return c.ok ? null : new Promise(function(ok){ c.img.addEventListener('load', ok); c.img.addEventListener('error', ok); });
    })));
  };

  // 목소리가 있으면 목소리 길이에, 없으면 글자 수에 맞춥니다
  HS.sceneDuration = function(s){
    if(s.audio && s.audioDur) return Math.max(3, s.audioDur + HS.VOICE_LEAD + 0.5) + FADE;
    if(+s.dur > 0) return Math.max(1.5, +s.dur) + FADE; // 직접 정한 길이
    return Math.max(4, Math.min(40, (s.narration || '').replace(/\s/g, '').length / CPS)) + FADE;
  };
  HS.timeline = function(){
    var t = 0;
    return HS.project.scenes.map(function(s, i){ var d = HS.sceneDuration(s), seg = { i: i, start: t, dur: d }; t += d - FADE; return seg; });
  };
  HS.totalDuration = function(){ var tl = HS.timeline(), l = tl[tl.length - 1]; return l ? l.start + l.dur : 0; };

  function motionRect(motion, k, iw, ih, w, h){
    // 그림을 화면에 꽉 채운 뒤(cover) 움직임에 따라 크기·위치를 바꿉니다
    var base = Math.max(w / iw, h / ih), z0 = 1.05, z1 = 1.22, z = z0, ox = 0.5, oy = 0.5;
    if(motion === 'zoomIn') z = z0 + (z1 - z0) * k;
    else if(motion === 'zoomOut') z = z1 - (z1 - z0) * k;
    else { z = 1.18; ox = motion === 'panLeft' ? 0.8 - 0.6 * k : 0.2 + 0.6 * k; }
    var dw = iw * base * z, dh = ih * base * z;
    return [(w - dw) * ox, (h - dh) * oy, dw, dh];
  }

  function drawSceneFrame(ctx, w, h, s, k, local){
    var img = HS.sceneImage(s), layers = !img && HS.sceneLayers(s);
    if(HS.isDataScene(s)){
      // 사료·연표·인물 관계도·비교표: 장면이 흐르는 동안 차례로 써지고 이어집니다 (끝 20%는 다 된 모습)
      HS.drawDataScene(ctx, w, h, s, Math.min(1, k * 1.25));
      return;
    }
    if(s.useMap && HS.project.map.places.length){
      // 지도 장면: 장면이 흐르는 동안 경로가 그려집니다
      HS.drawMap(ctx, w, h, HS.project.map, { style: HS.project.mapStyle || 'old', progress: Math.min(1, k * 1.3) });
    } else if(layers){
      HS.drawLayers(ctx, w, h, layers, s.motion, k);
    } else if(img){
      var r = motionRect(s.motion, k, img.width, img.height, w, h);
      ctx.drawImage(img, r[0], r[1], r[2], r[3]);
    } else {
      // 그린 배경에도 같은 움직임을 줍니다
      ctx.save();
      var z = s.motion === 'zoomOut' ? 1.15 - 0.12 * k : s.motion === 'zoomIn' ? 1.03 + 0.12 * k : 1.12;
      var px = s.motion === 'panLeft' ? (0.5 - k) * w * 0.08 : s.motion === 'panRight' ? (k - 0.5) * w * 0.08 : 0;
      ctx.translate(w / 2 - px, h / 2); ctx.scale(z, z); ctx.translate(-w / 2, -h / 2);
      HS.drawSceneArt(ctx, w, h, s, local);
      ctx.restore();
    }
    // 가장자리 어둡게
    var v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }

  // 자막 덩어리: 문장을 화면 폭에 맞춰 두 줄 이하로 나눕니다 (화면 자막과 SRT 가 같은 기준을 씁니다)
  var measure = null;
  // 화면 크기: 가로 16:9 (1280×720) 또는 세로 9:16 쇼츠 (720×1280)
  HS.frameSize = function(){ return HS.project.aspect === '9:16' ? [720, 1280] : [1280, 720]; };
  function subFont(ctx, w, h){ ctx.font = 'bold ' + Math.round(34 * Math.min(w, h) / 720) + 'px ' + "'Noto Sans KR',sans-serif"; }
  function chunksOf(text){
    if(!measure){ measure = document.createElement('canvas').getContext('2d'); }
    var fs = HS.frameSize();
    subFont(measure, fs[0], fs[1]);
    var sents = text.match(/[^.!?。]+[.!?。]?\s*/g) || [text], chunks = [];
    sents.forEach(function(se){
      var lines = HS.wrap(measure, se.trim(), fs[0] * (fs[0] < fs[1] ? 0.86 : 0.8));
      for(var i = 0; i < lines.length; i += 2) chunks.push(lines.slice(i, i + 2));
    });
    return chunks;
  }
  // 장면 하나의 자막 시각표 [{start, end, lines}] (영상 전체 기준 초)
  function sceneCues(s, seg){
    var text = (s.narration || '').trim(); if(!text) return [];
    var chunks = chunksOf(text), total = chunks.reduce(function(a, c){ return a + c.join('').length; }, 0) || 1;
    var lead = s.audio ? HS.VOICE_LEAD : FADE * 0.5, span = s.audio && s.audioDur ? s.audioDur : seg.dur - FADE;
    var end = seg.start + seg.dur - FADE * 0.5, acc = 0;
    return chunks.map(function(c, i){
      var st = seg.start + lead + acc / total * span;
      acc += c.join('').length;
      return { start: st, end: i === chunks.length - 1 ? end : Math.min(end, seg.start + lead + acc / total * span), lines: c };
    });
  }
  // 글을 핵심어 조각과 나머지 조각으로 나눕니다 [{t, key}]
  HS.markKeywords = function(text, keys){
    var out = [], i = 0, plain = '';
    while(i < text.length){
      var hit = null;
      for(var k = 0; k < keys.length; k++) if(keys[k] && text.substr(i, keys[k].length) === keys[k]){ hit = keys[k]; break; }
      if(hit){ if(plain){ out.push({ t: plain, key: false }); plain = ''; } out.push({ t: hit, key: true }); i += hit.length; }
      else { plain += text[i]; i++; }
    }
    if(plain) out.push({ t: plain, key: false });
    return out;
  };
  HS.subtitleCues = function(){
    var scenes = HS.project.scenes, out = [];
    HS.timeline().forEach(function(seg){ out = out.concat(sceneCues(scenes[seg.i], seg)); });
    return out;
  };
  function subtitle(ctx, w, h, s, seg, t){
    var cues = sceneCues(s, seg); if(!cues.length) return;
    var cur = cues[cues.length - 1];
    for(var j = 0; j < cues.length; j++) if(t < cues[j].end){ cur = cues[j]; break; }
    // 자막 크기는 캔버스 크기에 비례 (미리보기·녹화·다른 크기 캔버스 모두 같은 모양)
    var u = Math.min(w, h) / 720, size = Math.round(34 * u), lh = size * 1.35;
    var bottom = w < h ? h * 0.74 : h - 60 * u; // 쇼츠는 아래쪽을 앱 단추가 가리므로 조금 위로
    var y0 = bottom - lh * (cur.lines.length - 1);
    subFont(ctx, w, h);
    var keys = (s.keywords || []).filter(Boolean).sort(function(a, b){ return b.length - a.length; });
    cur.lines.forEach(function(line, i){
      var tw = ctx.measureText(line).width, x = (w - tw) / 2, y = y0 + i * lh;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 14 * u, y - size, tw + 28 * u, size * 1.3);
      // 핵심어는 노랗게
      HS.markKeywords(line, keys).forEach(function(seg){
        ctx.fillStyle = seg.key ? '#ffd84d' : '#fff';
        ctx.fillText(seg.t, x, y);
        x += ctx.measureText(seg.t).width;
      });
    });
  }

  function titleCard(ctx, w, h, s, local){
    var u = Math.min(w, h) / 720, a = Math.min(1, 0.35 + local / 1.2), size = 78 * u;
    ctx.globalAlpha = a;
    ctx.font = '800 ' + Math.round(size) + "px 'Nanum Myeongjo',serif";
    // 폭에 넘치면 두 줄로, 그래도 넘치면 글씨를 줄입니다
    var lines = HS.wrap(ctx, s.heading, w * 0.86).slice(0, 3);
    var widest = Math.max.apply(null, lines.map(function(l){ return ctx.measureText(l).width; }));
    if(widest > w * 0.9){ size *= w * 0.9 / widest; ctx.font = '800 ' + Math.round(size) + "px 'Nanum Myeongjo',serif"; }
    var lh = size * 1.25, top = h * 0.5 - lh * lines.length / 2;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, top - lh * 0.4, w, lh * (lines.length + 0.5));
    ctx.fillStyle = '#fff8e8';
    lines.forEach(function(l, i){ ctx.fillText(l, (w - ctx.measureText(l).width) / 2, top + lh * (i + 0.75)); });
    ctx.globalAlpha = 1;
  }

  // 연도·장소 이름표: 장면이 밝아진 뒤 왼쪽에서 밀려 들어오고, 장면 끝에 사라집니다
  function caption(ctx, w, h, text, local, dur){
    if(!text) return;
    var u = Math.min(w, h) / 720, a = Math.min(1, Math.max(0, (local - 0.6) / 0.4), Math.max(0, (dur - 0.9 - local) / 0.4));
    if(a <= 0) return;
    ctx.save();
    ctx.font = 'bold ' + Math.round(30 * u) + "px 'Noto Sans KR',sans-serif";
    var tw = ctx.measureText(text).width, bw = tw + 44 * u, bh = 54 * u;
    var x = 36 * u - (1 - a) * (bw + 40 * u), y = w < h ? h * 0.1 : 36 * u;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(20,14,10,.78)'; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(x, y, 7 * u, bh);
    ctx.fillStyle = '#fff4dc'; ctx.fillText(text, x + 24 * u, y + bh * 0.68);
    ctx.restore();
  }

  // 장면 전환: fade(겹침) · ink(먹 번짐) · wipe(붓으로 쓸기) · cut(바로)
  var layerCanvas = null;
  function transitionMask(mc, w, h, kind, prog, seed){
    mc.save();
    mc.globalCompositeOperation = 'destination-in';
    mc.fillStyle = '#000';
    mc.beginPath();
    if(kind === 'ink'){
      // 먹물 방울 몇 개가 번져 화면을 덮습니다
      var r = HS.rng(seed), R = Math.hypot(w, h);
      for(var i = 0; i < 7; i++){
        var cx = r() * w, cy = r() * h, grow = Math.max(0, prog * 1.6 - r() * 0.5);
        var rad = R * 0.55 * grow * grow;
        mc.moveTo(cx + rad, cy);
        for(var k = 1; k <= 24; k++){ // 가장자리를 울퉁불퉁하게
          var ang = k / 24 * Math.PI * 2, wob = 1 + 0.12 * Math.sin(ang * 5 + i);
          mc.lineTo(cx + Math.cos(ang) * rad * wob, cy + Math.sin(ang) * rad * wob);
        }
      }
    } else { // wipe: 붓 자국처럼 비스듬한 가장자리
      var edge = prog * (w + h * 0.4);
      mc.moveTo(0, 0); mc.lineTo(edge, 0); mc.lineTo(edge - h * 0.4, h); mc.lineTo(0, h);
    }
    mc.fill();
    mc.restore();
  }

  // 시각 t 의 한 장면(겹침 포함)을 그립니다
  HS.drawVideoFrame = function(ctx, w, h, t, opts){
    opts = opts || {};
    var tl = HS.timeline(), scenes = HS.project.scenes;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    if(!tl.length) return;
    tl.forEach(function(seg){
      var local = t - seg.start, s = scenes[seg.i];
      if(local < 0 || local > seg.dur) return;
      var kind = seg.i === 0 ? 'cut' : (s.transition || 'fade'), prog = Math.min(1, local / FADE);
      if(kind === 'cut' || prog >= 1){
        drawSceneFrame(ctx, w, h, s, local / seg.dur, local);
      } else if(kind === 'fade'){
        ctx.save(); ctx.globalAlpha = prog; drawSceneFrame(ctx, w, h, s, local / seg.dur, local); ctx.restore();
      } else {
        if(!layerCanvas) layerCanvas = document.createElement('canvas');
        if(layerCanvas.width !== w || layerCanvas.height !== h){ layerCanvas.width = w; layerCanvas.height = h; }
        var lc = layerCanvas.getContext('2d');
        lc.clearRect(0, 0, w, h);
        drawSceneFrame(lc, w, h, s, local / seg.dur, local);
        transitionMask(lc, w, h, kind, prog, s.heading || seg.i);
        ctx.drawImage(layerCanvas, 0, 0);
      }
      if(prog >= 1 || seg.i === 0){
        // 내 캐릭터: 전환이 끝난 뒤 올라오고, 말하는 동안 통통 튑니다
        var lead = s.audio ? HS.VOICE_LEAD : FADE * 0.5, talkEnd = s.audio && s.audioDur ? lead + s.audioDur : seg.dur - FADE;
        HS.drawSceneCharacter(ctx, w, h, s, local - (seg.i ? FADE : 0), seg.dur - (seg.i ? FADE : 0), local > lead && local < talkEnd && !!(s.narration || s.audio));
        if(seg.i === 0 && scenes.length > 1) titleCard(ctx, w, h, scenes[0], local);
        else caption(ctx, w, h, s.caption, local, seg.dur);
        if(opts.subs !== false && !(seg.i === 0 && scenes.length > 1)) subtitle(ctx, w, h, s, seg, t);
      }
    });
  };

  /* ── 캔버스 녹화 (MediaRecorder → WebM) ─────────────────── */
  // withAudio(dest) 를 주면 그 안에서 소리를 걸고, 멈추는 함수를 돌려받아 녹화 끝에 부릅니다
  HS.recordCanvas = function(canvas, duration, drawAt, onTick, withAudio){
    if(!window.MediaRecorder || !canvas.captureStream) return Promise.reject(new Error('이 브라우저는 영상 녹화를 지원하지 않습니다 (크롬·엣지 권장)'));
    var ac = withAudio && HS.audioCtx(), dest = ac && ac.createMediaStreamDestination();
    // 설정에서 MP4 를 고르면(기본) 브라우저가 지원할 때 MP4 로, 아니면 WebM 으로 녹화합니다
    var mp4 = HS.load('hs.format', 'mp4') === 'mp4' ? (dest ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'] : ['video/mp4;codecs=avc1.42E01E', 'video/mp4']) : [];
    var types = mp4.concat(dest ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']), mime = '';
    for(var i = 0; i < types.length; i++) if(MediaRecorder.isTypeSupported(types[i])){ mime = types[i]; break; }
    var stream = canvas.captureStream(30), chunks = [];
    if(dest) dest.stream.getAudioTracks().forEach(function(t){ stream.addTrack(t); });
    var stopAudio = null;
    var rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6e6 } : undefined);
    rec.ondataavailable = function(e){ if(e.data && e.data.size) chunks.push(e.data); };
    return new Promise(function(ok, fail){
      rec.onstop = function(){ if(stopAudio) stopAudio(); ok(new Blob(chunks, { type: /^video\/mp4/.test(mime) ? 'video/mp4' : 'video/webm' })); };
      rec.onerror = function(e){ fail(e.error || new Error('녹화 실패')); };
      var t0 = null;
      function frame(now){
        if(t0 == null) t0 = now;
        var t = (now - t0) / 1000;
        drawAt(Math.min(t, duration));
        onTick && onTick(t, duration);
        if(t < duration) requestAnimationFrame(frame);
        else setTimeout(function(){ rec.stop(); }, 150);
      }
      drawAt(0);
      rec.start(250);
      if(dest) Promise.resolve(withAudio(dest)).then(function(stop){ stopAudio = stop; });
      requestAnimationFrame(frame);
    });
  };

  HS.videoExt = function(blob){ return blob && blob.type === 'video/mp4' ? '.mp4' : '.webm'; };
})();
