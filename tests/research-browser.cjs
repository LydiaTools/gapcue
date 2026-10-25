const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(process.env.GAPCUE_PLAYWRIGHT||'playwright');
const {createServer}=require('../scripts/serve.cjs');
const root=path.resolve(__dirname,'..'),stamp=new Date().toISOString().replace(/[:.]/g,'-');
const output=path.join(root,'artifacts','research-'+stamp);
const real=process.env.GAPCUE_REAL_PUBLIC==='1';
const story={id:101,type:'story',by:'fixture-author',time:1780000000,title:'Original synthetic research thread',text:'A fictional request for a portable review. <img src="https://example.invalid/tracker">',score:7,descendants:13,url:'https://github.com/example/fixture'};
const comment=(id,parent,date)=>({objectID:String(id),story_id:101,parent_id:parent,author:'fixture-reader',created_at:date,comment_text:'Keep the exact source beside the decision. &lt;script&gt;window.injected=true&lt;/script&gt;'});
(async()=>{
 await fs.mkdir(output,{recursive:true});
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=process.env.GAPCUE_PUBLIC_URL||'http://127.0.0.1:'+server.address().port;
 if(process.env.GAPCUE_PUBLIC_URL)assert.equal(new URL(origin).origin,'https://lydiatools.github.io');
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true,...(process.env.GAPCUE_PROXY?{proxy:{server:process.env.GAPCUE_PROXY,bypass:'localhost,127.0.0.1'}}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const page=await context.newPage(),errors=[],reads=[],checks=[];let mode='normal',releaseSlow;
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
 context.on('request',request=>{if(['hn.algolia.com','hacker-news.firebaseio.com','api.github.com'].includes(new URL(request.url()).hostname)){assert.equal(request.method(),'GET');assert.equal(request.headers().authorization,undefined);assert.equal(request.headers().cookie,undefined);assert.equal(request.headers().referer,undefined);reads.push(request.url());}});
 if(!real)await context.route(/https:\/\/(hn\.algolia\.com|hacker-news\.firebaseio\.com|api\.github\.com)\//,async route=>{
  const url=new URL(route.request().url());let data,status=200;
  if(mode==='rate')status=429,data={message:'Synthetic rate limit'};
  else if(url.hostname==='hacker-news.firebaseio.com')data=story;
  else if(url.hostname==='hn.algolia.com'&&!url.searchParams.get('tags').includes('comment')){
   const query=url.searchParams.get('query');
   if(query==='slow')await new Promise(resolve=>{releaseSlow=resolve;});
   data={nbHits:1,hits:[{objectID:'101',title:query==='fresh'?'Fresh synthetic result':story.title,author:'fixture-author',points:7,num_comments:13,created_at:'2026-10-01T10:00:00Z',url:story.url}]};
  }else if(url.hostname==='hn.algolia.com')data={page:Number(url.searchParams.get('page')),nbHits:13,nbPages:2,hits:url.searchParams.get('page')==='1'?[comment(1001,101,'2026-09-01T10:00:00Z')]:[comment(1003,1001,'2026-10-01T10:00:00Z'),comment(1002,101,'2026-09-30T10:00:00Z')]};
  else if(url.pathname==='/repos/example/project')data={private:false,visibility:'public',full_name:'example/project',stargazers_count:5,html_url:'https://github.com/example/project'};
  else if(url.pathname.endsWith('/comments')){
   if(url.searchParams.get('page')==='2')status=503,data={};
   else data=[{id:1,html_url:'https://github.com/example/project/issues/5#issuecomment-1',body:'Original synthetic comment.',created_at:'2026-10-01T10:00:00Z',user:{login:'fixture-reader',type:'User'}}];
  }else data={number:5,title:'Original synthetic GitHub issue',state:'open',comments:11,body:'Read the latest discussion first.',created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-02T00:00:00Z',user:{login:'fixture-author'}};
  try{await route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});}catch(error){if(!route.request().failure())throw error;}
 });
 try{
  await page.goto(origin);await page.locator('#issueList button').first().waitFor();assert.equal(reads.length,0);
  checks.push('Page load and fictional sample make no public API requests.');
  const query=real?'Corgi':'portable research';
  if(!real)await page.locator('#notes').fill('Keep this old review until I choose to replace it.');
  await page.locator('#source-input').fill(query);await page.locator('#search').click();await page.locator('.result-open').first().waitFor();
  assert.ok(reads[0].includes('numericFilters='));
  if(!real)assert.match(await page.locator('#notes').inputValue(),/Keep this old review/);
  await page.screenshot({path:path.join(output,'search-en.png'),fullPage:false});
  checks.push('Keyword search returns bounded source-linked stories and dated metrics without replacing current notes.');
  const chosen=real?page.getByRole('button',{name:/Show HN: Corgi, a helpful/}):page.locator('.result-open').first();
  if(!real)page.once('dialog',d=>d.accept());
  await chosen.click();await page.waitForFunction(()=>document.getElementById('issueState').textContent==='Discussion');
  assert.equal(await page.locator('#discover').getAttribute('open'),null);
  assert.match(await page.locator('#referenceHeading').textContent(),/Project links/);
  assert.ok(await page.locator('#comments a').count()>0);
  assert.equal(await page.evaluate(()=>window.injected),undefined);
  assert.equal(await page.locator('#coverage').textContent().then(v=>v.includes('bot comments')),false);
  await page.locator('#verdict').selectOption('followup');await page.locator('#notes').fill('Check the alternative before making a prototype. Source stays original.');
  const downloadEvent=page.waitForEvent('download');await page.locator('#export').click();const downloaded=await downloadEvent;
  const saved=path.join(output,'actual-review.json');await downloaded.saveAs(saved);assert.equal(await downloaded.failure(),null);
  const review=JSON.parse(await fs.readFile(saved,'utf8')),report=JSON.parse(review.source_text);
  assert.equal(report.source_kind,'hackernews');assert.equal(report.discovery.search.query,query);assert.equal(report.discovery.selected_id,report.threads[0].number);
  assert.equal(report.threads[0].state,'discussion');assert.ok(report.requests.every(r=>r.url.startsWith('https://')));
  await fs.writeFile(path.join(output,'collected-source.json'),review.source_text);
  await page.screenshot({path:path.join(output,'thread-en.png'),fullPage:false});
  checks.push('Chosen HN story has explicit discussion state, indexed sample/parent links and an actual review download including discovery query and source metrics.');
  await page.close();
  const restored=await context.newPage();await restored.goto('file://'+path.join(root,'app/index.html'));await restored.locator('#issueList button').first().waitFor();
  await context.setOffline(true);await restored.locator('#file').setInputFiles(saved);await restored.waitForFunction(()=>document.getElementById('notes').value.includes('Check the alternative'));
  assert.equal(await restored.locator('#verdict').inputValue(),'followup');assert.equal(await restored.locator('#issueTitle').textContent(),report.threads[0].title);
  checks.push('Actual tab close, file:// reopen and disconnected import preserve the exact HN source and decision.');
  await restored.locator('#language').click();await restored.setViewportSize({width:390,height:844});
  assert.equal(await restored.locator('h1').textContent(),'\u641c\u7d22\u4e0e\u6838\u5bf9\u8ba8\u8bba');assert.ok(await restored.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await restored.screenshot({path:path.join(output,'thread-mobile-zh.png'),fullPage:true});
  checks.push('390px Chinese controls preserve source text, notes and parent URLs without page overflow.');
  await context.setOffline(false);await restored.close();
  const recovery=await context.newPage();await recovery.goto(origin);await recovery.locator('#issueList button').first().waitFor();await recovery.locator('#file').setInputFiles(saved);await recovery.waitForFunction(()=>document.getElementById('notes').value.includes('Check the alternative'));
  if(real){
   await recovery.locator('#source-input').fill('https://github.com/microsoft/markitdown/issues/293');recovery.once('dialog',d=>d.accept());await recovery.locator('#search').click();
   await recovery.waitForFunction(()=>document.getElementById('issueKey').textContent==='microsoft/markitdown#293',{},{timeout:120000});
   assert.match(await recovery.locator('#snapshotStatus').textContent(),/Requested reads completed|Some sources unavailable/);
   const event=recovery.waitForEvent('download');await recovery.locator('#export').click();await (await event).saveAs(path.join(output,'actual-github-review.json'));
   await recovery.screenshot({path:path.join(output,'github-en.png'),fullPage:false});
   checks.push('Actual anonymous browser collection of microsoft/markitdown#293 completes with visible current source/reference outcomes; partial remains partial.');
  }else{
   mode='rate';await recovery.locator('#source-input').fill('https://github.com/example/project/issues/5');await recovery.locator('#search').click();await recovery.waitForFunction(()=>document.getElementById('researchStatus').textContent.includes('API limit'));
   assert.equal(await recovery.locator('#issueTitle').textContent(),report.threads[0].title);assert.match(await recovery.locator('#notes').inputValue(),/Check the alternative/);
   checks.push('Rate limit does not replace the current source or notes and does not retry.');
   mode='normal';await recovery.locator('#search').click();await recovery.waitForFunction(()=>document.getElementById('snapshotStatus').textContent==='Some sources unavailable');
   assert.equal(await recovery.locator('#issueKey').textContent(),'example/project#5');assert.match(await recovery.locator('#comments').textContent(),/could not be read/);
   checks.push('One failed GitHub comment page produces a readable partial snapshot with visible omissions.');
   await recovery.locator('#notes').fill('Keep me during cancellation.');await recovery.locator('#source-input').fill('slow');await recovery.locator('#search').click();
   for(let i=0;i<100&&!releaseSlow;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(releaseSlow);
   await recovery.locator('#stop').click();assert.match(await recovery.locator('#researchStatus').textContent(),/Stopped/);assert.equal(await recovery.locator('#notes').inputValue(),'Keep me during cancellation.');
   await recovery.locator('#source-input').fill('fresh');await recovery.locator('#search').click();await recovery.getByRole('button',{name:'Fresh synthetic result',exact:true}).waitFor();releaseSlow();
   await recovery.waitForTimeout(80);assert.equal(await recovery.getByRole('button',{name:'Fresh synthetic result',exact:true}).count(),1);assert.equal(await recovery.locator('#notes').inputValue(),'Keep me during cancellation.');
   checks.push('Abort and a late older search response cannot replace the newer result or unsaved notes.');
  }
  assert.deepEqual(errors,[]);
  const result={captured_at:new Date().toISOString(),mode:real?'actual anonymous public APIs':'controlled original synthetic API fixtures',browser:browser.version(),source_commit:process.env.GITHUB_SHA||null,checks,public_reads:reads,page_errors:errors,output,scope:'Source retrieval and local research workflow; not external adoption, demand validation or Star attribution.'};
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{releaseSlow?.();await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
