'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.GAPCUE_PLAYWRIGHT||'playwright');
const {createServer}=require('../scripts/serve.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route(/https:\/\/(api\.github\.com|hn\.algolia\.com|hacker-news\.firebaseio\.com)\//,async route=>{
  const url=new URL(route.request().url());requests.push(url);let data;
  if(url.hostname==='api.github.com')data={total_count:1,incomplete_results:false,items:[{id:321,full_name:'example/corgi',html_url:'https://github.com/example/corgi',description:'A fictional matching name',created_at:'2026-10-02T00:00:00Z',stargazers_count:42,fork:false,archived:false,license:{spdx_id:'MIT'}}]};
  else if(url.hostname==='hacker-news.firebaseio.com')data={id:101,type:'story',by:'author',time:1791000000,title:'Show HN: Corgi – a terminal for agents',text:'',score:7,descendants:0,url:'https://example.com/corgi'};
  else if((url.searchParams.get('tags')||'').includes('comment'))data={page:0,nbHits:0,nbPages:0,hits:[]};
  else data={nbHits:1,hits:[{objectID:'101',title:'Show HN: Corgi – a terminal for agents',author:'author',created_at:'2026-10-01T10:00:00Z',points:7,num_comments:0,url:'https://example.com/corgi'}]};
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 });
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#issueList button').first().waitFor();
  await page.locator('#notes').fill('Keep this note.');await page.fill('#source-input','agent tools');await page.selectOption('#search-days','30');await page.click('#search');
  await page.locator('.hn-find-repos').first().click();assert.equal(await page.inputValue('#source-input'),'Corgi');assert.equal(await page.inputValue('#search-source'),'github');assert.equal(await page.inputValue('#search-days'),'0');
  assert.match(await page.locator('#researchStatus').innerText(),/Edit the suggested name/);assert.equal(requests.filter(u=>u.hostname==='api.github.com').length,0);
  await page.fill('#source-input','corgi terminal');await page.click('#search');await page.locator('.repo-title').waitFor();
  assert.equal(await page.locator('.repo-title').innerText(),'example/corgi');assert.match(await page.locator('#resultMeta').innerText(),/candidates, not verified/);assert.equal(await page.locator('#resultMeta a').getAttribute('href'),'https://news.ycombinator.com/item?id=101');
  const downloadEvent=page.waitForEvent('download');await page.click('#save-repo-snapshot');const snapshot=await downloadEvent;const snapshotPath=await snapshot.path();const data=JSON.parse(await require('node:fs/promises').readFile(snapshotPath,'utf8'));assert.deepEqual(data.origin,{story_url:'https://news.ycombinator.com/item?id=101',relation:'name_search_unverified'});
  const gh=requests.filter(u=>u.hostname==='api.github.com');assert.equal(gh.length,1);assert.match(gh[0].searchParams.get('q'),/^corgi terminal /);assert.doesNotMatch(gh[0].searchParams.get('q'),/created:/);
  assert.equal(await page.locator('#notes').inputValue(),'Keep this note.');await page.getByRole('button',{name:'Back to HN results'}).click();
  assert.equal(await page.inputValue('#source-input'),'agent tools');assert.equal(await page.inputValue('#search-days'),'30');assert.equal(await page.inputValue('#search-source'),'hn');
  page.once('dialog',dialog=>dialog.accept());await page.locator('.result-open').first().click();await page.waitForFunction(()=>document.getElementById('issueKey').textContent==='hn#101');
  await page.locator('#notes').fill('Keep the HN review.');await page.click('#language');await page.locator('#references .hn-find-repos').click();
  assert.equal(await page.inputValue('#source-input'),'Corgi');assert.match(await page.locator('#researchStatus').innerText(),/同名结果可能无关/);
  await page.click('#search');await page.locator('.repo-title').waitFor();assert.match(await page.locator('#resultMeta').innerText(),/只是候选/);assert.equal(await page.locator('#notes').inputValue(),'Keep the HN review.');
  await page.getByRole('button',{name:'返回 HN 结果'}).click();assert.equal(await page.inputValue('#source-input'),'agent tools');
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.goto('http://127.0.0.1:'+server.address().port+'/compare.html?lang=zh');await page.locator('#first').setInputFiles(snapshotPath);await page.locator('#first-origin a').waitFor();assert.equal(await page.locator('#first-origin a').getAttribute('href'),'https://news.ycombinator.com/item?id=101');assert.match(await page.locator('#first-origin').innerText(),/尚未核实/);assert.equal(await page.locator('#result').isHidden(),true);
  await page.click('#language');await page.waitForFunction(()=>document.getElementById('first-origin').textContent.includes('not verified'));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const other={...data,captured_at:new Date(Date.parse(data.captured_at)+60000).toISOString(),origin:{story_url:'https://news.ycombinator.com/item?id=102',relation:'name_search_unverified'}};await page.locator('#second').setInputFiles({name:'other.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(other))});await page.waitForFunction(()=>!document.getElementById('result').hidden);assert.equal(await page.locator('#first-origin a').getAttribute('href'),'https://news.ycombinator.com/item?id=101');assert.equal(await page.locator('#second-origin a').getAttribute('href'),'https://news.ycombinator.com/item?id=102');
  await page.locator('#first').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...data,origin:{story_url:'https://evil.invalid/',relation:'name_search_unverified'}}))});assert.match(await page.locator('#status').innerText(),/Could not read/);assert.equal(await page.locator('#first-origin').isHidden(),true);
  const offline=await browser.newContext({offline:true});try{const p=await offline.newPage();await p.goto(require('node:url').pathToFileURL(path.join(__dirname,'../app/compare.html')).href);await p.locator('#first').setInputFiles(snapshotPath);await p.locator('#first-origin a').waitFor();assert.equal(await p.locator('#first-origin a').getAttribute('href'),'https://news.ycombinator.com/item?id=101');}finally{await offline.close()}
  assert.deepEqual(errors,[]);
  console.log('HN title search: explicit user query, no premature GitHub request, editable candidates, return to HN, notes and bilingual UI passed.');
 }finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
