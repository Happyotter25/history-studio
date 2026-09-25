/* 대본 원문 → 의미 단위 검토 → 장면마다 한 슬라이드 → 사람 검토. */
(function(){
  'use strict';
  var HS=window.HS;
  function copy(x){return JSON.parse(JSON.stringify(x));}
  function id(){return 'slide-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);}
  HS.studioDraft=function(){return HS.project.studio||(HS.project.studio={script:'',analyzedScript:'',method:'',mode:'input',slides:[]});};
  HS.studioUnits=function(script){
    if(typeof script!=='string'||!script.trim()||script.length>12000)throw new Error('대본은 1~12,000자로 넣어 주세요. 긴 대본은 편별로 나누어 주세요.');
    var units=[],start=0,re=/[.!?。]+[”’"']?(?:\s+|$)|\n\s*\n/g,m;
    while((m=re.exec(script))){var end=m.index+m[0].length;if(script.slice(start,end).trim()){units.push({start:start,end:end,text:script.slice(start,end)});start=end;}}
    if(start<script.length){if(script.slice(start).trim())units.push({start:start,end:script.length,text:script.slice(start)});else if(units.length){units[units.length-1].end=script.length;units[units.length-1].text=script.slice(units[units.length-1].start);}}
    if(units.length>500)throw new Error('문장이 너무 많습니다. 대본을 나누어 주세요.');return units;
  };
  function slide(start,end,title,reason,type,content,prompt){return {id:id(),start:start,end:end,title:title,reason:reason,type:type,content:content||'',prompt:prompt||'',image:null,imagePrompt:'',credit:'',reviewed:'',candidates:[]};}
  HS.studioAnalyzeResult=function(script,result){
    var units=HS.studioUnits(script),last=0;
    if(!result||!Array.isArray(result.scenes)||!result.scenes.length||result.scenes.length>80)throw new Error('분석 결과의 장면 목록을 확인할 수 없습니다.');
    var slides=result.scenes.map(function(g){
      if(!Number.isInteger(g.end)||g.end<=last||g.end>units.length||!['text','board','image'].includes(g.type)||typeof g.title!=='string'||!g.title.trim()||g.title.length>100||typeof g.reason!=='string'||g.reason.length>500||typeof g.content!=='string'||g.content.length>1200||typeof g.prompt!=='string'||g.prompt.length>2000)throw new Error('분석 결과의 범위나 형식이 올바르지 않습니다. 원문은 변경하지 않았습니다.');
      var s=slide(units[last].start,units[g.end-1].end,g.title,g.reason,g.type,g.content,g.prompt);last=g.end;return s;
    });
    if(last!==units.length)throw new Error('분석 결과에 빠진 원고가 있습니다. 다시 분석해 주세요.');
    return {script:script,analyzedScript:script,method:'Codex 의미 분석 · 사람 검토 필요',mode:'review',slides:slides};
  };
  HS.studioParagraphPlan=function(script){
    HS.studioUnits(script);var start=0,slides=[],re=/\n\s*\n/g,m;
    function add(end){var text=script.slice(start,end);if(text.trim()){slides.push(slide(start,end,text.trim().split(/[.!?。\n]/)[0].slice(0,60),'문단 경계로 나눈 초안입니다. 한 가지 설명인지 직접 확인하세요.','text','',''));start=end;}}
    while((m=re.exec(script)))add(m.index+m[0].length);add(script.length);
    if(start<script.length&&slides.length)slides[slides.length-1].end=script.length;
    if(slides.length>80)throw new Error('80장면 이하로 대본을 나누어 주세요.');
    return {script:script,analyzedScript:script,method:'문단 기준 초안 · AI 의미 분석 아님',mode:'review',slides:slides};
  };
  HS.studioValidate=function(p){
    if(!p||p.script!==p.analyzedScript||!p.slides.length)throw new Error('바뀐 대본을 다시 분석해 주세요.');
    var end=0;p.slides.forEach(function(s){if(s.start!==end||s.end<=s.start||s.end>p.script.length||!p.script.slice(s.start,s.end).trim())throw new Error('장면 범위에 누락 또는 겹침이 있습니다.');end=s.end;});
    if(end!==p.script.length)throw new Error('장면에 포함되지 않은 원고가 있습니다.');return true;
  };
  HS.studioSplit=function(p,i,offset){
    HS.studioValidate(p);if(p.mode!=='review')throw new Error('장면 구분 검토 모드에서 나누세요.');if(p.slides.length>=80)throw new Error('장면은 80개까지 만들 수 있습니다.');
    var s=p.slides[i],cut=s.start+offset;if(!Number.isInteger(offset)||cut<=s.start||cut>=s.end||!p.script.slice(s.start,cut).trim()||!p.script.slice(cut,s.end).trim()||/[\uD800-\uDBFF]/.test(p.script[cut-1]))throw new Error('원고에서 앞뒤 내용이 남는 위치에 커서를 놓으세요.');
    var a=slide(s.start,cut,s.title,'사람이 나눈 장면','text','',''),b=slide(cut,s.end,s.title+' (계속)','사람이 나눈 장면','text','','');p.slides.splice(i,1,a,b);
  };
  HS.studioMerge=function(p,i){HS.studioValidate(p);if(p.mode!=='review'||!p.slides[i+1])throw new Error('검토 모드에서 다음 장면이 있을 때 합칠 수 있습니다.');var a=p.slides[i],b=p.slides[i+1];p.slides.splice(i,2,slide(a.start,b.end,a.title,'사람이 합친 장면','text','',''));};
  HS.studioFingerprint=function(p,s){var str=JSON.stringify([p.script.slice(s.start,s.end),s.title,s.type,s.content,s.prompt,s.image,s.credit]),h=2166136261;for(var i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);return (h>>>0).toString(16)+':'+str.length;};
  HS.studioReviewed=function(p,s){return !!s.reviewed&&s.reviewed===HS.studioFingerprint(p,s);};
  HS.studioProblem=function(s){if(!s.title.trim())return '슬라이드 제목을 넣으세요.';if(s.type==='image'){if(!s.image)return '이 장면의 이미지를 생성하거나 불러오세요.';if(s.imagePrompt!==s.prompt)return '이미지 제작 지시가 바뀌었습니다. 다시 생성하거나 사진을 불러오세요.';}else if(!s.content.trim())return '슬라이드에 넣을 글이나 판서 내용을 채우세요.';return '';};
  function textBlock(ctx,text,x,y,w,h,size,color){var lines;do{ctx.font='500 '+size+'px "Noto Sans KR",sans-serif';lines=HS.wrap(ctx,text,w);if(lines.length*size*1.5<=h)break;size-=2;}while(size>=24);if(size<24)throw new Error('한 슬라이드에 글이 너무 많습니다. 내용을 줄이거나 장면을 나누세요.');ctx.fillStyle=color;ctx.textBaseline='top';ctx.textAlign='left';lines.forEach(function(line,i){ctx.fillText(line,x,y+i*size*1.5);});}
  HS.studioCanvas=function(p,s){
    var problem=HS.studioProblem(s);if(problem)return Promise.reject(new Error(problem));var c=document.createElement('canvas');c.width=1920;c.height=1080;var x=c.getContext('2d');
    if(s.type==='board')HS.drawBoardBg(x,1920,1080,'board',s.id);else{x.fillStyle='#14242d';x.fillRect(0,0,1920,1080);}
    try{textBlock(x,s.title,110,85,1700,180,66,s.type==='board'?'#f6e27a':'#ffffff');}catch(e){return Promise.reject(e);}
    var work=Promise.resolve();
    if(s.type==='image')work=HS.loadImage(s.image).then(function(im){var q=Math.min(1700/im.width,700/im.height);x.drawImage(im,110+(1700-im.width*q)/2,275+(700-im.height*q)/2,im.width*q,im.height*q);});
    else try{
      if(s.type==='board'){
        var rows=s.content.split('\n').map(HS.parseBoardLine),plain=rows.map(function(r){return r.text;}).join('\n'),size=54,lines;
        do{x.font='500 '+size+'px "Noto Sans KR",sans-serif';lines=rows.map(function(r){return HS.wrap(x,r.text,1640-Math.min(r.indent,4)*40);});if(lines.reduce(function(n,a){return n+a.length;},0)*size*1.5<=680)break;size-=2;}while(size>=24);
        if(size<24)throw new Error('판서가 한 장에 너무 많습니다. 내용을 줄이거나 장면을 나누세요.');
        var y=290;x.textBaseline='top';rows.forEach(function(r,i){x.fillStyle=HS.CHALK[r.color]||'#fff';lines[i].forEach(function(line){x.fillText(line,130+Math.min(r.indent,4)*40,y);y+=size*1.5;});});
      }else textBlock(x,s.content,110,290,1700,680,54,'#ecf3f5');
    }catch(e){return Promise.reject(e);}
    return work.then(function(){if(s.credit)textBlock(x,s.credit,110,1000,1700,45,26,'#bbcbd0');return c;});
  };
  HS.exportStudio=function(format,noDownload){
    var p=copy(HS.studioDraft());try{HS.studioValidate(p);if(p.mode!=='compose'||p.slides.some(function(s){return !HS.studioReviewed(p,s);}))throw new Error('모든 장면을 검토 완료한 뒤 저장해 주세요.');}catch(e){return Promise.reject(e);}
    var zip=new JSZip(),ppt=new window.PptxGenJS();ppt.layout='LAYOUT_WIDE';var report=[];
    return p.slides.reduce(function(chain,s,i){return chain.then(function(){return HS.studioCanvas(p,s).then(function(c){var name=String(i+1).padStart(2,'0')+' '+s.title.replace(/[\\/:*?"<>|]/g,'').slice(0,60)+'.png';report.push({file:name,title:s.title,type:s.type,script:p.script.slice(s.start,s.end),credit:s.credit});if(format==='ppt'){var sl=ppt.addSlide();sl.addImage({data:c.toDataURL(),x:0,y:0,w:13.333333,h:7.5});sl.addNotes(['슬라이드 제목: '+s.title,'표현: '+({text:'글',board:'판서',image:'이미지'}[s.type]||s.type),s.type==='image'?'이미지 설명 / 생성 프롬프트:\n'+s.prompt:'슬라이드 내용:\n'+s.content,'장면 원고:\n'+p.script.slice(s.start,s.end),'출처·제작 메모:\n'+(s.credit||'미기재')].join('\n\n'));}else return HS.teachingBlob(c).then(function(b){zip.file(name,b);});});});},Promise.resolve()).then(function(){if(format==='ppt')return ppt.write({outputType:'blob'});zip.file('장면과 원고.json',JSON.stringify(report,null,2));return zip.generateAsync({type:'blob'});}).then(function(b){if(!noDownload)HS.download(format==='ppt'?'검토 완료 슬라이드.pptx':'검토 완료 슬라이드 PNG.zip',b);return b;});
  };
})();
