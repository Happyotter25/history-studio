/* 역사 영상 전용 장면 — 사료 · 연표 · 인물 관계도 · 비교표
 * scene.kind 가 'source' | 'timeline' | 'people' | 'compare' 이면 그림 대신 이 장면을 그립니다.
 * k(0~1)는 장면 안의 진행으로, 차례로 써지고·찍히고·이어지는 움직임을 냅니다. k=1 이면 다 된 모습(PPT·썸네일용).
 * scene.data = {original, translation, cite, events[{year,label}], people[{name,role}], links[{from,to,label}], left, right, rows[{label,left,right}]}
 */
(function(){
  'use strict';
  var HS = window.HS;
  var KINDS = { illust: '삽화', map: '지도', source: '사료', timeline: '연표', people: '인물 관계도', compare: '비교표' };
  HS.SCENE_KINDS = KINDS;
  HS.sceneKind = function(s){ return s.kind && KINDS[s.kind] ? s.kind : (s.useMap ? 'map' : 'illust'); };
  HS.isDataScene = function(s){ var k = HS.sceneKind(s); return k === 'source' || k === 'timeline' || k === 'people' || k === 'compare'; };
  HS.needsPicture = function(s){ return HS.sceneKind(s) === 'illust'; };
  HS.setSceneKind = function(s, kind){
    s.kind = kind; s.useMap = kind === 'map';
    s.data = s.data || {};
  };

  var SERIF = "'Nanum Myeongjo',serif", SANS = "'Noto Sans KR',sans-serif";
  var INK = '#2b2118', RED = '#9b2d20', BLUE = '#2f5f8a';
  function clamp(x){ return Math.max(0, Math.min(1, x)); }
  function span(k, a, b){ return clamp((k - a) / (b - a)); }
  function ease(x){ return 1 - Math.pow(1 - x, 3); }

  // 한지 바탕
  function hanji(ctx, w, h, seed){
    var g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    g.addColorStop(0, '#f4ead3'); g.addColorStop(1, '#dcc9a2');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    var r = HS.rng(seed || 'hanji');
    ctx.save(); ctx.strokeStyle = 'rgba(120,90,50,.08)'; ctx.lineWidth = 1;
    for(var i = 0; i < 260; i++){ // 닥나무 섬유
      var x = r() * w, y = r() * h, l = 6 + r() * 26, a = r() * Math.PI;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    ctx.restore();
  }
  function title(ctx, w, h, text, u, a){
    if(!text) return;
    ctx.save(); ctx.globalAlpha = a == null ? 1 : a;
    ctx.font = '800 ' + Math.round(34 * u) + 'px ' + SERIF; ctx.fillStyle = INK;
    var t = HS.wrap(ctx, text, w * 0.8)[0], tw = ctx.measureText(t).width;
    ctx.fillText(t, (w - tw) / 2, (w < h ? h * 0.2 : 70 * u));
    ctx.fillStyle = RED; ctx.fillRect((w - 60 * u) / 2, (w < h ? h * 0.2 : 70 * u) + 22 * u, 60 * u, 3 * u);
    ctx.restore();
  }
  // 글을 n 글자까지만 (쓰는 모습)
  function upto(lines, n){
    var out = [];
    for(var i = 0; i < lines.length && n > 0; i++){ out.push(lines[i].slice(0, n)); n -= lines[i].length; }
    return out;
  }
  function rich(ctx, text, x, y, keys, color){ // 핵심어는 붉게
    HS.markKeywords(text, keys).forEach(function(seg){ ctx.fillStyle = seg.key ? RED : color; ctx.fillText(seg.t, x, y); x += ctx.measureText(seg.t).width; });
  }

  /* 사료: 두루마리가 펼쳐지고, 원문(세로쓰기)이 한 자씩 → 번역이 한 줄씩 → 출처 */
  function drawSource(ctx, w, h, s, k, u){
    var d = s.data || {}, portrait = w < h;
    hanji(ctx, w, h, s.heading);
    var open = ease(span(k, 0, 0.15));
    var pw = w * (portrait ? 0.9 : 0.84), ph = h * (portrait ? 0.74 : 0.78) * open, px = (w - pw) / 2, py = (h - ph) / 2 + (portrait ? h * 0.03 : 0);
    // 종이와 나무 축
    ctx.fillStyle = '#fbf5e6'; ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(90,60,30,.35)'; ctx.lineWidth = 2 * u; ctx.strokeRect(px + 10 * u, py + 10 * u, pw - 20 * u, Math.max(0, ph - 20 * u));
    ctx.fillStyle = '#6b4a2b';
    [py - 10 * u, py + ph - 8 * u].forEach(function(y){ ctx.fillRect(px - 26 * u, y, pw + 52 * u, 18 * u); ctx.fillStyle = '#4a3220'; ctx.fillRect(px - 34 * u, y - 4 * u, 10 * u, 26 * u); ctx.fillRect(px + pw + 24 * u, y - 4 * u, 10 * u, 26 * u); ctx.fillStyle = '#6b4a2b'; });
    if(open < 1) return;
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    var orig = String(d.original || '').replace(/\s+/g, ''), tr = String(d.translation || ''), keys = s.keywords || [];
    // 원문: 세로로, 오른쪽부터 (가로 화면은 오른쪽 40%, 세로 화면은 위쪽)
    var trBox;
    if(orig){
      var fs = 40 * u, colW = fs * 1.35, rows = Math.max(4, Math.floor((portrait ? ph * 0.42 : ph - 90 * u) / (fs * 1.12)));
      var cols = Math.ceil(orig.length / rows);
      if(cols * colW > (portrait ? pw - 60 * u : pw * 0.4)){ fs *= (portrait ? pw - 60 * u : pw * 0.4) / (cols * colW); colW = fs * 1.35; rows = Math.max(4, Math.floor((portrait ? ph * 0.42 : ph - 90 * u) / (fs * 1.12))); cols = Math.ceil(orig.length / rows); }
      var shown = Math.floor(orig.length * span(k, 0.15, 0.5));
      var right = portrait ? (w + cols * colW) / 2 - colW / 2 : px + pw - 50 * u, top = py + 50 * u;
      ctx.font = '700 ' + Math.round(fs) + 'px ' + SERIF; ctx.fillStyle = INK; ctx.textAlign = 'center';
      for(var i = 0; i < shown; i++){
        var c = Math.floor(i / rows), r = i % rows;
        ctx.fillText(orig[i], right - c * colW, top + fs + r * fs * 1.12);
      }
      ctx.textAlign = 'left';
      trBox = portrait ? [px + 40 * u, py + ph * 0.52, pw - 80 * u] : [px + 50 * u, py + 70 * u, pw * 0.56 - 80 * u];
      if(!portrait){ // 원문과 번역 사이 세로줄
        ctx.strokeStyle = 'rgba(155,45,32,.4)'; ctx.lineWidth = 2 * u;
        ctx.beginPath(); ctx.moveTo(px + pw * 0.56, py + 40 * u); ctx.lineTo(px + pw * 0.56, py + ph - 40 * u); ctx.stroke();
      }
    } else trBox = [px + 70 * u, py + (portrait ? 80 : 90) * u, pw - 140 * u];
    // 번역
    var tfs = (orig ? 30 : 38) * u;
    ctx.font = Math.round(tfs) + 'px ' + SERIF;
    var lines = HS.wrap(ctx, tr, trBox[2]);
    // 긴 번역 인용도 출처 영역을 침범하지 않도록 글자 크기를 맞춥니다.
    while(tfs > 16 * u && lines.length * tfs * 1.55 > py + ph - 80 * u - trBox[1]){
      tfs *= 0.95; ctx.font = Math.round(tfs) + 'px ' + SERIF; lines = HS.wrap(ctx, tr, trBox[2]);
    }
    var total = tr.length, part = upto(lines, Math.floor(total * span(k, orig ? 0.5 : 0.15, 0.88)));
    part.forEach(function(l, i){ rich(ctx, l, trBox[0], trBox[1] + tfs + i * tfs * 1.55, keys, INK); });
    // 출처
    if(d.cite && k > 0.88){
      ctx.globalAlpha = span(k, 0.88, 0.95);
      ctx.font = 'italic ' + Math.round(22 * u) + 'px ' + SERIF; ctx.fillStyle = '#6b5440';
      var ct = '— ' + d.cite, cw = ctx.measureText(ct).width;
      ctx.fillText(ct, px + pw - cw - 50 * u, py + ph - 36 * u);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* 연표: 줄이 그어지고 사건이 차례로 찍힙니다 */
  function drawTimeline(ctx, w, h, s, k, u){
    var ev = ((s.data || {}).events || []).filter(function(e){ return e.year || e.label; }).slice(0, 8), portrait = w < h;
    hanji(ctx, w, h, s.heading);
    title(ctx, w, h, s.heading, u);
    var line = ease(span(k, 0.05, 0.25)), n = Math.max(1, ev.length);
    ctx.strokeStyle = INK; ctx.lineWidth = 4 * u; ctx.lineCap = 'round';
    if(portrait){
      var x0 = w * 0.24, y0 = h * 0.28, y1 = h * 0.86;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + (y1 - y0) * line); ctx.stroke();
      ev.forEach(function(e, i){
        var a = ease(span(k, 0.25 + i * 0.65 / n, 0.25 + (i + 0.8) * 0.65 / n)); if(a <= 0) return;
        var y = y0 + (y1 - y0) * (n === 1 ? 0.5 : i / (n - 1));
        ctx.globalAlpha = a;
        ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x0, y, 11 * u * (0.6 + 0.4 * a), 0, Math.PI * 2); ctx.fill();
        ctx.font = '800 ' + Math.round(30 * u) + 'px ' + SERIF; ctx.fillStyle = RED;
        var yt = e.year || ''; ctx.fillText(yt, x0 - 24 * u - ctx.measureText(yt).width, y + 10 * u);
        ctx.font = Math.round(26 * u) + 'px ' + SANS; ctx.fillStyle = INK;
        HS.wrap(ctx, e.label || '', w - x0 - 60 * u).slice(0, 2).forEach(function(l, j){ ctx.fillText(l, x0 + 26 * u, y + 9 * u + j * 32 * u); });
        ctx.globalAlpha = 1;
      });
      return;
    }
    var xa = w * 0.08, xb = w * 0.92, yl = h * 0.52;
    ctx.beginPath(); ctx.moveTo(xa, yl); ctx.lineTo(xa + (xb - xa) * line, yl); ctx.stroke();
    if(line >= 1){ // 화살촉
      ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(xb + 14 * u, yl); ctx.lineTo(xb - 6 * u, yl - 10 * u); ctx.lineTo(xb - 6 * u, yl + 10 * u); ctx.fill();
    }
    var step = (xb - xa) / n;
    ev.forEach(function(e, i){
      var a = ease(span(k, 0.25 + i * 0.65 / n, 0.25 + (i + 0.8) * 0.65 / n)); if(a <= 0) return;
      var x = xa + step * (i + 0.5), up = i % 2 === 0;
      ctx.globalAlpha = a;
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x, yl, 12 * u * (0.6 + 0.4 * a), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(43,33,24,.5)'; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.moveTo(x, yl + (up ? -16 : 16) * u); ctx.lineTo(x, yl + (up ? -60 : 60) * u); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = '800 ' + Math.round(30 * u) + 'px ' + SERIF; ctx.fillStyle = RED;
      ctx.fillText(e.year || '', x, up ? yl - 74 * u : yl + 96 * u);
      ctx.font = Math.round(24 * u) + 'px ' + SANS; ctx.fillStyle = INK;
      var lines = HS.wrap(ctx, e.label || '', Math.max(step * 1.6, 140 * u)).slice(0, 3);
      lines.forEach(function(l, j){ ctx.fillText(l, x, up ? yl - 112 * u - (lines.length - 1 - j) * 30 * u : yl + 132 * u + j * 30 * u); });
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    });
  }

  /* 인물 관계도: 인물 카드가 나타나고 관계선이 이어집니다 */
  function nodePos(n, w, h, u){
    var portrait = w < h, cx = w / 2, cy = portrait ? h * 0.52 : h * 0.56, pos = [];
    if(n <= 3){ for(var i = 0; i < n; i++) pos.push(portrait ? [cx, h * 0.34 + i * h * 0.2] : [w * (n === 1 ? 0.5 : 0.2 + i * 0.6 / (n - 1)), cy]); return pos; }
    var rx = portrait ? w * 0.32 : w * 0.33, ry = portrait ? h * 0.24 : h * 0.26;
    for(var j = 0; j < n; j++){ var a = -Math.PI / 2 + j / n * Math.PI * 2; pos.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return pos;
  }
  var NODE_COLORS = ['#9b2d20', '#2f5f8a', '#3c8d5a', '#b07a1f', '#7d4bb3', '#5a5048'];
  function drawPeople(ctx, w, h, s, k, u){
    var d = s.data || {}, ppl = (d.people || []).filter(function(p){ return p.name; }).slice(0, 6), links = (d.links || []).filter(function(l){ return l.from && l.to; });
    hanji(ctx, w, h, s.heading);
    title(ctx, w, h, s.heading, u);
    var pos = nodePos(ppl.length, w, h, u), byName = {}, R = 58 * u;
    ppl.forEach(function(p, i){ byName[p.name] = i; });
    // 관계선 (인물보다 먼저 그려 아래에 깔리게)
    var ls = links.filter(function(l){ return byName[l.from] != null && byName[l.to] != null; });
    ls.forEach(function(l, i){
      var a = span(k, 0.45 + i * 0.45 / Math.max(1, ls.length), 0.45 + (i + 0.9) * 0.45 / Math.max(1, ls.length)); if(a <= 0) return;
      var A = pos[byName[l.from]], B = pos[byName[l.to]], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
      var sx = A[0] + dx / L * R, sy = A[1] + dy / L * R, ex = B[0] - dx / L * (R + 8 * u), ey = B[1] - dy / L * (R + 8 * u);
      var mx = sx + (ex - sx) * a, my = sy + (ey - sy) * a;
      ctx.strokeStyle = 'rgba(43,33,24,.75)'; ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(mx, my); ctx.stroke();
      if(a >= 1){
        var ang = Math.atan2(dy, dx);
        ctx.fillStyle = 'rgba(43,33,24,.85)'; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(ang - 0.4) * 16 * u, ey - Math.sin(ang - 0.4) * 16 * u); ctx.lineTo(ex - Math.cos(ang + 0.4) * 16 * u, ey - Math.sin(ang + 0.4) * 16 * u); ctx.fill();
        if(l.label){
          ctx.font = 'bold ' + Math.round(20 * u) + 'px ' + SANS;
          var tw = ctx.measureText(l.label).width, cx = (sx + ex) / 2, cy = (sy + ey) / 2;
          ctx.fillStyle = '#fbf5e6'; ctx.fillRect(cx - tw / 2 - 8 * u, cy - 16 * u, tw + 16 * u, 30 * u);
          ctx.strokeStyle = 'rgba(155,45,32,.6)'; ctx.lineWidth = 1.5 * u; ctx.strokeRect(cx - tw / 2 - 8 * u, cy - 16 * u, tw + 16 * u, 30 * u);
          ctx.fillStyle = RED; ctx.textAlign = 'center'; ctx.fillText(l.label, cx, cy + 6 * u); ctx.textAlign = 'left';
        }
      }
    });
    ppl.forEach(function(p, i){
      var a = ease(span(k, 0.05 + i * 0.4 / ppl.length, 0.05 + (i + 0.9) * 0.4 / ppl.length)); if(a <= 0) return;
      var x = pos[i][0], y = pos[i][1], r = R * (0.7 + 0.3 * a), col = NODE_COLORS[i % NODE_COLORS.length];
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fbf5e6'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 5 * u; ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = '800 ' + Math.round(44 * u) + 'px ' + SERIF; ctx.fillStyle = col;
      ctx.fillText(p.name.charAt(0), x, y + 15 * u);
      ctx.font = 'bold ' + Math.round(26 * u) + 'px ' + SANS; ctx.fillStyle = INK;
      ctx.fillText(p.name, x, y + R + 32 * u);
      if(p.role){ ctx.font = Math.round(19 * u) + 'px ' + SANS; ctx.fillStyle = '#6b5440'; ctx.fillText(HS.wrap(ctx, p.role, 220 * u)[0], x, y + R + 58 * u); }
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    });
  }

  /* 비교표: 두 쪽 머리가 나오고 줄이 하나씩 채워집니다 */
  function drawCompare(ctx, w, h, s, k, u){
    var d = s.data || {}, rows = (d.rows || []).filter(function(r){ return r.label || r.left || r.right; }).slice(0, 6), portrait = w < h;
    hanji(ctx, w, h, s.heading);
    title(ctx, w, h, s.heading, u);
    var tw = w * (portrait ? 0.92 : 0.84), tx = (w - tw) / 2, ty = portrait ? h * 0.27 : 120 * u;
    var labW = tw * (portrait ? 0.26 : 0.22), colW = (tw - labW) / 2, hh = 64 * u;
    var avail = (portrait ? h * 0.62 : h - ty - hh - 110 * u), rh = Math.min(92 * u, avail / Math.max(1, rows.length));
    var head = ease(span(k, 0.03, 0.18));
    ctx.globalAlpha = head;
    [[d.left || '가', BLUE, tx + labW], [d.right || '나', RED, tx + labW + colW]].forEach(function(c){
      ctx.fillStyle = c[1]; ctx.fillRect(c[2] + 4 * u, ty, colW - 8 * u, hh);
      ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(30 * u) + 'px ' + SERIF; ctx.textAlign = 'center';
      ctx.fillText(HS.wrap(ctx, c[0], colW - 20 * u)[0], c[2] + colW / 2, ty + hh * 0.66); ctx.textAlign = 'left';
    });
    ctx.globalAlpha = 1;
    rows.forEach(function(r, i){
      var a = ease(span(k, 0.18 + i * 0.72 / rows.length, 0.18 + (i + 0.8) * 0.72 / rows.length)); if(a <= 0) return;
      var y = ty + hh + 8 * u + i * rh;
      ctx.globalAlpha = a;
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.75)'; ctx.fillRect(tx, y, tw, rh - 6 * u);
      ctx.fillStyle = INK; ctx.font = 'bold ' + Math.round(24 * u) + 'px ' + SANS; ctx.textAlign = 'center';
      HS.wrap(ctx, r.label || '', labW - 16 * u).slice(0, 2).forEach(function(l, j, arr){ ctx.fillText(l, tx + labW / 2, y + rh / 2 + 8 * u + (j - (arr.length - 1) / 2) * 28 * u); });
      ctx.font = Math.round(23 * u) + 'px ' + SANS;
      [[r.left, tx + labW], [r.right, tx + labW + colW]].forEach(function(c){
        HS.wrap(ctx, c[0] || '', colW - 24 * u).slice(0, 2).forEach(function(l, j, arr){ ctx.fillText(l, c[1] + colW / 2, y + rh / 2 + 8 * u + (j - (arr.length - 1) / 2) * 28 * u); });
      });
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    });
  }

  HS.drawDataScene = function(ctx, w, h, s, k){
    var u = Math.min(w, h) / 720, kind = HS.sceneKind(s);
    ({ source: drawSource, timeline: drawTimeline, people: drawPeople, compare: drawCompare })[kind](ctx, w, h, s, clamp(k), u);
  };

  /* ── 편집용 글 형식 ↔ 자료 ─────────────────────────────
   * 연표: "1592 | 임진왜란 발발"   인물: "이순신 | 삼도수군통제사"   관계: "선조 > 이순신 : 임명"   비교: "병력 | 약 8만 | 약 16만" */
  function rowsOf(text){ return String(text || '').split('\n').map(function(l){ return l.split('|').map(function(x){ return x.trim(); }); }).filter(function(c){ return c.join(''); }); }
  HS.kindToText = function(s){
    var d = s.data || {}, k = HS.sceneKind(s);
    if(k === 'timeline') return (d.events || []).map(function(e){ return e.year + ' | ' + e.label; }).join('\n');
    if(k === 'people') return (d.people || []).map(function(p){ return p.name + (p.role ? ' | ' + p.role : ''); }).join('\n');
    if(k === 'compare') return (d.rows || []).map(function(r){ return r.label + ' | ' + r.left + ' | ' + r.right; }).join('\n');
    return '';
  };
  HS.textToKind = function(s, text){
    var d = s.data = s.data || {}, k = HS.sceneKind(s), rows = rowsOf(text);
    if(k === 'timeline') d.events = rows.map(function(c){ return { year: c[0] || '', label: c.slice(1).join(' | ') }; });
    if(k === 'people') d.people = rows.map(function(c){ return { name: c[0] || '', role: c.slice(1).join(' | ') }; });
    if(k === 'compare') d.rows = rows.map(function(c){ return { label: c[0] || '', left: c[1] || '', right: c[2] || '' }; });
  };
  HS.linksToText = function(s){ return ((s.data || {}).links || []).map(function(l){ return l.from + ' > ' + l.to + (l.label ? ' : ' + l.label : ''); }).join('\n'); };
  HS.textToLinks = function(s, text){ (s.data = s.data || {}).links = HS.textToRoutes(text); };
})();
