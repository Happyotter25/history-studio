(function(){
  'use strict';
  var HS=window.HS,$=HS.$,token='',busy=false,jobId='',stop=false,connected=false;
  var previews=[];
  function message(t){$('cli-status').textContent=t;}
  function render(){
    $('cli-one').disabled=busy||!connected||!HS.materialApproved()||!HS.pendingShots('missing').length;
    $('cli-all').disabled=$('cli-one').disabled;$('cli-stop').hidden=!busy;
    $('cli-connect').disabled=busy;
    $('cli-preview').innerHTML=previews.map(function(p){return '<figure style="margin:0"><img style="width:100%;max-height:260px;object-fit:contain" src="'+p.image+'" alt="생성된 삽화"><figcaption>'+HS.esc(p.label)+' · <a download="'+HS.esc(p.file)+'" href="'+p.image+'">PNG 저장</a></figcaption></figure>';}).join('');
  }
  function api(url,method,data){return fetch(url,{method:method||'GET',headers:{'X-Studio-Token':token,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'연결에 실패했습니다.');return d;});});}
  function connect(){
    if(location.protocol==='file:'){message('자동 제작은 “사관 스튜디오 실행.command”를 더블클릭해 연 앱에서 사용할 수 있습니다. 기존 프로젝트는 백업 후 새 앱에서 불러오세요.');return Promise.resolve();}
    message('Codex CLI 연결을 확인하고 있습니다…');
    return fetch('/api/session').then(function(r){return r.json();}).then(function(s){token=s.token;return api('/api/status');}).then(function(s){connected=s.ready;message(s.message);render();}).catch(function(){connected=false;message('로컬 실행 파일로 앱을 열어 주세요. 연결 프로그램이 꺼져 있으면 다시 실행해 주세요.');render();});
  }
  function poll(id){return api('/api/jobs/'+id).then(function(r){
    message(r.message);
    if(r.state==='done')return HS.loadImage(r.image).then(function(){return r.image;});
    if(r.state!=='running')throw new Error(r.message);
    return new Promise(function(resolve){setTimeout(resolve,1200);}).then(function(){return poll(id);});
  });}
  function start(all){
    if(busy||!connected||!HS.materialApproved())return;
    var project=HS.project,items=HS.pendingShots('missing').slice(0,all?undefined:1).map(function(x){return {id:x.sh.id,prompt:HS.shotPrompt(x.sh),image:x.sh.image,file:HS.shotFile(x.si,x.sj,x.sh),label:x.s.heading};});
    if(!items.length)return;
    busy=true;stop=false;render();
    var index=0;
    function next(){
      if(stop||index>=items.length)return;
      if(HS.project!==project||!HS.materialApproved())throw new Error('프로젝트나 제작 목록이 바뀌어 대기 중인 제작을 멈췄습니다.');
      var item=items[index++];message(index+' / '+items.length+'장 · Codex에 요청 중…');
      return api('/api/jobs','POST',{prompt:item.prompt}).then(function(r){jobId=r.id;if(stop)return api('/api/jobs/'+jobId,'DELETE').then(function(){throw new Error('생성을 중단했습니다.');});return poll(jobId);}).then(function(image){
        jobId='';previews.unshift({image:image,file:item.file,label:item.label||'삽화'});previews=previews.slice(0,12);
        var found=HS.findShot(item.id);
        if(HS.project!==project||!found||HS.shotPrompt(found.sh)!==item.prompt||found.sh.image!==item.image||!HS.materialApproved()){
          stop=true;render();throw new Error('제작 중 자료가 바뀌었습니다. 완성 그림은 아래 미리보기에서 PNG로 저장할 수 있습니다.');
        }
        HS.setShotImage(found.sh,image);HS.changed('shots');render();return next();
      });
    }
    Promise.resolve().then(next).then(function(){message(stop?'생성을 중단했습니다.':'그림 '+index+'장을 완성해 프로젝트에 넣었습니다. 아래에서 미리보거나 PNG를 저장하세요.');}).catch(function(e){message(e.message);}).finally(function(){busy=false;jobId='';render();});
  }
  $('cli-connect').onclick=connect;$('cli-one').onclick=function(){start(false);};$('cli-all').onclick=function(){start(true);};
  $('cli-stop').onclick=function(){stop=true;if(jobId)api('/api/jobs/'+jobId,'DELETE').catch(function(e){message(e.message);});};
  window.addEventListener('beforeunload',function(e){if(busy){e.preventDefault();e.returnValue='';}});
  HS.onChange(function(){render();});HS.ready.then(function(){render();connect();});
})();
