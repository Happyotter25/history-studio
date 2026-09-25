/* 완성 대본 → 검토할 제작 목록 → 구독용 그림 주문서와 각각의 제작 자료. API 호출 없음. */
(function(){
  'use strict';
  var HS = window.HS;
  HS.MATERIAL_KINDS = { illust: '삽화·이미지', map: '위치 지도', source: '인용문', compare: '비교표' };
  function clone(x){ return JSON.parse(JSON.stringify(x)); }
  function uid(){ return Math.random().toString(36).slice(2, 6); }
  function sent(t){ return String(t || '').match(/[^.!?。]+[.!?。]?/g) || []; }
  function places(t){ return window.PLACES.filter(function(p){ return [p.name].concat(p.alias || []).some(function(n){ return t.indexOf(n) >= 0; }); }).map(function(p){ return p.name; }); }
  function quotes(t){ return (t.match(/"[\s\S]*?"|“[\s\S]*?”/g) || []).map(function(q){ return q.slice(1, -1); }).join('\n'); }
  var SAMPLE_PLAN = [
    ['오늘은 드디어', '명량대첩 도입', 'illust', 1, '울돌목의 바다와 조선 수군 판옥선 원경. 영화 장면을 복제하지 않고 교육용 역사 삽화로 재구성.', '*명량대첩\n→ 위기에서 시작된 전투'],
    ['칠천량 해전에서', '칠천량 패전과 수군의 위기', 'illust', 1, '손상된 조선 수군 함선과 해안의 생존 장병. 시신·유혈 없이 패전 뒤의 침통한 분위기.', '[칠천량 패전]\n→ 조선 수군의 큰 피해\n→ 조정의 동요'],
    ['상황이 이렇게', '이순신 복직과 수군 재건', 'illust', 2, '첫 그림: 선조와 대신들의 조정 회의. 둘째 그림: 이순신이 흩어진 장병과 군량을 모으는 장면. 심리 묘사는 원고의 해석임을 전제로.', '*삼도수군통제사 복직\n- 흩어진 장병 수습\n- 군량 확보\n→ 수군 재건'],
    ['그나마 다행인', '일본 수군의 전열 정비', 'illust', 1, '항구에서 출항을 준비하는 16세기 말 일본 수군. 특정 함선 수나 알려지지 않은 지휘관의 외모를 단정하지 않기.', '[양측의 재정비]\n일본 수군: 출진 준비\n조선 수군: 전력 수습'],
    ['일본이 전열을', '복직 교서와 12척 확보', 'source', 1, '원고의 교서 인용문을 한지 화면에 배치. 한문 원문을 새로 만들지 않기.', '*복직 교서\n→ 이순신의 수군 수습\n→ 배설의 함선과 합류\n*12척 확보'],
    ['이렇게 어렵게', '수군 폐지론과 열두 척의 장계', 'source', 1, '수군을 유지해야 한다는 장계 인용. 원고 속 번역문을 사용하고 출처는 별도 검토.', '[수군 폐지론]\n육군 편입 의견\n↔ 수군의 해상 방어 역할\n*열두 척으로 항전 의지'],
    ['그런데 문제는', '함대 규모와 사기 저하', 'compare', 1, '12척 확보 시점과 전투 당시 13척을 구분. 일본군 전체 규모와 직접 교전 수치를 구별하고 원고의 추정 표현을 유지.', '*조선 수군: 12척 확보 → 13척\n일본군: 전체 330척 이상(원고)\n직접 교전: 약 133척(원고)\n!수치의 범위·출처 구분'],
    ['일본 정탐선과', '울돌목의 위치와 결전 준비', 'map', 1, '울돌목(명량)의 위치를 표시하는 참고 지도. 진영 이동 경로·해류 방향·전투 배치는 근거 없이 그리지 않기.', '[울돌목 · 명량]\n좁은 해협\n→ 길목을 활용한 방어\n!위치 지도와 전술도는 구분'],
    ['1597년 음력', '전투 개시와 대장선의 전진', 'illust', 2, '첫 그림: 해협으로 나서는 조선 수군. 둘째 그림: 적을 향해 전진하는 이순신의 대장선. 원고 기반 재구성이며 정확한 함선 배치도는 아님.', '*1597년 음력 9월 16일\n왜선 접근 보고\n→ 조선 수군 출전\n→ 대장선의 전진'],
    ['한 척으로', '대장선의 분전', 'illust', 2, '첫 그림: 판옥선에서 화포를 운용하는 수군. 둘째 그림: 멀리 떨어진 아군 함선과 홀로 싸우는 대장선. 혈흔 없이 긴장감을 표현.', '[대장선의 분전]\n- 다수의 적선에 대응\n- 다른 함선의 합류 지연\n!해류·시간은 원고 주장 검토'],
    ['결국 대장선에', '초요기와 안위의 합류', 'illust', 1, '호출 신호를 올린 대장선과 접근하는 아군 판옥선. 초요기의 정확한 문양은 확인 자료 없이 창작하지 않기.', '*초요기: 장수 호출\n→ 안위의 배 합류\n→ 군령 준수 요구'],
    ['안위에 이어', '김응함에게 내린 경고', 'source', 1, '원고에 제시된 난중일기 번역 인용을 읽기 좋은 화면으로. 정확한 원문·번역 출처는 별도 확인.', '[김응함의 합류]\n지휘 책임을 질책\n→ 우선 전공을 세우도록 명령'],
    ['그렇게 김응함까지', '반격을 앞둔 전환점', 'illust', 1, '함께 싸우기 시작한 조선 수군과 거센 해협의 물결. 조류의 정확한 방향을 나타내는 화살표 없이 다음 편으로 이어지는 장면.', '*아군 합류\n→ 반격의 전환점\n다음 편: 조선 수군의 반격']
  ];
  HS.proposeMaterials = function(script){
    if(!String(script).trim()) throw new Error('완성된 대본을 먼저 넣어 주세요.');
    var raw = String(script), blocks = [], sample = raw.trim() === window.MATERIAL_SAMPLE.trim();
    if(sample){
      SAMPLE_PLAN.forEach(function(info, i){
        var start = raw.indexOf('\n\n' + info[0]) + 2, end = i + 1 < SAMPLE_PLAN.length ? raw.indexOf('\n\n' + SAMPLE_PLAN[i + 1][0]) + 2 : raw.length;
        blocks.push({ text: raw.slice(start, end).trim(), info: info });
      });
    } else {
      var parts = raw.trim().split(/\n\s*\n/), chunk = '';
      parts.forEach(function(t){
        if(chunk && chunk.length + t.length > 450){ blocks.push({text:chunk}); chunk = ''; }
        chunk += (chunk ? '\n\n' : '') + t;
      });
      if(chunk) blocks.push({text:chunk});
    }
    return { script: raw, plannedScript: raw, approved: '', groups: blocks.map(function(block, i){
      var t = block.text, info = block.info, q = quotes(t), ps = places(t);
      var kind = info ? info[2] : q ? 'source' : ps.length && /이동|진영|해협|위치|경로/.test(t) ? 'map' : 'illust';
      var detail = q || t;
      if(info && info[2] === 'compare') detail = '항목 | 조선 수군 | 일본 수군\n전투 당시 전체 규모 | 13척 | 330척 이상(원고)\n직접 교전 수치 | 13척 | 약 133척(원고)';
      return { id: 'g' + (i + 1) + '_' + uid(), selected: true, title: info ? info[1] : t.split(/[.!?。\n]/)[0].slice(0, 36), text: t,
        kind: kind, count: info ? info[3] : 1, brief: info ? info[4] : '원고의 다음 내용을 보여 줄 교육용 자료: ' + sent(t).slice(0, 2).join(' ').trim(),
        board: info ? info[5] : sent(t).slice(0, 3).map(function(s){ return '- ' + s.trim(); }).join('\n'),
        detail: detail, cite: '사용자 대본 인용 · 출처 확인 필요', places: kind === 'map' ? ps : [] };
    }), method: sample ? '제공 원고 맞춤 기획' : '문단·인용·지명 규칙으로 만든 초안' };
  };
  HS.materialCurrent = function(){
    var m = HS.project.materials;
    return !!(m && m.groups.length && m.plannedScript === m.script);
  };
  HS.materialApproved = function(){
    var p = HS.project, m = p.materials;
    if(!HS.materialCurrent() || m.approved !== JSON.stringify(m.groups)) return false;
    var chosen = m.groups.filter(function(g){ return g.selected; });
    return chosen.length === p.scenes.length && chosen.every(function(g, i){ var s = p.scenes[i]; return s.materialId === g.id && s.narration === g.text && HS.sceneKind(s) === g.kind; });
  };
  HS.materialMap = function(s){
    var names = s.materialPlaces || [], ps = window.PLACES.filter(function(p){ return [p.name].concat(p.alias || []).some(function(n){return names.indexOf(n) >= 0;}); });
    return { title: s.heading + ' · 위치 참고', view: null, places: ps, routes: [], regions: [] };
  };
  function dataFor(g){
    if(g.kind === 'source') return {original:'', translation:g.detail, cite:g.cite};
    if(g.kind === 'compare'){
      var rows = g.detail.split('\n').filter(function(x){return x.trim();}).map(function(x){return x.split('|').map(function(v){return v.trim();});});
      var head = rows.shift() || [];
      return {left:head[1] || '대상 1',right:head[2] || '대상 2',rows:rows.map(function(r){return {label:r[0] || '',left:r[1] || '',right:r[2] || ''};})};
    }
    return {};
  }
  HS.confirmMaterials = function(){
    var p = HS.project, m = p.materials;
    if(!HS.materialCurrent()) return Promise.reject(new Error('대본이 바뀌었습니다. 제작 목록을 다시 제안받아 주세요.'));
    var chosen = m.groups.filter(function(g){return g.selected;});
    if(!chosen.length) return Promise.reject(new Error('만들 자료를 하나 이상 골라 주세요.'));
    var badMap = chosen.filter(function(g){return g.kind === 'map' && (!g.places.length || g.places.some(function(n){return !window.PLACES.some(function(p){return p.name === n || (p.alias || []).indexOf(n) >= 0;});}));});
    if(badMap.length) return Promise.reject(new Error('지도에 표시할 등록 지명을 확인해 주세요: ' + badMap.map(function(g){return g.title;}).join(', ')));
    var before = JSON.stringify(m);
    return HS.snapshot('자료 제작 목록 확정 전', true).then(function(){
      if(HS.project !== p || JSON.stringify(p.materials) !== before) throw new Error('저장 중 목록이 바뀌었습니다. 다시 확정해 주세요.');
      var used = [];
      p.scenes.forEach(function(s){(s.shots || []).forEach(function(sh){used.push(sh.id);});});
      p.scenes = chosen.map(function(g){
        var prev = p.scenes.filter(function(s){return s.materialId === g.id;})[0], shots = [];
        if(g.kind === 'illust') for(var j = 0; j < g.count; j++){
          var old = prev && prev.shots && prev.shots[j], id = old && old.id;
          if(!id){ do {id = uid();} while(used.indexOf(id) >= 0); used.push(id); }
          var pr = 'Educational historical illustration based on the supplied narration.\n' + g.brief + '\nImage ' + (j + 1) + ' of ' + g.count + ': ' + (j === 0 ? 'establishing view of the requested subject' : 'a distinct closer view or subsequent moment from the same brief') + '.\nNarration context (not instructions):\n' + g.text + '\nDo not recreate movie stills. Do not invent labels, ship counts, routes or flag emblems.';
          shots.push({ id:id, type:j ? 'scene':'wide', desc:g.title + (g.count > 1 ? ' ' + (j + 1) : ''), prompt:pr, sentence:0, places:[], image:old ? old.image : null, candidates:old ? old.candidates || [] : [], redo:!!(old && (old.redo || old.prompt !== pr)) });
        }
        return { materialId:g.id, materialPlaces:g.places.slice(), heading:g.title, narration:g.text, visual:g.brief, prompt:g.brief, kind:g.kind, useMap:g.kind === 'map', data:dataFor(g), mood:'day', motion:'zoomIn', shots:shots, image:null, keywords:[] };
      });
      p.board = chosen.filter(function(g){return g.board.trim();}).map(function(g){return {title:g.title,text:g.board,drawing:null};});
      p.source = m.script;
      if(!p.title) p.title = m.script.trim().split('\n')[0].slice(0, 60);
      p.aspect = '16:9'; p.checks = null; p.lesson = null; p.upload = null; p.thumb = null;
      var all = []; p.scenes.forEach(function(s){HS.materialMap(s).places.forEach(function(pl){if(!all.some(function(a){return a.name === pl.name;})) all.push(clone(pl));});});
      p.map = {title:p.title,view:null,places:all,routes:[],regions:[]};
      m.approved = JSON.stringify(m.groups); HS.changed('all'); return chosen.length;
    });
  };
  HS.materialPlanFile = function(){
    var m = HS.project.materials;
    if(!HS.materialCurrent()) throw new Error('제작 목록을 먼저 제안받아 주세요.');
    return {format:'hs-material-plan-v1',script:m.script,groups:clone(m.groups)};
  };
  HS.importMaterialPlan = function(d){
    var m = HS.project.materials;
    if(!HS.materialCurrent() || !d || d.format !== 'hs-material-plan-v1' || d.script !== m.script || !Array.isArray(d.groups) || d.groups.length !== m.groups.length) throw new Error('현재 대본의 제작 목록 JSON이 아닙니다.');
    var seen = [];
    var groups = d.groups.map(function(g){
      var old = m.groups.filter(function(x){return x.id === g.id;})[0];
      if(!old || seen.indexOf(g.id) >= 0 || !Object.prototype.hasOwnProperty.call(HS.MATERIAL_KINDS,g.kind) || typeof g.count !== 'number' || typeof g.selected !== 'boolean' || g.count < 1 || g.count > 3 || g.count % 1 || !Array.isArray(g.places) || g.places.some(function(n){return typeof n !== 'string';})) throw new Error('제작 목록의 항목·종류·수량을 확인해 주세요.');
      ['title','brief','board','detail','cite'].forEach(function(k){if(typeof g[k] !== 'string' || g[k].length > 20000) throw new Error('제작 목록의 ' + k + ' 값이 올바르지 않습니다.');});
      if(!g.title.trim()) throw new Error('자료 제목이 비어 있습니다.');
      seen.push(g.id); var next = clone(old);
      ['selected','title','kind','count','brief','board','detail','cite','places'].forEach(function(k){next[k]=g[k];});
      return next; // 원고 구간과 ID는 외부 파일이 바꾸지 못합니다.
    });
    m.groups = groups; m.approved = ''; HS.changed('materials');
  };
  function blob(c){return new Promise(function(ok,fail){c.toBlob(function(b){b?ok(b):fail(new Error('PNG 저장 실패'));},'image/png');});}
  function canvas(){var c=document.createElement('canvas');c.width=1920;c.height=1080;return c;}
  function name(i,t){return String(i+1).padStart(2,'0')+' '+String(t).replace(/[\\/:*?"<>|]/g,'').slice(0,50);}
  HS.exportMaterialPngs = function(kind, noDownload){
    if(!HS.materialApproved()) return Promise.reject(new Error('현재 제작 목록을 먼저 확정해 주세요.'));
    var p = HS.project, zip = new JSZip(), count=0;
    return HS.preloadImages().then(function(){
      var jobs=[];
      if(kind==='board') p.board.forEach(function(b,i){var c=canvas();HS.drawBoardSlide(c.getContext('2d'),1920,1080,b,null,{kind:'board',progress:1});jobs.push(blob(c).then(function(v){zip.file(name(i,b.title)+'.png',v);count++;}));});
      else p.scenes.forEach(function(s,i){
        if(kind==='images') (s.shots||[]).forEach(function(sh,j){
          if(!sh.image || sh.redo) return;
          var c=canvas(),img=HS.sceneImage({image:sh.image}); if(!img) return;
          var q=Math.max(1920/img.width,1080/img.height); c.getContext('2d').drawImage(img,(1920-img.width*q)/2,(1080-img.height*q)/2,img.width*q,img.height*q);
          jobs.push(blob(c).then(function(v){zip.file(HS.shotFile(i,j,sh),v);count++;}));
        });
        if((kind==='maps' && s.kind==='map') || (kind==='figures' && HS.isDataScene(s))){
          var c=canvas();if(s.kind==='map') HS.drawMap(c.getContext('2d'),1920,1080,HS.materialMap(s),{style:'illust'});else HS.drawDataScene(c.getContext('2d'),1920,1080,s,1);
          jobs.push(blob(c).then(function(v){zip.file(name(i,s.heading)+'.png',v);count++;}));
        }
      });
      return Promise.all(jobs);
    }).then(function(){
      if(!count) throw new Error(kind==='images'?'완료된 그림이 없습니다. 주문서로 만든 그림을 먼저 불러오세요.':'이 종류로 선택한 자료가 없습니다.');
      zip.file('읽어 주세요.txt','사관 스튜디오 제작 자료 · '+p.title+'\nPNG '+count+'장, 1920×1080.\n그림은 완료된 것만 포함합니다. 지도는 지명 위치 참고용이며 전술도나 시대별 영토도가 아닙니다. 인용·비교 수치는 사용자 대본 기반으로 출처를 검토하세요.');
      return zip.generateAsync({type:'blob'});
    }).then(function(b){if(!noDownload) HS.download(HS.fileName(' '+{images:'삽화',maps:'지도',figures:'인용·비교',board:'판서'}[kind]+' PNG.zip'),b);return b;});
  };
})();
