/* MIT © 2026 LydiaTools. */
"use strict";
const core = window.GapCueCore;
const $ = (id) => document.getElementById(id);
let lang = new URLSearchParams(location.search).get("lang") === "zh" ? "zh" : "en";
let loaded = null, selected = null, decisions = Object.create(null), dirty = false;
let operation = null, operationId = 0, searchResult = null, atlasExpanded = false, hnRepoLookup = null;
const live = window.GapCueLive;
const messages = {
  en: {
    collectNav:"Collect a report", subtitle:"GitHub Issue Scout", headline:"Read the replies before you build.", intro:"Collect public GitHub issues with Python. Review the sources and keep your decision here.", open:"Open report or review", sample:"Try the sample", issues:"Issues to read", indexNote:"An open issue is a starting point for research. The sources and your judgment do the rest.", request:"The request", source:"Open source", discussion:"Collected discussion", newest:"Newest collected page first", references:"Mentioned changes", referenceHint:"States collected from GitHub; branch links remain links to inspect.", decision:"Your decision", verdict:"What is the next step?", notes:"What would change your decision?", save:"Save review file", local:"Report content is read locally. Save a review file to keep the source snapshot and your notes together.", ownReport:"Collect your own report", collectHint:"In a source checkout with Python 3.10+, run a read-only public GitHub collection:", thenOpen:"Open the generated report.json here. Public mode uses GitHub's anonymous rate limit; --backend gh can reuse your GitHub CLI login.", details:"Collection details", scope:"This is a bounded, non-atomic snapshot. Comments can be omitted and excerpts shortened. Handles and Stars are not demand votes. A mentioned or merged PR does not establish a released fix.", footer:"Preview v0.1.0. Source text is displayed as data. No model calls or report uploads.", feedback:"Report a problem", unreviewed:"Not reviewed", followup:"Follow up", prototype:"Prototype candidate", pass:"Pass for my task", sampleType:"Fictional sample — no live repository data", snapshotType:"Collected source snapshot", partial:"Some sources unavailable", complete:"Requested reads completed", collected:"Collected", openState:"Open", closedState:"Closed", mergedState:"Merged", unavailable:"Unavailable", noIssues:"No issues in this report. Try different collection terms or an explicit issue URL.", noComments:"No comments were reported on the issue read.", noRefs:"No issue/PR or patch links were captured in the selected excerpts.", linkOnly:"Link only", notChecked:"Not checked", checked:"Collected", patch:"Branch / commit link", reference:"Reference", sourceSample:"Fictional source", notePlaceholder:"What would you check next? Keep the current alternative and a small validation step beside your decision.", discard:"Replace the current report and unsaved decision notes? Download a review first to keep them.", imported:"Report opened. Your edits stay in this tab until you save a review.", restored:"Review reopened with its source snapshot and notes.", saved:"Review file prepared. Open it here to resume with the same source and notes.", edited:"Notes changed. Save a review file before closing.", errorPrefix:"Could not open this file: ", fileLimit:"Choose a JSON report/review smaller than 20 MiB.", excerpt:"Source excerpt", shortened:"Shortened", bot:"Bot", sourceUnavailable:"This source was unavailable during collection. Recollect it before deciding from its contents.", noCollectedComments:"No comment text was collected.", commentsFailed:"One or more comment pages could not be read.", firstLast:"First and last pages, by the issue's reported count", singlePage:"One collected comment page", hash:"Source SHA-256", failures:"Unavailable sources", file:"Source file", author:"Opened by", created:"Created", updated:"Updated", commentsRead:(n,total)=>`${n} / ${total} comments collected`, handles:(n)=>`${n} commenter handles`, bots:(n)=>`${n} bot comments`, gap:(n)=>`${n} reported comments are not included in this sample. Open the original thread before treating this as the full discussion.`, page:(n)=>`Page ${n}`, chars:(n,total)=>`${n.toLocaleString()} / ${total.toLocaleString()} characters`, requests:(n)=>`${n} recorded API reads`,
  },
  zh: {
    collectNav:"采集报告", subtitle:"GitHub Issue 调研台", headline:"立项之前，先看后续讨论。", intro:"用 Python 采集公开 GitHub 问题，在这里核对来源并保留自己的判断。", open:"打开报告或评审文件", sample:"试用示例", issues:"待阅读的问题", indexNote:"Open 状态只是调研起点，还需要核对来源并作出自己的判断。", request:"原始请求", source:"查看来源", discussion:"已采集的讨论", newest:"先看已采集的末页", references:"提到的改动", referenceHint:"状态采自 GitHub；分支链接仍需要打开核对。", decision:"你的判断", verdict:"下一步做什么？", notes:"什么信息会改变你的判断？", save:"保存评审文件", local:"报告在本页本地读取。保存评审文件，可把来源快照和自己的笔记一起保留。", ownReport:"采集自己的报告", collectHint:"在源码目录中使用 Python 3.10+，只读采集公开 GitHub 内容：", thenOpen:"在本页打开生成的 report.json。公开模式受匿名 API 额度限制；--backend gh 可复用 GitHub CLI 登录态。", details:"采集详情", scope:"这是有范围限制、并非同一瞬间采集的快照。可能遗漏中间评论或缩短原文；账号名和 Star 不等于需求票数。提到或合并了 PR，也不能据此认定已发布修复。", footer:"v0.1.0 预览。来源文字仅作数据展示，不调用模型、不上传报告。", feedback:"反馈问题", unreviewed:"尚未评审", followup:"继续核对", prototype:"候选小样", pass:"不适合当前任务", sampleType:"虚构示例，不是真实仓库数据", snapshotType:"已采集的来源快照", partial:"部分来源不可用", complete:"已完成计划中的读取", collected:"采集时间", openState:"Open", closedState:"Closed", mergedState:"已合并", unavailable:"不可用", noIssues:"这份报告没有问题条目。可换关键词，或指定具体 Issue 地址重新采集。", noComments:"读取问题时，GitHub 未报告有评论。", noRefs:"所选原文片段中没有采到 Issue、PR 或补丁链接。", linkOnly:"仅链接", notChecked:"未核对", checked:"采集状态", patch:"分支或提交链接", reference:"提及来源", sourceSample:"虚构来源", notePlaceholder:"下一步需要核对什么？记下现有替代方案，以及一个可以验证的小步骤。", discard:"替换当前报告和未保存的判断笔记吗？要保留进度，请先下载评审文件。", imported:"已打开报告。修改先保留在本页，保存评审文件后才能在下次继续。", restored:"已恢复来源快照和判断笔记。", saved:"评审文件已准备好。以后在本页打开，可继续查看相同来源和笔记。", edited:"笔记已修改，关闭前请保存评审文件。", errorPrefix:"无法打开此文件：", fileLimit:"请选择小于 20 MiB 的 JSON 报告或评审文件。", excerpt:"来源片段", shortened:"已缩短", bot:"机器人", sourceUnavailable:"采集时该来源不可用。请重新采集后再根据原文作判断。", noCollectedComments:"未采集到评论文字。", commentsFailed:"有评论页未能读取。", firstLast:"按问题报告的数量采集首尾页", singlePage:"已采集一个评论页", hash:"来源 SHA-256", failures:"不可用来源", file:"来源文件", author:"发起者", created:"创建", updated:"更新", commentsRead:(n,total)=>`已采集 ${n} / ${total} 条评论`, handles:(n)=>`${n} 个评论账号名`, bots:(n)=>`${n} 条机器人评论`, gap:(n)=>`这份样本没有包含 ${n} 条已报告的评论。请打开原讨论核对，勿将样本视为完整讨论。`, page:(n)=>`第 ${n} 页`, chars:(n,total)=>`${n.toLocaleString()} / ${total.toLocaleString()} 字符`, requests:(n)=>`${n} 次已记录的 API 读取`,
  },
};
Object.assign(messages.en,window.GapCueResearchMessages.en);
Object.assign(messages.zh,window.GapCueResearchMessages.zh);
const tr = (key, ...args) => typeof messages[lang][key] === "function" ? messages[lang][key](...args) : messages[lang][key];
function element(tag, text, className) { const node=document.createElement(tag); if(text!==undefined)node.textContent=String(text); if(className)node.className=className; return node; }
function clear(id) { const node=$(id); node.replaceChildren(); return node; }
function date(value) { const n=Date.parse(value); return Number.isFinite(n) ? new Date(n).toISOString().slice(0,16).replace("T"," ")+" UTC" : "—"; }
function stateLabel(state) { return tr(({open:"openState",closed:"closedState",merged:"mergedState",discussion:"discussionState"})[state] || "unavailable"); }
function sourceLink(node,url) { const href=core.source(url); if(href){node.href=href;node.removeAttribute("aria-disabled");node.title=href;}else{node.removeAttribute("href");node.setAttribute("aria-disabled","true");node.title=tr("sourceSample");} }
function excerpt(parent, value) {
  parent.append(element("pre",value.text,"source-excerpt"));
  if(value.truncated)parent.append(element("p",tr("shortened")+": "+tr("chars",[...value.text].length,value.characters),"excerpt-length"));
}
function renderIndex() {
  const list=clear("issueList");
  $("issueCount").textContent=core.records(loaded.report).length;
  for(const issue of core.records(loaded.report)){
    const button=element("button",undefined,"issue-item"+(selected===issue.key?" active":""));button.type="button";button.dataset.issue=issue.key;
    if(selected===issue.key)button.setAttribute("aria-current","true");
    button.append(element("span",issue.key,"item-id"),element("span",issue.available?issue.title:tr("unavailable"),"item-title"));
    button.append(element("span",issue.available?tr(issue.source_kind==="hackernews"?"hnCommentsRead":"commentsRead",issue.comments.entries.length,issue.comments.reported_total):issue.error,"item-coverage"));
    button.addEventListener("click",()=>{selected=issue.key;render();});list.append(button);
  }
}
function linkedRepositoryAction(container,url) {
  if(!live.linkedRepository(url))return;
  const button=element("button",tr("linkedRepoButton"),"secondary linked-repo"),detail=element("div",undefined,"linked-repo-detail");
  button.type="button";detail.setAttribute("role","status");
  button.addEventListener("click",async()=>{
    button.disabled=true;detail.replaceChildren(element("p",tr("linkedRepoLoading"),"hint"));
    try {
      const info=await live.linkedRepositoryInfo(url);
      if(!container.isConnected)return;
      const text=tr("linkedRepoResult",info.full_name,info.stars,date(info.created_at),date(info.captured_at));
      const flags=[info.archived?tr("linkedRepoArchived"):null,info.fork?tr("linkedRepoFork"):null].filter(Boolean);
      detail.replaceChildren(element("p",text+(flags.length?" · "+flags.join(" · "):""),"hint"),element("p",tr("linkedRepoHint"),"hint"));
    } catch(error) { if(container.isConnected)detail.replaceChildren(element("p",tr("linkedRepoFailed"),"hint")); }
    finally { if(container.isConnected)button.disabled=false; }
  });
  container.append(button,detail);
}
function renderReferences(issue) {
  const parent=clear("references");
  const origin=issue?.source_kind==="hackernews"?loaded.report.discovery?.repository_context:null;
  if(origin){
    const item=element("div",undefined,"reference"),top=element("div",undefined,"reference-top"),link=element("a",origin.full_name,"reference-title");
    link.href=core.github(origin.url);link.target="_blank";link.rel="noopener noreferrer";
    top.append(link,element("span",tr("repoOriginBadge"),"badge"));item.append(top,element("p",tr("repoOriginHint")));parent.append(item);
  }
  if(!issue?.references?.length){parent.append(element("p",tr(issue?.source_kind==="hackernews"?"noProjectLink":"noRefs"),"hint"));return;}
  for(const ref of issue.references){
    const item=element("div",undefined,"reference");const top=element("div",undefined,"reference-top");
    const title=ref.kind==="project_link"?new URL(ref.url).hostname:ref.kind==="patch_link"?tr("patch"):(ref.kind==="pull_request"?"PR":"#")+(ref.number||"");
    const link=element("a",title,"reference-title");link.target="_blank";link.rel="noopener";if(ref.kind==="project_link"){link.href=core.external(ref.url);link.rel="noopener noreferrer";}else sourceLink(link,ref.url);
    const label=ref.check==="checked"?stateLabel(ref.state):tr(({not_checked:"notChecked",unavailable:"unavailable",link_only:"linkOnly"})[ref.check]||"notChecked");
    top.append(link,element("span",label,"badge "+(ref.check==="checked"?ref.state:ref.check==="unavailable"?"unavailable":"")));item.append(top);
    if(ref.captured_at)item.append(element("p",tr("collected")+" "+date(ref.captured_at)));
    if(ref.reason&&ref.kind!=="project_link")item.append(element("p",ref.reason));
    if(ref.kind==="project_link"&&!loaded.report.synthetic)linkedRepositoryAction(item,ref.url);
    parent.append(item);
  }
}
function commentBlock(comment, issue) {
  const block=element("section",undefined,"comment"),heading=element("div",undefined,"comment-heading"),who=element("span",comment.author,"comment-author");
  const role=comment.account_type==="Bot"?tr("bot"):comment.association&&comment.association!=="NONE"?comment.association.toLowerCase().replaceAll("_"," "):"";
  if(role)who.append(element("span",role,"comment-role"));
  const link=element("a",tr("source"),"source-link");link.target="_blank";link.rel="noopener";sourceLink(link,comment.url);heading.append(who,link);block.append(heading);
  excerpt(block,comment.body);
  if(issue.source_kind==="hackernews"&&comment.parent_id!==issue.number){
    const parent=element("a",tr("parent")+" #"+comment.parent_id,"source-link");parent.target="_blank";parent.rel="noopener noreferrer";sourceLink(parent,"https://news.ycombinator.com/item?id="+comment.parent_id);block.append(parent);
    if(!loaded.report.synthetic){
      const button=element("button",tr("readParent"),"parent-read"),detail=element("div",undefined,"parent-context");button.type="button";detail.setAttribute("role","status");
      button.addEventListener("click",async()=>{
        button.disabled=true;detail.replaceChildren(element("p",tr("parentLoading"),"hint"));
        try{
          const captured=issue.comments.entries.find(entry=>entry.id===comment.parent_id);
          const item=captured||await live.readHNParent(comment.parent_id);
          if(!block.isConnected)return;
          detail.replaceChildren(element("p",tr("parentContext")+" · "+item.author+" · "+date(item.created_at),"hint"));excerpt(detail,item.body);
          detail.append(element("p",tr(captured?"parentInSnapshot":"parentNotSaved"),"hint"));
        }catch(error){if(block.isConnected)detail.replaceChildren(element("p",tr("parentFailed"),"hint"));}
        finally{if(block.isConnected)button.disabled=false;}
      });
      block.append(button,detail);
    }
  }
  block.append(element("p",date(comment.created_at)+" · "+tr("page",comment.page),"comment-date"));return block;
}
function renderThread(issue) {
  $("thread").hidden=!issue;$("empty").hidden=!!issue;$("empty").textContent=tr("noIssues");
  if(!issue)return;
  $("issueKey").textContent=issue.key;$("issueTitle").textContent=issue.available?issue.title:tr("sourceUnavailable");
  $("issueState").textContent=issue.available?stateLabel(issue.state):tr("unavailable");$("issueState").className="badge "+(issue.available?issue.state:"unavailable");
  const body=clear("issueBody"),comments=clear("comments"),coverage=clear("coverage");sourceLink($("issueSource"),issue.url);
  if(!issue.available){$("issueMeta").textContent="";body.append(element("p",issue.error,"hint"));coverage.append(element("strong",tr("unavailable")));return;}
  $("issueMeta").textContent=tr("author")+" "+issue.author+" · "+tr("created")+" "+date(issue.created_at)+(issue.source_kind==="hackernews"?" · "+tr("storyMetrics",issue.points,issue.comments.reported_total):" · "+tr("updated")+" "+date(issue.updated_at));
  const sample=issue.comments,handles=new Set(sample.entries.map(c=>c.author.toLowerCase())),bots=sample.entries.filter(c=>c.account_type==="Bot").length;
  coverage.append(element("strong",tr(issue.source_kind==="hackernews"?"hnCommentsRead":"commentsRead",sample.entries.length,sample.reported_total)),element("span",tr("handles",handles.size)));
  if(issue.source_kind!=="hackernews")coverage.append(element("span",tr("bots",bots)));
  else coverage.append(element("span",tr("hnSample")));
  excerpt(body,issue.body);
  if(!sample.available)comments.append(element("p",tr("commentsFailed"),"sample-gap"));
  if(!sample.entries.length){comments.append(element("p",sample.reported_total?tr("noCollectedComments"):tr("noComments"),"hint"));return;}
  const entries=[...sample.entries].sort((a,b)=>issue.source_kind==="hackernews"?Date.parse(b.created_at)-Date.parse(a.created_at):b.id-a.id),gap=Math.max(0,Math.max(sample.reported_total,sample.indexed_total||0)-entries.length);let gapShown=false;
  const newestPage=issue.source_kind==="hackernews"?Math.min(...sample.pages):Math.max(...sample.pages);
  for(const comment of entries){
    if(gap&&!gapShown&&sample.pages.length>1&&comment.page!==newestPage){comments.append(element("p",tr(issue.source_kind==="hackernews"?"hnGap":"gap",gap),"sample-gap"));gapShown=true;}
    comments.append(commentBlock(comment,issue));
  }
  if(gap&&!gapShown)comments.append(element("p",tr(issue.source_kind==="hackernews"?"hnGap":"gap",gap),"sample-gap"));
}
function render() {
  document.documentElement.lang=lang==="zh"?"zh-CN":"en";
  for(const node of document.querySelectorAll("[data-i18n]"))node.textContent=tr(node.dataset.i18n);
  $("language").textContent=lang==="en"?"中文":"English";
  for(const option of $("verdict").options)option.textContent=tr(option.value);
  $("notes").placeholder=tr("notePlaceholder");
  if(!loaded)return;
  const report=loaded.report;
  $("snapshot").className="snapshot"+(report.synthetic?" sample":"")+(report.collection_status==="partial"?" partial":"");
  $("snapshotType").textContent=tr(report.synthetic?"sampleType":"snapshotType");
  $("snapshotDate").textContent=tr("collected")+" "+date(report.captured_at);
  $("snapshotStatus").textContent=report.synthetic&&report.collection_status!=="partial"?"":tr(report.collection_status==="partial"?"partial":"complete");
  renderSearch();
  renderIndex();const issue=core.records(report).find(i=>i.key===selected);renderThread(issue);renderReferences(issue);
  $("referenceHeading").textContent=tr(issue?.source_kind==="hackernews"?"projectLinks":"references");
  $("referenceHint").textContent=tr(issue?.source_kind==="hackernews"?"projectHint":"referenceHint");
  $("requestHeading").textContent=tr(issue?.source_kind==="hackernews"?"hnRequest":"request");
  if(issue?.source_kind==="hackernews"&&issue.comments.indexed_total!==null)$("coverage").append(element("span",tr("indexed")+": "+issue.comments.indexed_total));
  const decision=decisions[selected]||{verdict:"unreviewed",notes:""};$("verdict").value=decision.verdict;$("notes").value=decision.notes;
  $("verdict").disabled=!issue;$("notes").disabled=!issue;$("export").disabled=!loaded;
  const details=clear("reportDetails");details.append(element("p",tr("hash")+": "+loaded.sha256),element("p",tr("requests",report.requests.length)));
  if(report.failures.length){details.append(element("p",tr("failures")+": "+report.failures.join(", ")));}
  $("saveStatus").textContent=dirty?tr("edited"):"";
}
async function load(text,restoredMessage=true,stillCurrent=()=>true) {
  const candidate=await core.parse(text);
  if(!stillCurrent() || dirty&&!confirm(tr("discard")))return false;
  loaded=candidate;decisions=candidate.decisions;selected=core.records(loaded.report)[0]?.key||null;dirty=false;$("error").hidden=true;render();
  $("saveStatus").textContent=restoredMessage?tr(Object.keys(decisions).length?"restored":"imported"):"";
  return true;
}
function fail(error){$("error").textContent=tr("errorPrefix")+error.message;$("error").hidden=false;}
function edit(){if(!selected)return;decisions[selected]={verdict:$("verdict").value,notes:$("notes").value,updated_at:new Date().toISOString()};dirty=true;$("saveStatus").textContent=tr("edited");}
function cancelOperation() { operationId++;operation?.abort();operation=null;$("stop").hidden=true;$("search").disabled=false;$("atlas").disabled=false; }
function repoActions(row,title,repo) {
  const issues=element("a",tr("repoIssues"),"source-link");issues.href=title.href+"/issues";issues.target="_blank";issues.rel="noopener noreferrer";
  const find=element("button",tr("repoFindHN"),"secondary repo-hn");find.type="button";
  find.addEventListener("click",()=>{
    const parts=repo.full_name.split("/"), term=parts[1].length>=2?parts[1]:parts.join(" ");
    const context={repository:repo.full_name,previous:searchResult,controls:{source:$("search-source").value,query:$("source-input").value,days:$("search-days").value,order:$("search-order").value}};
    $("source-input").value=term;$("search-source").value="hn";$("search-days").value="0";$("search-order").value="relevance";
    startResearch(null,context);
  });
  row.append(issues,document.createTextNode(" "),find);
}
function renderSearch() {
  $("source-input").placeholder=tr("inputPlaceholder");
  const url=/^https?:\/\//i.test($("source-input").value.trim()), repos=$("search-source").value==="github";
  $("hn-sort-label").hidden=repos;
  $("search").textContent=tr(url?"readThread":repos?"searchRepos":"searchHN");
  if(!searchResult)return;
  $("discover").hidden=false;
  if(searchResult.kind==="atlas") {
    $("resultTitle").textContent=tr("atlasTitle");
    const meta=clear("resultMeta"), attribution=element("a",tr("atlasSource"),"source-link"), license=element("a",tr("atlasLicense"),"source-link");
    attribution.href="https://agentatlas.dev/trending";attribution.target="_blank";attribution.rel="noopener noreferrer";
    license.href="https://creativecommons.org/licenses/by/4.0/";license.target="_blank";license.rel="noopener noreferrer";
    const visible=atlasExpanded?searchResult.entries:searchResult.entries.slice(0,8);
    meta.append(attribution,document.createTextNode(" · "),license,document.createTextNode(" · "+tr("atlasGenerated")+" "+date(searchResult.generated_at)+" · "+tr("atlasShowing",visible.length,searchResult.entries.length)+" · "+tr("atlasHint")));
    const list=clear("searchResults");
    if(!searchResult.entries.length)list.append(element("p",tr("atlasEmpty"),"hint"));
    for(const repo of visible){
      const row=element("div",undefined,"repo-result"),title=element("a",repo.full_name,"repo-title");
      title.href=core.github(repo.html_url);title.target="_blank";title.rel="noopener noreferrer";
      row.append(title,element("p",`${repo.stargazers_count.toLocaleString()} Stars · ${repo.stars_per_day===null?"—":repo.stars_per_day.toLocaleString()} ${tr("atlasPerDay")} · ${date(repo.created_at)}`,"hint"));
      if(repo.description)row.append(element("p",repo.description,"repo-description"));
      repoActions(row,title,repo);list.append(row);
    }
    if(searchResult.entries.length>8){const toggle=element("button",atlasExpanded?tr("atlasShowLess"):tr("atlasShowAll",searchResult.entries.length),"secondary");toggle.type="button";toggle.id="atlas-more";toggle.addEventListener("click",()=>{atlasExpanded=!atlasExpanded;renderSearch();$("atlas-more").focus();});list.append(toggle);}
    return;
  }
  if(searchResult.kind==="repositories") {
    $("resultTitle").textContent=tr("repoResults")+": "+searchResult.query;
    $("resultMeta").textContent=tr("repoFound",searchResult.entries.length,searchResult.reported_total)+" · "+tr("repoHint")+(searchResult.created_since?" · "+tr("repoSince",searchResult.created_since):"")+" — "+date(searchResult.captured_at)+(searchResult.incomplete_results?" · "+tr("repoPartial"):"");
    const list=clear("searchResults");
    const actions=element("p",undefined,"snapshot-actions"),saveSnapshot=element("button",tr("saveRepoSnapshot"),"secondary");
    saveSnapshot.type="button";saveSnapshot.id="save-repo-snapshot";
    saveSnapshot.addEventListener("click",()=>{const value=window.GapCueCompare.snapshot(searchResult),blob=new Blob([JSON.stringify(value,null,2)+"\n"],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="gapcue-repositories-"+new Date().toISOString().replace(/[:.]/g,"-")+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);$("researchStatus").textContent=tr("savedRepoSnapshot");});
    const compareLink=element("a",tr("compareRepoSnapshots"),"source-link");compareLink.href="compare.html"+(lang==="zh"?"?lang=zh":"");actions.append(saveSnapshot,document.createTextNode(" "),compareLink);list.append(actions);
    if(!searchResult.entries.length)list.append(element("p",tr("noRepoResults"),"hint"));
    for(const repo of searchResult.entries) {
      const row=element("div",undefined,"repo-result"),title=element("a",repo.full_name,"repo-title");
      title.href=core.github(repo.html_url);title.target="_blank";title.rel="noopener noreferrer";
      const meta=element("p",`${repo.stargazers_count.toLocaleString()} Stars · ${date(repo.created_at)} · ${repo.license||tr("repoLicenseUnknown")}${repo.fork?" · "+tr("repoFork"):""}`,"hint");
      row.append(title,meta);
      if(repo.description)row.append(element("p",repo.description,"repo-description"));
      repoActions(row,title,repo);list.append(row);
    }
    return;
  }
  $("resultTitle").textContent=tr("results")+": "+searchResult.query;
  $("resultMeta").textContent=tr("found",searchResult.entries.length,searchResult.reported_total)+" - "+date(searchResult.captured_at)+(hnRepoLookup?" · "+tr("repoHNHint",hnRepoLookup.repository):"");
  const list=clear("searchResults");
  if(hnRepoLookup){const back=element("button",tr("repoHNBack"),"secondary");back.type="button";back.addEventListener("click",()=>{const saved=hnRepoLookup;hnRepoLookup=null;searchResult=saved.previous;$("search-source").value=saved.controls.source;$("source-input").value=saved.controls.query;$("search-days").value=saved.controls.days;$("search-order").value=saved.controls.order;renderSearch();$("researchStatus").textContent=tr("repoChoose");});list.append(back);}
  if(!searchResult.entries.length)list.append(element("p",tr("noResults"),"hint"));
  for(const story of searchResult.entries){
    const row=element("div",undefined,"search-result"),button=element("button",story.title,"result-open");button.type="button";
    button.addEventListener("click",()=>{
      $("source-input").value=story.url;
      const discovery={search:searchResult,selected_id:story.id};
      if(hnRepoLookup)discovery.repository_context={full_name:hnRepoLookup.repository,url:"https://github.com/"+hnRepoLookup.repository,relation:"name_search_unverified"};
      startResearch(discovery);
    });
    row.append(button,element("span",tr("storyMetrics",story.points,story.comments)+" - "+date(story.created_at),"hint"));
    if(story.project_url){const project=element("a",new URL(story.project_url).hostname,"source-link");project.href=story.project_url;project.target="_blank";project.rel="noopener noreferrer";row.append(project);linkedRepositoryAction(row,story.project_url);}list.append(row);
  }
}
async function startResearch(discovery=null, repoLookup=null) {
  cancelOperation();const id=operationId;operation=new AbortController();const controller=operation;
  $("search").disabled=true;$("atlas").disabled=true;$("stop").hidden=false;$("error").hidden=true;
  try {
    const parsed=live.input($("source-input").value);
    $("researchStatus").textContent=tr(parsed.kind==="search"?($("search-source").value==="github"?"searchingRepos":"searching"):"collecting");
    const options={signal:controller.signal,days:Number($("search-days").value)};
    if(parsed.kind==="search"){
      const repoMode=$("search-source").value==="github";
      if(repoMode){searchResult=null;$("discover").hidden=true;}
      const found=repoMode?await live.searchRepositories(parsed.query,options):await live.search(parsed.query,$("search-order").value,options);
      if(id!==operationId)return;searchResult=repoMode?{...found,kind:"repositories"}:found;hnRepoLookup=repoLookup;renderSearch();$("discover").open=true;$("researchStatus").textContent=tr(repoMode?"repoChoose":"chooseResult");
    }else{
      const report=await live.collect($("source-input").value,options);
      if(discovery)report.discovery=discovery;
      if(id!==operationId)return;
      const changed=await load(JSON.stringify(report,null,2)+"\n",true,()=>id===operationId);
      if(changed&&discovery)$("discover").open=false;
      if(changed)$("researchStatus").textContent=tr(report.collection_status==="partial"?"partial":"complete")+" - "+tr("reads",report.requests.length);
    }
  }catch(error){if(id===operationId){const code=error.code==="rateLimited"&&$("search-source").value==="github"&&!/^https?:\/\//i.test($("source-input").value.trim())?"repoRateLimited":error.code;$("researchStatus").textContent=tr(controller.signal.aborted?"stopped":messages[lang][code]?code:"sourceFailed");}}
  finally{if(id===operationId){operation=null;$("search").disabled=false;$("atlas").disabled=false;$("stop").hidden=true;}}
}
async function startAtlas(){
  cancelOperation();const id=operationId;operation=new AbortController();const controller=operation;
  $("search").disabled=true;$("atlas").disabled=true;$("stop").hidden=false;$("error").hidden=true;
  searchResult=null;hnRepoLookup=null;atlasExpanded=false;$("discover").hidden=true;$("researchStatus").textContent=tr("atlasLoading");
  try{const found=await live.risingAgents({signal:controller.signal});if(id!==operationId)return;searchResult=found;renderSearch();$("discover").open=true;$("researchStatus").textContent=tr("repoChoose");}
  catch(error){if(id===operationId)$("researchStatus").textContent=tr(controller.signal.aborted?"stopped":"atlasSourceFailed");}
  finally{if(id===operationId){operation=null;$("search").disabled=false;$("atlas").disabled=false;$("stop").hidden=true;}}
}
$("atlas").addEventListener("click",startAtlas);
$("research").addEventListener("submit",event=>{event.preventDefault();startResearch();});
$("stop").addEventListener("click",()=>{cancelOperation();$("researchStatus").textContent=tr("stopped");});
$("source-input").addEventListener("input",renderSearch);
$("search-source").addEventListener("change",()=>{cancelOperation();searchResult=null;hnRepoLookup=null;$("discover").hidden=true;$("researchStatus").textContent=tr("inputHint");renderSearch();});
$("language").addEventListener("click",()=>{lang=lang==="en"?"zh":"en";render();});
$("open").addEventListener("click",()=>{cancelOperation();$("file").click();});
$("file").addEventListener("change",async()=>{try{cancelOperation();const file=$("file").files[0];if(!file)return;if(file.size>core.MAX_FILE)throw new Error(tr("fileLimit"));await load(await file.text());}catch(error){fail(error);}finally{$("file").value="";}});
$("sample").addEventListener("click",()=>{cancelOperation();load(window.GapCueSampleText).catch(fail);});
$("notes").addEventListener("input",edit);$("verdict").addEventListener("change",edit);
$("export").addEventListener("click",()=>{try{const value=core.review(loaded,decisions),blob=new Blob([JSON.stringify(value,null,2)+"\n"],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="gapcue-review-"+new Date().toISOString().replace(/[:.]/g,"-")+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);dirty=false;$("saveStatus").textContent=tr("saved");}catch(error){fail(error);}});
window.addEventListener("beforeunload",event=>{if(dirty){event.preventDefault();event.returnValue="";}});
render();load(window.GapCueSampleText,false).catch(fail);
