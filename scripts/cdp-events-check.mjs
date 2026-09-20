import {writeFile} from 'node:fs/promises';
const port=process.argv[2]??'9344';
const targets=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
const target=targets.find(t=>t.type==='page'&&!t.url.includes('#/output'));
const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
let id=0;const pending=new Map();
socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const task=pending.get(m.id);pending.delete(m.id);m.error?task.reject(new Error(JSON.stringify(m.error))):task.resolve(m.result);}};
const cmd=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
async function evaluate(expression){const result=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
try{
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Arduino').click()");
  await new Promise(r=>setTimeout(r,500));
  const count=await evaluate("document.querySelectorAll('select[aria-label$=effect]').length");if(count!==8)throw Error('Expected 8 flows, got '+count);
  console.log('PASS packaged UI: eight editable sensor flows');
  const labels=await evaluate("document.body.innerText");
  for(const name of ['怀疑','探索','欲望','自信','冲突','虚无','接纳','结束 · 光芒消散'])if(!labels.includes(name))throw Error('Missing event: '+name);
  await evaluate("[...document.querySelectorAll('button')].filter(b=>b.textContent==='TRIGGER')[7].click()");
  await new Promise(r=>setTimeout(r,5500));
  if(!(await evaluate("document.body.innerText")).includes('光芒消散'))throw Error('Final status missing');
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='恢复播放').click()");
  console.log('PASS packaged event labels, CH8 and resume buttons');
  const capture=await cmd('Page.captureScreenshot',{format:'png'});await writeFile('test-output/events/packaged-terminal.png',Buffer.from(capture.data,'base64'));
}finally{socket.close();}
