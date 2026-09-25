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
  await page.click('#material-sample');await page.click('#material-propose');await page.click('#material-confirm');
  await page.waitForFunction(()=>!document.getElementById('cli-one').disabled);await page.click('#cli-one');await page.waitForTimeout(100);release();
  await page.waitForFunction(()=>document.getElementById('cli-status').textContent.includes('1장을 완성'));
  assert.equal(await page.locator('#cli-preview img').count(),1);assert.equal(await page.evaluate(()=>HS.pendingShots('missing').length),10);
  await page.click('#cli-one');await page.waitForTimeout(100);await page.evaluate(()=>HS.project=JSON.parse(JSON.stringify(HS.project)));release();
  await page.waitForFunction(()=>document.getElementById('cli-status').textContent.includes('자료가 바뀌었습니다'));
  assert.equal(await page.evaluate(()=>HS.pendingShots('missing').length),10);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
