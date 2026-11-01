const test=require('node:test');
const assert=require('node:assert/strict');
const so=require('../app/stackoverflow-core.js');
const now=1790000000000;
const q={question_id:101,title:'How &amp; why?',link:'https://stackoverflow.com/questions/101/how-why',creation_date:1780000000,answer_count:1,body:'Read <a href="https://github.com/example/fixture/issues/2">the project</a>. &lt;img src=x&gt;',owner:{display_name:'A &amp; B',link:'https://stackoverflow.com/users/5/person'},content_license:'CC BY-SA 4.0'};
const answer={answer_id:202,question_id:101,creation_date:1780000001,body:'See <a href="https://github.com/example/other">another</a>.',owner:{display_name:'Responder',link:'https://stackoverflow.com/users/6/responder'},content_license:'CC BY-SA 3.0',is_accepted:false};
function fixture(fn,calls=[]){return async(url,options)=>{calls.push({url,options});const v=fn(url);return new Response(JSON.stringify(v.body??v),{status:v.status||200,headers:{'content-type':'application/json'}});};}
function fake(url){if(url.includes('search/advanced'))return {items:[q],has_more:true};if(url.includes('/answers?'))return {items:[answer],has_more:false};return {items:[q],has_more:false};}
function options(fetcher,storage=so.memoryStore(),clock=()=>now){return {fetcher,storage,now:clock,locks:null};}
test('only canonical source and repository URLs survive',()=>{
 assert.equal(so.questionUrl('https://stackoverflow.com/questions/101/how-why?x=1'),'https://stackoverflow.com/questions/101');
 for(const bad of ['https://stackoverflow.com.evil.test/questions/101','http://stackoverflow.com/questions/101','https://u:p@stackoverflow.com/questions/101','https://stackoverflow.com/questions/0'])assert.equal(so.questionUrl(bad),null);
 assert.equal(so.repoUrl('https://github.com/example/repo/issues/1'),'https://github.com/example/repo');
 assert.equal(so.repoUrl('https://github.com.evil.test/example/repo'),null);
 assert.deepEqual(so.repos(q.body),['https://github.com/example/fixture']);
});
test('search is bounded, anonymous, and exposes no fabricated total or solved claim',async()=>{
 const calls=[];const out=await so.search(' browser   agent ',90,options(fixture(fake,calls)));
 assert.equal(out.query,'browser agent');assert.equal(out.has_more,true);assert.equal(out.entries[0].attribution.author.name,'A & B');assert.equal(out.entries[0].attribution.license,'CC BY-SA 4.0');assert.equal(out.entries[0].url,'https://stackoverflow.com/questions/101');assert.equal(out.reported_total,undefined);
 assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.referrerPolicy,'no-referrer');assert.equal(new URL(calls[0].url).searchParams.get('pagesize'),'8');
});
test('collect preserves each author, license, source, answers, and repo leads',async()=>{
 const calls=[],s=await so.collect(101,options(fixture(fake,calls)));assert.equal(calls.length,2);assert.equal(s.question.attribution.author.name,'A & B');assert.equal(s.question.attribution.license,'CC BY-SA 4.0');assert.equal(s.answers[0].attribution.license,'CC BY-SA 3.0');assert.equal(s.answers[0].accepted,false);assert.equal(s.answers[0].url,'https://stackoverflow.com/a/202');assert.deepEqual(s.question.repositories,['https://github.com/example/fixture']);assert.match(s.question.body.text,/<img src=x>/);assert.equal(s.partial,false);assert.equal(so.validate(JSON.parse(JSON.stringify(s))).question.id,101);
});
test('answer failure keeps the question and marks a partial sample',async()=>{
 const calls=[],s=await so.collect(101,options(fixture(url=>url.includes('/answers?')?{status:503,body:{error_id:500}}:fake(url),calls)));assert.equal(s.partial,true);assert.equal(s.answers.length,0);assert.equal(s.question.id,101);assert.equal(calls.length,2);
});
test('same semantic request is blocked for a minute across client instances',async()=>{
 let clock=now;const store=so.memoryStore(),calls=[],opts=options(fixture(fake,calls),store,()=>clock);
 await so.search('browser agent',0,opts);await assert.rejects(()=>so.search('browser   agent',0,opts),e=>e.code==='duplicate');assert.equal(calls.length,1);clock+=60001;await so.search('browser agent',0,opts);assert.equal(calls.length,2);
});
test('server backoff is stored per method, including on an error; no automatic retry',async()=>{
 let clock=now;const store=so.memoryStore(),calls=[];const client=so.client(options(fixture(()=>({status:503,body:{backoff:30,error_id:500}}),calls),store,()=>clock));
 await assert.rejects(()=>client.get('search','search/advanced',{site:'stackoverflow',q:'one'}),e=>e.code==='sourceFailed');await assert.rejects(()=>client.get('search','search/advanced',{site:'stackoverflow',q:'another'}),e=>e.code==='backoff'&&e.wait===30);assert.equal(calls.length,1);clock+=30001;
 await assert.rejects(()=>client.get('search','search/advanced',{site:'stackoverflow',q:'another'}),e=>e.code==='sourceFailed');assert.equal(calls.length,2);
});
test('missing license or altered source identity is refused',async()=>{
 await assert.rejects(()=>so.collect(101,options(fixture(url=>({...fake(url),items:[{...q,content_license:undefined}]})))),e=>e.code==='licenseUnavailable');
 const s=await so.collect(101,options(fixture(fake)));s.question.url='https://stackoverflow.com.evil.test/questions/101';assert.throws(()=>so.validate(s),e=>e.code==='invalidSnapshot');
});
test('deleted author remains attributed as unavailable without an invented profile',async()=>{
 const s=await so.collect(101,options(fixture(url=>url.includes('/answers?')?{items:[{...answer,owner:{}}],has_more:false}:fake(url))));assert.deepEqual(s.answers[0].attribution.author,{name:'[deleted or unavailable]',url:null});
});
