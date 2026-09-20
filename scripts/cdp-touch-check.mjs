import assert from 'node:assert/strict';
const port=process.argv[2]??'9357';
const targets=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
const target=targets.find(t=>t.type==='page'&&!t.url.includes('#/output'));
const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
let id=0;const pending=new Map();
socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
const cmd=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
async function evaluate(expression){const result=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
try{
  await evaluate(`(()=>{const select=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='capacitive'));if(!select)throw Error('Touch option missing');select.value='capacitive';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await new Promise(r=>setTimeout(r,500));
  assert(await evaluate("!!document.querySelector('input[aria-label=\"CH1 baseline\"]')"));
  assert.equal(await evaluate("document.querySelectorAll('select[aria-label$=effect]').length"),8);
  const log=await evaluate("window.centopia.arduino.run('capacitive')");assert(log.includes('Sketch uses'));
  console.log('PASS packaged cold start, touch UI and bundled offline Uno compile\n'+log);
}finally{socket.close();}
