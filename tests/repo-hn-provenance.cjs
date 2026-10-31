const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require(process.env.GAPCUE_PLAYWRIGHT||'playwright');
const {createServer}=require('../scripts/serve.cjs');

(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gapcue-origin-'));
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route(/https:\/\/(api\.github\.com|hn\.algolia\.com|hacker-news\.firebaseio\.com)\//,async route=>{
  const url=new URL(route.request().url());let data;
  if(url.hostname==='api.github.com')data={total_count:1,incomplete_results:false,items:[{id:123,full_name:'sampleorg/desk',html_url:'https://github.com/sampleorg/desk',description:null,created_at:'2026-10-02T00:00:00Z',stargazers_count:145,archived:false,fork:false,license:null}]};
  else if(url.hostname==='hacker-news.firebaseio.com')data={id:101,type:'story',by:'fixture-author',time:1791000000,title:'Desk discussion',text:'Fictional report.',score:7,descendants:0,url:'https://example.com/desk'};
  else if((url.searchParams.get('tags')||'').includes('comment'))data={page:0,nbHits:0,nbPages:0,hits:[]};
  else data={nbHits:1,hits:[{objectID:'101',title:'Desk discussion',author:'fixture-author',created_at:'2026-10-01T10:00:00Z',points:7,num_comments:0,url:'https://example.com/desk'}]};
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 });
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#issueList button').first().waitFor();
  await page.selectOption('#search-source','github');await page.fill('#source-input','desk');await page.click('#search');await page.locator('.repo-hn').first().click();
  await page.locator('.result-open').first().click();await page.waitForFunction(()=>document.getElementById('issueKey').textContent==='hn#101');
  assert.equal(await page.locator('#references a').first().getAttribute('href'),'https://github.com/sampleorg/desk');
  assert.match(await page.locator('#references').innerText(),/not verified/);
  await page.locator('#notes').fill('Check project ownership.');
  const d=page.waitForEvent('download');await page.click('#export');const download=await d;const file=path.join(dir,'review.json');await download.saveAs(file);
  const review=JSON.parse(await fs.readFile(file,'utf8')),source=JSON.parse(review.source_text);
  assert.deepEqual(source.discovery.repository_context,{full_name:'sampleorg/desk',url:'https://github.com/sampleorg/desk',relation:'name_search_unverified'});
  await page.close();const restored=await context.newPage();await restored.goto('file://'+path.join(__dirname,'../app/index.html'));await restored.locator('#issueList button').first().waitFor();await context.setOffline(true);
  await restored.locator('#file').setInputFiles(file);await restored.waitForFunction(()=>document.getElementById('notes').value==='Check project ownership.');
  assert.equal(await restored.locator('#references a').first().getAttribute('href'),'https://github.com/sampleorg/desk');assert.match(await restored.locator('#references').innerText(),/not verified/);
  source.discovery.repository_context.url='https://evil.invalid/sampleorg/desk';const bad=path.join(dir,'bad.json');await fs.writeFile(bad,JSON.stringify(source));await restored.locator('#file').setInputFiles(bad);
  await restored.waitForFunction(()=>!document.getElementById('error').hidden);assert.match(await restored.locator('#error').innerText(),/Invalid repository search origin/);assert.equal(await restored.locator('#notes').inputValue(),'Check project ownership.');
  assert.deepEqual(errors,[]);console.log('Repository origin: saved and reopened offline, explicitly unverified; unsafe origin rejected.');
 }finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
