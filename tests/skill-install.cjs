/* Exercise an actual installer copy from an unrelated working directory. No live APIs. */
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');

(async()=>{
 const installed=await fs.realpath(process.argv[2]);
 const source=path.resolve(__dirname,'..');
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'gapcue-installed-check-'));
 try {
  const runtime=['SKILL.md','scripts/research.cjs','app/core.js','app/live.js','app/index.html','package.json','examples/sample-report.json'];
  const hashes={};
  for(const name of runtime) {
   const destination=path.join(installed,name),real=await fs.realpath(destination);
   assert.ok(real.startsWith(installed+path.sep),'Runtime file escaped the installed skill.');
   const bytes=await fs.readFile(destination);assert.deepEqual(bytes,await fs.readFile(path.join(source,name)));
   hashes[name]=createHash('sha256').update(bytes).digest('hex');
  }
  for(const name of ['node_modules','.git','artifacts'])await assert.rejects(fs.stat(path.join(installed,name)),/ENOENT/);
  const entry=path.join(installed,'scripts/research.cjs');
  const execute=(args,preload)=>{
   const result=spawnSync(process.execPath,[...(preload?['--require',preload]:[]),entry,...args],{cwd:temporary,encoding:'utf8',timeout:15000});
   assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr+'\n'+result.stdout);return result.stdout;
  };
  const version=execute(['--version']).trim();
  assert.equal(version,JSON.parse(await fs.readFile(path.join(installed,'package.json'),'utf8')).version);
  const preload=path.join(temporary,'fixture.cjs'),requests=path.join(temporary,'requests.json');
  await fs.writeFile(preload,`const fs=require('node:fs');const calls=[];
globalThis.fetch=async(url,options)=>{
 calls.push({url,method:options.method,credentials:options.credentials});fs.writeFileSync(${JSON.stringify(requests)},JSON.stringify(calls));
 let data;
 if(url==='https://hacker-news.firebaseio.com/v0/item/101.json')data={id:101,type:'story',title:'Original installed-runtime fixture',by:'fixture',time:1767225600,score:2,descendants:1};
 else if(url.startsWith('https://hn.algolia.com/api/v1/search_by_date?'))data={page:0,nbPages:1,nbHits:1,hits:[{objectID:'102',story_id:101,parent_id:101,author:'fixture-reader',created_at:'2026-01-02T00:00:00Z',comment_text:'Synthetic fixture, not adoption.'}]};
 else throw new Error('Unexpected fixture URL');
 return new Response(JSON.stringify(data));
};`);
  const collected=path.join(temporary,'thread');
  const receipt=JSON.parse(execute(['collect','https://news.ycombinator.com/item?id=101','--out',collected],preload));
  assert.equal(receipt.status,'complete');assert.equal(receipt.threads[0].comments_collected,1);
  const calls=JSON.parse(await fs.readFile(requests,'utf8'));assert.equal(calls.length,2);assert.ok(calls.every(c=>c.method==='GET'&&c.credentials==='omit'));
  const decision=path.join(temporary,'decision');
  execute(['review',path.join(collected,'review.json'),'--verdict','followup','--note','Check current alternatives. 核对替代方案。','--out',decision]);
  const review=JSON.parse(await fs.readFile(path.join(decision,'review.json'),'utf8'));
  assert.equal(review.source_text,await fs.readFile(path.join(collected,'report.json'),'utf8'));
  assert.equal(createHash('sha256').update(review.source_text).digest('hex'),review.source_sha256);
  assert.equal(review.decisions['hn#101'].verdict,'followup');assert.match(review.decisions['hn#101'].notes,/核对替代方案/);
  process.stdout.write(JSON.stringify({status:'passed',version,checks:['actual installed copy','runtime byte equality','no checkout dependencies','subprocess CLI collect','anonymous GET only','source-preserving bilingual decision'],runtime_sha256:hashes})+'\n');
 } finally { await fs.rm(temporary,{recursive:true,force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1;});
