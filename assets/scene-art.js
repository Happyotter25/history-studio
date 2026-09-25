/* 그림이 없는 장면에 까는 배경 삽화 — 분위기(mood)에 따라 하늘·산·바다·궁궐을 그립니다.
 * 같은 장면은 늘 같은 모양이 나오도록 장면 제목으로 난수를 고정합니다. t(초)는 움직임에 씁니다.
 */
(function(){
  'use strict';
  var HS = window.HS;
  var SKY = {
    dawn: ['#f3c9a6', '#e79c83', '#6d6a8f'], day: ['#cfe3ea', '#e9e3cf', '#b7c9b0'],
    dusk: ['#f0a86a', '#b9585a', '#3d2f4d'], night: ['#1b2440', '#27345c', '#0d1224'],
    war: ['#e0825a', '#7a2e22', '#2a1714'], sea: ['#bcd6de', '#8fb3bf', '#3c6a7d'],
    court: ['#efe3c4', '#e0c795', '#9b6a45'], snow: ['#e8edf1', '#c9d3db', '#8d9aa6']
  };
  var HILL = {
    dawn: '#4d4660', day: '#5d7560', dusk: '#2c2233', night: '#0a0e1a', war: '#1d100d',
    sea: '#355563', court: '#5b3d28', snow: '#7c8995'
  };

  function mix(a, b, k){
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - k) + ((pb >> 16) & 255) * k);
    var g = Math.round(((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k);
    var bl = Math.round((pa & 255) * (1 - k) + (pb & 255) * k);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function ridge(ctx, w, h, base, amp, color, r, alpha){
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, h);
    var peaks = 3 + Math.floor(r() * 4), pts = [];
    for(var i = 0; i <= peaks; i++) pts.push([i / peaks * w, base - r() * amp]);
    ctx.lineTo(0, pts[0][1]);
    for(var j = 1; j < pts.length; j++){
      var p0 = pts[j - 1], p1 = pts[j], mx = (p0[0] + p1[0]) / 2;
      ctx.quadraticCurveTo(mx, Math.min(p0[1], p1[1]) - amp * (0.2 + r() * 0.5), p1[0], p1[1]);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function palace(ctx, w, h, color){
    // 기와지붕 실루엣 (근정전 풍)
    var cx = w * 0.5, by = h * 0.72, u = Math.min(w, h) / 720;
    ctx.fillStyle = color;
    ctx.fillRect(cx - 360 * u, by, 720 * u, h - by);
    ctx.fillRect(cx - 250 * u, by - 110 * u, 500 * u, 110 * u);
    function roof(y, half, lift){
      ctx.beginPath();
      ctx.moveTo(cx - half, y); ctx.quadraticCurveTo(cx - half * 0.7, y - 18 * u, cx - half * 0.55, y - lift);
      ctx.lineTo(cx + half * 0.55, y - lift); ctx.quadraticCurveTo(cx + half * 0.7, y - 18 * u, cx + half, y);
      ctx.quadraticCurveTo(cx + half * 0.9, y - 8 * u, cx + half * 0.8, y - 4 * u); ctx.lineTo(cx - half * 0.8, y - 4 * u);
      ctx.quadraticCurveTo(cx - half * 0.9, y - 8 * u, cx - half, y);
      ctx.fill();
    }
    roof(by - 100 * u, 380 * u, 90 * u);
    ctx.fillRect(cx - 190 * u, by - 250 * u, 380 * u, 70 * u);
    roof(by - 240 * u, 300 * u, 80 * u);
  }

  function ships(ctx, w, h, color, t, r){
    ctx.fillStyle = color;
    for(var i = 0; i < 4; i++){
      var x = ((r() * w + t * 12 * (i % 2 ? 1 : -0.6)) % (w + 200)) - 100, y = h * (0.66 + r() * 0.1), s = (0.6 + r() * 0.6) * Math.min(w, h) / 720;
      ctx.beginPath(); ctx.moveTo(x - 70 * s, y); ctx.lineTo(x + 70 * s, y); ctx.lineTo(x + 50 * s, y + 22 * s); ctx.lineTo(x - 50 * s, y + 22 * s); ctx.fill();
      ctx.fillRect(x - 3 * s, y - 80 * s, 6 * s, 80 * s);
      ctx.beginPath(); ctx.moveTo(x, y - 76 * s); ctx.lineTo(x + 40 * s, y - 40 * s); ctx.lineTo(x, y - 12 * s); ctx.fill();
    }
  }

  function waves(ctx, w, h, t, color){
    ctx.strokeStyle = color; ctx.lineWidth = 2 * Math.min(w, h) / 720; ctx.globalAlpha = 0.5;
    for(var row = 0; row < 7; row++){
      var y = h * 0.74 + row * h * 0.04;
      ctx.beginPath();
      for(var x = 0; x <= w; x += 20){
        var yy = y + Math.sin(x / 60 + t * 1.5 + row) * 4;
        x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function particles(ctx, w, h, t, kind, r){
    var n = kind === 'snow' ? 140 : 70;
    for(var i = 0; i < n; i++){
      var x0 = r() * w, sp = 0.4 + r(), y, x;
      if(kind === 'snow'){ y = (r() * h + t * 40 * sp) % h; x = x0 + Math.sin(t + i) * 10; ctx.fillStyle = 'rgba(255,255,255,.85)'; }
      else if(kind === 'war'){ y = h - ((r() * h + t * 60 * sp) % h); x = x0 + Math.sin(t * 2 + i) * 8; ctx.fillStyle = 'rgba(255,' + (120 + Math.floor(r() * 80)) + ',60,.8)'; }
      else { y = (r() * h * 0.6); x = x0; ctx.fillStyle = 'rgba(255,255,230,' + (0.3 + 0.5 * Math.abs(Math.sin(t * sp + i))) + ')'; }
      ctx.beginPath(); ctx.arc(x, y, (kind === 'snow' ? 2.2 : 1.6) * sp * Math.min(w, h) / 720, 0, Math.PI * 2); ctx.fill();
    }
  }

  HS.drawSceneArt = function(ctx, w, h, scene, t){
    var mood = SKY[scene.mood] ? scene.mood : 'day', sky = SKY[mood], r = HS.rng(scene.heading || 'scene');
    t = t || 0;
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, sky[2]); g.addColorStop(0.55, sky[1]); g.addColorStop(1, sky[0]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // 해 · 달
    var sunX = w * (0.2 + r() * 0.6), sunY = h * (0.2 + r() * 0.15);
    ctx.fillStyle = mood === 'night' ? '#f4efd8' : mood === 'war' || mood === 'dusk' ? '#ffcf8a' : '#fff6de';
    ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(sunX, sunY, h * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    if(mood === 'night') particles(ctx, w, h, t, 'star', r);
    // 겹겹의 산 (먼 산은 옅게)
    var hill = HILL[mood];
    ridge(ctx, w, h, h * 0.55, h * 0.18, mix(hill, sky[1], 0.55), r, 0.25);
    ridge(ctx, w, h, h * 0.63, h * 0.16, hill, r, 0.45);
    if(mood === 'sea'){
      ctx.fillStyle = '#4f7f90'; ctx.fillRect(0, h * 0.7, w, h * 0.3);
      waves(ctx, w, h, t, '#e6f0f2');
      ships(ctx, w, h, '#1f2b33', t, r);
    } else if(mood === 'court'){
      ridge(ctx, w, h, h * 0.7, h * 0.08, hill, r, 0.7);
      palace(ctx, w, h, '#3a2618');
    } else {
      ridge(ctx, w, h, h * 0.74, h * 0.12, hill, r, 0.85);
    }
    if(mood === 'war'){
      // 연기와 깃발
      for(var i = 0; i < 5; i++){
        var sx = r() * w, rise = (t * 20 + i * 50) % 200;
        ctx.fillStyle = 'rgba(40,20,15,.25)';
        ctx.beginPath(); ctx.arc(sx + Math.sin(t + i) * 20, h * 0.7 - rise, 60 + rise * 0.4, 0, Math.PI * 2); ctx.fill();
      }
      for(var f = 0; f < 6; f++){
        var fx = w * (0.1 + f * 0.15) + r() * 40, fy = h * (0.72 + r() * 0.05), u = Math.min(w, h) / 720;
        ctx.fillStyle = '#1d100d'; ctx.fillRect(fx, fy - 110 * u, 4 * u, 110 * u);
        ctx.fillStyle = f % 2 ? '#b8322a' : '#e8d8a8';
        ctx.beginPath(); ctx.moveTo(fx + 4 * u, fy - 110 * u);
        ctx.quadraticCurveTo(fx + 30 * u, fy - 104 * u + Math.sin(t * 4 + f) * 6 * u, fx + 56 * u, fy - 100 * u);
        ctx.lineTo(fx + 56 * u, fy - 64 * u); ctx.lineTo(fx + 4 * u, fy - 70 * u); ctx.fill();
      }
      particles(ctx, w, h, t, 'war', r);
    }
    if(mood === 'snow') particles(ctx, w, h, t, 'snow', r);
    // 한지 결
    ctx.globalAlpha = 0.06; ctx.fillStyle = '#fff';
    for(var k = 0; k < 400; k++) ctx.fillRect(r() * w, r() * h, 2, 1);
    ctx.globalAlpha = 1;
  };
})();
