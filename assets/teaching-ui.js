(function(){
  'use strict';
  var HS=window.HS,$=HS.$,selected=0,prepared=null,revision=0,drag=null,history=[],busy=false,uploadRevision=0;
  var c=$('teaching-canvas'),ctx=c.getContext('2d');
  function scene(){return HS.project.scenes[selected];}
  function status(t,err){$('teaching-status').textContent=t||'';$('teaching-status').classList.toggle('err',!!err);}
  function link(){var t=HS.teachingSettings(scene()),a=$('teaching-source-link');try{var u=new URL(t.url);if(!/^https?:$/.test(u.protocol))throw 0;a.href=u.href;a.hidden=false;}catch(e){a.removeAttribute('href');a.hidden=true;}}
  function locked(){return HS.project.materials&&!HS.materialApproved();}
  function resetImage(){ctx.fillStyle='#17282e';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#c1d5d7';ctx.textAlign='center';ctx.font='36px sans-serif';ctx.fillText('사진·삽화 또는 인용문·제목 카드를 준비해 주세요',960,540);$('teaching-png').disabled=true;}
  function paint(){
    if(!prepared)return;var s=scene();if(!s)return;var t=HS.teachingSettings(s),v=$('teaching-view').value;
    try{var result=HS.teachingVariant(prepared,t,v==='layout'?'marked':v);if(v==='layout')result=HS.teachingLayout(result,s,true);ctx.drawImage(result,0,0);$('teaching-png').disabled=busy||locked()||prepared.stale;
      if(drag){ctx.save();ctx.strokeStyle='#5ce1c1';ctx.lineWidth=5;ctx.setLineDash([18,12]);ctx.strokeRect(drag.x*1920,drag.y*1080,(drag.x2-drag.x)*1920,(drag.y2-drag.y)*1080);ctx.restore();}return true;
    }catch(e){$('teaching-png').disabled=true;ctx.drawImage(prepared.canvas,0,0);status(e.message,true);return false;}
  }
  function draw(){
    var n=++revision,p=HS.project,s=scene();prepared=null;resetImage();if(!s)return;
    var t=HS.teachingSettings(s),spec=HS.teachingSpec(s);$('teaching-checked').checked=HS.teachingReadiness(s).checked;
    $('teaching-origin').textContent=spec.origin+' · '+(HS.teachingReadiness(s).checked?'출처 확인 표시됨':'출처·이용 조건 확인 필요');
    HS.teachingPrepare(s).then(function(r){if(n!==revision||HS.project!==p||scene()!==s)return;prepared=r;var painted=paint();if(r.stale)status('자료가 바뀌었습니다. 이전 강조·확대는 적용하지 않습니다. 표시를 초기화하고 다시 지정해 주세요.',true);else if(locked())status('제작 목록이 바뀌었습니다. 자료 제작에서 확정한 뒤 내보내세요.',true);else if(painted)status('도구를 고르고 화면을 끌거나 아래 숫자 입력으로 표시하세요.');}).catch(function(e){if(n===revision)status(e.message,true);});
  }
  HS.renderTeaching=function(){
    var ss=HS.project.scenes;selected=Math.min(selected,Math.max(0,ss.length-1));prepared=null;drag=null;history=[];
    $('teaching-empty').hidden=!!ss.length;$('teaching-work').hidden=!ss.length;if(!ss.length){revision++;return;}
    $('teaching-scene').innerHTML=ss.map(function(s,i){return '<option value="'+i+'">'+(i+1)+'. '+HS.esc(s.heading)+'</option>';}).join('');$('teaching-scene').value=selected;
    var s=scene(),t=HS.teachingSettings(s);
    if($('teaching-view').value==='zoom'&&(!t.crop||t.basis!==HS.teachingSpec(s).basis))$('teaching-view').value='marked';
    $('teaching-kind').innerHTML=Object.keys(HS.TEACHING_KINDS).map(function(k){return '<option value="'+k+'">'+HS.TEACHING_KINDS[k]+'</option>';}).join('');$('teaching-kind').value=t.kind;
    $('teaching-shot').innerHTML='<option value="">첫 번째 완료된 삽화</option>'+(s.shots||[]).map(function(sh,i){return '<option value="'+HS.esc(sh.id)+'">'+(i+1)+'. '+HS.esc(sh.desc||s.heading)+(sh.redo?' · 다시 제작 필요':sh.image?' · 완료':' · 대기')+'</option>';}).join('');$('teaching-shot').value=t.shotId||'';
    ['credit','url','rights','caption','quote'].forEach(function(k){$('teaching-'+k).value=t[k]||'';});$('teaching-checked').checked=HS.teachingReadiness(s).checked;$('teaching-include').checked=t.include!==false;$('teaching-intro').checked=!!t.intro;
    $('teaching-narration').textContent=s.narration;
    $('teaching-search').href='https://commons.wikimedia.org/w/index.php?title=Special:MediaSearch&type=image&search='+encodeURIComponent(s.heading);
    $('teaching-quote').disabled=!(t.kind==='quote'||(t.kind==='auto'&&s.kind==='source'));$('teaching-quote').parentElement.hidden=$('teaching-quote').disabled;$('teaching-remove').disabled=!t.image;link();report();draw();
  };
  function report(){
    var ss=HS.project.scenes,rows=ss.map(HS.teachingReadiness),included=rows.filter(function(r){return r.included;}),ready=included.filter(function(r){return r.ready;}).length;
    $('teaching-summary').textContent='선택 '+included.length+'구간 · 자료 준비 '+ready+' · 보완 필요 '+(included.length-ready)+' · 출처 미확인 '+included.filter(function(r){return !r.checked;}).length;
    $('teaching-readiness').innerHTML=ss.map(function(s,i){var r=rows[i];return '<button type="button" class="btn" data-scene="'+i+'"'+(i===selected?' aria-current="true"':'')+'>'+HS.esc((i+1)+'. '+s.heading+' · '+(!r.included?'출력 제외':r.reason||'자료 준비됨'))+'</button>';}).join('');
    $('teaching-ppt').disabled=busy||locked()||!included.length||ready!==included.length;
    $('teaching-pack').disabled=busy||locked()||!ready;
  }
  $('teaching-readiness').onclick=function(e){var b=e.target.closest('[data-scene]');if(b){selected=+b.dataset.scene;HS.renderTeaching();}};
  function changed(){HS.changed('teaching');report();}
  function clearCredit(t){t.checked=false;t.checkedBasis='';t.credit='';t.url='';t.rights='확인 필요';}

  $('teaching-scene').onchange=function(){selected=+this.value;HS.renderTeaching();};
  $('teaching-kind').onchange=function(){HS.teachingSettings(scene()).kind=this.value;changed();HS.renderTeaching();};
  $('teaching-shot').onchange=function(){var t=HS.teachingSettings(scene());t.shotId=this.value;if(!t.image)clearCredit(t);changed();HS.renderTeaching();};
  ['credit','url','rights','caption','quote'].forEach(function(k){$('teaching-'+k).oninput=function(){HS.teachingSettings(scene())[k]=this.value;changed();if(k==='url')link();if(k==='quote'||k==='credit')draw();else paint();};});
  ['checked','include','intro'].forEach(function(k){$('teaching-'+k).onchange=function(){var t=HS.teachingSettings(scene());t[k]=this.checked;if(k==='checked')t.checkedBasis=this.checked?HS.teachingSpec(scene()).basis:'';changed();draw();};});
  $('teaching-file').onchange=function(){
    var f=this.files[0];this.value='';if(!f)return;var p=HS.project,s=scene(),t=HS.teachingSettings(s),old=t.image,upload=++uploadRevision;
    if(!/^image\/(png|jpeg|webp)$/.test(f.type)||f.size>20*1024*1024){status('PNG·JPG·WebP 파일을 20MB 이하로 넣어 주세요.',true);return;}
    status('자료를 읽고 있습니다…');
    HS.readFile(f).then(function(u){return HS.shrinkImage(u,2400,'image/png');}).then(function(u){
      if(upload!==uploadRevision||HS.project!==p||scene()!==s||t!==s.teaching||t.image!==old)throw new Error('읽는 동안 구간이 바뀌어 불러오기를 중단했습니다.');
      return HS.replaceTeachingImage(s,u).then(function(){if(HS.project===p&&scene()===s){HS.renderTeaching();HS.toast('사진을 넣었습니다. 이전 자료는 상단 되돌리기에서 복원할 수 있습니다.');}});
    }).catch(function(e){status(e.message,true);});
  };
  $('teaching-remove').onclick=function(){var p=HS.project,s=scene();++uploadRevision;status('이전 자료를 복원 기록에 저장하고 있습니다…');HS.replaceTeachingImage(s,null).then(function(){if(HS.project===p&&scene()===s){HS.renderTeaching();HS.toast('사진을 해제했습니다. 상단 되돌리기에서 복원할 수 있습니다.');}}).catch(function(e){status(e.message,true);});};
  $('teaching-view').onchange=function(){status('');paint();};
  $('teaching-tool').onchange=function(){$('teaching-view').value='marked';status('화면을 끌어 새 표시나 확대 영역을 지정하세요.');paint();};
  function saveHistory(t){history.push({marks:JSON.parse(JSON.stringify(t.marks)),crop:t.crop?JSON.parse(JSON.stringify(t.crop)):null,basis:t.basis});if(history.length>30)history.shift();}
  function add(m){
    if(!prepared)return;var t=HS.teachingSettings(scene());
    if(prepared.stale){status('자료가 바뀌었습니다. 표시 초기화 후 다시 지정해 주세요.',true);return;}
    if(t.marks.length>=150){status('강조 표시는 구간마다 150개까지 넣을 수 있습니다.',true);return;}
    if(Math.abs(m.x2-m.x)<.003&&Math.abs(m.y2-m.y)<.003)return;
    if(m.type==='crop'&&(Math.abs(m.x2-m.x)<.01||Math.abs(m.y2-m.y)<.01)){status('확대 영역의 너비와 높이를 조금 더 크게 지정해 주세요.',true);return;}
    saveHistory(t);t.basis=prepared.spec.basis;if(m.type==='crop')t.crop=m;else t.marks.push(m);changed();status(m.type==='crop'?'확대 영역을 저장했습니다. 확대본을 선택해 확인하세요.':'강조 표시를 저장했습니다.');$('teaching-view').value=m.type==='crop'?'zoom':'marked';paint();
  }
  function pos(e){var r=c.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
  c.onpointerdown=function(e){if(!prepared||!['base','marked'].includes($('teaching-view').value))return;var p=pos(e);drag={type:$('teaching-tool').value,x:p.x,y:p.y,x2:p.x,y2:p.y};c.setPointerCapture(e.pointerId);};
  c.onpointermove=function(e){if(!drag)return;var p=pos(e);drag.x2=p.x;drag.y2=p.y;paint();};
  c.onpointerup=function(e){if(!drag)return;var m=drag,p=pos(e);m.x2=p.x;m.y2=p.y;drag=null;c.releasePointerCapture(e.pointerId);add(m);paint();};
  c.onpointercancel=function(){drag=null;paint();};
  $('teaching-add').onclick=function(){var m={type:$('teaching-tool').value},valid=true;['x','y','x2','y2'].forEach(function(k){var v=+$('teaching-'+k).value;if(!isFinite(v)||v<0||v>100)valid=false;m[k]=v/100;});if(!valid){status('좌표는 0~100 사이의 숫자로 넣어 주세요.',true);return;}add(m);};
  $('teaching-undo').onclick=function(){var t=HS.teachingSettings(scene()),last=history.pop();if(!last){status('되돌릴 표시가 없습니다.');return;}Object.keys(last).forEach(function(k){t[k]=last[k];});changed();draw();};
  $('teaching-clear').onclick=function(){if(!prepared)return;var t=HS.teachingSettings(scene());saveHistory(t);t.marks=[];t.crop=null;t.basis=prepared.spec.basis;prepared.stale=false;changed();$('teaching-view').value='marked';status('표시를 초기화했습니다. 되돌리기로 복원할 수 있습니다.');paint();};
  function job(fn){if(busy)return;busy=true;['teaching-pack','teaching-ppt','teaching-png'].forEach(function(id){$(id).disabled=true;});status('자료를 준비하고 있습니다…');Promise.resolve().then(fn).then(function(){status('파일을 저장했습니다. 묶음의 출처 목록에서 제외된 자료도 확인하세요.');}).catch(function(e){status(e.message,true);}).finally(function(){busy=false;report();paint();});}
  $('teaching-pack').onclick=function(){job(function(){return HS.exportTeachingPack();});};$('teaching-ppt').onclick=function(){job(function(){return HS.exportTeachingPptx();});};
  $('teaching-png').onclick=function(){job(function(){
    if(!prepared||prepared.stale||locked())throw new Error('현재 자료와 제작 목록을 먼저 확인해 주세요.');
    var s=scene(),t=HS.teachingSettings(s),v=$('teaching-view').value,result=HS.teachingVariant(prepared,t,v==='layout'?'marked':v);
    // 강사 공간은 검은 빈 공간으로 내보내며 안내 글자는 제외합니다.
    if(v==='layout')result=HS.teachingLayout(result,s,false);
    var label={base:'원본',marked:'강조',zoom:'확대',layout:'강사 배치'}[v],name=String(selected+1).padStart(2,'0')+' '+String(s.heading||'강의 자료').replace(/[\\/:*?"<>|]/g,'').slice(0,60)+' '+label+'.png';
    return HS.teachingBlob(result).then(function(b){HS.download(name,b);});
  });};
  HS.onChange(function(what){if(what==='all')return;if(['shots','scene','scenes','materials'].includes(what)&&$('tab-teaching').classList.contains('on'))HS.renderTeaching();});
})();
