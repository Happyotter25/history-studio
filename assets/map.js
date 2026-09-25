/* 역사 지도 — Natural Earth 해안선 위에 지명과 이동 경로를 그립니다.
 * 양식: old(옛 지도) · modern(깔끔한 지도) · board(칠판). progress(0~1)로 경로가 그려지는 모습을 냅니다.
 */
(function(){
  'use strict';
  var HS = window.HS;
  var STYLE = {
    old: { sea: '#c9d2c2', sea2: '#b5c1ae', land: '#eadcb5', edge: '#8a6a45', text: '#3b2a1a', halo: 'rgba(245,235,205,.9)', route: '#a32b1e', font: "'Nanum Myeongjo',serif" },
    modern: { sea: '#dbe8f0', sea2: '#c8dbe7', land: '#f7f5f0', edge: '#9aa7b0', text: '#1f2a33', halo: 'rgba(255,255,255,.9)', route: '#d0443a', font: "'Noto Sans KR',sans-serif" },
    board: { sea: '#1f3b2d', sea2: '#1f3b2d', land: 'rgba(243,241,231,.10)', edge: 'rgba(243,241,231,.85)', text: '#f3f1e7', halo: 'rgba(31,59,45,.8)', route: '#f6e27a', font: "'Nanum Pen Script',cursive" }
  };
  HS.MAP_STYLE = STYLE;

  // 지명이 다 들어오도록 보기 범위를 잡습니다 (지명이 없으면 한반도)
  HS.fitMapView = function(places, aspect){
    aspect = aspect || 16 / 9;
    var lon0 = 124, lon1 = 131, lat0 = 33, lat1 = 43;
    if(places && places.length){
      lon0 = Infinity; lon1 = -Infinity; lat0 = Infinity; lat1 = -Infinity;
      places.forEach(function(p){ lon0 = Math.min(lon0, p.lon); lon1 = Math.max(lon1, p.lon); lat0 = Math.min(lat0, p.lat); lat1 = Math.max(lat1, p.lat); });
      var padLon = Math.max(1.2, (lon1 - lon0) * 0.25), padLat = Math.max(1, (lat1 - lat0) * 0.25);
      lon0 -= padLon; lon1 += padLon; lat0 -= padLat; lat1 += padLat;
    }
    // 위도에 따라 경도 폭을 줄여(cos) 화면 비율에 맞춥니다
    var k = Math.cos((lat0 + lat1) / 2 * Math.PI / 180);
    var wDeg = (lon1 - lon0) * k, hDeg = lat1 - lat0;
    if(wDeg / hDeg < aspect){ var addW = (hDeg * aspect - wDeg) / k / 2; lon0 -= addW; lon1 += addW; }
    else { var addH = (wDeg / aspect - hDeg) / 2; lat0 -= addH; lat1 += addH; }
    return [lon0, lat0, lon1, lat1];
  };

  // 지명과 영역이 다 들어오는 보기 범위 (사용자가 정해 둔 범위가 있으면 그것)
  HS.mapView = function(map, w, h){
    if(map.view) return map.view;
    var pts = map.places.slice();
    (map.regions || []).forEach(function(r){ r.points.forEach(function(q){ pts.push({ lon: q[0], lat: q[1] }); }); });
    return HS.fitMapView(pts, w / h);
  };
  // 캔버스 좌표 → 경위도
  HS.mapUnproject = function(map, w, h, x, y){
    var v = HS.mapView(map, w, h);
    return [Math.round((v[0] + x / w * (v[2] - v[0])) * 100) / 100, Math.round((v[3] - y / h * (v[3] - v[1])) * 100) / 100];
  };

  function projector(view, w, h){
    return function(lon, lat){ return [(lon - view[0]) / (view[2] - view[0]) * w, (view[3] - lat) / (view[3] - view[1]) * h]; };
  }

  function drawLand(ctx, P, st, w, h){
    ctx.beginPath();
    (window.GEO ? window.GEO.countries : []).forEach(function(c){
      c.rings.forEach(function(ring){
        for(var i = 0; i < ring.length; i++){
          var q = P(ring[i][0], ring[i][1]);
          i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
        }
        ctx.closePath();
      });
    });
    ctx.fillStyle = st.land; ctx.fill();
    ctx.strokeStyle = st.edge; ctx.lineWidth = 1.6 * w / 1280; ctx.stroke();
  }

  function arrowPath(ctx, a, b, bend, prog){
    // 휘어진 화살표 (2차 베지어), prog 만큼만 그립니다
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
    var cx = mx - dy * bend, cy = my + dx * bend, steps = 40, last = a, prev = a;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]);
    for(var i = 1; i <= steps * prog; i++){
      var t = i / steps, x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0], y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1];
      prev = last; last = [x, y]; ctx.lineTo(x, y);
    }
    ctx.stroke();
    return { tip: last, dir: Math.atan2(last[1] - prev[1], last[0] - prev[0]) };
  }

  HS.drawMap = function(ctx, w, h, map, opt){
    opt = opt || {};
    var st = STYLE[opt.style] || STYLE.old, u = w / 1280;
    var view = HS.mapView(map, w, h), P = projector(view, w, h);
    var prog = opt.progress == null ? 1 : opt.progress;
    if(opt.style === 'board') HS.drawBoardBg(ctx, w, h, 'board', 'map');
    else {
      var g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7);
      g.addColorStop(0, st.sea); g.addColorStop(1, st.sea2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    drawLand(ctx, P, st, w, h);
    // 경위선 (옛 지도·깔끔한 지도)
    if(opt.style !== 'board'){
      ctx.strokeStyle = st.edge; ctx.globalAlpha = 0.15; ctx.lineWidth = 1;
      for(var lo = Math.ceil(view[0] / 5) * 5; lo < view[2]; lo += 5){ var a = P(lo, 0); ctx.beginPath(); ctx.moveTo(a[0], 0); ctx.lineTo(a[0], h); ctx.stroke(); }
      for(var la = Math.ceil(view[1] / 5) * 5; la < view[3]; la += 5){ var b = P(0, la); ctx.beginPath(); ctx.moveTo(0, b[1]); ctx.lineTo(w, b[1]); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // 영역 (나라의 대략적인 판도, 점령지 등) — 반투명 칠과 이름
    (map.regions || []).concat(opt.draft ? [opt.draft] : []).forEach(function(rg){
      if(!rg.points || !rg.points.length) return;
      var col = rg.color || '#b8322a';
      ctx.save();
      ctx.beginPath();
      rg.points.forEach(function(q, i){ var a = P(q[0], q[1]); i ? ctx.lineTo(a[0], a[1]) : ctx.moveTo(a[0], a[1]); });
      if(rg !== opt.draft) ctx.closePath();
      ctx.globalAlpha = Math.min(1, prog * 3) * (opt.style === 'board' ? 0.22 : 0.28);
      ctx.fillStyle = col; if(rg !== opt.draft) ctx.fill();
      ctx.globalAlpha = Math.min(1, prog * 3) * 0.9;
      ctx.strokeStyle = col; ctx.lineWidth = 3 * u; ctx.setLineDash([10 * u, 6 * u]); ctx.stroke(); ctx.setLineDash([]);
      if(rg === opt.draft) rg.points.forEach(function(q){ var a = P(q[0], q[1]); ctx.fillStyle = col; ctx.fillRect(a[0] - 4 * u, a[1] - 4 * u, 8 * u, 8 * u); });
      ctx.restore();
      if(rg.name && rg !== opt.draft){
        var cx = 0, cy = 0;
        rg.points.forEach(function(q){ cx += q[0]; cy += q[1]; });
        var c = P(cx / rg.points.length, cy / rg.points.length);
        ctx.globalAlpha = Math.min(1, prog * 3);
        ctx.font = 'bold ' + Math.round(38 * u) + 'px ' + st.font;
        var tw = ctx.measureText(rg.name).width;
        label(ctx, rg.name, c[0] - tw / 2, c[1], 38 * u, st, col);
        ctx.globalAlpha = 1;
      }
    });
    var byName = {};
    map.places.forEach(function(p){ byName[p.name] = p; });
    // 경로 (차례대로 그려짐)
    var routes = map.routes.filter(function(r){ return byName[r.from] && byName[r.to]; });
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    routes.forEach(function(r, i){
      var local = Math.max(0, Math.min(1, prog * routes.length - i));
      if(local <= 0) return;
      var A = P(byName[r.from].lon, byName[r.from].lat), B = P(byName[r.to].lon, byName[r.to].lat);
      ctx.strokeStyle = r.color || st.route; ctx.lineWidth = 6 * u; ctx.globalAlpha = 0.9;
      if(opt.style !== 'board') ctx.setLineDash([16 * u, 10 * u]);
      var tip = arrowPath(ctx, A, B, 0.18, local);
      ctx.setLineDash([]);
      // 화살촉
      ctx.fillStyle = r.color || st.route;
      ctx.save(); ctx.translate(tip.tip[0], tip.tip[1]); ctx.rotate(tip.dir);
      ctx.beginPath(); ctx.moveTo(10 * u, 0); ctx.lineTo(-16 * u, -12 * u); ctx.lineTo(-16 * u, 12 * u); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
      if(r.label && local > 0.6){
        var m = P((byName[r.from].lon + byName[r.to].lon) / 2, (byName[r.from].lat + byName[r.to].lat) / 2);
        label(ctx, r.label, m[0] + 14 * u, m[1] - 10 * u, 26 * u, st, r.color || st.route);
      }
    });
    // 지명
    map.places.forEach(function(p){
      var q = P(p.lon, p.lat);
      if(q[0] < -50 || q[0] > w + 50 || q[1] < -50 || q[1] > h + 50) return;
      ctx.lineWidth = 3 * u;
      if(p.kind === 'battle'){ // 칼 두 자루(✕)
        ctx.strokeStyle = opt.style === 'board' ? '#f4a6b8' : '#8c1d12';
        ctx.beginPath(); ctx.moveTo(q[0] - 10 * u, q[1] - 10 * u); ctx.lineTo(q[0] + 10 * u, q[1] + 10 * u); ctx.moveTo(q[0] + 10 * u, q[1] - 10 * u); ctx.lineTo(q[0] - 10 * u, q[1] + 10 * u); ctx.stroke();
      } else {
        ctx.fillStyle = st.text; ctx.strokeStyle = st.halo;
        ctx.beginPath(); ctx.arc(q[0], q[1], (p.kind === 'capital' ? 10 : 7) * u, 0, Math.PI * 2); ctx.fill();
        if(p.kind === 'capital'){ ctx.strokeStyle = st.text; ctx.beginPath(); ctx.arc(q[0], q[1], 15 * u, 0, Math.PI * 2); ctx.stroke(); }
      }
      label(ctx, p.name, q[0] + 18 * u, q[1] + 9 * u, (p.kind === 'capital' ? 34 : 28) * u, st, st.text);
    });
    // 제목 두루마리
    if(map.title){
      ctx.font = 'bold ' + Math.round(40 * u) + 'px ' + st.font;
      var tw = ctx.measureText(map.title).width;
      ctx.fillStyle = opt.style === 'board' ? 'rgba(0,0,0,.25)' : st.halo;
      ctx.fillRect(30 * u, 30 * u, tw + 50 * u, 66 * u);
      ctx.strokeStyle = st.edge; ctx.lineWidth = 2 * u; ctx.strokeRect(36 * u, 36 * u, tw + 38 * u, 54 * u);
      ctx.fillStyle = st.text; ctx.fillText(map.title, 55 * u, 76 * u);
    }
    // 출처
    ctx.font = Math.round(14 * u) + 'px sans-serif'; ctx.fillStyle = st.text; ctx.globalAlpha = 0.6;
    ctx.fillText('지도 자료: Natural Earth', w - 190 * u, h - 14 * u); ctx.globalAlpha = 1;
  };

  function label(ctx, text, x, y, size, st, color){
    ctx.font = 'bold ' + Math.round(size) + 'px ' + st.font;
    ctx.lineWidth = size * 0.22; ctx.strokeStyle = st.halo; ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }

  // "부산 > 한양 : 일본군 북상" 줄들 ↔ routes
  HS.routesToText = function(routes){ return routes.map(function(r){ return r.from + ' > ' + r.to + (r.label ? ' : ' + r.label : ''); }).join('\n'); };
  HS.textToRoutes = function(text){
    return String(text).split('\n').map(function(l){
      var m = l.match(/^\s*(.+?)\s*(?:>|→|->)\s*(.+?)\s*(?::\s*(.*))?$/);
      return m ? { from: m[1], to: m[2], label: (m[3] || '').trim() } : null;
    }).filter(Boolean);
  };
})();
