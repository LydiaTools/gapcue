const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const live=require('../app/live.js');
const cli=require('../scripts/research.cjs');
const repo={id:123,full_name:'Example/project',html_url:'https://github.com/Example/project',description:'Fictional sample',created_at:'2026-10-05T12:30:00Z',stargazers_count:42,fork:false,archived:false,license:{spdx_id:'MIT'}};
const reply=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers});
test('GitHub repository search uses one anonymous GET, stars-desc ordering and explicit UTC window',async()=>{
 const calls=[];const result=await live.searchRepositories('agent skills',{days:30,fetcher:async(url,options)=>{calls.push({url,options});return reply({total_count:25,incomplete_results:false,items:[repo,{...repo,id:124,full_name:'Example/no-license',html_url:'https://github.com/Example/no-license',license:null}]});}});
 assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.referrerPolicy,'no-referrer');
 const url=new URL(calls[0].url);assert.equal(url.origin,'https://api.github.com');assert.equal(url.pathname,'/search/repositories');assert.equal(url.searchParams.get('sort'),'stars');assert.equal(url.searchParams.get('order'),'desc');assert.equal(url.searchParams.get('per_page'),'8');assert.match(url.searchParams.get('q'),/created:>=\d{4}-\d\d-\d\d/);assert.match(url.searchParams.get('q'),/fork:false/);assert.equal(result.reported_total,25);assert.equal(result.incomplete_results,false);assert.equal(result.entries[0].license,'MIT');assert.equal(result.entries[1].license,null);assert.equal(result.entries[0].stargazers_count,42);
});
test('malformed sources and qualifier injection do not become empty success',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return reply({total_count:1,incomplete_results:false,items:[{...repo,html_url:'https://github.com.evil.invalid/Example/project'}]});};
 await assert.rejects(live.searchRepositories('created:>2026',{days:30,fetcher}),e=>e.code==='invalidRepoQuery');assert.equal(calls,0);
 await assert.rejects(live.searchRepositories('agent',{days:30,fetcher}),e=>e.code==='sourceFailed');
 await assert.rejects(live.searchRepositories('agent',{days:30,fetcher:async()=>reply({total_count:0,items:[]})}),e=>e.code==='sourceFailed');
 await assert.rejects(live.searchRepositories('agent',{days:30,fetcher:async()=>reply({},403,{'x-ratelimit-remaining':'0'})}),e=>e.code==='rateLimited');
});
test('CLI preserves partial results and reports incomplete search as partial exit 1',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gapcue-repos-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const dir=path.join(root,'out');
 const result=await cli.run(['repos','agent skills','--days','30','--out',dir],{fetcher:async()=>reply({total_count:100,incomplete_results:true,items:[repo]})});
 assert.equal(result.exitCode,1);assert.equal(result.summary.status,'partial');const data=JSON.parse(await fs.readFile(path.join(dir,'repos.json'),'utf8'));assert.equal(data.incomplete_results,true);assert.equal(data.entries[0].html_url,repo.html_url);assert.ok((await fs.readFile(path.join(dir,'SHA256SUMS.txt'),'utf8')).includes('repos.json'));
 await assert.rejects(cli.run(['repos','agent','--days','31','--out',path.join(root,'bad')]),/Invalid/);
});
test('any-time query omits created qualifier and response size is bounded',async()=>{
 let seen;const result=await live.searchRepositories('open source',{days:0,fetcher:async(url)=>{seen=new URL(url);return reply({total_count:0,incomplete_results:false,items:[]});}});
 assert.equal(result.entries.length,0);assert.doesNotMatch(seen.searchParams.get('q'),/created:/);
 await assert.rejects(live.searchRepositories('agent',{days:90,fetcher:async()=>new Response('x'.repeat(1048577),{status:200})}),e=>e.code==='responseTooLarge');
});
test('failed GitHub source yields a failure artifact, never a false empty result',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gapcue-repos-failure-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const dir=path.join(root,'out');
 const result=await cli.run(['repos','agent','--out',dir],{fetcher:async()=>reply({},429)});
 assert.equal(result.exitCode,1);assert.equal(result.summary.status,'failed');assert.equal(JSON.parse(await fs.readFile(path.join(dir,'failure.json'),'utf8')).error,'rateLimited');await assert.rejects(fs.stat(path.join(dir,'repos.json')),{code:'ENOENT'});
});
