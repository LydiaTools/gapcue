const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url'),{chromium}=require(process.env.GAPCUE_PLAYWRIGHT||'playwright'),{createServer}=require('../scripts/serve.cjs');
const repo=(id,full_name,stars)=>({id,full_name,html_url:'https://github.com/'+full_name,description:null,created_at:'2026-10-01T00:00:00Z',stargazers_count:stars,fork:false,archived:false,license:null});
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true}),server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const ctx=await browser.newContext({viewport:{width:1365,height:900},acceptDownloads:true}),page=await ctx.newPage(),errors=[];let calls=0;
 page.on('pageerror',e=>errors.push(e.message));
 await ctx.route('https://api.github.com/search/repositories**',route=>{calls++;const data={total_count:2,incomplete_results:calls===2,items:calls===1?[repo(1,'example/old',100),repo(2,'example/removed',8)]:[repo(1,'example/renamed',107),repo(3,'example/added',9)]};return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)})});
 try{
  const base='http://127.0.0.1:'+server.address().port;await page.goto(base);await page.locator('#search-source').selectOption('github');await page.locator('#source-input').fill('agents');await page.locator('#search').click();await page.locator('#save-repo-snapshot').waitFor();
  let event=page.waitForEvent('download');await page.locator('#save-repo-snapshot').click();const a=await event;const aPath=await a.path();
  await page.waitForTimeout(30);await page.locator('#search').click();await page.waitForFunction(()=>document.querySelector('.repo-title')?.textContent==='example/renamed');event=page.waitForEvent('download');await page.locator('#save-repo-snapshot').click();const b=await event;const bPath=await b.path();
  await page.goto(base+'/compare.html?lang=zh');await page.locator('#first').setInputFiles(bPath);await page.locator('#second').setInputFiles(aPath);
  await page.waitForFunction(()=>!document.getElementById('result').hidden);assert.match(await page.locator('#rows').innerText(),/example\/renamed/);assert.match(await page.locator('#rows').innerText(),/example\/old/);assert.match(await page.locator('#rows').innerText(),/\+7/);assert.match(await page.locator('#missing').innerText(),/1.*1/);assert.match(await page.locator('#scope').innerText(),/不完整/);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(os.tmpdir(),'gapcue-compare-mobile.png'),fullPage:true});
  await page.locator('#language').click();await page.waitForFunction(()=>document.getElementById('scope').textContent.includes('incomplete'));assert.match(await page.locator('#scope').innerText(),/incomplete/);
  await page.locator('#second').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await page.waitForFunction(()=>document.getElementById('status').innerText.includes('Could not read'));assert.match(await page.locator('#status').innerText(),/Could not read/);assert.equal(await page.locator('#result').isHidden(),true);
  const offline=await browser.newContext({offline:true});try{const p=await offline.newPage();await p.goto(pathToFileURL(path.join(__dirname,'../app/compare.html')).href);await p.locator('#first').setInputFiles(aPath);await p.locator('#second').setInputFiles(bPath);await p.waitForFunction(()=>!document.getElementById('result').hidden);assert.match(await p.locator('#rows').innerText(),/\+7/);}finally{await offline.close()}
  assert.deepEqual(errors,[]);console.log('Repository snapshots: downloads, stable IDs, partial results, language, malformed input, mobile and offline passed.');
 }finally{await ctx.close();await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
