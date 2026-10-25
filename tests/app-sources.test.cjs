const test=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('../scripts/serve.cjs');
test('the documented preview server serves every declared script with executable MIME',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const response=await fetch(base);assert.equal(response.status,200);const html=await response.text();
  const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(match=>match[1]);assert.ok(scripts.includes('live.js')&&scripts.includes('live-i18n.js'));
  for(const file of scripts){const response=await fetch(base+'/'+file);assert.equal(response.status,200,file);assert.match(response.headers.get('content-type'),/javascript/,file);}
  assert.equal((await fetch(base+'/../package.json')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
