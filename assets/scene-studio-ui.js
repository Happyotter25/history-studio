(function(){
  'use strict';
  var HS=window.HS,$=HS.$,selected=0,lastProject=null,busy=false,jobId='',cancelled=false,token='',previewRevision=0,promptProposal=null;
  function plan(){return HS.studioDraft();}function current(){return plan().slides[selected];}
  function message(s,error){$('studio-status').textContent=s;$('studio-status').classList.toggle('err',!!error);}
  function save(){HS.changed('studio');}
  function safe(fn){Promise.resolve().then(fn).catch(function(e){message(e.message,true);});}
  function draw(){
    var n=++previewRevision,p=plan(),s=current(),c=$('studio-canvas'),x=c.getContext('2d');x.fillStyle='#14242d';x.fillRect(0,0,1920,1080);
    if(!s)return;
    HS.studioCanvas(p,s).then(function(result){if(n!==previewRevision||plan()!==p||current()!==s)return;x.drawImage(result,0,0);$('studio-preview-note').textContent=HS.studioReviewed(p,s)?'검토 완료 · 이 화면이 한 장의 슬라이드로 저장됩니다.':'미리보기를 확인하고 검토 완료를 눌러 주세요.';}).catch(function(e){if(n!==previewRevision)return;x.fillStyle='#d7e5e9';x.font='36px sans-serif';x.textAlign='center';x.fillText('장면 내용을 채우면 슬라이드가 나타납니다.',960,540);$('studio-preview-note').textContent=e.message;});
  }
  function overview(){
    var p=plan(),done=p.slides.filter(function(s){return HS.studioReviewed(p,s);}).length;
    $('studio-progress').textContent=p.mode==='input'?'1. 대본 분석':p.mode==='review'?'2. 장면 구분 검토 · '+p.slides.length+'장면':'3. 장면 만들기 · 검토 완료 '+done+' / '+p.slides.length;
    $('studio-png-all').disabled=busy||p.mode!=='compose'||done!==p.slides.length||!done;$('studio-ppt-all').disabled=$('studio-png-all').disabled;
    $('studio-outline').innerHTML=p.slides.map(function(s,i){return '<button type="button" class="btn" data-studio-scene="'+i+'"'+(selected===i?' aria-current="true"':'')+'>'+(s.image?'<img src="'+HS.esc(s.image)+'" alt="장면 미리보기" loading="lazy">':'')+'<b>'+String(i+1).padStart(2,'0')+'. '+HS.esc(s.title)+'</b><small>'+({text:'글',board:'판서',image:'이미지'}[s.type])+' · '+(HS.studioReviewed(p,s)?'검토 완료':HS.studioProblem(s)?'내용 필요':'검토 대기')+'</small></button>';}).join('');
    if(current())$('studio-review-state').textContent=HS.studioReviewed(p,current())?'✓ 검토 완료':'○ 검토 대기 · 내용을 수정하면 다시 검토해야 합니다.';
  }
  HS.renderSceneStudio=function(){
    if(lastProject!==HS.project){selected=0;lastProject=HS.project;}var p=plan();selected=Math.max(0,Math.min(selected,p.slides.length-1));
    $('studio-fields').disabled=busy;$('studio-cancel').hidden=!busy||!jobId;$('studio-input').hidden=p.mode!=='input';$('studio-work').hidden=p.mode==='input';
    $('studio-script').value=p.script;$('studio-method').textContent=p.method;$('studio-return').hidden=!p.slides.length||p.script!==p.analyzedScript;
    $('studio-boundaries').hidden=p.mode!=='review';$('studio-editor').hidden=p.mode!=='compose';$('studio-confirm-plan').hidden=p.mode!=='review';$('studio-reopen-plan').hidden=p.mode!=='compose';
    renderBatch();renderPromptProposal();overview();if(!p.slides.length){previewRevision++;return;}var s=current();
    $('studio-source').open=p.mode==='review';$('studio-original').value=p.script.slice(s.start,s.end);$('studio-reason').textContent=s.reason;
    $('studio-scene-title').value=s.title;$('studio-type').value=s.type;$('studio-content').value=s.content;$('studio-prompt').value=s.prompt;$('studio-credit').value=s.credit;
    $('studio-content-label').hidden=s.type==='image';$('studio-image-editor').hidden=s.type!=='image';$('studio-content-help').textContent=s.type==='board'?'줄마다 판서 항목을 쓰세요. *핵심어는 노란색, !주의는 분홍색, -는 들여쓰기입니다.':'슬라이드에 보여 줄 핵심 문장을 직접 다듬어 주세요. 원고 전체는 발표자 노트에 보존됩니다.';
    $('studio-prev').disabled=selected===0;$('studio-next').disabled=selected===p.slides.length-1;$('studio-merge').disabled=selected===p.slides.length-1;
    $('studio-candidates').innerHTML=(s.candidates||[]).map(function(im,i){return '<button type="button" class="btn" data-studio-candidate="'+i+'"><img src="'+HS.esc(im.image)+'" alt="이전 그림 '+(i+1)+'">이 그림으로 복원</button>';}).join('');draw();
  };
  async function protectedChange(label,fn){var project=HS.project,p=plan(),before=JSON.stringify(p);await HS.snapshot(label,true);if(HS.project!==project||plan()!==p||JSON.stringify(p)!==before)throw new Error('저장 중 프로젝트나 내용이 바뀌었습니다. 다시 시도해 주세요.');fn();save();HS.renderSceneStudio();}
  async function api(url,method,data){var r=await fetch(url,{method:method||'GET',headers:{'X-Studio-Token':token,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),v=await r.json();if(!r.ok)throw new Error(v.error||'연결 실패');return v;}
  async function runCodex(kind,prompt){
    if(location.protocol==='file:')throw new Error('Codex 분석·생성은 로컬 실행 앱에서 가능합니다. 사관 스튜디오 실행.command로 열어 주세요.');
    var session=await fetch('/api/session');if(!session.ok)throw new Error('앱 실행 프로그램을 다시 시작해 주세요.');token=(await session.json()).token;
    var st=await api('/api/status');if(!st.ready)throw new Error(st.message||'Codex 로그인 상태를 확인해 주세요.');if(cancelled)throw new Error('작업을 중단했습니다.');
    var job=await api('/api/jobs','POST',{kind:kind,prompt:prompt});jobId=job.id;$('studio-cancel').hidden=false;
    if(cancelled)await api('/api/jobs/'+jobId,'DELETE');
    while(true){var result=await api('/api/jobs/'+jobId);message(result.message);if(result.state==='done')return result;if(result.state!=='running')throw new Error(result.message);await new Promise(function(r){setTimeout(r,1200);});}
  }
  async function job(fn){if(busy)return;busy=true;cancelled=false;HS.renderSceneStudio();message('작업을 준비하고 있습니다…');try{await fn();}catch(e){message(e.message,true);}finally{busy=false;jobId='';$('studio-cancel').hidden=true;HS.renderSceneStudio();}}
  $('studio-script').oninput=function(){plan().script=this.value;save();$('studio-return').hidden=plan().script!==plan().analyzedScript;};
  $('studio-import-script').onclick=function(){safe(async function(){var text=(HS.project.materials&&HS.project.materials.script)||HS.project.source;if(!text)throw new Error('기존 대본이 없습니다. 직접 붙여 넣어 주세요.');if(plan().script.trim()&&!confirm('현재 입력칸을 기존 프로젝트 대본으로 바꿀까요?'))return;await protectedChange('대본 불러오기 전',function(){plan().script=text;});});};
  $('studio-sample').onclick=function(){safe(async function(){if(plan().script.trim()&&!confirm('입력칸을 명량대첩 예시로 바꿀까요?'))return;await protectedChange('예시 대본 입력 전',function(){plan().script=window.MATERIAL_SAMPLE;});});};
  function analyze(ai){job(async function(){var project=HS.project,p=plan(),script=p.script,units=HS.studioUnits(script),before=JSON.stringify(p);await HS.snapshot('대본 장면 분석 전',true);
    var result=ai?HS.studioAnalyzeResult(script,(await runCodex('analysis',JSON.stringify({units:units.map(function(u){return u.text;})}))).plan):HS.studioParagraphPlan(script);
    if(cancelled||HS.project!==project||plan()!==p||JSON.stringify(p)!==before)throw new Error('분석 중 대본이나 프로젝트가 바뀌어 적용하지 않았습니다.');HS.project.studio=result;selected=0;save();message('장면을 제안했습니다. 원고 경계와 설명 단위를 검토한 뒤 장면 만들기로 전환하세요.');});}
  $('studio-analyze').onclick=function(){analyze(true);};$('studio-paragraph').onclick=function(){analyze(false);};
  $('studio-cancel').onclick=function(){cancelled=true;message('중단을 요청했습니다…');if(jobId)api('/api/jobs/'+jobId,'DELETE').catch(function(e){message(e.message,true);});};
  $('studio-outline').onclick=function(e){var b=e.target.closest('[data-studio-scene]');if(b){selected=+b.dataset.studioScene;HS.renderSceneStudio();}};
  $('studio-prev').onclick=function(){selected--;HS.renderSceneStudio();};$('studio-next').onclick=function(){selected++;HS.renderSceneStudio();};
  $('studio-split').onclick=function(){var cut=$('studio-original').selectionStart;safe(function(){return protectedChange('장면 나누기 전',function(){HS.studioSplit(plan(),selected,cut);});});};
  $('studio-merge').onclick=function(){safe(function(){return protectedChange('장면 합치기 전',function(){HS.studioMerge(plan(),selected);});});};
  $('studio-confirm-plan').onclick=function(){safe(function(){return protectedChange('장면 만들기 전환 전',function(){HS.studioValidate(plan());plan().mode='compose';});});};
  $('studio-reopen-plan').onclick=function(){safe(function(){return protectedChange('장면 구분 재검토 전',function(){plan().mode='review';});});};
  $('studio-edit-script').onclick=function(){safe(function(){return protectedChange('대본 다시 입력 전',function(){plan().backMode=plan().mode;plan().mode='input';});});};
  $('studio-return').onclick=function(){if(plan().slides.length&&plan().script===plan().analyzedScript){plan().mode=plan().backMode||'review';save();HS.renderSceneStudio();}};
  ['scene-title','content','prompt','credit'].forEach(function(k){$('studio-'+k).oninput=function(){var s=current();s[k==='scene-title'?'title':k]=this.value;s.reviewed='';save();renderPromptProposal();overview();draw();};});
  $('studio-type').onchange=function(){current().type=this.value;current().reviewed='';save();HS.renderSceneStudio();};
  function attach(s,image){if(s.image){s.candidates=s.candidates||[];s.candidates.unshift({image:s.image,prompt:s.imagePrompt});s.candidates=s.candidates.slice(0,3);}s.image=image;s.imagePrompt=s.prompt;s.reviewed='';}
  function renderPromptProposal(){
    var a=promptProposal,valid=a&&a.project===HS.project&&a.plan===plan()&&a.scene===current()&&a.before===JSON.stringify(current());
    $('studio-prompt-proposal').hidden=!valid;if(valid)$('studio-proposed-prompt').value=a.text;
  }
  function imageReady(s){return s.type==='image'&&!!s.image&&s.imagePrompt===s.prompt;}
  function renderBatch(){
    var p=plan(),ready=p.slides.filter(imageReady).length,errors=p.slides.filter(function(s){return s.production&&s.production.state==='error';}).length;
    $('studio-batch').hidden=p.mode!=='compose';$('studio-batch-style').value=p.imageStyle||'';
    $('studio-batch-summary').textContent='이미지 준비 '+ready+' / '+p.slides.length+' · 프롬프트 '+p.slides.filter(function(s){return !!s.prompt.trim();}).length+' · 실패 '+errors+' · 검토 완료 '+p.slides.filter(function(s){return HS.studioReviewed(p,s);}).length;
    $('studio-batch-progress').max=p.slides.length||1;$('studio-batch-progress').value=ready;
    $('studio-batch-log').innerHTML=p.slides.map(function(s){return '<li>'+HS.esc(s.title)+' — '+HS.esc(s.production?(!busy&&['prompt','image'].includes(s.production.state)?'이전 작업 중단 · 미완성 채우기로 이어가세요':s.production.message):imageReady(s)?'이미지 준비 완료':'대기')+'</li>';}).join('');
  }
  $('studio-batch-style').oninput=function(){plan().imageStyle=this.value;save();};
  $('studio-next-review').onclick=function(){var p=plan(),i=p.slides.findIndex(function(s,i){return i>selected&&!HS.studioReviewed(p,s);});if(i<0)i=p.slides.findIndex(function(s){return !HS.studioReviewed(p,s);});if(i>=0){selected=i;HS.renderSceneStudio();$('studio-editor').scrollIntoView({block:'start',behavior:'smooth'});}else message('모든 장면의 검토가 끝났습니다.');};
  function batch(withImages){job(async function(){
    var project=HS.project,p=plan(),scope=$('studio-batch-scope').value;HS.studioValidate(p);
    if(p.mode!=='compose')throw new Error('장면 구분을 확정한 뒤 시작하세요.');
    var targets=p.slides.filter(function(s){return scope==='failed'?s.production&&s.production.state==='error':scope==='all'||(withImages?!imageReady(s):!s.prompt.trim());});
    if(!targets.length){message('선택한 범위에 작업할 장면이 없습니다.');return;}
    var expected=JSON.stringify(p);
    function valid(){return HS.project===project&&plan()===p&&JSON.stringify(p)===expected;}
    function guard(){if(cancelled)throw new Error('작업을 중단했습니다. 완성된 장면은 보존됩니다.');if(!valid())throw new Error('프로젝트나 장면이 바뀌어 전체 제작을 중단했습니다.');}
    function commit(){save();expected=JSON.stringify(p);HS.renderSceneStudio();}
    await HS.snapshot('전체 장면 자동 제작 전',true);guard();promptProposal=null;
    var done=0,failed=0;
    for(var i=0;i<targets.length;i++){
      guard();var scene=targets[i];selected=p.slides.indexOf(scene);
      try{
        // 재시도는 이미 저장된 프롬프트를 재사용합니다. 전체 다시 만들기는 새로 작성합니다.
        if(scope==='all'||!scene.prompt.trim()){
          scene.production={state:'prompt',message:'프롬프트 작성 중'};commit();
          var draft=await runCodex('prompt',JSON.stringify({title:scene.title,narration:p.script.slice(scene.start,scene.end),purpose:scene.reason,existingPrompt:[scene.prompt,p.imageStyle||''].filter(Boolean).join('\n')}));guard();
          if(typeof draft.generatedPrompt!=='string'||!draft.generatedPrompt.trim()||draft.generatedPrompt.length>2000)throw new Error('유효한 프롬프트를 받지 못했습니다.');
          scene.prompt=draft.generatedPrompt;scene.reviewed='';
        }
        scene.type='image';scene.reviewed='';scene.production={state:'ready',message:'프롬프트 준비 완료'};commit();
        if(withImages){
          scene.production={state:'image',message:'이미지 생성 중 · '+(i+1)+' / '+targets.length};commit();
          var result=await runCodex('image','Educational historical illustration for exactly one slide. No text or labels. Do not invent historical details as facts.\n'+JSON.stringify({scene:scene.title,narration:p.script.slice(scene.start,scene.end),visualDescription:scene.prompt,style:p.imageStyle||''}));guard();
          await HS.loadImage(result.image);guard();attach(scene,result.image);scene.credit='AI 재현 삽화 · 역사적 세부 확인 필요';
          scene.production={state:'done',message:'이미지 완성 · 사람 검토 대기'};commit();
        }
        done++;
      }catch(e){
        if(!valid())throw e;
        scene.production={state:cancelled?'paused':'error',message:cancelled?'중단됨 · 미완성 채우기로 이어서 제작':e.message};commit();
        if(cancelled)throw e;failed++;
      }
      jobId='';message('전체 제작 '+(i+1)+' / '+targets.length+' · 완료 '+done+' · 실패 '+failed);
    }
    message((withImages?'전체 이미지 제작':'전체 프롬프트 작성')+' 종료 · 완료 '+done+' · 실패 '+failed+'. 장면별 결과를 검토하세요.');
  });}
  $('studio-batch-images').onclick=function(){batch(true);};$('studio-batch-prompts').onclick=function(){batch(false);};
  $('studio-auto-prompt').onclick=function(){job(async function(){
    var project=HS.project,p=plan(),s=current(),before=JSON.stringify(s);HS.studioValidate(p);if(p.mode!=='compose'||s.type!=='image')throw new Error('장면 만들기에서 이미지 표현을 선택해 주세요.');promptProposal=null;
    var result=await runCodex('prompt',JSON.stringify({title:s.title,narration:p.script.slice(s.start,s.end),purpose:s.reason,existingPrompt:s.prompt}));
    if(cancelled||HS.project!==project||plan()!==p||current()!==s||JSON.stringify(s)!==before)throw new Error('작성 중 프로젝트나 장면이 바뀌어 제안을 적용하지 않았습니다.');
    if(typeof result.generatedPrompt!=='string'||!result.generatedPrompt.trim()||result.generatedPrompt.length>2000)throw new Error('올바른 프롬프트를 받지 못했습니다. 앱 실행 프로그램을 다시 시작하고 시도해 주세요.');
    promptProposal={project:project,plan:p,scene:s,before:before,text:result.generatedPrompt};message('프롬프트 제안을 확인하고 적용하세요. 기존 내용은 아직 바꾸지 않았습니다.');
  });};
  $('studio-apply-prompt').onclick=function(){safe(async function(){var a=promptProposal;if(!a||a.project!==HS.project||a.plan!==plan()||a.scene!==current()||a.before!==JSON.stringify(current()))throw new Error('장면 내용이 바뀌었습니다. 프롬프트를 다시 작성해 주세요.');await protectedChange('이미지 프롬프트 적용 전',function(){a.scene.prompt=a.text;a.scene.reviewed='';promptProposal=null;});message('프롬프트를 적용했습니다. 내용을 다듬은 뒤 이 장면만 생성하세요.');});};
  $('studio-discard-prompt').onclick=function(){promptProposal=null;renderPromptProposal();};
  $('studio-generate').onclick=function(){job(async function(){var project=HS.project,p=plan(),s=current(),before=JSON.stringify(s);HS.studioValidate(p);if(p.mode!=='compose')throw new Error('장면 구분을 먼저 확정해 주세요.');if(!s.prompt.trim())throw new Error('이미지 제작 지시를 넣어 주세요.');await HS.snapshot('장면 이미지 생성 전',true);
    var result=await runCodex('image','Educational historical illustration for exactly one slide. No text or labels. Do not invent historical details as facts.\n'+JSON.stringify({scene:s.title,narration:p.script.slice(s.start,s.end),visualDescription:s.prompt}));await HS.loadImage(result.image);
    $('studio-result-link').href=result.image;$('studio-result-link').hidden=false;
    if(cancelled||HS.project!==project||plan()!==p||JSON.stringify(s)!==before)throw new Error('제작 중 프로젝트나 장면이 바뀌었습니다. 완성 그림은 별도 PNG 링크로 저장하세요.');attach(s,result.image);s.credit='AI 재현 삽화 · 역사적 세부 확인 필요';save();message('이 장면의 그림을 만들었습니다. 역사적 표현을 확인한 뒤 검토 완료를 누르세요.');});};
  $('studio-image-file').onchange=function(){var f=this.files[0];this.value='';if(!f)return;job(async function(){if(!/^image\/(png|jpeg|webp)$/.test(f.type)||f.size>20*1024*1024)throw new Error('PNG·JPG·WebP 파일을 20MB 이하로 넣어 주세요.');var project=HS.project,p=plan(),s=current(),before=JSON.stringify(s);var image=await HS.shrinkImage(await HS.readFile(f),2400,'image/png');if(HS.project!==project||plan()!==p||JSON.stringify(s)!==before)throw new Error('불러오는 동안 장면이 바뀌었습니다.');await protectedChange('장면 사진 변경 전',function(){attach(s,image);s.credit='';});message('사진을 넣었습니다. 출처를 기록하고 검토해 주세요.');});};
  $('studio-candidates').onclick=function(e){var b=e.target.closest('[data-studio-candidate]');if(!b)return;safe(function(){return protectedChange('장면 이전 그림 복원 전',function(){var s=current(),old=s.candidates[+b.dataset.studioCandidate];s.prompt=old.prompt;attach(s,old.image);s.credit='출처 다시 확인 필요';});});};
  $('studio-review-done').onclick=function(){job(async function(){var p=plan(),s=current(),before=HS.studioFingerprint(p,s);await HS.studioCanvas(p,s);if(plan()!==p||current()!==s||HS.studioFingerprint(p,s)!==before)throw new Error('검토 중 자료가 바뀌었습니다.');s.reviewed=before;save();var next=p.slides.findIndex(function(item,i){return i>selected&&!HS.studioReviewed(p,item);});if(next<0)next=p.slides.findIndex(function(item){return !HS.studioReviewed(p,item);});if(next>=0)selected=next;message(next>=0?'검토 완료로 표시하고 다음 미검토 장면으로 이동했습니다.':'모든 장면 검토가 끝났습니다. 슬라이드를 저장하세요.');});};
  $('studio-png-one').onclick=function(){job(async function(){var p=plan(),s=current(),i=selected;if(!HS.studioReviewed(p,s))throw new Error('현재 장면을 먼저 검토 완료해 주세요.');var c=await HS.studioCanvas(p,JSON.parse(JSON.stringify(s))),name=String(i+1).padStart(2,'0')+' '+s.title.replace(/[\\/:*?"<>|]/g,'')+'.png';HS.download(name,await HS.teachingBlob(c));message('슬라이드 PNG를 저장했습니다.');});};
  $('studio-png-all').onclick=function(){job(async function(){await HS.exportStudio('png');message('한 장면당 한 PNG로 저장했습니다.');});};$('studio-ppt-all').onclick=function(){job(async function(){await HS.exportStudio('ppt');message('한 장면당 한 슬라이드로 저장했습니다. 원고는 발표자 노트에 있습니다.');});};
  HS.onChange(function(what){if(what==='all')return;if(what==='studio'&&$('tab-studio').classList.contains('on'))overview();});
  window.addEventListener('beforeunload',function(e){if(busy){e.preventDefault();e.returnValue='';}});
})();
