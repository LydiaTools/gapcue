const test=require('node:test');
const assert=require('node:assert/strict');
const live=require('../app/live.js');
const entry={repo:'example/agent',url:'https://github.com/example/agent',description:'<img src=x onerror=alert(1)>',stars:42,starsPerDay:3,createdAt:'2026-10-15'};
const feed={generatedAt:'2026-10-30T05:49:31.902Z',rising:[entry]};
const response=data=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});

test('rising snapshot uses the fixed anonymous source and preserves its timestamp and average',async()=>{
 let request;const result=await live.risingAgents({fetcher:async(url,options)=>{request={url,options};return response(feed);}});
 assert.equal(request.url,'https://agentatlas.dev/trending.json');assert.equal(request.options.method,'GET');assert.equal(request.options.credentials,'omit');assert.equal(request.options.referrerPolicy,'no-referrer');assert.equal(request.options.redirect,'error');
 assert.equal(result.generated_at,feed.generatedAt);assert.equal(result.entries[0].stars_per_day,3);assert.equal(result.entries[0].description,entry.description);assert.equal(result.requests.length,1);
});
test('malformed or hostile source is not silently reported as a valid ranking',async()=>{
 for(const data of [
  {...feed,generatedAt:'not-a-date'}, {...feed,rising:new Array(101).fill(entry)},
  {...feed,rising:[{...entry,url:'https://github.com.evil.test/example/agent'}]},
  {...feed,rising:[{...entry,starsPerDay:-1}]}, {...feed,rising:[{...entry,stars:'42'}]}
 ]) await assert.rejects(live.risingAgents({fetcher:async()=>response(data)}),e=>e.code==='sourceFailed');
 await assert.rejects(live.risingAgents({fetcher:async()=>new Response('x'.repeat(1048577),{status:200})}),e=>e.code==='responseTooLarge');
});
test('empty snapshot and unknown average stay distinct from zero',async()=>{
 const empty=await live.risingAgents({fetcher:async()=>response({...feed,rising:[]})});assert.deepEqual(empty.entries,[]);
 const partial=await live.risingAgents({fetcher:async()=>response({...feed,rising:[{...entry,starsPerDay:null}]})});assert.equal(partial.entries[0].stars_per_day,null);
});
