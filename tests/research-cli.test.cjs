const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const core=require('../app/core.js');
const cli=require('../scripts/research.cjs');

async function workspace(t) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gapcue-cli-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;
}
function mock(route,calls=[]) {
 return async(url,options)=>{calls.push({url,options});const result=route(url);return new Response(JSON.stringify(Object.hasOwn(result,'status')?result.body:result),{status:result.status??200});};
}
const story={id:101,type:'story',title:'Original synthetic test story',by:'fixture-author',time:1767225600,score:7,descendants:23,url:'https://example.org/project'};
const comment=(id)=>({objectID:String(id),story_id:101,author:'fixture-reader',created_at:'2026-01-02T00:00:00Z',parent_id:101,comment_text:'A synthetic request, not market evidence.'});
function hn(url) {
 if(url.includes('firebaseio'))return story;
 return {page:url.includes('page=2')?2:0,nbPages:3,nbHits:23,hits:url.includes('page=2')?[comment(24)]:[comment(2),comment(3)]};
}
async function checkSums(root) {
 const lines=(await fs.readFile(path.join(root,'SHA256SUMS.txt'),'utf8')).trim().split('\n');
 for(const line of lines){const [sha,name]=line.split('  ');assert.equal(createHash('sha256').update(await fs.readFile(path.join(root,name))).digest('hex'),sha);}
}

test('CLI help and version run from an unrelated working directory without packages',async t=>{
 const root=await workspace(t);
 for(const flag of ['--help','--version']) {
  const result=spawnSync(process.execPath,[path.resolve(__dirname,'../scripts/research.cjs'),flag],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0);assert.match(result.stdout,new RegExp(cli.VERSION.replaceAll('.','\\.')));assert.equal(result.stderr,'');
 }
 assert.deepEqual(await fs.readdir(root),[]);
});

test('HN search writes a bounded source file, one GET and matching file hashes',async t=>{
 const root=await workspace(t),out=path.join(root,'search'),calls=[];
 const result=await cli.run(['search','PDF tables','--sort','recent','--days','30','--out',out],{fetcher:mock(()=>({nbHits:99,hits:[{objectID:'101',title:'Fixture',author:'author',created_at:'2026-01-01T00:00:00Z',points:4,num_comments:3,url:'https://example.org'}]}),calls)});
 assert.equal(result.exitCode,0);assert.equal(calls.length,1);assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.credentials,'omit');
 const data=JSON.parse(await fs.readFile(path.join(out,'search.json'),'utf8'));assert.equal(data.days,30);assert.equal(data.sort,'recent');assert.equal(data.entries[0].id,101);assert.equal(data.reported_total,99);await checkSums(out);
});

test('existing output and invalid targets stop BEFORE source access, preserving files',async t=>{
 const root=await workspace(t),calls=[];await fs.writeFile(path.join(root,'keep.txt'),'original');
 const sourceOptions={fetcher:mock(()=>{throw new Error('must not call');},calls)};
 await assert.rejects(cli.run(['search','PDF tables','--out',root],sourceOptions),/EEXIST/);
 for(const args of [['collect','https://github.com.evil.invalid/a/b/issues/1'],['search','PDF tables','--days','31'],['search','PDF tables','--sort','recent','--sort','relevance']])await assert.rejects(cli.run([...args,'--out',path.join(root,'invalid')],sourceOptions));
 assert.equal(calls.length,0);assert.equal(await fs.readFile(path.join(root,'keep.txt'),'utf8'),'original');assert.deepEqual(await fs.readdir(root),['keep.txt']);
});

test('collected HN review reopens with exact source bytes, sampled counts and no automatic decision',async t=>{
 const root=await workspace(t),out=path.join(root,'thread');
 const result=await cli.run(['collect','https://news.ycombinator.com/item?id=101','--out',out],{fetcher:mock(hn)});
 assert.equal(result.exitCode,0);assert.equal(result.summary.threads[0].comments_collected,3);assert.equal(result.summary.threads[0].comments_reported,23);
 const source=await fs.readFile(path.join(out,'report.json'),'utf8'),loaded=await core.parse(await fs.readFile(path.join(out,'review.json'),'utf8'));
 assert.equal(loaded.source,source);assert.equal(loaded.report.parameters.backend,'anonymous Node GET');assert.equal(loaded.report.tool_version,cli.VERSION);assert.deepEqual(Object.keys(loaded.decisions),[]);
 assert.deepEqual(loaded.report.threads[0].comments.pages,[1,3]);assert.equal(loaded.report.threads[0].references[0].check,'link_only');await checkSums(out);
});

test('partial collection exits 1 with source still openable and missing comments visible',async t=>{
 const root=await workspace(t),out=path.join(root,'partial');
 const result=await cli.run(['collect','https://news.ycombinator.com/item?id=101','--out',out],{fetcher:mock(url=>url.includes('page=2')?{status:503,body:{}}:hn(url))});
 assert.equal(result.exitCode,1);assert.equal(result.summary.status,'partial');
 const loaded=await core.parse(await fs.readFile(path.join(out,'review.json'),'utf8'));assert.equal(loaded.report.collection_status,'partial');assert.equal(loaded.report.threads[0].comments.reported_total,23);assert.equal(loaded.report.threads[0].comments.available,false);await checkSums(out);
});

test('unavailable search writes a failure, exits 1, and never retries or invents an empty success',async t=>{
 const root=await workspace(t),out=path.join(root,'limited'),calls=[];
 const result=await cli.run(['search','PDF tables','--out',out],{fetcher:mock(()=>({status:429,body:{}}),calls)});
 assert.equal(result.exitCode,1);assert.equal(result.summary.status,'failed');assert.equal(calls.length,1);assert.equal(JSON.parse(await fs.readFile(path.join(out,'failure.json'),'utf8')).error,'rateLimited');
 await assert.rejects(fs.stat(path.join(out,'search.json')),/ENOENT/);await checkSums(out);
});

test('private GitHub metadata blocks before issue reads and is not exported as a source report',async t=>{
 const root=await workspace(t),out=path.join(root,'private'),calls=[];
 const result=await cli.run(['collect','https://github.com/example/private/issues/1','--out',out],{fetcher:mock(()=>({private:true}),calls)});
 assert.equal(result.exitCode,1);assert.equal(calls.length,1);await assert.rejects(fs.stat(path.join(out,'report.json')),/ENOENT/);
});

test('GitHub CLI output keeps source text literal in JSON and inert in its Markdown index',async t=>{
 const root=await workspace(t),out=path.join(root,'github'),calls=[];
 const title='<img src=x> ![tracker](https://example.org/track)';
 const result=await cli.run(['collect','https://github.com/example/project/issues/5','--out',out],{fetcher:mock(url=>url.endsWith('/repos/example/project')?{private:false,visibility:'public',full_name:'example/project',html_url:'https://github.com/example/project',stargazers_count:2}:{number:5,title,comments:0,state:'open',html_url:'https://github.com/example/project/issues/5',created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z',user:{login:'fixture'},body:'Original synthetic request.'},calls)});
 assert.equal(result.exitCode,0);assert.equal(calls.length,2);assert.ok(calls.every(c=>c.options.method==='GET'));
 const loaded=await core.parse(await fs.readFile(path.join(out,'review.json'),'utf8'));assert.equal(loaded.report.issues[0].title,title);
 const index=await fs.readFile(path.join(out,'report.md'),'utf8');assert.ok(!index.includes('<img'));assert.ok(!index.includes('![tracker]'));await checkSums(out);
});

test('local review saves bilingual notes while preserving exact old source bytes and other decisions',async t=>{
 const root=await workspace(t),input=path.join(root,'input.json'),out=path.join(root,'decision');
 const loaded=await core.parse(await fs.readFile(path.resolve(__dirname,'../examples/sample-report.json'),'utf8'));
 const second=loaded.report.issues[1].key,first=loaded.report.issues[0].key;
 await fs.writeFile(input,JSON.stringify(core.review(loaded,{[second]:{verdict:'pass',notes:'Keep this prior note.',updated_at:'2026-01-01'}})));
 const result=await cli.run(['review',input,'--key',first,'--verdict','followup','--note','Check release. 核对当前版本。','--out',out]);
 assert.equal(result.exitCode,0);const updated=await core.parse(await fs.readFile(path.join(out,'review.json'),'utf8'));
 assert.equal(updated.source,loaded.source);assert.equal(updated.sha256,loaded.sha256);assert.equal(updated.decisions[second].notes,'Keep this prior note.');assert.equal(updated.decisions[first].notes,'Check release. 核对当前版本。');await checkSums(out);
});

test('changed source hash and unknown decision keys cannot produce a new saved review',async t=>{
 const root=await workspace(t),input=path.join(root,'input.json'),out=path.join(root,'invalid');
 const loaded=await core.parse(await fs.readFile(path.resolve(__dirname,'../examples/sample-report.json'),'utf8'));
 const review=core.review(loaded,{});review.source_text+=' ';await fs.writeFile(input,JSON.stringify(review));
 await assert.rejects(cli.run(['review',input,'--key',loaded.report.issues[0].key,'--verdict','prototype','--note','x','--out',out]),/SHA-256/);
 await fs.writeFile(input,loaded.source);await assert.rejects(cli.run(['review',input,'--key','other/repo#1','--verdict','pass','--note','x','--out',out]),/Choose --key/);
 await assert.rejects(fs.stat(out),/ENOENT/);
});

test('an interrupted read remains interrupted and does not fetch the next page',async t=>{
 const root=await workspace(t),out=path.join(root,'stop'),controller=new AbortController();let calls=0;
 const result=await cli.run(['collect','https://news.ycombinator.com/item?id=101','--out',out],{signal:controller.signal,fetcher:async()=>{calls++;controller.abort();throw new DOMException('Stopped','AbortError');}});
 assert.equal(result.exitCode,130);assert.equal(calls,1);assert.equal(JSON.parse(await fs.readFile(path.join(out,'failure.json'),'utf8')).status,'interrupted');
});
