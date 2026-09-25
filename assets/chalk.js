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
  };
  // 원본 캔버스 → 온전한 분필 그림(투명 바탕, 원본 크기)
  HS.chalkFull = function(srcCanvas, opt){
    var c = document.createElement('canvas');
    HS.convertToChalk(srcCanvas, c, { sens: opt.sens, color: opt.color, bg: 'none' });
    return c;
  };
})();
