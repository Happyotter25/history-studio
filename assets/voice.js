/* 내레이션 목소리 — 장면마다 마이크로 녹음하거나 음성 파일(클로바더빙·타입캐스트 등에서 받은 mp3/wav)을 넣습니다.
 * 목소리가 있는 장면은 목소리 길이에 맞춰 영상 길이가 정해지고, 녹화한 WebM 에 소리가 함께 들어갑니다.
 * 브라우저 읽어 주기(speechSynthesis)는 미리 듣기용입니다 — 브라우저가 그 소리를 녹화하게 해 주지 않습니다.
 */
(function(){
  'use strict';
  var HS = window.HS;
  var ac = null, buffers = {};
  HS.audioCtx = function(){
    if(!ac){ var AC = window.AudioContext || window.webkitAudioContext; if(!AC) return null; ac = new AC(); }
    if(ac.state === 'suspended') ac.resume();
    return ac;
  };
  function dataUrlToArrayBuffer(u){
    var b64 = u.slice(u.indexOf(',') + 1), bin = atob(b64), buf = new Uint8Array(bin.length);
    for(var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  }
  // 장면 목소리를 AudioBuffer 로 (한 번 풀면 기억)
  HS.sceneAudio = function(scene){
    if(!scene.audio) return Promise.resolve(null);
    if(buffers[scene.audio]) return buffers[scene.audio];
    var c = HS.audioCtx(); if(!c) return Promise.resolve(null);
    buffers[scene.audio] = new Promise(function(ok, fail){ c.decodeAudioData(dataUrlToArrayBuffer(scene.audio), ok, fail); }).catch(function(){ return null; });
    return buffers[scene.audio];
  };
  HS.setSceneAudio = function(scene, dataUrl){
    scene.audio = dataUrl;
    return HS.sceneAudio(scene).then(function(buf){
      if(!buf){ scene.audio = null; scene.audioDur = 0; throw new Error('소리 파일을 읽지 못했습니다'); }
      scene.audioDur = Math.round(buf.duration * 100) / 100;
      HS.changed('scene');
      return buf;
    });
  };

  // 타임라인에 맞춰 목소리를 겁니다. from: 영상 안의 시작 시각(초), dest: 녹화용 출력(없으면 스피커)
  // 돌려주는 함수를 부르면 멈춥니다
  HS.playNarration = function(from, dest){
    var c = HS.audioCtx(); if(!c) return Promise.resolve(function(){});
    var tl = HS.timeline(), scenes = HS.project.scenes, nodes = [], t0 = c.currentTime + 0.05;
    return Promise.all(tl.map(function(seg){ return HS.sceneAudio(scenes[seg.i]); })).then(function(bufs){
      tl.forEach(function(seg, k){
        var buf = bufs[k]; if(!buf) return;
        var at = seg.start + HS.VOICE_LEAD - from; // 장면이 밝아진 뒤 말을 시작합니다
        if(at + buf.duration <= 0) return;
        var src = c.createBufferSource(); src.buffer = buf;
        src.connect(dest || c.destination);
        if(at >= 0) src.start(t0 + at); else src.start(t0, -at);
        nodes.push(src);
      });
      return function(){ nodes.forEach(function(n){ try{ n.stop(); }catch(e){} }); };
    });
  };

  // 마이크 녹음 — start() 하면 stop 함수를 돌려주고, stop() 은 dataURL 을 돌려줍니다
  HS.recordVoice = function(){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder)
      return Promise.reject(new Error('이 브라우저에서는 녹음할 수 없습니다'));
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function(stream){
      var type = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      var rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined), chunks = [];
      rec.ondataavailable = function(e){ if(e.data.size) chunks.push(e.data); };
      rec.start();
      return function stop(){
        return new Promise(function(ok){
          rec.onstop = function(){
            stream.getTracks().forEach(function(t){ t.stop(); });
            var blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), r = new FileReader();
            r.onload = function(){ ok(r.result); };
            r.readAsDataURL(blob);
          };
          rec.stop();
        });
      };
    });
  };

  // 브라우저 읽어 주기 (미리 듣기)
  HS.speak = function(text){
    if(!window.speechSynthesis) return false;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 1.05;
    var ko = speechSynthesis.getVoices().filter(function(v){ return /^ko/i.test(v.lang); })[0];
    if(ko) u.voice = ko;
    speechSynthesis.speak(u);
    return true;
  };
  HS.stopSpeak = function(){ if(window.speechSynthesis) speechSynthesis.cancel(); };
})();
