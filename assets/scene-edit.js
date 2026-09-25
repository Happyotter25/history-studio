/* 장면 편집: 편집 전 기록을 남기고, 장면 번호를 사용하는 자료도 함께 옮깁니다. */
(function(){
  'use strict';
  var HS = window.HS;
  function clone(x){ return JSON.parse(JSON.stringify(x)); }
  function sentences(text){ return (String(text || '').match(/[^.!?。]+[.!?。]?/g) || []).filter(function(x){ return x.trim(); }); }
  function id(){
    var next;
    do { next = Math.random().toString(36).slice(2, 6); } while(HS.findShot(next));
    return next;
  }
  function pictureShots(s){
    if(s.shots && s.shots.length) return clone(s.shots);
    if(s.image) return [{ id: id(), type: 'scene', desc: s.visual || s.heading, prompt: s.prompt || '', sentence: 0, places: [], image: s.image }];
    return [{ id: id(), type: 'scene', desc: s.visual || s.heading, prompt: s.prompt || '', sentence: 0, places: [], image: HS.sceneStill(s, 1280, 720).toDataURL('image/png') }];
  }
  function remap(p, oldScenes, mapping, changedText){
    if(p.thumb){ var ti = mapping[+p.thumb.scene]; p.thumb.scene = ti == null ? 0 : ti; }
    if(changedText) p.checks = null;
    else if(p.checks) p.checks.items = p.checks.items.filter(function(item){
      var next = mapping[item.scene - 1]; if(next == null) return false; item.scene = next + 1; return true;
    });
    if(p.lesson) p.lesson.quiz.forEach(function(q){
      if(q.scene > 0){ var next = mapping[q.scene - 1]; q.scene = next == null ? 0 : next + 1; }
    });
  }
  HS.editScenes = function(action, index, value, options){
    options = options || {};
    var p = HS.project, old = p.scenes, a = old[index], b = old[index + 1];
    if(HS.sceneEditBusy) return Promise.reject(new Error('앞선 장면 편집을 저장하고 있습니다. 잠시 기다려 주세요.'));
    if(!a) return Promise.reject(new Error('장면을 찾을 수 없습니다.'));
    if(HS.Q && HS.Q.running) return Promise.reject(new Error('그림 생성이 끝난 뒤 장면을 편집해 주세요.'));
    if(['move', 'split', 'merge', 'delete'].indexOf(action) < 0) return Promise.reject(new Error('지원하지 않는 편집입니다.'));
    if(action === 'move' && (value < 0 || value >= old.length || value === index)) return Promise.resolve(index);
    if(action === 'merge' && !b) return Promise.reject(new Error('다음 장면이 없습니다.'));
    var text = a.narration || '', cut = Math.floor(value);
    if(action === 'split' && (!text.slice(0, cut).trim() || !text.slice(cut).trim() || !(cut > 0 && cut < text.length)))
      return Promise.reject(new Error('내레이션에서 나눌 곳을 눌러 커서를 놓으세요. 앞뒤에 글이 있어야 합니다.'));
    if((action === 'split' || action === 'merge') && (a.audio || (action === 'merge' && b.audio)) && !options.resetAudio)
      return Promise.reject(new Error('대본이 바뀌면 해당 장면의 목소리를 다시 녹음해야 합니다.'));
    var before = JSON.stringify(old), label = { move: '순서 바꾸기', split: '나누기', merge: '합치기', delete: '지우기' }[action];
    HS.sceneEditBusy = true;
    return HS.snapshot('장면 ' + label + ' 전', true).then(function(){ return action === 'merge' ? HS.preloadImages() : null; }).then(function(){
      if(HS.project !== p || JSON.stringify(p.scenes) !== before) throw new Error('저장 중 대본이 바뀌었습니다. 다시 눌러 주세요.');
      var mapping = old.map(function(s, i){ return i; }), scenes = old.slice();
      if(action === 'move'){
        scenes.splice(value, 0, scenes.splice(index, 1)[0]);
        mapping = old.map(function(s){ return scenes.indexOf(s); });
      } else if(action === 'delete'){
        scenes.splice(index, 1);
        mapping = old.map(function(s, i){ return i === index ? null : i > index ? i - 1 : i; });
      } else if(action === 'split'){
        var left = clone(a), right = clone(a), front = text.slice(0, cut).trim(), back = text.slice(cut).trim();
        left.narration = front; right.narration = back; right.heading = (a.heading || '장면') + ' (계속)';
        left.audio = right.audio = null; left.audioDur = right.audioDur = 0;
        left.dur = right.dur = null; // 글 길이에 맞게 다시 계산
        left.keywords = (a.keywords || []).filter(function(k){ return front.indexOf(k) >= 0; });
        right.keywords = (a.keywords || []).filter(function(k){ return back.indexOf(k) >= 0; });
        var spans = [], re = /[^.!?。]+[.!?。]?/g, match;
        while((match = re.exec(text))) if(match[0].trim()) spans.push({start: match.index + match[0].search(/\S/), end: re.lastIndex});
        var rightSentence = spans.filter(function(s){ return s.end <= cut; }).length;
        left.shots = []; right.shots = [];
        (a.shots || []).forEach(function(sh){
          var copy = clone(sh), span = spans[sh.sentence || 0];
          if(span && span.start >= cut){ copy.sentence = Math.max(0, (sh.sentence || 0) - rightSentence); right.shots.push(copy); }
          else left.shots.push(copy);
        });
        // 나누는 지점에서 보이던 그림은 뒷 장면 첫 문장에서도 이어집니다. 새 ID로 주문서 충돌을 막습니다.
        if(left.shots.length && (!right.shots.length || right.shots[0].sentence > 0)){
          var carry = clone(left.shots[left.shots.length - 1]); carry.id = id(); carry.sentence = 0; right.shots.unshift(carry);
        }
        scenes.splice(index, 1, left, right);
        mapping = old.map(function(s, i){ return i > index ? i + 1 : i; });
      } else {
        var merged = clone(a), offset = sentences(a.narration).length;
        merged.narration = [a.narration, b.narration].filter(Boolean).join('\n');
        // 마침표 없는 앞 문장도 별개 문장으로 끝내 샷의 문장 번호를 지킵니다.
        if((a.narration || '').trim() && (b.narration || '').trim() && !/[.!?。]$/.test(a.narration.trim()))
          merged.narration = a.narration.trim() + '.\n' + b.narration;
        merged.keywords = (a.keywords || []).concat(b.keywords || []).filter(function(k, i, all){ return all.indexOf(k) === i; });
        merged.audio = null; merged.audioDur = 0; merged.dur = null;
        if(HS.sceneKind(a) === 'illust' && HS.sceneKind(b) === 'illust'){
          merged.shots = pictureShots(a).concat(pictureShots(b).map(function(sh){ sh.sentence = (sh.sentence || 0) + offset; return sh; }));
        }
        scenes.splice(index, 2, merged);
        mapping = old.map(function(s, i){ return i === index + 1 ? index : i > index + 1 ? i - 1 : i; });
      }
      p.scenes = scenes;
      remap(p, old, mapping, action === 'split' || action === 'merge');
      HS.changed('scenes');
      return action === 'move' ? value : Math.min(index, scenes.length - 1);
    }).finally(function(){ HS.sceneEditBusy = false; });
  };
})();
