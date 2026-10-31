const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require(process.env.GAPCUE_PLAYWRIGHT||'playwright');
const {createServer}=require('../scripts/serve.cjs');
const fixture={id:123,full_name:'example/desk',html_url:'https://github.com/example/desk',description:'<img src=x onerror="window.injected=1">',created_at:'2026-10-02T00:00:00Z',stargazers_count:145,archived:false,fork:false,license:{spdx_id:"NOASSERTION"}};
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),errors=[],requests=[];let mode='normal',releaseSlow;
 page.on('pageerror',e=>errors.push(e.message));
 await ctx.route('https://api.github.com/search/repositories**',async route=>{
  const req=route.request(),url=new URL(req.url()),headers=req.headers();requests.push({url,headers,method:req.method()});
  const q=url.searchParams.get('q');if(q.startsWith('slow '))await new Promise(r=>releaseSlow=r);
  const item={...fixture,full_name:q.startsWith('fresh ')?'example/fresh':fixture.full_name};item.html_url='https://github.com/'+item.full_name;
  if(mode==='invalid')item.html_url='https://evil.invalid/example/desk';
  const data={total_count:mode==='empty'?0:10,incomplete_results:mode==='partial',items:mode==='empty'?[]:[item]};
  try{await route.fulfill({status:mode==='rate'?429:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});}catch(e){if(!req.failure())throw e;}
 });
 try{
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#issueList button').first().waitFor();
  await page.locator('#notes').fill('Preserve this review.');await page.locator('#search-source').selectOption('github');await page.locator('#search-days').selectOption('30');await page.locator('#source-input').fill('agents');await page.locator('#search').click();await page.locator('.repo-title').waitFor();
  assert.equal(await page.locator('.repo-title').textContent(),'example/desk');assert.match(await page.locator('#searchResults').innerText(),/145 Stars/);assert.match(await page.locator('#searchResults').innerText(),/License not detected/);assert.match(await page.locator('#resultMeta').innerText(),/Created since .* UTC/);assert.match(await page.locator('#resultMeta').innerText(),/not growth or demand/);assert.equal(await page.evaluate(()=>window.injected),undefined);assert.equal(await page.locator('.repo-description img').count(),0);assert.equal(await page.locator('#notes').inputValue(),'Preserve this review.');await page.screenshot({path:path.join(os.tmpdir(),'gapcue-repo-fixture-desktop.png'),fullPage:true});
  const q=requests[0].url.searchParams;assert.match(q.get('q'),/archived:false fork:false created:>=\d{4}-\d{2}-\d{2}/);assert.equal(q.get('sort'),'stars');assert.equal(q.get('order'),'desc');assert.equal(q.get('per_page'),'8');assert.equal(requests[0].method,'GET');for(const h of ['authorization','cookie','referer'])assert.equal(requests[0].headers[h],undefined);
  mode='partial';await page.locator('#search').click();await page.waitForFunction(()=>document.getElementById('resultMeta').textContent.includes('incomplete'));await page.locator('#language').click();assert.match(await page.locator('#resultMeta').innerText(),/不完整/);assert.match(await page.locator('#resultMeta').innerText(),/创建日期自/);await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(os.tmpdir(),'gapcue-repo-fixture-mobile.png'),fullPage:true});
  mode='empty';await page.locator('#search').click();await page.waitForFunction(()=>document.getElementById('searchResults').textContent.includes('没有匹配'));mode='rate';await page.locator('#search').click();await page.waitForFunction(()=>document.getElementById('researchStatus').textContent.includes('额度'));assert.equal(await page.locator('#discover').isHidden(),true);assert.doesNotMatch(await page.locator('#researchStatus').innerText(),/Python/);assert.equal(await page.locator('#notes').inputValue(),'Preserve this review.');
  await page.locator('#source-input').fill('agents:tool');await page.locator('#search').click();assert.match(await page.locator('#researchStatus').innerText(),/下划线/);await page.locator('#source-input').fill('agents');mode='invalid';await page.locator('#search').click();await page.waitForFunction(()=>document.getElementById('researchStatus').textContent.includes('无法读取'));assert.equal(await page.locator('#discover').isHidden(),true);
  mode='normal';await page.locator('#source-input').fill('slow');await page.locator('#search').click();for(let i=0;i<100&&!releaseSlow;i++)await new Promise(r=>setTimeout(r,10));assert.ok(releaseSlow);await page.locator('#search-source').selectOption('hn');await page.locator('#search-source').selectOption('github');await page.locator('#source-input').fill('fresh');await page.locator('#search').click();await page.waitForFunction(()=>document.querySelector('.repo-title')?.textContent==='example/fresh');releaseSlow();await page.waitForTimeout(150);assert.equal(await page.locator('.repo-title').textContent(),'example/fresh');assert.equal(await page.locator('#notes').inputValue(),'Preserve this review.');
  assert.deepEqual(errors,[]);console.log('Repository browser: current stars, date cutoff, privacy, hostile data, partial, empty, rate limit, language, mobile and cancellation passed.');
 }finally{releaseSlow?.();await ctx.close();await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
