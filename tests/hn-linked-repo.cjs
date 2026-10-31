const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require(process.env.GAPCUE_PLAYWRIGHT||'playwright');
const {createServer}=require('../scripts/serve.cjs');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gapcue-hn-repo-'));const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});const context=await browser.newContext({acceptDownloads:true});const page=await context.newPage(),reads=[],errors=[];let failRepo=false;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route(/https:\/\/(api\.github\.com|hn\.algolia\.com|hacker-news\.firebaseio\.com)\//,async route=>{
  const u=new URL(route.request().url());reads.push(u.href);let data;
  if(u.hostname==='api.github.com'){
   if(failRepo)return route.fulfill({status:429,contentType:'application/json',body:'{}'});
   data={full_name:'Example/project',html_url:'https://github.com/Example/project',private:false,archived:false,fork:false,stargazers_count:42,created_at:'2026-10-02T00:00:00Z'};
  }else if(u.hostname==='hacker-news.firebaseio.com')data={id:101,type:'story',by:'author',time:1791000000,title:'A synthetic project',text:'',score:7,descendants:0,url:'https://github.com/Example/project'};
  else if((u.searchParams.get('tags')||'').includes('comment'))data={page:0,nbHits:0,nbPages:0,hits:[]};
  else data={nbHits:1,hits:[{objectID:'101',title:'A synthetic project',author:'author',created_at:'2026-10-01T10:00:00Z',points:7,num_comments:0,url:'https://github.com/Example/project'}]};
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 });
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#issueList button').first().waitFor();
  await page.fill('#source-input','project');await page.click('#search');await page.locator('.result-open').first().waitFor();
  assert.equal(reads.filter(x=>x.startsWith('https://api.github.com/')).length,0);
  await page.locator('.linked-repo').first().click();await page.getByText(/42 current Stars/).waitFor();assert.match(await page.locator('.linked-repo-detail').first().innerText(),/not saved with the review/);
  assert.equal(reads.filter(x=>x.startsWith('https://api.github.com/')).length,1);
  await page.locator('.result-open').first().click();await page.waitForFunction(()=>document.getElementById('issueKey').textContent==='hn#101');
  await page.locator('#notes').fill('Keep this decision.');await page.locator('#references .linked-repo').click();await page.locator('#references').getByText(/42 current Stars/).waitFor();
  failRepo=true;await page.locator('#references .linked-repo').click();await page.locator('#references').getByText(/GitHub repository unavailable/).waitFor();assert.equal(await page.locator('#notes').inputValue(),'Keep this decision.');
  const event=page.waitForEvent('download');await page.locator('#export').click();const file=path.join(dir,'review.json');await (await event).saveAs(file);
  const saved=JSON.parse(await fs.readFile(file,'utf8'));const source=JSON.parse(saved.source_text);assert.equal(source.threads[0].references[0].url,'https://github.com/Example/project');assert.equal(source.threads[0].references[0].check,'link_only');assert.equal(source.requests.some(x=>x.url.startsWith('https://api.github.com/')),false);
  await page.click('#language');assert.equal(await page.locator('#notes').inputValue(),'Keep this decision.');await page.locator('#references .linked-repo').waitFor();assert.match(await page.locator('#references .linked-repo').innerText(),/查看链接/);
  assert.deepEqual(errors,[]);console.log('HN linked repository: explicit read, current Stars, safe failure, unsaved review preserved; bilingual control.');
 }finally{await context.close();await browser.close();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
