const test=require('node:test');
const assert=require('node:assert/strict');
const live=require('../app/live.js');
const core=require('../app/core.js');
// All payloads below are original synthetic API fixtures, not fetched user evidence.
const story={id:101,type:'story',by:'test-author',time:1780000000,title:'Synthetic research story',text:'A &lt;script&gt;literal&lt;/script&gt;.<p>Second line.',url:'https://github.com/example/fixture',score:7,descendants:23};
function page(index, entries){return {page:index,nbPages:3,nbHits:23,hits:entries};}
const comment=(id,date='2026-10-01T10:00:00Z')=>({objectID:String(id),story_id:101,parent_id:1001,author:'test-reader',created_at:date,comment_text:'Please preserve the source. <a href="https://example.org/source">Details</a>'});
function fake(routes, calls=[]){return async(url,options)=>{calls.push({url,options});const value=routes(url);return new Response(JSON.stringify(value?.status?value.body:value),{status:value?.status||200,headers:{'content-type':'application/json'}});};}
const hnRoutes=url=>url.includes('firebaseio')?story:url.includes('page=2')?page(2,[comment(1001,'2026-09-01T10:00:00Z')]):page(0,[comment(1003),comment(1002)]);

test('input allows topics and exact public issue/story URLs, not lookalikes or credentials',()=>{
 assert.deepEqual(live.input(' pdf tables '),{kind:'search',query:'pdf tables'});
 assert.equal(live.input('https://github.com/example/project/issues/7').kind,'github');
 assert.equal(live.input('https://news.ycombinator.com/item?id=101').id,101);
 for(const value of ['x','https://github.com.evil.invalid/a/b/issues/1','https://u:p@github.com/a/b/issues/1','https://github.com/a/b/pull/1','https://news.ycombinator.com.evil.invalid/item?id=1','javascript://x'])assert.throws(()=>live.input(value),/invalidInput/);
});
test('HN HTML becomes inert readable text with numeric entities and link destinations',()=>{
 assert.equal(live.plain('Hi&#x27;s<p>&lt;img src=x&gt; &amp; <a href="https://example.org">Link</a>'),"Hi's\n<img src=x> & Link (https://example.org)");
 assert.equal(live.plain('&#x110000;'), '&#x110000;');
});
test('search is one anonymous GET, bounded to 8, with a recorded time filter and original dates',async()=>{
 const calls=[];
 const result=await live.search('pdf tables','recent',{days:30,fetcher:fake(()=>({nbHits:99,hits:[{objectID:'101',title:'Example',author:'a',created_at:'2020-01-01T00:00:00Z',points:2,num_comments:3,url:'javascript:alert(1)'}]}),calls)});
 assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.referrerPolicy,'no-referrer');assert.match(calls[0].url,/search_by_date/);
 assert.match(new URL(calls[0].url).searchParams.get('numericFilters'),/^created_at_i>=\d+$/);assert.equal(new URL(calls[0].url).searchParams.get('typoTolerance'),'false');assert.equal(new URL(calls[0].url).searchParams.get('removeWordsIfNoResults'),'none');
 assert.equal(result.days,30);assert.equal(result.entries[0].created_at,'2020-01-01T00:00:00Z');assert.equal(result.entries[0].project_url,null);
});
test('HN is a discussion snapshot with newest/oldest indexed samples, parent links, own metrics and no fictional GitHub state',async()=>{
 const result=await live.collect('https://news.ycombinator.com/item?id=101',{fetcher:fake(hnRoutes)});
 assert.equal(result.schema_version,2);assert.equal(result.source_kind,'hackernews');assert.equal(result.issues,undefined);
 const thread=result.threads[0];assert.equal(thread.state,'discussion');assert.equal(thread.key,'hn#101');assert.equal(thread.points,7);
 assert.equal(thread.comments.reported_total,23);assert.equal(thread.comments.indexed_total,23);assert.deepEqual(thread.comments.pages,[1,3]);assert.equal(thread.comments.entries.length,3);assert.equal(thread.comments.entries[0].parent_id,1001);
 assert.equal(thread.references[0].kind,'project_link');assert.equal(thread.references[0].check,'link_only');
 assert.equal(result.requests.length,3);assert.equal(result.collection_status,'complete');
 const source=JSON.stringify(result),loaded=await core.parse(source);const review=core.review(loaded,{'hn#101':{verdict:'followup',notes:'Check the actual alternatives.',updated_at:'2026-10-01'}});
 const restored=await core.parse(JSON.stringify(review));assert.equal(restored.source,source);assert.equal(restored.decisions['hn#101'].notes,'Check the actual alternatives.');
});
test('HN missing comment page remains partial with retained source, not a zero-comment success',async()=>{
 const report=await live.collectHN(101,{fetcher:fake(url=>url.includes('page=2')?{status:503,body:{error:'unavailable'}}:hnRoutes(url))});
 assert.equal(report.collection_status,'partial');assert.equal(report.threads[0].comments.available,false);assert.equal(report.threads[0].comments.entries.length,2);assert.equal(report.threads[0].comments.reported_total,23);assert.ok(report.failures.length);
});
test('on-demand HN parent reads one public comment and handles missing or mismatched data',async()=>{
 const calls=[],parent={id:1001,type:'comment',by:'parent-reader',time:1780000000,text:'A &lt;script&gt;literal&lt;/script&gt; question.'};
 const result=await live.readHNParent(1001,{fetcher:fake(()=>parent,calls)});
 assert.equal(result.id,1001);assert.match(result.body.text,/<script>literal<\/script>/);assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://hacker-news.firebaseio.com/v0/item/1001.json');assert.equal(calls[0].options.credentials,'omit');
 for(const invalid of [null,{...parent,id:1002},{...parent,deleted:true},{...parent,type:'story'}])await assert.rejects(live.readHNParent(1001,{fetcher:fake(()=>invalid)}),/unavailableThread/);
 await assert.rejects(live.readHNParent(0,{fetcher:fake(()=>parent)}),/invalidInput/);
});
test('an empty search index does not erase the official HN comment count',async()=>{
 const report=await live.collectHN(101,{fetcher:fake(url=>url.includes('firebaseio')?story:{page:0,nbPages:0,nbHits:0,hits:[]})});
 assert.equal(report.collection_status,'partial');assert.equal(report.threads[0].comments.reported_total,23);assert.equal(report.threads[0].comments.available,false);
});
test('HN deleted items and unavailable metrics do not become current live stories',async()=>{
 for(const item of [{...story,deleted:true},{...story,score:undefined},{...story,type:'comment'}])await assert.rejects(live.collectHN(101,{fetcher:fake(()=>item)}),/unavailableThread/);
});
test('HN source identity, comment identity and project links cannot be promoted into checked PRs',async()=>{
 const report=await live.collectHN(101,{fetcher:fake(hnRoutes)});
 for(const mutate of [r=>r.threads[0].key='hn#102',r=>r.threads[0].state='open',r=>r.threads[0].comments.entries[0].url='https://news.ycombinator.com/item?id=1',r=>r.threads[0].references[0].check='checked',r=>r.threads[0].references[0].url='javascript:alert(1)']){
  const altered=structuredClone(report);mutate(altered);assert.throws(()=>core.validate(altered));
 }
});
const ghIssue={number:5,title:'Synthetic issue',comments:11,state:'open',html_url:'https://github.com/example/project/issues/5',created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-02T00:00:00Z',user:{login:'requester'},body:'The related implementation is #7.'};
const ghComment=id=>({id,html_url:'https://github.com/example/project/issues/5#issuecomment-'+id,user:{login:'reader',type:'User'},created_at:'2026-10-01T00:00:00Z',body:'A synthetic follow-up.'});
function ghRoutes(url){
 if(url.endsWith('/repos/example/project'))return {private:false,visibility:'public',full_name:'example/project',html_url:'https://github.com/example/project',stargazers_count:99};
 if(url.endsWith('/issues/5'))return ghIssue;
 if(url.includes('/comments'))return url.includes('page=2')?[ghComment(11)]:Array.from({length:10},(_,i)=>ghComment(i+1));
 if(url.endsWith('/issues/7'))return {number:7,state:'closed',html_url:'https://github.com/example/project/pull/7',pull_request:{}};
 if(url.endsWith('/pulls/7'))return {state:'closed',merged_at:'2026-10-02T00:00:00Z'};
 throw new Error('Unexpected fixture URL '+url);
}
test('GitHub checks public visibility before content, first/last comments, and actual PR merged state',async()=>{
 const calls=[],result=await live.collectGitHub('example/project',5,{fetcher:fake(ghRoutes,calls)});
 assert.equal(calls[0].url,'https://api.github.com/repos/example/project');assert.equal(result.schema_version,1);
 const item=result.issues[0];assert.equal(item.state,'open');assert.equal(item.comments.entries.length,11);assert.deepEqual(item.comments.pages,[1,2]);assert.equal(item.references[0].state,'merged');assert.equal(item.references[0].kind,'pull_request');
 assert.equal(result.collection_status,'complete');assert.equal(result.requests.length,6);assert.ok(calls.every(c=>c.options.method==='GET'&&c.options.credentials==='omit'));
});
test('nonpublic GitHub metadata stops before any issue body read',async()=>{
 const calls=[];await assert.rejects(live.collectGitHub('example/private',5,{fetcher:fake(()=>({private:true,visibility:'private'}),calls)}),/unavailableThread/);assert.equal(calls.length,1);
});
test('unavailable referenced PR does not claim its state; partial comment evidence remains readable',async()=>{
 const report=await live.collectGitHub('example/project',5,{fetcher:fake(url=>url.endsWith('/issues/7')?{status:404,body:{}}:ghRoutes(url))});
 assert.equal(report.collection_status,'partial');assert.equal(report.issues[0].references[0].check,'unavailable');assert.equal(report.issues[0].references[0].state,undefined);assert.equal(report.issues[0].comments.entries.length,11);
});
test('rate limits, oversized and malformed responses are explicit failures and are never retried',async()=>{
 for(const [fetcher,pattern] of [[async()=>new Response('{}',{status:429}),/rateLimited/],[async()=>new Response('x'.repeat(live.MAX_RESPONSE+1)),/responseTooLarge/],[async()=>new Response('{'),/sourceFailed/]]){
  let calls=0;await assert.rejects(live.search('topic','relevance',{fetcher:async(...args)=>{calls++;return fetcher(...args);}}),pattern);assert.equal(calls,1);
 }
});
test('an aborted collection does not return a partial successful report or start another request',async()=>{
 const controller=new AbortController();let calls=0;
 const fetcher=async(url,options)=>{calls++;controller.abort();throw new DOMException('Stopped','AbortError');};
 await assert.rejects(live.collectHN(101,{signal:controller.signal,fetcher}),/Stopped/);assert.equal(calls,1);
});
test('a forbidden response is not called a rate limit without rate-limit evidence',async()=>{
 await assert.rejects(live.search('topic','relevance',{fetcher:async()=>new Response('{}',{status:403})}),/sourceFailed/);
 await assert.rejects(live.search('topic','relevance',{fetcher:async()=>new Response('{}',{status:403,headers:{'x-ratelimit-remaining':'0'}})}),/rateLimited/);
});
