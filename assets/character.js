/* 내 캐릭터 — 손으로 그린 캐릭터를 영상에 진행자로 등장시킵니다.
 * 종이 사진에서 바깥 종이만 걷어 내어(테두리에서 이어진 밝은 곳만 투명하게) 스티커로 만들고,
 * 영상에서는 장면 구석에 올라와 살짝 흔들리다가, 말하는 동안에는 통통 튀어 말하는 느낌을 냅니다.
 */
(function(){
  'use strict';
  var HS = window.HS;

  // 캔버스 → 스티커 {data(PNG dataURL), w, h}. opt.chalk 이면 분필 그림으로, opt.outline 이면 흰 테두리
  HS.makeSticker = function(src, opt){
    opt = opt || {};
    var w = src.width, h = src.height, img = src.getContext('2d').getImageData(0, 0, w, h), d = img.data, n = w * h;
    var ink = HS.inkMask(img, opt.sens || 14), keep = new Uint8Array(n);
    // 바탕 후보: 선이 아니고, 밝고, 색이 옅은 곳
    var bgLike = new Uint8Array(n);
    for(var i = 0; i < n; i++){
      var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3];
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
      bgLike[i] = a < 20 || (!ink[i] && mx > 150 && sat < 0.22) ? 1 : 0;
    }
    // 테두리에서 이어진 바탕만 걷어 냅니다 (얼굴 안쪽 흰 곳은 남김)
    var bg = new Uint8Array(n), stack = [];
    function push(p){ if(bgLike[p] && !bg[p]){ bg[p] = 1; stack.push(p); } }
    for(var x = 0; x < w; x++){ push(x); push((h - 1) * w + x); }
    for(var y = 0; y < h; y++){ push(y * w); push(y * w + w - 1); }
    while(stack.length){
      var p = stack.pop(), px = p % w, py = (p / w) | 0;
      if(px > 0) push(p - 1); if(px < w - 1) push(p + 1); if(py > 0) push(p - w); if(py < h - 1) push(p + w);
    }
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for(i = 0; i < n; i++) if(!bg[i]){ keep[i] = 1; var kx = i % w, ky = (i / w) | 0; if(kx < minX) minX = kx; if(kx > maxX) maxX = kx; if(ky < minY) minY = ky; if(ky > maxY) maxY = ky; }
    if(maxX < 0) return null;
    // 작은 먼지(몇 화소짜리)는 넓이로 거릅니다 — 전체의 0.05% 미만이면 그림이 없는 것으로
    var area = 0; for(i = 0; i < n; i++) area += keep[i];
    if(area < n * 0.0005) return null;
    var pad = opt.outline ? 8 : 2;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
    var cw = maxX - minX + 1, ch = maxY - minY + 1, c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    var ctx = c.getContext('2d'), out = ctx.createImageData(cw, ch), o = out.data;
    for(y = 0; y < ch; y++) for(x = 0; x < cw; x++){
      var si = (y + minY) * w + x + minX, di = (y * cw + x) * 4;
      if(!keep[si]) continue;
      o[di] = d[si * 4]; o[di + 1] = d[si * 4 + 1]; o[di + 2] = d[si * 4 + 2]; o[di + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    if(opt.chalk){ // 분필 그림: 선만 분필색으로
      var cm = new Uint8Array(cw * ch);
      for(y = 0; y < ch; y++) for(x = 0; x < cw; x++) cm[y * cw + x] = ink[(y + minY) * w + x + minX];
      var layer = HS.chalkLayer(cm, cw, ch, opt.color || '#f3f1e7', 'sticker');
      ctx.clearRect(0, 0, cw, ch);
      if(layer.box) ctx.drawImage(layer.canvas, layer.box[0], layer.box[1]);
    }
    if(opt.outline){ // 스티커처럼 흰 테두리
      var o2 = document.createElement('canvas'); o2.width = cw; o2.height = ch;
      var oc = o2.getContext('2d');
      for(var k = 0; k < 16; k++){ var ang = k / 16 * Math.PI * 2; oc.drawImage(c, Math.cos(ang) * 5, Math.sin(ang) * 5); }
      oc.globalCompositeOperation = 'source-in'; oc.fillStyle = '#ffffff'; oc.fillRect(0, 0, cw, ch);
      oc.globalCompositeOperation = 'source-over'; oc.drawImage(c, 0, 0);
      c = o2;
    }
    return { data: c.toDataURL('image/png'), w: cw, h: ch };
  };

  HS.addCharacter = function(name, sticker){
    var p = HS.project;
    p.characters = p.characters || [];
    var ch = { id: 'c' + Date.now().toString(36), name: name || ('캐릭터 ' + (p.characters.length + 1)), image: sticker.data, w: sticker.w, h: sticker.h };
    p.characters.push(ch);
    HS.changed('characters');
    return ch;
  };
  HS.characterById = function(id){ return (HS.project.characters || []).filter(function(c){ return c.id === id; })[0] || null; };

  var cache = {};
  HS.characterImage = function(ch){
    if(!ch) return null;
    var c = cache[ch.image];
    if(!c){ c = cache[ch.image] = { img: new Image(), ok: false }; c.img.onload = function(){ c.ok = true; }; c.img.src = ch.image; }
    return c.ok ? c.img : null;
  };
  HS.preloadCharacters = function(){
    return Promise.all((HS.project.characters || []).map(function(ch){
      HS.characterImage(ch);
      var c = cache[ch.image];
      return c.ok ? null : new Promise(function(ok){ c.img.addEventListener('load', ok); c.img.addEventListener('error', ok); });
    }));
  };

  // 장면의 캐릭터를 그립니다. speaking: 지금 말하는 중인지 (목소리 구간 또는 자막이 흐르는 동안)
  HS.drawSceneCharacter = function(ctx, w, h, scene, local, dur, speaking){
    var ref = scene.character; if(!ref || !ref.id) return;
    var ch = HS.characterById(ref.id), img = HS.characterImage(ch); if(!img) return;
    var u = Math.min(w, h) / 720, portrait = w < h;
    var th = (portrait ? 0.3 : 0.46) * h * (ref.size || 1), tw = th * img.width / img.height;
    if(tw > w * 0.4){ tw = w * 0.4; th = tw * img.height / img.width; }
    var right = ref.side === 'right';
    var x = right ? w - tw - 30 * u : 30 * u;
    var enter = Math.min(1, local / 0.5), leave = Math.min(1, Math.max(0, (dur - local) / 0.4));
    var show = Math.min(enter, leave), ease = 1 - Math.pow(1 - show, 3);
    var base = portrait ? h * 0.66 : h - 8 * u; // 쇼츠는 자막 위쪽에
    var bob = Math.sin(local * 2.2) * 4 * u, sq = 1, hop = 0;
    if(speaking){ var bt = Math.abs(Math.sin(local * 9)); hop = bt * 7 * u; sq = 1 - bt * 0.03; }
    ctx.save();
    ctx.globalAlpha = ease;
    ctx.translate(x + tw / 2, base + (1 - ease) * th * 0.6 - hop + bob);
    ctx.scale((right ? -1 : 1) * (ref.flip ? -1 : 1) * (2 - sq), sq);
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(0, 0, tw * 0.38, 8 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(img, -tw / 2, -th, tw, th);
    ctx.restore();
  };
})();
