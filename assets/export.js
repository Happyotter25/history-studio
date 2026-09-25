/* PPT 내보내기 (PptxGenJS) — 스토리 PPT와 판서 PPT
 * 글자는 모두 PowerPoint 안에서 고칠 수 있는 텍스트로 넣고, 그림·배경만 이미지로 넣습니다.
 */
(function(){
  'use strict';
  var HS = window.HS;
  var W = 13.333, H = 7.5; // LAYOUT_WIDE (인치)

  function canvas(w, h){ var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // 장면 한 컷 (그림이 있으면 그림, 없으면 분위기 배경)
  HS.sceneStill = function(scene, w, h){
    var c = canvas(w, h), ctx = c.getContext('2d'), img = HS.sceneImage(scene);
    if(img){
      var s = Math.max(w / img.width, h / img.height);
      ctx.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
    } else HS.drawSceneArt(ctx, w, h, scene, 0);
    return c;
  };
  function sentences(t){ return (String(t || '').match(/[^.!?。]+[.!?。]?/g) || []).map(function(s){ return s.trim(); }).filter(Boolean); }

  function save(pptx, name){
    return pptx.write({ outputType: 'blob' }).then(function(blob){ HS.download(name, blob); return blob; });
  }

  var THEMES = {
    hanji: { bg: 'F4EFE4', ink: '2B2520', sub: '7A6F63', accent: '9B2D20', panel: 'FFFDF7' },
    ink: { bg: '1B1916', ink: 'ECE6DA', sub: 'A59A8B', accent: 'D0574A', panel: '24211D' }
  };

  HS.exportStoryPptx = function(opt){
    opt = opt || {};
    var p = HS.project, th = THEMES[opt.theme] || THEMES.hanji;
    if(!p.scenes.length) return Promise.reject(new Error('먼저 대본을 만드세요'));
    return HS.preloadImages().then(function(){
      var pptx = new window.PptxGenJS();
      pptx.layout = 'LAYOUT_WIDE';
      pptx.title = p.title || '사관 스튜디오';
      var serif = 'Nanum Myeongjo', sans = 'Noto Sans KR';
      // 표지
      var cover = pptx.addSlide();
      cover.addImage({ data: HS.sceneStill(p.scenes[0], 1600, 900).toDataURL('image/jpeg', 0.88), x: 0, y: 0, w: W, h: H });
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 2.6, w: W, h: 2.1, fill: { color: '000000', transparency: 55 }, line: { type: 'none' } });
      cover.addText(p.title || p.scenes[0].heading, { x: 0.5, y: 2.75, w: W - 1, h: 1.2, fontFace: serif, fontSize: 48, bold: true, color: 'FFF8E8', align: 'center' });
      cover.addText(p.scenes.length + '개 장면 · 사관 스튜디오', { x: 0.5, y: 3.9, w: W - 1, h: 0.5, fontFace: sans, fontSize: 16, color: 'EDE3CF', align: 'center' });
      cover.addNotes(p.scenes[0].narration || '');
      // 장면
      p.scenes.forEach(function(s, i){
        if(i === 0 && p.scenes.length > 1) return;
        var sl = pptx.addSlide();
        sl.background = { color: th.bg };
        sl.addImage({ data: HS.sceneStill(s, 1200, 900).toDataURL('image/jpeg', 0.86), x: 0, y: 0, w: 7.2, h: H });
        sl.addText(String(i).padStart(2, '0'), { x: 7.6, y: 0.5, w: 1.2, h: 0.5, fontFace: serif, fontSize: 18, bold: true, color: th.accent });
        sl.addText(s.heading, { x: 7.6, y: 0.95, w: 5.3, h: 1.1, fontFace: serif, fontSize: 30, bold: true, color: th.ink, valign: 'top', fit: 'shrink' });
        var pts = sentences(s.narration).slice(0, 4).map(function(t){ return { text: t, options: { bullet: { code: '25AA' }, paraSpaceAfter: 8 } }; });
        if(pts.length) sl.addText(pts, { x: 7.6, y: 2.2, w: 5.3, h: 4.6, fontFace: sans, fontSize: 16, color: th.ink, valign: 'top', fit: 'shrink', lineSpacingMultiple: 1.2 });
        sl.addNotes((s.narration || '') + (s.visual ? '\n\n[화면] ' + s.visual : ''));
      });
      // 지도
      if(opt.map !== false && p.map.places.length){
        var mc = canvas(1600, 900);
        HS.drawMap(mc.getContext('2d'), 1600, 900, p.map, { style: opt.mapStyle || 'old' });
        var ms = pptx.addSlide();
        ms.addImage({ data: mc.toDataURL('image/jpeg', 0.9), x: 0, y: 0, w: W, h: H });
        ms.addNotes(p.map.routes.map(function(r){ return r.from + ' → ' + r.to + (r.label ? ' : ' + r.label : ''); }).join('\n'));
      }
      return save(pptx, HS.fileName(' 스토리.pptx'));
    });
  };

  var CHALK_HEX = { white: 'F3F1E7', yellow: 'F6E27A', pink: 'F4A6B8', blue: '9FD3F0' };

  HS.exportBoardPptx = function(){
    var p = HS.project;
    if(!p.board.length) return Promise.reject(new Error('판서가 비어 있습니다'));
    var pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.title = (p.title || '판서') + ' 판서';
    var pen = 'Nanum Pen Script';
    var bgc = canvas(1600, 900); HS.drawBoardBg(bgc.getContext('2d'), 1600, 900, 'board', 'pptx');
    var bg = bgc.toDataURL('image/jpeg', 0.85);
    p.board.forEach(function(b){
      var sl = pptx.addSlide();
      sl.background = { data: bg };
      sl.addText(b.title || '', { x: 0.6, y: 0.35, w: 12, h: 1.0, fontFace: pen, fontSize: 48, color: CHALK_HEX.white, underline: { style: 'wavy', color: CHALK_HEX.white } });
      var lines = String(b.text || '').split('\n').filter(function(l){ return l.trim(); });
      var size = lines.length > 9 ? Math.max(20, Math.round(32 * 9 / lines.length)) : 32;
      var maxW = b.drawing ? 7.3 : 12, y = 1.6, lh = size * 1.3 / 72;
      lines.forEach(function(raw){
        var L = HS.parseBoardLine(raw), x = 0.7 + L.indent * 0.55;
        var runs = L.parts.map(function(pt){ return { text: pt.t, options: { color: CHALK_HEX[pt.c] } }; });
        var avail = maxW - (x - 0.7), estW = L.text.length * size * 0.62 / 72 + 0.35;
        var rows = Math.max(1, Math.ceil(estW / avail)), bw = L.box ? Math.min(avail, estW) : avail;
        var o = { x: x, y: y, w: bw, h: lh * rows + 0.12, fontFace: pen, fontSize: size, color: CHALK_HEX[L.color], valign: 'middle', margin: 4 };
        if(L.box) o.line = { color: CHALK_HEX[L.color], width: 1.5 };
        if(!L.indent && !L.box && !/^→/.test(L.text)) o.bullet = { code: '2022' };
        sl.addText(runs, o);
        y += lh * rows + 0.18;
      });
      if(b.drawing){ // 그림 비율을 지켜 오른쪽 칸(4.5×5.4)에 맞춥니다
        var ar = (b.dw || 1) / (b.dh || 1), dw = 4.5, dh = 4.5 / ar;
        if(dh > 5.4){ dh = 5.4; dw = 5.4 * ar; }
        sl.addImage({ data: b.drawing, x: 8.3 + (4.5 - dw) / 2, y: 1.5 + (5.4 - dh) / 2, w: dw, h: dh });
      }
    });
    return save(pptx, HS.fileName(' 판서.pptx'));
  };
})();
