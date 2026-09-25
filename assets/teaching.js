/* 채널 표본 분석을 반영한 강의용 자료: 원본/강조/확대, 출처, 화면 배치. */
(function(){
  'use strict';
  var HS=window.HS,W=1920,H=1080;
  HS.TEACHING_KINDS={auto:'기존 제작 자료',photo:'실물·현장 사진',artifact:'유물·사료 사진',illust:'재현 삽화',map:'지도',quote:'사료 인용문',title:'주제 제목 카드'};
  function clone(x){return JSON.parse(JSON.stringify(x));}
  function canvas(){var c=document.createElement('canvas');c.width=W;c.height=H;return c;}
  function clean(t){return String(t||'').replace(/[\\/:*?"<>|]/g,'').slice(0,60);}
  function fit(ctx,text,x,y,w,h,max,color,align){
    var size=max,lines;
    do{ctx.font='500 '+size+'px "Noto Sans KR", sans-serif';lines=HS.wrap(ctx,text,w);if(lines.length*size*1.45<=h)break;size-=2;}while(size>10);
    ctx.fillStyle=color;ctx.textAlign=align||'left';ctx.textBaseline='top';
    lines.forEach(function(line,i){ctx.fillText(line,align==='center'?x+w/2:x,y+i*size*1.45,w);});
  }
  HS.teachingSettings=function(s){
    if(!s.teaching)s.teaching={kind:'auto',image:null,credit:'',url:'',rights:'확인 필요',checked:false,caption:s.heading||'',quote:(s.data&&s.data.translation)||'',marks:[],crop:null,basis:''};
    return s.teaching;
  };
  function kind(s,t){return t.kind==='auto'?(s.kind==='source'?'quote':s.kind==='map'?'map':HS.isDataScene(s)?'data':'illust'):t.kind;}
  function imageFor(s,t,k){
    if(t.image)return t.image;
    if(k==='photo'||k==='artifact')return null;
    var sh=(s.shots||[]).filter(function(sh){return (!t.shotId||sh.id===t.shotId)&&sh.image&&!sh.redo;})[0];
    return sh?sh.image:s.image||null;
  }
  var hashCache=[];
  function hash(str){
    var cached=hashCache.filter(function(x){return x.str===str;})[0];if(cached)return cached.hash;
    var h=2166136261;for(var i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);
    var v=(h>>>0).toString(16)+':'+str.length;hashCache.push({str:str,hash:v});if(hashCache.length>8)hashCache.shift();return v;
  }
  HS.teachingSpec=function(s,mapOverride){
    var t=HS.teachingSettings(s),k=kind(s,t),src=imageFor(s,t,k),map=s.materialPlaces?HS.materialMap(s):(mapOverride||HS.project.map);
    var basis=hash(JSON.stringify({kind:k,image:/^(photo|artifact|illust)$/.test(k)?src:null,text:k==='quote'?(t.quote||(s.data&&s.data.translation)||s.narration):k==='title'?s.heading:'',credit:k==='quote'?(t.credit||(s.data&&s.data.cite)||''):'',data:k==='data'?s.data:null,map:k==='map'?map:null}));
    return {kind:k,image:src,map:clone(map),basis:basis,origin:/^(photo|artifact|illust)$/.test(k)?(t.image?(k==='illust'?'불러온 재현 삽화':'불러온 자료'):'기존 삽화 · 제작 방식 확인 필요'):k==='map'?'위치 참고 지도':k==='quote'?'사용자 인용문':k==='title'?'주제 제목':'사용자 데이터 도표'};
  };
  HS.teachingTitle=function(s){var c=canvas(),x=c.getContext('2d');x.fillStyle='#101010';x.fillRect(0,0,W,H);fit(x,'# '+s.heading,120,390,1680,420,96,'#fff','center');return c;};
  HS.teachingPrepare=function(s,mapOverride){
    var t=HS.teachingSettings(s),spec=HS.teachingSpec(s,mapOverride),c=canvas(),x=c.getContext('2d');x.fillStyle='#101010';x.fillRect(0,0,W,H);
    var ready;
    if(spec.kind==='title'){fit(x,'# '+s.heading,120,390,1680,420,96,'#fff','center');ready=Promise.resolve();}
    else if(spec.kind==='quote'){
      var q=t.quote||(s.data&&s.data.translation)||s.narration;
      if(q.length>2000)return Promise.reject(new Error('인용문은 2,000자 이내로 나누어 넣어 주세요. 원고 전체는 발표자 노트에 보존합니다.'));
      fit(x,q,150,180,1620,660,64,'#fff');fit(x,t.credit||(s.data&&s.data.cite)||'출처 확인 필요',150,900,1620,100,28,'#c9c9c9');ready=Promise.resolve();
    }else if(spec.kind==='map'){
      if(!spec.map.places.length)return Promise.reject(new Error('지도에 표시할 지명이 없습니다. 지도 탭에서 지명을 정해 주세요.'));
      HS.drawMap(x,W,H,spec.map,{style:'illust'});ready=Promise.resolve();
    }else if(spec.kind==='data'){HS.drawDataScene(x,W,H,s,1);ready=Promise.resolve();}
    else{
      if(!spec.image)return Promise.reject(new Error('자료가 아직 없습니다. 사진을 불러오거나 삽화를 먼저 만들어 주세요.'));
      ready=HS.loadImage(spec.image).then(function(im){var scale=Math.min(W/im.width,H/im.height);x.drawImage(im,(W-im.width*scale)/2,(H-im.height*scale)/2,im.width*scale,im.height*scale);});
    }
    return ready.then(function(){return {canvas:c,spec:spec,stale:!!((t.marks.length||t.crop)&&t.basis!==spec.basis)};});
  };
  function point(v,max){return Math.max(0,Math.min(max,Number(v)||0));}
  HS.drawTeachingMarks=function(ctx,marks){
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#ff4136';ctx.lineWidth=10;
    (marks||[]).forEach(function(m){
      var a=point(m.x,1)*W,b=point(m.y,1)*H,c=point(m.x2,1)*W,d=point(m.y2,1)*H,l=Math.min(a,c),top=Math.min(b,d),w=Math.abs(c-a),h=Math.abs(d-b);
      ctx.beginPath();
      if(m.type==='circle')ctx.ellipse(l+w/2,top+h/2,Math.max(1,w/2),Math.max(1,h/2),0,0,Math.PI*2);
      else if(m.type==='box')ctx.rect(l,top,w,h);
      else if(m.type==='highlight'){ctx.fillStyle='rgba(255,221,48,.32)';ctx.fillRect(l,top,w,h);return;}
      else{ctx.moveTo(a,b);ctx.lineTo(c,d);if(m.type==='arrow'){var angle=Math.atan2(d-b,c-a);ctx.moveTo(c-32*Math.cos(angle-.5),d-32*Math.sin(angle-.5));ctx.lineTo(c,d);ctx.lineTo(c-32*Math.cos(angle+.5),d-32*Math.sin(angle+.5));}}
      ctx.stroke();
    });ctx.restore();
  };
  HS.teachingVariant=function(prepared,t,variant){
    var c=canvas(),x=c.getContext('2d'),valid=t.basis===prepared.spec.basis;
    x.fillStyle='#101010';x.fillRect(0,0,W,H);
    if(variant==='zoom'){
      if(!valid||!t.crop)throw new Error('현재 자료에서 확대 영역을 먼저 지정해 주세요.');
      var r=t.crop,sx=Math.min(r.x,r.x2)*W,sy=Math.min(r.y,r.y2)*H,sw=Math.abs(r.x2-r.x)*W,sh=Math.abs(r.y2-r.y)*H;
      if(sw<4||sh<4)throw new Error('확대 영역이 너무 작습니다.');
      var scale=Math.min(W/sw,H/sh);x.drawImage(prepared.canvas,sx,sy,sw,sh,(W-sw*scale)/2,(H-sh*scale)/2,sw*scale,sh*scale);
    }else{x.drawImage(prepared.canvas,0,0);if(variant==='marked'&&valid)HS.drawTeachingMarks(x,t.marks);}
    return c;
  };
  HS.teachingLayout=function(source,s,guide){
    var c=canvas(),x=c.getContext('2d'),t=HS.teachingSettings(s);x.fillStyle='#101010';x.fillRect(0,0,W,H);
    // 약 2/3 자료, 1/3 강사. 자료는 잘리지 않게 비율을 보존합니다.
    var aw=1280,ah=900,q=Math.min(aw/source.width,ah/source.height);x.drawImage(source,(aw-source.width*q)/2,(ah-source.height*q)/2,source.width*q,source.height*q);
    if(guide){x.fillStyle='#263c42';x.fillRect(1300,0,620,900);fit(x,'강사 화면 자리\n(배치 확인용)',1340,340,540,260,44,'#cde2e1','center');}
    fit(x,t.caption||s.heading,80,930,1760,125,44,'#fff','center');
    return c;
  };
  HS.teachingBlob=function(c){return new Promise(function(ok,fail){c.toBlob(function(b){b?ok(b):fail(new Error('PNG 변환 실패'));},'image/png');});};
  HS.teachingCredit=function(s,spec){var t=HS.teachingSettings(s);return {title:s.heading,kind:spec.kind,origin:spec.origin,credit:t.credit||(s.data&&s.data.cite)||'',url:t.url,rights:t.rights,sourceChecked:!!t.checked,caption:t.caption};};
  function snapshot(){
    if(!HS.project.scenes.length)throw new Error('먼저 제작 목록을 확정하거나 대본을 만들어 주세요.');
    if(HS.project.materials&&!HS.materialApproved())throw new Error('변경한 제작 목록을 먼저 확정해 주세요.');
    return HS.project.scenes.filter(function(s){return HS.teachingSettings(s).include!==false;}).map(clone);
  }
  HS.exportTeachingPack=function(noDownload){
    var scenes;try{scenes=snapshot();}catch(e){return Promise.reject(e);}var zip=new JSZip(),manifest=[],count=0,title=HS.project.title,map=clone(HS.project.map);
    return scenes.reduce(function(chain,s,i){return chain.then(function(){
      var t=HS.teachingSettings(s),base=String(i+1).padStart(2,'0')+' '+clean(s.heading),spec=HS.teachingSpec(s,map),record=HS.teachingCredit(s,spec);record.files=[];manifest.push(record);
      // 일반 지도도 작업 시작 시점의 복사본을 사용합니다.
      var work=HS.teachingPrepare(s,map);
      return work.then(function(p){
        if(p.stale)throw new Error('원본이 바뀌어 강조·확대 영역을 다시 확인해야 합니다.');
        var variants=['base'];if(t.intro&&p.spec.kind!=='title')variants.unshift('title');if(t.marks.length)variants.push('marked');if(t.crop)variants.push('zoom');
        return variants.reduce(function(ch,v){return ch.then(function(){var filename=base+'/'+{title:'00 주제',base:'01 원본',marked:'02 강조',zoom:'03 확대'}[v]+'.png';return HS.teachingBlob(v==='title'?HS.teachingTitle(s):HS.teachingVariant(p,t,v)).then(function(b){zip.file(filename,b);record.files.push(filename);count++;});});},Promise.resolve());
      }).catch(function(e){record.skipped=e.message;});
    });},Promise.resolve()).then(function(){
      if(!count)throw new Error('내보낼 자료가 없습니다. 사진·삽화 또는 인용문·제목 카드를 준비해 주세요.');
      zip.file('자료 목록과 출처.json',JSON.stringify({title:title,materials:manifest},null,2));
      zip.file('출처 및 사용 안내.txt',manifest.map(function(r,i){return (i+1)+'. '+r.title+'\n자료: '+r.origin+'\n출처: '+(r.credit||'확인 필요')+'\n주소: '+(r.url||'미기입')+'\n이용 조건: '+r.rights+'\n출처 확인 표시: '+(r.sourceChecked?'사용자가 확인함':'미확인')+(r.skipped?'\n제외: '+r.skipped:'');}).join('\n\n')+'\n\nPNG는 1920×1080입니다. 원본은 비율을 유지한 자료 화면이며, 업로드 파일 그대로의 복사본은 아닙니다. 지도는 위치 참고용, 생성 삽화는 재현입니다. 강사 자리 안내는 자료 PNG에 포함하지 않습니다.');
      return zip.generateAsync({type:'blob'});
    }).then(function(b){if(!noDownload)HS.download(clean(title||'강의 자료')+' 강의 자료 묶음.zip',b);return b;});
  };
  HS.exportTeachingPptx=function(noDownload){
    var scenes;try{scenes=snapshot();}catch(e){return Promise.reject(e);}var pptx=new window.PptxGenJS(),count=0,map=clone(HS.project.map); pptx.layout='LAYOUT_WIDE';pptx.title=HS.project.title||'강의 자료';
    return scenes.reduce(function(chain,s){return chain.then(function(){
      var t=HS.teachingSettings(s);return HS.teachingPrepare(s,map).then(function(p){
        if(p.stale)throw new Error(s.heading+': 원본이 바뀌었습니다. 강조 표시를 다시 확인해 주세요.');
        var vs=['base'];if(t.intro&&p.spec.kind!=='title')vs.unshift('title');if(t.marks.length)vs.push('marked');if(t.crop)vs.push('zoom');
        vs.forEach(function(v){var sl=pptx.addSlide();sl.background={color:'101010'};
          sl.addImage({data:(v==='title'?HS.teachingTitle(s):HS.teachingVariant(p,t,v)).toDataURL('image/png'),x:0,y:.625,w:8.89,h:5});
          sl.addText(t.caption||s.heading,{x:.3,y:6.5,w:12.7,h:.7,color:'FFFFFF',fontSize:22,fit:'shrink',align:'center'});
          var credit=HS.teachingCredit(s,p.spec);sl.addNotes((s.narration||'')+'\n\n[자료 '+v+']\n'+JSON.stringify(credit,null,2)+'\n오른쪽은 강사 화면을 넣을 빈 공간입니다.');count++;
        });
      });
    });},Promise.resolve()).then(function(){if(!count)throw new Error('선택한 자료가 없습니다.');return pptx.write({outputType:'blob'});}).then(function(b){if(!noDownload)HS.download('강의 스토리.pptx',b);return b;});
  };
})();
