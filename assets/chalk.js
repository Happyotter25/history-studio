/* 손그림 → 판서 그림
 * 종이 사진은 그늘·얼룩이 있어 한 값으로 자르면 선이 끊깁니다. 그래서 둘레 밝기의 평균과 견주는
 * 적응형 문턱값으로 선을 가려낸 뒤, 선을 분필 결(듬성듬성한 알갱이)로 칠판 위에 다시 그립니다.
 */
(function(){
  'use strict';
  var HS = window.HS;

  // 선(잉크) 가려내기 → Uint8Array 마스크 (1 = 선)
  HS.inkMask = function(imgData, sens){
    var w = imgData.width, h = imgData.height, d = imgData.data, n = w * h;
    var gray = new Float32Array(n), I = new Float64Array((w + 1) * (h + 1));
    for(var i = 0; i < n; i++){
      var a = d[i * 4 + 3] / 255; // 투명한 곳은 흰 종이로 봅니다
      gray[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) * a + 255 * (1 - a);
    }
    for(var y = 0; y < h; y++){
      var row = 0;
      for(var x = 0; x < w; x++){ row += gray[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; }
    }
    var R = Math.max(8, Math.round(Math.min(w, h) / 40)), mask = new Uint8Array(n);
    for(y = 0; y < h; y++){
      var y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1);
      for(x = 0; x < w; x++){
        var x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1);
        var sum = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
        var mean = sum / ((x1 - x0) * (y1 - y0)), g = gray[y * w + x];
        if((g < mean - sens && g < 215) || g < 70) mask[y * w + x] = 1; // 넓게 칠한 곳은 둘레도 어두워 절대값으로도 봅니다
      }
    }
    return mask;
  };

  // 마스크를 분필 선으로 칠한 투명 캔버스 (선이 있는 곳만 잘라서)
  HS.chalkLayer = function(mask, w, h, color, seed){
    var r = HS.rng(seed || 'chalk'), c = document.createElement('canvas');
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for(var i = 0; i < mask.length; i++) if(mask[i]){ var x = i % w, y = (i / w) | 0; if(x < minX) minX = x; if(x > maxX) maxX = x; if(y < minY) minY = y; if(y > maxY) maxY = y; }
    if(maxX < 0){ c.width = c.height = 1; return { canvas: c, box: null }; }
    var pad = 6; minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
    var cw = maxX - minX + 1, ch = maxY - minY + 1;
    c.width = cw; c.height = ch;
    var ctx = c.getContext('2d'), out = ctx.createImageData(cw, ch), o = out.data;
    var rgb = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
    for(var yy = 0; yy < ch; yy++) for(var xx = 0; xx < cw; xx++){
      var m = mask[(yy + minY) * w + xx + minX];
      if(!m) continue;
      if(r() < 0.12) continue; // 분필이 덜 묻은 알갱이
      var k = (yy * cw + xx) * 4;
      o[k] = rgb[0]; o[k + 1] = rgb[1]; o[k + 2] = rgb[2]; o[k + 3] = Math.round(255 * (0.55 + 0.45 * r()));
    }
    ctx.putImageData(out, 0, 0);
    // 가루 번짐
    var glow = document.createElement('canvas'); glow.width = cw; glow.height = ch;
    var g = glow.getContext('2d');
    g.filter = 'blur(1.2px)'; g.globalAlpha = 0.7; g.drawImage(c, 0, 0);
    g.filter = 'none'; g.globalAlpha = 1; g.drawImage(c, 0, 0);
    return { canvas: glow, box: [minX, minY, cw, ch] };
  };

  // 원본 캔버스 → 결과 캔버스, 잘린 투명 PNG(dataURL)도 돌려줍니다
  HS.convertToChalk = function(srcCanvas, outCanvas, opt){
    var w = srcCanvas.width, h = srcCanvas.height;
    var data = srcCanvas.getContext('2d').getImageData(0, 0, w, h);
    var mask = HS.inkMask(data, opt.sens);
    var layer = HS.chalkLayer(mask, w, h, opt.color, 'chalk');
    outCanvas.width = w; outCanvas.height = h;
    var ctx = outCanvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if(opt.bg !== 'none') HS.drawBoardBg(ctx, w, h, opt.bg, 'chalk');
    if(layer.box) ctx.drawImage(layer.canvas, layer.box[0], layer.box[1]);
    var count = 0; for(var i = 0; i < mask.length; i++) count += mask[i];
    return { cropped: layer.box ? layer.canvas.toDataURL('image/png') : null, ink: count / mask.length };
  };

  // 그리는 모습: 분필 그림을 획 순서대로(획 기록이 없으면 위→아래로 쓸어내리며) 드러냅니다
  // chalk: 투명 바탕의 온전한 분필 그림(원본과 같은 크기), strokes: [[[x,y],...], ...]
  HS.drawChalkReveal = function(ctx, w, h, chalk, strokes, progress, bg){
    if(bg !== 'none') HS.drawBoardBg(ctx, w, h, bg, 'chalk'); else ctx.clearRect(0, 0, w, h);
    var mask = document.createElement('canvas'); mask.width = w; mask.height = h;
    var m = mask.getContext('2d');
    if(strokes && strokes.length){
      var total = 0;
      strokes.forEach(function(st){ total += Math.max(1, st.length - 1); });
      var left = progress * total;
      m.strokeStyle = '#000'; m.lineWidth = 26; m.lineCap = 'round'; m.lineJoin = 'round';
      strokes.forEach(function(st){
        if(left <= 0) return;
        m.beginPath(); m.moveTo(st[0][0], st[0][1]);
        if(st.length === 1){ m.lineTo(st[0][0] + 0.1, st[0][1]); left -= 1; }
        for(var i = 1; i < st.length && left > 0; i++, left--) m.lineTo(st[i][0], st[i][1]);
        m.stroke();
      });
    } else {
      var edge = progress * (h + 80);
      var g = m.createLinearGradient(0, edge - 80, 0, edge);
      g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
      m.fillStyle = g; m.fillRect(0, 0, w, edge);
    }
    m.globalCompositeOperation = 'source-in';
    m.drawImage(chalk, 0, 0);
    ctx.drawImage(mask, 0, 0);
    // 끝무렵에는 획이 못 덮은 곳(넓게 칠한 곳 등)까지 온전한 그림으로 채웁니다
    if(progress > 0.9){ ctx.globalAlpha = Math.min(1, (progress - 0.9) / 0.1); ctx.drawImage(chalk, 0, 0); ctx.globalAlpha = 1; }
  };

  /* 사진 그림의 획 찾기 — 선을 한 화소 두께의 뼈대로 가늘게 한 뒤(Zhang-Suen), 뼈대를 따라 걸으며 획으로 만듭니다.
   * 획은 앞 획이 끝난 곳에서 가까운 것부터 이어 그려, 사람이 그리는 순서처럼 보이게 합니다. */
  function thin(img, w, h){
    var changed = true, del = [], P = function(x, y){ return img[y * w + x]; };
    while(changed){
      changed = false;
      for(var pass = 0; pass < 2; pass++){
        del.length = 0;
        for(var y = 1; y < h - 1; y++) for(var x = 1; x < w - 1; x++){
          if(!img[y * w + x]) continue;
          var p2 = P(x, y - 1), p3 = P(x + 1, y - 1), p4 = P(x + 1, y), p5 = P(x + 1, y + 1), p6 = P(x, y + 1), p7 = P(x - 1, y + 1), p8 = P(x - 1, y), p9 = P(x - 1, y - 1);
          var B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if(B < 2 || B > 6) continue;
          var A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2);
          if(A !== 1) continue;
          if(pass === 0 ? (p2 * p4 * p6 || p4 * p6 * p8) : (p2 * p4 * p8 || p2 * p6 * p8)) continue;
          del.push(y * w + x);
        }
        if(del.length){ changed = true; for(var i = 0; i < del.length; i++) img[del[i]] = 0; }
      }
    }
    return img;
  }
  var NB = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  HS.traceStrokes = function(mask, w, h){
    // 큰 그림은 줄여서 계산합니다 (긴 변 400px)
    var k = Math.max(1, Math.max(w, h) / 400), sw = Math.round(w / k), sh = Math.round(h / k), img = new Uint8Array(sw * sh);
    for(var y = 0; y < sh; y++) for(var x = 0; x < sw; x++) img[y * sw + x] = mask[Math.min(h - 1, Math.round(y * k)) * w + Math.min(w - 1, Math.round(x * k))];
    thin(img, sw, sh);
    var seen = new Uint8Array(sw * sh), strokes = [];
    function nbs(x, y){
      var out = [];
      for(var i = 0; i < 8; i++){ var nx = x + NB[i][0], ny = y + NB[i][1]; if(nx >= 0 && ny >= 0 && nx < sw && ny < sh && img[ny * sw + nx] && !seen[ny * sw + nx]) out.push([nx, ny]); }
      return out;
    }
    function walk(x, y){
      var pts = [[x, y]]; seen[y * sw + x] = 1;
      for(;;){
        var n = nbs(x, y); if(!n.length) break;
        x = n[0][0]; y = n[0][1]; seen[y * sw + x] = 1; pts.push([x, y]);
      }
      return pts;
    }
    // 끝점(이웃이 하나)에서 먼저 출발해야 획이 가운데서 끊기지 않습니다
    for(var round = 0; round < 2; round++) for(y = 0; y < sh; y++) for(x = 0; x < sw; x++){
      if(!img[y * sw + x] || seen[y * sw + x]) continue;
      if(round === 0 && nbs(x, y).length !== 1) continue;
      var st = walk(x, y);
      if(st.length >= 3) strokes.push(st);
    }
    // 가까운 획부터 차례로 (위쪽에서 시작)
    strokes.sort(function(a, b){ return a[0][1] - b[0][1]; });
    var ordered = [], left = strokes.slice(), cur = left.length ? [left[0][0][0], 0] : null;
    while(left.length){
      var best = 0, bd = Infinity, rev = false;
      for(var i = 0; i < left.length; i++){
        var s0 = left[i][0], s1 = left[i][left[i].length - 1];
        var d0 = (s0[0] - cur[0]) * (s0[0] - cur[0]) + (s0[1] - cur[1]) * (s0[1] - cur[1]);
        var d1 = (s1[0] - cur[0]) * (s1[0] - cur[0]) + (s1[1] - cur[1]) * (s1[1] - cur[1]);
        if(d0 < bd){ bd = d0; best = i; rev = false; }
        if(d1 < bd){ bd = d1; best = i; rev = true; }
      }
      var pick = left.splice(best, 1)[0];
      if(rev) pick.reverse();
      ordered.push(pick);
      cur = pick[pick.length - 1];
    }
    // 원래 크기로 되돌리고 점을 솎아 냅니다
    return ordered.map(function(st){
      var out = [];
      for(var i = 0; i < st.length; i += 2) out.push([st[i][0] * k, st[i][1] * k]);
      var last = st[st.length - 1]; out.push([last[0] * k, last[1] * k]);
      return out;
    });
  };
  // 원본 캔버스 → 온전한 분필 그림(투명 바탕, 원본 크기)
  HS.chalkFull = function(srcCanvas, opt){
    var c = document.createElement('canvas');
    HS.convertToChalk(srcCanvas, c, { sens: opt.sens, color: opt.color, bg: 'none' });
    return c;
  };
})();
