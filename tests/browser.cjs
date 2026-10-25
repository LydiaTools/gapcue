const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash}=require('node:crypto');
const {chromium}=require(process.env.GAPCUE_PLAYWRIGHT || 'playwright');
const {createServer}=require('../scripts/serve.cjs');
const root=path.resolve(__dirname,'..');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const output=path.join(root,'artifacts','browser-'+stamp);
const shots=process.env.GAPCUE_SCREENSHOTS||output;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

(async()=>{
 await fs.mkdir(output,{recursive:true});await fs.mkdir(shots,{recursive:true});
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 const external=[],errors=[],checks=[];
 const sampleBytes=await fs.readFile(path.join(root,'examples/sample-report.json'));
 const sample=JSON.parse(sampleBytes);
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
  context.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin+'/'))external.push(r.url());});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.locator('#issueList button').first().waitFor();
  assert.match(await page.locator('#snapshotType').textContent(),/Fictional sample/);
  assert.equal(await page.locator('#issueState').textContent(),'Open');
  assert.equal(await page.locator('#references .badge').first().textContent(),'Merged');
  assert.match(await page.locator('.sample-gap').textContent(),/6 reported comments/);
  assert.match(await page.locator('#comments .comment').first().textContent(),/requester/);
  await page.screenshot({path:path.join(shots,'desktop-en.png'),fullPage:true});
  checks.push('Clearly marked fictional sample; open issue, merged PR, newest collected page and omitted comments remain separate facts.');

  await page.locator('#verdict').selectOption('followup');
  await page.locator('#notes').fill('Check the current release with a small file. 先核对，再立项。');
  const downloadEvent=page.waitForEvent('download');await page.locator('#export').click();const item=await downloadEvent;
  assert.equal(await item.failure(),null);const review=JSON.parse(await fs.readFile(await item.path()));
  assert.equal(review.source_sha256,hash(sampleBytes));
  assert.equal(review.source_text,sampleBytes.toString());
  assert.equal(review.decisions['sample/research-board#17'].verdict,'followup');
  const saved=path.join(output,'review.json');await item.saveAs(saved);
  await page.reload();await page.locator('#issueList button').first().waitFor();
  await page.locator('#file').setInputFiles(saved);
  await page.waitForFunction(()=>document.getElementById('notes').value.includes('先核对'));
  assert.equal(await page.locator('#verdict').inputValue(),'followup');
  checks.push('Actual review download and reload/import preserve exact source bytes, SHA-256, bilingual notes and decision.');

  await page.locator('#notes').fill('Unsaved local decision');
  const pendingDialog=page.waitForEvent('dialog');
  await page.locator('#file').setInputFiles(path.join(root,'examples/sample-report.json'));
  const dialog=await pendingDialog;await dialog.dismiss();
  await page.waitForFunction(()=>document.getElementById('file').files.length===0);
  assert.equal(await page.locator('#notes').inputValue(),'Unsaved local decision');
  checks.push('Declining replacement keeps unsaved notes and the current source.');

  await page.locator('#file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await page.locator('#error').waitFor({state:'visible'});
  assert.equal(await page.locator('#notes').inputValue(),'Unsaved local decision');
  const hostile=structuredClone(sample);hostile.issues[0].body.text='<img id="injected" src="https://example.invalid/pixel"><script>window.injected=true</script>';
  hostile.issues[0].body.characters=hostile.issues[0].body.text.length;
  page.once('dialog',d=>d.accept());
  await page.locator('#file').setInputFiles({name:'inert-source.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(hostile))});
  await page.waitForFunction(()=>document.getElementById('issueBody').textContent.includes('<img'));
  assert.equal(await page.locator('#injected').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
  const unsafe=structuredClone(sample);unsafe.issues[0].url='javascript:alert(1)';
  await page.locator('#file').setInputFiles({name:'unsafe-link.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(unsafe))});
  await page.locator('#error').waitFor({state:'visible'});
  assert.match(await page.locator('#issueBody').textContent(),/<img/);
  checks.push('Malformed JSON and unsafe source URLs do not replace the current report; source HTML stays inert and makes no remote request.');

  const partial=structuredClone(sample);partial.collection_status='partial';partial.failures=['comments:page4'];partial.issues[0].comments.available=false;partial.issues[0].comments.entries=partial.issues[0].comments.entries.slice(0,3);
  await page.locator('#file').setInputFiles({name:'partial.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(partial))});
  await page.waitForFunction(()=>document.getElementById('snapshotStatus').textContent==='Some sources unavailable');
  assert.match(await page.locator('#comments').textContent(),/could not be read/);
  checks.push('Partial source reads remain visibly unavailable instead of becoming an empty successful collection.');

  await page.locator('#sample').click();await page.waitForFunction(()=>document.getElementById('snapshotStatus').textContent==='');
  await page.locator('#language').click();
  assert.equal(await page.locator('h1').textContent(),'搜索与核对讨论');
  assert.equal(await page.locator('#issueTitle').textContent(),sample.issues[0].title);
  await page.screenshot({path:path.join(shots,'desktop-zh.png'),fullPage:true});
  checks.push('Chinese controls preserve the original source language and data.');

  const mobile=await context.newPage({viewport:{width:390,height:844}});
  await mobile.setViewportSize({width:390,height:844});mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(origin+'/?lang=zh');await mobile.locator('#issueList button').first().waitFor();
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.locator('#issueList button').nth(1).click();
  assert.equal(await mobile.locator('#issueTitle').textContent(),sample.issues[1].title);
  await mobile.screenshot({path:path.join(shots,'mobile-zh.png'),fullPage:true});
  checks.push('Fresh 390-pixel Chinese layout has no page overflow and can select another issue.');

  const offline=await context.newPage();offline.on('pageerror',e=>errors.push(e.message));
  await offline.goto('file://'+path.join(root,'app/index.html'));
  await offline.locator('#issueList button').first().waitFor();await offline.locator('#notes').fill('Offline note');
  const offlineEvent=offline.waitForEvent('download');await offline.locator('#export').click();const offlineDownload=await offlineEvent;
  assert.equal(await offlineDownload.failure(),null);
  const offlineReview=JSON.parse(await fs.readFile(await offlineDownload.path()));
  assert.equal(offlineReview.decisions['sample/research-board#17'].notes,'Offline note');
  assert.equal(offlineReview.source_sha256,hash(sampleBytes));
  checks.push('Direct file:// viewer opens, edits and downloads a review without a server.');
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  const report={captured_at:new Date().toISOString(),browser:browser.version(),checks,external_http_requests:external,page_errors:errors,screenshots:shots,scope:'Original fictional reports and local/file:// workflow checks; not real user adoption.'};
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  await context.close();
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
