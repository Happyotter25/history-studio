/* ⑧ 업로드 준비 — 유튜브에 올릴 때 필요한 것들
 *  - 자막 파일(SRT): 영상 속 자막과 같은 시각표로 만듭니다
 *  - 챕터(타임스탬프): 장면 시작 시각으로 만들고, 유튜브 규칙(0:00 시작, 10초 이상, 3개 이상)에 맞춥니다
 *  - 제목 후보·설명·태그·썸네일 문구·고정 댓글: Claude 가 짓습니다 (키가 없으면 간단한 틀)
 *  - 썸네일: 장면 그림 위에 굵은 글씨를 얹어 1280×720 PNG 로
 */
(function(){
  'use strict';
  var HS = window.HS, $ = HS.$, P = function(){ return HS.project; };

  function pad(n, k){ n = String(n); while(n.length < k) n = '0' + n; return n; }
  function srtTime(t){
    var ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
    return pad(h, 2) + ':' + pad(m, 2) + ':' + pad(s, 2) + ',' + pad(ms % 1000, 3);
  }
  function clock(t){
    t = Math.floor(t);
    var h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
    return (h ? h + ':' + pad(m, 2) : m) + ':' + pad(s, 2);
  }
  HS.srt = function(){
    return HS.subtitleCues().map(function(c, i){
      return (i + 1) + '\n' + srtTime(c.start) + ' --> ' + srtTime(c.end) + '\n' + c.lines.join('\n') + '\n';
    }).join('\n');
  };
  // 유튜브 챕터: 첫 챕터 0:00, 챕터마다 10초 이상. 짧은 장면은 앞 챕터에 합칩니다
  HS.chapters = function(){
    var tl = HS.timeline(), scenes = P().scenes, total = HS.totalDuration(), out = [];
    tl.forEach(function(seg){
      var start = seg.i === 0 ? 0 : seg.start;
      if(out.length && start - out[out.length - 1].start < 10) return;
      if(total - start < 10 && out.length) return;
      out.push({ start: start, title: scenes[seg.i].heading });
    });
    return out;
  };
  HS.chaptersText = function(){ return HS.chapters().map(function(c){ return clock(c.start) + ' ' + c.title; }).join('\n'); };

  /* ── Claude 로 업로드 정보 짓기 ───────────────────────── */
  var SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['titles', 'description', 'tags', 'thumbnail_texts', 'pinned_comment'],
    properties: {
      titles: { type: 'array', items: { type: 'string' } },
      description: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      thumbnail_texts: { type: 'array', items: { type: 'string' } },
      pinned_comment: { type: 'string' }
    }
  };
  HS.generateUploadAI = function(){
    var p = P();
    var sys = [
      '너는 한국 역사 교육 유튜브 채널의 운영자다. 영상 대본을 보고 업로드 정보를 짓는다. 채널 주인은 고등학교 역사 교사다.',
      '- titles: 제목 후보 5개. 40자 안팎, 궁금증을 일으키되 과장·낚시·사실과 다른 표현은 쓰지 않는다. 핵심 검색어(인물·사건 이름)를 앞쪽에.',
      '- description: 설명란 본문. 첫 두 줄에 영상의 핵심(검색 결과에 보이는 부분), 이어서 영상에서 다루는 내용 요약 3~5줄, 참고한 소스 안내 한 줄. 챕터 목록은 넣지 않는다(따로 붙인다). 해시태그 3개를 맨 끝 줄에.',
      '- tags: 검색용 태그 10~15개. 인물·사건·시대·교과 단원·"한국사" 같은 넓은 말을 섞는다.',
      '- thumbnail_texts: 썸네일에 크게 쓸 문구 3개. 각각 12자 이내, 두 줄로 나눌 곳에 "\\n".',
      '- pinned_comment: 고정 댓글. 시청자에게 던지는 질문 하나로 토론을 이끈다.'
    ].join('\n');
    var script = p.scenes.map(function(s, k){ return (k + 1) + '. ' + s.heading + ' — ' + s.narration; }).join('\n');
    return HS.callClaude(sys, [{ role: 'user', content: '영상 제목(가제): ' + (p.title || '') + '\n\n<script>\n' + script + '\n</script>' }], SCHEMA, null, 'medium').then(function(r){
      p.upload = { titles: r.data.titles, description: r.data.description, tags: r.data.tags, thumbTexts: r.data.thumbnail_texts, pinned: r.data.pinned_comment };
      useThumbText(p);
      HS.changed('upload');
      return p.upload;
    });
  };
  // 썸네일 글씨를 아직 손대지 않았으면(비었거나 제목 그대로) 새 문구로 바꿉니다
  function useThumbText(p){
    var t = thumbOpts();
    if(p.upload.thumbTexts[0] && (!t.main || t.main === p.title)) t.main = p.upload.thumbTexts[0];
  }
  // 키가 없을 때의 간단한 틀
  HS.uploadSimple = function(){
    var p = P(), title = p.title || (p.scenes[0] && p.scenes[0].heading) || '역사 이야기';
    var tags = [title, '한국사', '역사', '역사 수업'].concat(p.map.places.slice(0, 6).map(function(x){ return x.name; }));
    p.upload = {
      titles: [title, title + ', 무엇이 달라졌을까?', '10분 만에 정리하는 ' + title],
      description: title + '의 흐름을 정리합니다.\n\n' + p.scenes.slice(1, 4).map(function(s){ return '· ' + s.heading; }).join('\n') + '\n\n#한국사 #역사 #' + title.replace(/\s+/g, ''),
      tags: tags.filter(function(t, i){ return tags.indexOf(t) === i; }),
      thumbTexts: [title],
      pinned: title + '에서 가장 결정적인 순간은 언제였다고 생각하세요?'
    };
    useThumbText(p);
    HS.changed('upload');
    return p.upload;
  };

  /* ── 썸네일 ─────────────────────────────────────────── */
  var THEMES = { yellow: ['#ffe14d', '#111'], red: ['#ff4a3d', '#fff'], white: ['#ffffff', '#111'] };
  HS.drawThumbnail = function(ctx, w, h, t){
    var p = P(), s = p.scenes[t.scene || 0];
    ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, h);
    if(s) ctx.drawImage(HS.sceneStill(s, w, h), 0, 0);
    // 글씨 쪽을 어둡게
    var left = t.layout !== 'right', g = ctx.createLinearGradient(left ? 0 : w, 0, left ? w : 0, 0);
    g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(0.6, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // 내 캐릭터는 글씨 반대쪽에 크게
    var ch = t.character && HS.characterById(t.character), cimg = HS.characterImage(ch);
    if(cimg){
      var chH = h * 0.9, chW = chH * cimg.width / cimg.height;
      if(chW > w * 0.42){ chW = w * 0.42; chH = chW * cimg.height / cimg.width; }
      ctx.drawImage(cimg, left ? w - chW - w * 0.03 : w * 0.03, h - chH, chW, chH);
    }
    var th = THEMES[t.color] || THEMES.yellow, u = w / 1280, x = left ? 60 * u : w - 60 * u;
    var lines = String(t.main || '').split('\n').filter(Boolean).slice(0, 3);
    var size = (lines.length > 2 ? 120 : 150) * u;
    ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.font = Math.round(size) + "px 'Black Han Sans','Noto Sans KR',sans-serif";
    // 너무 길면 줄여 폭 60% 안에 넣습니다
    var widest = Math.max.apply(null, lines.map(function(l){ return ctx.measureText(l).width; }).concat([1]));
    if(widest > w * 0.62){ size *= w * 0.62 / widest; ctx.font = Math.round(size) + "px 'Black Han Sans','Noto Sans KR',sans-serif"; }
    var y = h * 0.5 - (lines.length - 1) * size * 0.55 + size * 0.35;
    lines.forEach(function(l, i){
      var yy = y + i * size * 1.1;
      ctx.lineWidth = size * 0.16; ctx.strokeStyle = '#000'; ctx.strokeText(l, x, yy);
      ctx.fillStyle = i === 0 ? th[0] : '#ffffff'; ctx.fillText(l, x, yy);
    });
    if(t.sub){
      ctx.font = 'bold ' + Math.round(44 * u) + "px 'Noto Sans KR',sans-serif";
      var sy = y + lines.length * size * 1.1 + 10 * u, sw = ctx.measureText(t.sub).width;
      ctx.fillStyle = th[0]; ctx.fillRect(left ? x - 12 * u : x - sw - 12 * u, sy - 44 * u, sw + 24 * u, 60 * u);
      ctx.fillStyle = th[1]; ctx.fillText(t.sub, x, sy);
    }
    ctx.textAlign = 'left';
  };

  /* ── 화면 ──────────────────────────────────────────── */
  function copy(text, what){ navigator.clipboard && navigator.clipboard.writeText(text); HS.toast(what + ' 복사했습니다'); }
  function status(msg, err){ var el = $('up-status'); el.textContent = msg || ''; el.classList.toggle('err', !!err); }
  function thumbOpts(){ var p = P(); p.thumb = p.thumb || { scene: 0, main: '', sub: '', color: 'yellow', layout: 'left' }; return p.thumb; }
  function drawThumb(){
    var c = $('thumb-canvas');
    HS.preloadImages().then(function(){ HS.drawThumbnail(c.getContext('2d'), c.width, c.height, thumbOpts()); });
  }
  HS.renderUpload = function(){
    var p = P(), u = p.upload, t = thumbOpts();
    var ch = HS.chapters();
    $('up-chapters').value = HS.chaptersText();
    $('up-chapter-note').textContent = !p.scenes.length ? '대본이 없습니다.' : ch.length < 3
      ? '유튜브 챕터는 3개 이상이어야 표시됩니다. 장면이 짧으면 앞 챕터에 합쳐집니다.' : '챕터 ' + ch.length + '개 · 영상 약 ' + Math.round(HS.totalDuration()) + '초 (목소리를 넣으면 시각이 바뀝니다)';
    $('up-info').innerHTML = u ? [
      '<b>제목 후보</b>' + u.titles.map(function(x){ return '<div class="row"><span style="flex:1">' + HS.esc(x) + '</span><button class="btn" data-copy="' + HS.esc(x) + '">복사</button></div>'; }).join(''),
      '<b>설명 (챕터 포함)</b><textarea id="up-desc" style="min-height:220px">' + HS.esc(u.description + '\n\n' + HS.chaptersText()) + '</textarea><button class="btn" data-copy-el="up-desc">설명 복사</button>',
      '<b>태그</b><textarea id="up-tags" style="min-height:60px">' + HS.esc(u.tags.join(', ')) + '</textarea><button class="btn" data-copy-el="up-tags">태그 복사</button>',
      '<b>고정 댓글</b><textarea id="up-pinned" style="min-height:60px">' + HS.esc(u.pinned) + '</textarea>'
    ].join('<div style="height:10px"></div>') : '<p class="small">아직 없습니다. 위 버튼을 누르세요.</p>';
    $('thumb-scene').innerHTML = p.scenes.map(function(s, i){ return '<option value="' + i + '"' + (i === +t.scene ? ' selected' : '') + '>' + (i + 1) + '. ' + HS.esc(s.heading) + '</option>'; }).join('');
    if(!t.main) t.main = (u && u.thumbTexts[0]) || p.title || '';
    $('thumb-main').value = t.main; $('thumb-sub').value = t.sub || '';
    $('thumb-color').value = t.color; $('thumb-layout').value = t.layout;
    $('thumb-character').innerHTML = '<option value="">없음</option>' + (p.characters || []).map(function(c){ return '<option value="' + c.id + '"' + (t.character === c.id ? ' selected' : '') + '>' + HS.esc(c.name) + '</option>'; }).join('');
    $('thumb-suggest').innerHTML = u && u.thumbTexts ? u.thumbTexts.map(function(x){ return '<button class="btn" data-thumb="' + HS.esc(x) + '">' + HS.esc(x.replace(/\n/g, ' / ')) + '</button>'; }).join(' ') : '';
    drawThumb();
  };
  $('up-srt').addEventListener('click', function(){
    if(!P().scenes.length) return;
    HS.download(HS.fileName(' 자막.srt'), new Blob([HS.srt()], { type: 'application/x-subrip;charset=utf-8' }));
  });
  $('up-copy-chapters').addEventListener('click', function(){ copy($('up-chapters').value, '챕터를'); });
  $('up-generate').addEventListener('click', function(){
    var btn = this;
    if(!P().scenes.length){ status('대본이 없습니다', true); return; }
    if(!HS.CFG.key){ HS.uploadSimple(); status('API 키가 없어 간단한 틀로 만들었습니다'); HS.renderUpload(); return; }
    btn.disabled = true; status('Claude가 짓는 중…');
    HS.generateUploadAI().then(function(){ status('만들었습니다 (약 ' + (HS.cost.last || 0) + '원)'); HS.renderUpload(); })
      .catch(function(e){ status(HS.whyFail(e), true); }).then(function(){ btn.disabled = false; });
  });
  $('up-info').addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    if(b.dataset.copy) copy(b.dataset.copy, '제목을');
    if(b.dataset.copyEl) copy($(b.dataset.copyEl).value, '');
  });
  $('up-info').addEventListener('input', function(e){
    var u = P().upload; if(!u) return;
    if(e.target.id === 'up-tags') u.tags = e.target.value.split(',').map(function(x){ return x.trim(); }).filter(Boolean);
    if(e.target.id === 'up-pinned') u.pinned = e.target.value;
    if(e.target.id === 'up-desc') u.description = e.target.value.replace('\n\n' + HS.chaptersText(), '');
    HS.changed('upload');
  });
  ['thumb-scene', 'thumb-main', 'thumb-sub', 'thumb-color', 'thumb-layout', 'thumb-character'].forEach(function(id){
    $(id).addEventListener('input', function(){
      var t = thumbOpts(), k = id.slice(6);
      t[k] = k === 'scene' ? +this.value : this.value;
      HS.changed('thumb'); drawThumb();
    });
  });
  $('thumb-suggest').addEventListener('click', function(e){
    var b = e.target.closest('button[data-thumb]'); if(!b) return;
    thumbOpts().main = b.dataset.thumb; $('thumb-main').value = b.dataset.thumb; HS.changed('thumb'); drawThumb();
  });
  $('thumb-png').addEventListener('click', function(){
    var c = $('thumb-canvas');
    HS.preloadImages().then(function(){
      HS.drawThumbnail(c.getContext('2d'), c.width, c.height, thumbOpts());
      c.toBlob(function(b){ HS.download(HS.fileName(' 썸네일.png'), b); });
    });
  });
})();
