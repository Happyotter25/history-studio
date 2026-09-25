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
    return Promise.all(HS.project.scenes.map(function(s){
      if(s.svg) return HS.sceneLayersReady(s);
      if(!s.image) return null;
      HS.sceneImage(s);
      var c = imgCache[s.image];
      return c.ok ? null : new Promise(function(ok){ c.img.addEventListener('load', ok); c.img.addEventListener('error', ok); });
    }));
  };

  // 목소리가 있으면 목소리 길이에, 없으면 글자 수에 맞춥니다
  HS.sceneDuration = function(s){
    if(s.audio && s.audioDur) return Math.max(3, s.audioDur + HS.VOICE_LEAD + 0.5) + FADE;
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
    var v = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }

  function subtitle(ctx, w, h, s, local, dur){
    var text = (s.narration || '').trim(); if(!text) return;
    var u = h / 720, size = Math.round(34 * u);
    ctx.font = 'bold ' + size + 'px ' + "'Noto Sans KR',sans-serif";
    // 문장을 두 줄 이하 덩어리로 나눠 시간에 맞춰 보여 줍니다
    var sents = text.match(/[^.!?。]+[.!?。]?\s*/g) || [text], chunks = [];
    sents.forEach(function(se){
      var lines = HS.wrap(ctx, se.trim(), w * 0.8);
      for(var i = 0; i < lines.length; i += 2) chunks.push(lines.slice(i, i + 2));
    });
    var total = chunks.reduce(function(a, c){ return a + c.join('').length; }, 0) || 1;
    var lead = s.audio ? HS.VOICE_LEAD : FADE * 0.5, span = s.audio && s.audioDur ? s.audioDur : dur - FADE, pos = Math.max(0, local - lead) / span * total, acc = 0, cur = chunks[chunks.length - 1];
    for(var j = 0; j < chunks.length; j++){ acc += chunks[j].join('').length; if(pos <= acc){ cur = chunks[j]; break; } }
    var lh = size * 1.35, y0 = h - 60 * u - lh * (cur.length - 1);
    cur.forEach(function(line, i){
      var tw = ctx.measureText(line).width, x = (w - tw) / 2, y = y0 + i * lh;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 14 * u, y - size, tw + 28 * u, size * 1.3);
      ctx.fillStyle = '#fff'; ctx.fillText(line, x, y);
    });
  }

  function titleCard(ctx, w, h, s, local){
    var u = h / 720, a = Math.min(1, 0.35 + local / 1.2);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, h * 0.36, w, h * 0.26);
    ctx.font = '800 ' + Math.round(78 * u) + "px 'Nanum Myeongjo',serif";
    var tw = ctx.measureText(s.heading).width;
    ctx.fillStyle = '#fff8e8'; ctx.fillText(s.heading, (w - tw) / 2, h * 0.52);
    ctx.globalAlpha = 1;
  }

  // 시각 t 의 한 장면(겹침 포함)을 그립니다
  HS.drawVideoFrame = function(ctx, w, h, t, opts){
    opts = opts || {};
    var tl = HS.timeline(), scenes = HS.project.scenes;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    if(!tl.length) return;
    tl.forEach(function(seg){
      var local = t - seg.start;
      if(local < 0 || local > seg.dur) return;
      var alpha = seg.i === 0 ? 1 : Math.min(1, local / FADE);
      ctx.save(); ctx.globalAlpha = alpha;
      drawSceneFrame(ctx, w, h, scenes[seg.i], local / seg.dur, local);
      ctx.restore();
      if(alpha >= 1 || seg.i === 0){
        if(seg.i === 0 && HS.project.scenes.length > 1) titleCard(ctx, w, h, scenes[0], local);
        if(opts.subs !== false && !(seg.i === 0 && scenes.length > 1)) subtitle(ctx, w, h, scenes[seg.i], local, seg.dur);
      }
    });
  };

  /* ── 캔버스 녹화 (MediaRecorder → WebM) ─────────────────── */
  // withAudio(dest) 를 주면 그 안에서 소리를 걸고, 멈추는 함수를 돌려받아 녹화 끝에 부릅니다
  HS.recordCanvas = function(canvas, duration, drawAt, onTick, withAudio){
    if(!window.MediaRecorder || !canvas.captureStream) return Promise.reject(new Error('이 브라우저는 영상 녹화를 지원하지 않습니다 (크롬·엣지 권장)'));
    var ac = withAudio && HS.audioCtx(), dest = ac && ac.createMediaStreamDestination();
    var types = dest ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'], mime = '';
    for(var i = 0; i < types.length; i++) if(MediaRecorder.isTypeSupported(types[i])){ mime = types[i]; break; }
    var stream = canvas.captureStream(30), chunks = [];
    if(dest) dest.stream.getAudioTracks().forEach(function(t){ stream.addTrack(t); });
    var stopAudio = null;
    var rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6e6 } : undefined);
    rec.ondataavailable = function(e){ if(e.data && e.data.size) chunks.push(e.data); };
    return new Promise(function(ok, fail){
      rec.onstop = function(){ if(stopAudio) stopAudio(); ok(new Blob(chunks, { type: 'video/webm' })); };
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
})();
