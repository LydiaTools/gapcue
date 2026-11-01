const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require(process.env.GAPCUE_PLAYWRIGHT||'playwright');
const {createServer}=require('../scripts/serve.cjs');
const fixtureQ={question_id:101,title:'Synthetic agent question',link:'https://stackoverflow.com/questions/101/example',creation_date:1780000000,answer_count:1,body:'A &lt;script&gt;window.injected=true&lt;/script&gt; <a href="https://github.com/example/fixture/issues/2">project</a>',owner:{display_name:'Original author',link:'https://stackoverflow.com/users/5/person'},content_license:'CC BY-SA 4.0'};
const fixtureA={answer_id:202,question_id:101,creation_date:1780000001,body:'A synthetic answer.',owner:{display_name:'Answer author',link:'https://stackoverflow.com/users/6/person'},content_license:'CC BY-SA 3.0',is_accepted:true};
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'gapcue-so-browser-'));
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:900}}),page=await ctx.newPage(),apiRequests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await ctx.route('https://api.stackexchange.com/**',async route=>{
  const req=route.request(),u=new URL(req.url());apiRequests.push(req.url());assert.equal(req.method(),'GET');assert.equal(req.headers().authorization,undefined);assert.equal(req.headers().cookie,undefined);assert.equal(req.headers().referer,undefined);
  const body=u.pathname.includes('search/advanced')?{items:[fixtureQ],has_more:false}:u.pathname.includes('/answers')?{items:[fixtureA],has_more:false}:{items:[fixtureQ],has_more:false};
  await route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(body)});
 });
 await ctx.route('https://api.github.com/repos/example/fixture',route=>route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify({private:false,full_name:'example/fixture',html_url:'https://github.com/example/fixture',stargazers_count:17,created_at:'2026-01-01T00:00:00Z',archived:false,fork:false})}));
 try{
  await page.goto(url+'/stackoverflow.html');assert.equal(apiRequests.length,0);
  await page.locator('#query').fill('agent workflow');await page.locator('#search').click();await page.getByRole('button',{name:'Synthetic agent question'}).waitFor();assert.equal(apiRequests.length,1);
  await page.getByRole('button',{name:'Synthetic agent question'}).click();await page.locator('#questionTitle').getByText('Synthetic agent question').waitFor();assert.equal(apiRequests.length,3);
  assert.match(await page.locator('#questionCredit').textContent(),/Original author/);assert.match(await page.locator('#questionCredit').textContent(),/CC BY-SA 4.0/);assert.match(await page.locator('#answers').textContent(),/Answer author/);assert.match(await page.locator('#answers').textContent(),/CC BY-SA 3.0/);assert.equal(await page.evaluate(()=>window.injected),undefined);
  assert.equal(await page.getByRole('link',{name:'example/fixture'}).getAttribute('href'),'https://github.com/example/fixture');await page.getByRole('button',{name:'Check current Stars'}).click();await page.getByText(/17 Stars/).waitFor();
  await page.locator('#notes').fill('Compare the existing tool before building.');await page.locator('#verdict').selectOption('followup');
  const download=page.waitForEvent('download');await page.locator('#save').click();const saved=path.join(temp,'review.json');await (await download).saveAs(saved);
  const bundle=JSON.parse(await fs.readFile(saved,'utf8'));assert.equal(bundle.verdict,'followup');assert.match(bundle.notes,/Compare/);assert.equal(JSON.parse(bundle.source_text).answers[0].attribution.license,'CC BY-SA 3.0');
  const prior=apiRequests.length;await page.locator('#search').click();await page.getByText(/requested recently/).waitFor();assert.equal(apiRequests.length,prior);
  await page.close();const restored=await ctx.newPage();
  // Open the local viewer, then disconnect before importing the saved file.
  await restored.goto('file://'+path.resolve('app/stackoverflow.html'));await ctx.setOffline(true);await restored.locator('#file').setInputFiles(saved);await restored.getByText('Saved research opened.').waitFor();assert.equal(await restored.locator('#notes').inputValue(),'Compare the existing tool before building.');assert.equal(await restored.locator('#verdict').inputValue(),'followup');assert.equal(apiRequests.length,prior);
  await restored.locator('#language').click();await restored.setViewportSize({width:390,height:844});assert.equal(await restored.locator('h1').textContent(),'从问题出发，寻找项目。');assert.equal(await restored.locator('#saveStatus').textContent(),'已打开保存的调研。');assert.ok(await restored.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await restored.screenshot({path:path.join(temp,'mobile-zh.png'),fullPage:true});
  const bad={...bundle,source_text:bundle.source_text+' '};const badfile=path.join(temp,'tampered.json');await fs.writeFile(badfile,JSON.stringify(bad));await restored.locator('#file').setInputFiles(badfile);await restored.getByText('无法打开此调研文件。').waitFor();assert.equal(await restored.locator('#notes').inputValue(),'Compare the existing tool before building.');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'passed',browser:browser.version(),api_requests:apiRequests.length,checks:['anonymous search','attributed question and answer','inert source text','GitHub star on demand','saved review','duplicate request blocked','offline restore','Chinese mobile','tamper rejected'],screenshot:path.join(temp,'mobile-zh.png')},null,2));
 }finally{await ctx.close();await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
