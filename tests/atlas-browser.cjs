const assert=require('node:assert/strict');
const {chromium}=require(process.env.GAPCUE_PLAYWRIGHT||'playwright');
const {createServer}=require('../scripts/serve.cjs');
const entry={repo:'example/agent',url:'https://github.com/example/agent',description:'<img src=x onerror="window.injected=1">',stars:42,starsPerDay:3,createdAt:'2026-10-15'};
const fixture={generatedAt:'2026-10-30T05:49:31.902Z',rising:[entry,...Array.from({length:9},(_,i)=>({...entry,repo:`example/agent${i}`,url:`https://github.com/example/agent${i}`}))]};
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],requests=[];let mode='normal',releaseSlow;
 page.on('pageerror',error=>errors.push(error.message));
 await context.route('https://agentatlas.dev/trending.json',async route=>{
  const req=route.request();requests.push({url:req.url(),method:req.method(),headers:req.headers()});
  if(mode==='slow')await new Promise(r=>releaseSlow=r);
  const data=mode==='invalid'?{...fixture,rising:[{...entry,url:'https://attacker.invalid/agent'}]}:fixture;
  try{await route.fulfill({status:mode==='failed'?503:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});}catch(error){if(!req.failure())throw error;}
 });
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#issueList button').first().waitFor();
  await page.locator('#notes').fill('Keep this note');await page.locator('#source-input').fill('private search words');await page.locator('#atlas').click();await page.locator('.repo-title').first().waitFor();
  assert.equal(await page.locator('.repo-title').first().textContent(),'example/agent');assert.equal(await page.locator('.repo-title').first().getAttribute('href'),'https://github.com/example/agent');assert.equal(await page.locator('.repo-title').count(),8);await page.locator('#atlas-more').click();assert.equal(await page.locator('.repo-title').count(),10);await page.locator('#atlas-more').click();assert.equal(await page.locator('.repo-title').count(),8);
  assert.match(await page.locator('#resultMeta').innerText(),/2026-10-30 05:49 UTC/);assert.match(await page.locator('#resultMeta').innerText(),/not recent daily growth/);assert.match(await page.locator('#searchResults').innerText(),/3 average Stars\/day since creation/);
  assert.equal(await page.locator('#resultMeta a').first().getAttribute('href'),'https://agentatlas.dev/trending');assert.equal(await page.locator('#resultMeta a').nth(1).getAttribute('href'),'https://creativecommons.org/licenses/by/4.0/');
  assert.equal(await page.locator('.repo-description img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);assert.equal(await page.locator('#notes').inputValue(),'Keep this note');
  assert.equal(requests[0].url,'https://agentatlas.dev/trending.json');assert.equal(requests[0].method,'GET');for(const key of ['authorization','cookie','referer'])assert.equal(requests[0].headers[key],undefined);
  await page.locator('#language').click();await page.setViewportSize({width:390,height:844});assert.match(await page.locator('#resultMeta').innerText(),/创建以来的平均值/);assert.match(await page.locator('#searchResults').innerText(),/创建以来日均 Star/);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  mode='invalid';await page.locator('#atlas').click();await page.waitForFunction(()=>document.getElementById('researchStatus').textContent.includes('暂不可用'));assert.equal(await page.locator('#discover').isHidden(),true);assert.equal(await page.locator('#notes').inputValue(),'Keep this note');
  mode='slow';await page.locator('#atlas').click();for(let i=0;i<100&&!releaseSlow;i++)await new Promise(r=>setTimeout(r,10));assert.ok(releaseSlow);await page.locator('#stop').click();releaseSlow();await page.waitForTimeout(150);assert.equal(await page.locator('#discover').isHidden(),true);assert.equal(await page.locator('#notes').inputValue(),'Keep this note');
  assert.deepEqual(errors,[]);console.log('AgentAtlas browser: attribution, dates, average, inert description, privacy, failure, cancellation, bilingual and mobile passed.');
 }finally{releaseSlow?.();await context.close();await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
