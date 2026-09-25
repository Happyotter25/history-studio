import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStudioServer} from '../tools/studio-server.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
test('로컬 연결: 출처·토큰·입력 검증, 순차 실행, 완료·실패·취소',async()=>{
 let release;
 const server=createStudioServer({status:async()=>({ready:true}),runner:async(job,update,register)=>{
  if(job.prompt==='fail')throw Error('private raw output');
  if(job.prompt==='wait')await new Promise(resolve=>{release=resolve;register(resolve);});
  update('그리는 중');return png;
 }});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(base+'/api/session',{headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await fetch(base+'/api/status')).status,403);
  assert.equal((await fetch(base+'/.git/config')).status,404);
  const {token}=await (await fetch(base+'/api/session')).json();
  const call=(p,method='GET',data)=>fetch(base+p,{method,headers:{'X-Studio-Token':token,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
  assert.equal((await (await call('/api/status')).json()).ready,true);
  assert.equal((await call('/api/jobs','POST',{prompt:42})).status,400);
  let {id}=await (await call('/api/jobs','POST',{prompt:'wait'})).json();
  assert.equal((await call('/api/jobs','POST',{prompt:'second'})).status,409);
  await call('/api/jobs/'+id,'DELETE');assert.equal((await (await call('/api/jobs/'+id)).json()).state,'cancelled');release();
  await new Promise(r=>setTimeout(r,30));
  ({id}=await (await call('/api/jobs','POST',{prompt:'ok'})).json());
  await new Promise(r=>setTimeout(r,50));let result=await(await call('/api/jobs/'+id)).json();assert.equal(result.state,'done');assert.match(result.image,/^data:image\/png;base64,/);
  ({id}=await (await call('/api/jobs','POST',{prompt:'fail'})).json());
  await new Promise(r=>setTimeout(r,30));result=await(await call('/api/jobs/'+id)).json();assert.equal(result.state,'error');assert.ok(!JSON.stringify(result).includes('private raw output'));
 }finally{await new Promise(r=>server.close(r));}
});
test('브라우저: 버튼 → 생성 → 미리보기·저장, 프로젝트 변경 보호',async()=>{
 const {chromium}=await import('playwright');let release;
 const server=createStudioServer({status:async()=>({ready:true,message:'시험 연결'}),runner:async(job,update,register)=>{await new Promise(r=>{release=r;register(r);});return png;}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('body[data-ready]');
  await page.click('#tabs button[data-tab=materials]');await page.click('#material-sample');await page.click('#material-propose');await page.click('#material-confirm');
  await page.waitForFunction(()=>!document.getElementById('cli-one').disabled);await page.click('#cli-one');await page.waitForTimeout(100);release();
  await page.waitForFunction(()=>document.getElementById('cli-status').textContent.includes('1장을 완성'));
  assert.equal(await page.locator('#cli-preview img').count(),1);assert.equal(await page.evaluate(()=>HS.pendingShots('missing').length),10);
  await page.click('#cli-one');await page.waitForTimeout(100);await page.evaluate(()=>HS.project=JSON.parse(JSON.stringify(HS.project)));release();
  await page.waitForFunction(()=>document.getElementById('cli-status').textContent.includes('자료가 바뀌었습니다'));
  assert.equal(await page.evaluate(()=>HS.pendingShots('missing').length),10);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});

test('장면 스튜디오: Codex 의미 분석과 현재 장면 이미지 생성 연결',async()=>{
 const {chromium}=await import('playwright');const kinds=[];
 const server=createStudioServer({status:async()=>({ready:true}),runner:async(job)=>{
   kinds.push(job.kind);if(job.kind==='analysis')return Buffer.from(JSON.stringify({scenes:[{end:1,title:'배경',reason:'배경 설명',type:'text',content:'전쟁의 배경',prompt:''},{end:2,title:'전투',reason:'전투 장면',type:'image',content:'',prompt:'판옥선 한 척'}]}));return png;
 }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
 try{const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('body[data-ready]');await page.fill('#studio-script','전쟁이 시작되었습니다. 이순신이 출전했습니다.');await page.click('#studio-analyze');await page.waitForFunction(()=>HS.project.studio.mode==='review');assert.equal(await page.locator('#studio-outline button').count(),2);await page.click('#studio-confirm-plan');await page.waitForFunction(()=>HS.project.studio.mode==='compose');await page.click('#studio-next');await page.click('#studio-generate');await page.waitForFunction(()=>HS.project.studio.slides[1].image);assert.equal(await page.evaluate(()=>HS.project.studio.slides[0].image),null);assert.deepEqual(kinds,['analysis','image']);assert.ok(!await page.evaluate(()=>HS.studioReviewed(HS.project.studio,HS.project.studio.slides[1])));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
test('이미지 프롬프트: 자동 초안→검토 적용, 원고 전달·그림 미생성·변경 보호',async()=>{
 const {chromium}=await import('playwright');let release;const requests=[];
 const server=createStudioServer({status:async()=>({ready:true}),runner:async job=>{requests.push(job);if(requests.length===2)await new Promise(r=>release=r);return Buffer.from(JSON.stringify({prompt:'조선 수군의 판옥선, 해협을 바라보는 원경, 교육용 삽화, 16:9, 글자 없음'}));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
 try{const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('body[data-ready]');await page.fill('#studio-script','이순신은 명량에서 싸웠습니다.');await page.click('#studio-paragraph');await page.waitForFunction(()=>HS.project.studio.mode==='review');await page.click('#studio-confirm-plan');await page.waitForFunction(()=>HS.project.studio.mode==='compose');await page.selectOption('#studio-type','image');await page.fill('#studio-prompt','내가 쓴 기존 지시');
 await page.click('#studio-auto-prompt');await page.waitForSelector('#studio-prompt-proposal:not([hidden])');assert.equal(await page.locator('#studio-prompt').inputValue(),'내가 쓴 기존 지시');assert.equal(requests[0].kind,'prompt');assert.match(JSON.parse(requests[0].prompt).narration,/명량/);assert.equal(await page.evaluate(()=>HS.project.studio.slides[0].image),null);
 await page.click('#studio-apply-prompt');await page.waitForFunction(()=>HS.project.studio.slides[0].prompt.includes('판옥선'));assert.equal(await page.evaluate(()=>HS.project.studio.slides[0].reviewed),'');assert.equal(requests.length,1);
 await page.click('#studio-auto-prompt');while(!release)await new Promise(r=>setTimeout(r,10));await page.evaluate(()=>{HS.project=JSON.parse(JSON.stringify(HS.project));HS.changed('all');});release();await page.waitForFunction(()=>document.getElementById('studio-status').textContent.includes('장면이 바뀌어'));assert.ok(await page.locator('#studio-prompt-proposal').isHidden());
 }finally{release?.();await browser.close();await new Promise(r=>server.close(r));}
});
