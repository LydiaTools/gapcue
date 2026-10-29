#!/usr/bin/env node
/* MIT © 2026 LydiaTools. Uses the same collectors and review format as the browser. */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const core = require('../app/core.js');
const live = require('../app/live.js');
const VERSION = require('../package.json').version;

const HELP = `GapCue ${VERSION} — public discussion research, without a browser runtime

node scripts/research.cjs search "PDF tables" --out ./search-01
node scripts/research.cjs repos "agent skills" --days 30 --out ./repos-01
node scripts/research.cjs collect "https://news.ycombinator.com/item?id=50214373" --out ./thread-01
node scripts/research.cjs review ./thread-01/review.json --verdict followup --note "Compare current alternatives." --out ./decision-01

search:  --sort relevance|recent (default relevance); --days 0|30|90|365 (default 90)
repos:   --days 0|30|90|365 (default 90); sorted by current total Stars, not growth
review:  --key THREAD_KEY (required only for multi-thread reports)
         --verdict unreviewed|followup|prototype|pass; --note TEXT (up to 6000 characters)

Every --out must be a NEW directory whose parent exists. Existing files are never replaced.
Search returns up to 8 HN stories. Collect reads one public HN story or GitHub Issue.
Reports and reviews open in app/index.html, including offline. No model API or package install.
Exit: 0 complete/local review; 1 partial/unavailable source; 2 arguments/files; 130 interrupted.
`;

function options(argv) {
  const [command, value, ...rest] = argv;
  if (!['search','repos','collect','review'].includes(command) || !value || value.startsWith('--')) throw new Error('Choose search, repos, collect or review and one input. Use --help.');
  const allowed = command==='search' ? ['out','sort','days'] : command==='repos' ? ['out','days'] : command==='collect' ? ['out'] : ['out','key','verdict','note'];
  const flags = Object.create(null);
  for (let i=0;i<rest.length;i+=2) {
    const key=rest[i]?.slice(2), val=rest[i+1];
    if (!rest[i]?.startsWith('--') || !allowed.includes(key) || Object.hasOwn(flags,key) || val===undefined || val.startsWith('--')) throw new Error('Unknown, duplicate or incomplete option. Use --help.');
    flags[key]=val;
  }
  if (!flags.out) throw new Error('Provide --out with a new directory.');
  if (command==='search') {
    if (live.input(value).kind!=='search' || !['relevance','recent'].includes(flags.sort||'relevance') || !['0','30','90','365'].includes(flags.days||'90')) throw new Error('Invalid search, sort or days.');
  } else if (command==='repos') {
    if (live.input(value).kind!=='search' || !/^[\p{L}\p{N} ._+#-]+$/u.test(value.trim()) || !['0','30','90','365'].includes(flags.days||'90')) throw new Error('Invalid repository search or days.');
  } else if (command==='collect') {
    if (live.input(value).kind==='search') throw new Error('Collect needs a public HN story or GitHub Issue URL.');
  } else if (!core.verdicts.includes(flags.verdict) || flags.note===undefined || flags.note.length>6000) throw new Error('Review needs --verdict and --note (up to 6000 characters).');
  return {command,value,flags};
}

async function readReview(file) {
  const info=await fs.stat(file);
  if (!info.isFile() || info.size>core.MAX_FILE) throw new Error('Choose a report/review file no larger than 20 MiB.');
  return core.parse(await fs.readFile(file,'utf8'));
}

async function writeFiles(directory, files) {
  let sums='';
  for (const [name, text] of Object.entries(files)) {
    await fs.writeFile(path.join(directory,name),text,{flag:'wx',mode:0o600});
    sums+=createHash('sha256').update(text).digest('hex')+'  '+name+'\n';
  }
  await fs.writeFile(path.join(directory,'SHA256SUMS.txt'),sums,{flag:'wx',mode:0o600});
}

function markdown(report) {
  const lines=['# GapCue source snapshot','',`Collected: ${report.captured_at}`,`Source status: ${report.collection_status}`,`Fictional sample: ${report.synthetic ? 'yes' : 'no'}`,''];
  for (const item of core.records(report)) {
    const title=String(item.title||'Unavailable').replace(/[\r\n]/g,' ').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\\`*_{}\[\]!]/g,char=>'\\'+char);
    lines.push(`## ${item.key}`, '', title, item.url||'Original fictional example');
    if (!item.available) { lines.push('Source unavailable.','');continue; }
    lines.push(`State: ${item.state}`,`Comments collected/reported: ${item.comments.entries.length}/${item.comments.reported_total}`);
    if (item.comments.indexed_total!==undefined) lines.push(`Indexed comments: ${item.comments.indexed_total ?? 'unavailable'}`);
    lines.push('Read the original thread for omitted replies. Current PR states do not establish a released fix.','');
  }
  lines.push('Original excerpts and request receipts are in report.json. No automatic opportunity score or demand verdict is produced.','');
  return lines.join('\n');
}

async function run(argv, sourceOptions={}) {
  if (argv.length===1 && ['--help','-h'].includes(argv[0])) return {exitCode:0,text:HELP};
  if (argv.length===1 && argv[0]==='--version') return {exitCode:0,text:VERSION+'\n'};
  const {command,value,flags}=options(argv);
  let loaded, decisions;
  if (command==='review') {
    loaded=await readReview(value);
    const keys=core.records(loaded.report).map(item=>item.key);
    const key=flags.key || (keys.length===1 ? keys[0] : null);
    if (!key || !keys.includes(key)) throw new Error('Choose --key from this report: '+keys.join(', '));
    decisions={...loaded.decisions,[key]:{verdict:flags.verdict,notes:flags.note,updated_at:new Date().toISOString()}};
  }
  const directory=path.resolve(flags.out);
  // Reserve before network access. A competing process or existing directory cannot be overwritten.
  await fs.mkdir(directory,{mode:0o700});
  try {
    if (command==='review') {
      const review=core.review(loaded,decisions);
      const text=JSON.stringify(review,null,2)+'\n';
      await core.parse(text);
      await writeFiles(directory,{'review.json':text});
      return {exitCode:0,summary:{status:'saved',command,directory,source_sha256:loaded.sha256,decisions:review.decisions}};
    }
    if (command==='repos') {
      const result=await live.searchRepositories(value,{...sourceOptions,days:Number(flags.days||90)});
      await writeFiles(directory,{'repos.json':JSON.stringify(result,null,2)+'\n'});
      return {exitCode:result.incomplete_results?1:0,summary:{status:result.incomplete_results?'partial':'complete',command,directory,returned:result.entries.length,reported_total:result.reported_total,incomplete_results:result.incomplete_results}};
    }
    if (command==='search') {
      const result=await live.search(value,flags.sort||'relevance',{...sourceOptions,days:Number(flags.days||90)});
      await writeFiles(directory,{'search.json':JSON.stringify(result,null,2)+'\n'});
      return {exitCode:0,summary:{status:'complete',command,directory,returned:result.entries.length,reported_total:result.reported_total}};
    }
    const report=await live.collect(value,sourceOptions);
    report.tool_version=VERSION;
    report.parameters.backend='anonymous Node GET';
    const source=JSON.stringify(report,null,2)+'\n';
    loaded=await core.parse(source);
    const review=JSON.stringify(core.review(loaded,{}),null,2)+'\n';
    await core.parse(review);
    await writeFiles(directory,{'report.json':source,'report.md':markdown(report),'review.json':review});
    return {exitCode:report.collection_status==='complete'?0:1,summary:{status:report.collection_status,command,directory,source_sha256:loaded.sha256,threads:core.records(report).map(item=>({key:item.key,comments_collected:item.comments?.entries.length ?? 0,comments_reported:item.comments?.reported_total ?? null}))}};
  } catch (error) {
    const interrupted=error.name==='AbortError' || sourceOptions.signal?.aborted;
    const failure={status:interrupted?'interrupted':'failed',command,captured_at:new Date().toISOString(),error:error instanceof live.SourceError ? error.code : error.message};
    try { await writeFiles(directory,{'failure.json':JSON.stringify(failure,null,2)+'\n'}); } catch { /* Preserve the original failure; never replace a partly written file. */ }
    return {exitCode:interrupted?130:error instanceof live.SourceError?1:2,summary:{...failure,directory}};
  }
}

if (require.main===module) {
  const controller=new AbortController();
  const stop=()=>controller.abort();
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  run(process.argv.slice(2),{signal:controller.signal}).then(result=>{
    process.stdout.write(result.text||JSON.stringify(result.summary)+'\n');process.exitCode=result.exitCode;
  }).catch(error=>{
    process.stderr.write(JSON.stringify({status:'failed',error:error.message})+'\n');process.exitCode=2;
  }).finally(()=>{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);});
}
module.exports={run,options,readReview,VERSION};
