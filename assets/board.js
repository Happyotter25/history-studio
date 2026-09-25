/* 칠판 판서 — 줄 문법 풀이와 캔버스 그리기 (미리보기·영상·PPT 배경이 함께 씁니다)
 *   - 앞에 "-" : 들여쓰기 (여러 개면 더 깊이)
 *   * 앞에 "*" : 노란 분필      ! 앞에 "!" : 분홍 분필
 *   [ 글 ]    : 네모 칸
 */
(function(){
  'use strict';
  var HS = window.HS;
  var CHALK = { white: '#f3f1e7', yellow: '#f6e27a', pink: '#f4a6b8', blue: '#9fd3f0' };
  HS.CHALK = CHALK;
  HS.BOARD_BG = { board: ['#274a38', '#1d3a2b'], black: ['#2b2d2c', '#1c1e1d'] };

  HS.parseBoardLine = function(raw){
    var s = String(raw).replace(/\s+$/, ''), indent = 0, color = 'white', box = false;
    var m = s.match(/^\s*(-+)\s*/);
    if(m){ indent = m[1].length; s = s.slice(m[0].length); }
    var arrow = '';
    if(/^→\s*/.test(s)){ arrow = '→ '; s = s.replace(/^→\s*/, ''); }
    if(/^\*/.test(s)){ color = 'yellow'; s = s.slice(1).trim(); }
    else if(/^!/.test(s)){ color = 'pink'; s = s.slice(1).trim(); }
    if(/^\[.*\]$/.test(s)){ box = true; s = s.slice(1, -1).trim(); }
    // 줄 가운데의 *낱말* 은 노란 분필 조각으로
    var parts = [], re = /\*([^*]+)\*/g, last = 0, mm;
    while((mm = re.exec(s))){ if(mm.index > last) parts.push({ t: s.slice(last, mm.index), c: color }); parts.push({ t: mm[1], c: 'yellow' }); last = re.lastIndex; }
    if(last < s.length) parts.push({ t: s.slice(last), c: color });
    if(arrow) parts.unshift({ t: arrow, c: 'white' });
    return { text: arrow + s.replace(/\*([^*]+)\*/g, '$1'), parts: parts, indent: indent, color: color, box: box };
  };

  // 분필 가루가 묻은 칠판 바탕
  HS.drawBoardBg = function(ctx, w, h, kind, seed){
    var bg = HS.BOARD_BG[kind || 'board'] || HS.BOARD_BG.board, r = HS.rng(seed || 'board');
    var g = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.1, w * 0.5, h * 0.5, w * 0.75);
    g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // 지우개 자국
    ctx.save();
    for(var i = 0; i < 14; i++){
      ctx.globalAlpha = 0.012 + r() * 0.022;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(r() * w, r() * h, 80 + r() * 260, 20 + r() * 50, (r() - 0.5) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // 분필 가루
    ctx.globalAlpha = 0.08;
    for(var j = 0; j < w * h / 900; j++){ ctx.fillStyle = r() > 0.5 ? '#ffffff' : '#000000'; ctx.fillRect(r() * w, r() * h, 1.5, 1.5); }
    ctx.restore();
    // 나무 틀과 분필 받침
    var f = Math.round(h * 0.025);
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(0, 0, w, f); ctx.fillRect(0, h - f, w, f); ctx.fillRect(0, 0, f, h); ctx.fillRect(w - f, 0, f, h);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(f, f, w - 2 * f, 4);
  };

  // 분필 글씨: 조금씩 어긋나게 여러 번 칠해 거친 결을 냅니다
  function chalkText(ctx, text, x, y, color){
    // 긁힘 무늬는 글자와 자리로 고정합니다 (쓰는 영상에서 앞 글자가 떨리지 않게)
    var r = HS.rng(text + '|' + Math.round(x) + '|' + Math.round(y));
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9; ctx.fillText(text, x, y);
    ctx.globalAlpha = 0.25; ctx.fillText(text, x + 0.8, y + 0.6);
    ctx.globalAlpha = 1;
    // 긁힌 자국 (글자 위에 칠판색 점)
    var w = ctx.measureText(text).width, size = parseInt(ctx.font, 10) || 40;
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 0.35;
    for(var i = 0; i < w * size / 60; i++) ctx.fillRect(x + r() * w, y - size * 0.8 + r() * size, 1.2, 1.2);
    ctx.restore();
    return w;
  }
  HS.chalkText = chalkText;

  function bodyLines(slide){ return String(slide.text || '').split('\n').filter(function(l){ return l.trim(); }); }
  // 한 장에 쓰는 글자 수 (그림은 25자 몫으로 칩니다) — 쓰는 영상의 길이를 정할 때 씁니다
  HS.boardChars = function(slide, hasDrawing){
    return (slide.title || '').length + bodyLines(slide).reduce(function(a, l){ return a + HS.parseBoardLine(l).text.length; }, 0) + (hasDrawing ? 25 : 0);
  };

  // 판서 한 장을 그립니다. slide = {title, text, drawing}, drawingImg 는 미리 읽어 둔 Image
  // opts.progress(0~1) 를 주면 그만큼만 써진 모습(분필로 써 나가는 영상)을 그립니다
  HS.drawBoardSlide = function(ctx, w, h, slide, drawingImg, opts){
    opts = opts || {};
    var budget = opts.progress == null ? Infinity : opts.progress * HS.boardChars(slide, !!drawingImg);
    function take(n){ var k = Math.max(0, Math.min(n, Math.floor(budget))); budget -= n; return k; }
    var r = HS.rng('chalk' + (slide.title || '') + (slide.text || ''));
    // 바탕은 새 캔버스에 그린 뒤 얹습니다 (글씨의 긁힘이 바탕까지 지우지 않게)
    HS.drawBoardBg(ctx, w, h, opts.bg, slide.title);
    var layer = document.createElement('canvas'); layer.width = w; layer.height = h;
    var c = layer.getContext('2d'), u = h / 720;
    c.textBaseline = 'alphabetic';
    var pad = 70 * u, textW = drawingImg ? w * 0.58 : w - pad * 2;
    // 제목과 밑줄
    c.font = 'bold ' + Math.round(68 * u) + 'px ' + getComputedStyle(document.body).getPropertyValue('--pen');
    var title = slide.title || '', tn = take(title.length);
    var tw = chalkText(c, title.slice(0, tn), pad, 110 * u, CHALK.white);
    if(tn === title.length && title){
      c.strokeStyle = CHALK.white; c.globalAlpha = 0.8; c.lineWidth = 3 * u; c.lineCap = 'round';
      c.beginPath(); c.moveTo(pad - 6 * u, 128 * u);
      for(var x = pad; x < pad + tw + 20 * u; x += 30 * u) c.lineTo(x, 128 * u + (r() - 0.5) * 4 * u);
      c.stroke(); c.globalAlpha = 1;
    }
    // 본문 줄
    var y = 200 * u, size = 46 * u;
    var lines = bodyLines(slide);
    if(lines.length > 9) size = 46 * u * 9 / lines.length;
    c.font = Math.round(size) + 'px ' + getComputedStyle(document.body).getPropertyValue('--pen');
    lines.forEach(function(raw){
      var L = HS.parseBoardLine(raw), x0 = pad + L.indent * 44 * u, xx = x0;
      var n = take(L.text.length), started = n > 0;
      if(started && !L.indent && !L.box && !/^→/.test(L.text)){ // 글머리 점
        c.fillStyle = CHALK[L.color]; c.globalAlpha = 0.9;
        c.beginPath(); c.arc(x0 + 8 * u, y - size * 0.32, 5 * u, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
        xx += 28 * u;
      }
      var wrapped = HS.wrap(c, L.text, textW - (xx - pad));
      if(L.box && started){
        var bw = Math.min(textW, c.measureText(L.text).width + 30 * u);
        c.strokeStyle = CHALK[L.color]; c.lineWidth = 2.5 * u; c.globalAlpha = 0.85;
        c.strokeRect(xx - 12 * u, y - size * 0.95, bw, size * 1.3 * wrapped.length); c.globalAlpha = 1;
      }
      wrapped.forEach(function(line, i){
        var m = Math.min(line.length, n); n -= m;
        if(i === 0 && L.parts.length > 1 && wrapped.length === 1){
          var px = xx, left = m;
          L.parts.forEach(function(pt){ var q = Math.min(pt.t.length, left); left -= q; if(q) px += chalkText(c, pt.t.slice(0, q), px, y, CHALK[pt.c]); });
        } else if(m) chalkText(c, line.slice(0, m), xx, y, CHALK[L.color]);
        y += size * 1.3;
      });
      y += size * 0.25;
    });
    if(drawingImg){
      var bx = w * 0.62, by = 150 * u, bw2 = w * 0.34, bh = h - by - 60 * u;
      var s = Math.min(bw2 / drawingImg.width, bh / drawingImg.height), show = budget === Infinity ? 1 : Math.max(0, Math.min(1, budget / 25));
      var dw = drawingImg.width * s, dh = drawingImg.height * s, dx = bx + (bw2 - dw) / 2, dy = by + (bh - dh) / 2;
      if(show > 0){ // 위에서부터 차례로 드러납니다
        c.save(); c.beginPath(); c.rect(dx, dy, dw, dh * show); c.clip();
        c.drawImage(drawingImg, dx, dy, dw, dh); c.restore();
      }
    }
    ctx.drawImage(layer, 0, 0);
  };
})();
