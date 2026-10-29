/* MIT © 2026 LydiaTools. Read-only public sources; no login or persistence. */
(function () {
  'use strict';
  const core = typeof module === 'object' && module.exports ? require('./core.js') : globalThis.GapCueCore;
  const HN = 'https://hn.algolia.com/api/v1/';
  const FIREBASE = 'https://hacker-news.firebaseio.com/v0/';
  const GH = 'https://api.github.com/';
  const PAGE_SIZE = 10;
  const MAX_RESPONSE = 1024 * 1024;
  class SourceError extends Error { constructor(code) { super(code); this.code = code; } }
  const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
  const positive = value => nonnegative(value) && value > 0;
  function excerpt(value, max = 6000) {
    const chars = [...String(value || '')];
    return { text: chars.slice(0, max).join(''), characters: chars.length, truncated: chars.length > max };
  }
  function plain(value) {
    return String(value || '').replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, url, text) => text + ' (' + url + ')')
      .replace(/<(?:p|br|\/p|\/pre|\/div|\/li)\b[^>]*>/gi, '\n').replace(/<[^>]*>/g, '')
      .replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
        if (entity.startsWith('#')) {
          const cp = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
          return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : match;
        }
        return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[entity.toLowerCase()] || match;
      }).trim();
  }
  function input(value) {
    const text = String(value || '').trim();
    if (!text || text.length > 180) throw new SourceError('invalidInput');
    if (/^https?:\/\//i.test(text)) {
      const hn = core.hn(text);
      if (hn) return { kind: 'hackernews', id: Number(new URL(hn).searchParams.get('id')) };
      const safe = core.github(text), match = safe && new URL(safe).pathname.match(/^\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_.-]+)\/issues\/([1-9][0-9]*)\/?$/);
      if (match && positive(Number(match[3]))) return { kind:'github', repository:match[1]+'/'+match[2], number:Number(match[3]) };
      throw new SourceError('invalidInput');
    }
    if (text.includes('://') || text.length < 2 || text.length > 120) throw new SourceError('invalidInput');
    return { kind:'search', query:text };
  }
  function client({fetcher = globalThis.fetch, signal, onProgress = () => {}} = {}) {
    const requests = [];
    async function get(url) {
      if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
      if (![HN, FIREBASE, GH].some(prefix => url.startsWith(prefix))) throw new SourceError('invalidInput');
      const event = {url, started_at:new Date().toISOString(), available:false}; requests.push(event);
      onProgress(requests.length);
      const controller = new AbortController();
      const cancel = () => controller.abort(); signal?.addEventListener('abort', cancel, {once:true});
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
      try {
        const response = await fetcher(url, {method:'GET', credentials:'omit', referrerPolicy:'no-referrer', cache:'no-store', redirect:'error', signal:controller.signal, headers:{Accept:'application/json'}});
        event.status = response.status;
        if (!response.ok) throw new SourceError(response.status===429 || response.status===403 && response.headers.get('x-ratelimit-remaining')==='0' ? 'rateLimited' : 'sourceFailed');
        if (Number(response.headers.get('content-length')) > MAX_RESPONSE) throw new SourceError('responseTooLarge');
        const reader = response.body.getReader(), chunks = []; let size = 0;
        while (true) {
          const {value, done} = await reader.read(); if (done) break;
          size += value.length;
          if (size > MAX_RESPONSE) { await reader.cancel(); throw new SourceError('responseTooLarge'); }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        let data;
        try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new SourceError('sourceFailed'); }
        event.available = true; return data;
      } catch (error) {
        const failure = timedOut ? new SourceError('timeout') : error;
        event.error = failure.code || (signal?.aborted ? 'stopped' : 'sourceFailed');
        throw failure;
      } finally {
        event.finished_at = new Date().toISOString(); clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      }
    }
    return {get, requests, signal};
  }
  function report(client, hn = false) {
    return {schema_version:hn ? 2 : 1, tool:'GapCue', tool_version:'0.4.0', ...(hn ? {source_kind:'hackernews'} : {}), synthetic:false, started_at:new Date().toISOString(), captured_at:new Date().toISOString(), collection_status:'complete', parameters:{backend:'anonymous browser GET',page_size:PAGE_SIZE,issue_limit:1,reference_limit:2}, repositories:[], requests:client.requests, failures:[], ...(hn ? {threads:[]} : {issues:[]})};
  }
  function unavailable(result, name, error, client) {
    if (client.signal?.aborted || error.name === 'AbortError' && !error.code) throw error;
    result.collection_status = 'partial'; result.failures.push(name+': '+(error.code || 'sourceFailed'));
  }
  async function search(query, sort = 'relevance', options) {
    const c = client(options), parsed = input(query);
    if (parsed.kind !== 'search' || !['relevance','recent'].includes(sort)) throw new SourceError('invalidInput');
    const days = options?.days ?? 90;
    if (![0,30,90,365].includes(days)) throw new SourceError('invalidInput');
    const params = new URLSearchParams({query:parsed.query,tags:'story',hitsPerPage:'8',page:'0',typoTolerance:'false',removeWordsIfNoResults:'none'});
    if (days) params.set('numericFilters','created_at_i>='+Math.floor(Date.now()/1000-days*86400));
    const url = HN+(sort==='recent'?'search_by_date':'search')+'?'+params;
    const data = await c.get(url);
    if (!Array.isArray(data.hits) || !nonnegative(data.nbHits)) throw new SourceError('sourceFailed');
    const entries = data.hits.slice(0,8).filter(h => positive(Number(h.objectID)) && typeof h.title==='string' && typeof h.created_at==='string').map(h => ({id:Number(h.objectID),title:plain(h.title).slice(0,1000),author:String(h.author||'[unavailable]').slice(0,200),created_at:h.created_at,points:nonnegative(h.points)?h.points:null,comments:nonnegative(h.num_comments)?h.num_comments:null,url:'https://news.ycombinator.com/item?id='+h.objectID,project_url:core.external(h.url)}));
    return {query:parsed.query,sort,days,captured_at:new Date().toISOString(),reported_total:data.nbHits,entries,requests:c.requests};
  }
  // GitHub Search returns current cumulative Stars, not a growth rate.
  async function searchRepositories(query, options) {
    const c=client(options), parsed=input(query), days=options?.days ?? 90;
    if (parsed.kind!=='search' || ![0,30,90,365].includes(days)) throw new SourceError('invalidInput');
    if (!/^[\p{L}\p{N} ._+#-]+$/u.test(parsed.query)) throw new SourceError('invalidRepoQuery');
    const terms=[parsed.query,'archived:false','fork:false'];
    const created_since=days?new Date(Date.now()-days*86400000).toISOString().slice(0,10):null;
    if (created_since) terms.push('created:>='+created_since);
    const params=new URLSearchParams({q:terms.join(' '),sort:'stars',order:'desc',per_page:'8',page:'1'});
    const data=await c.get(GH+'search/repositories?'+params);
    if (!data || !nonnegative(data.total_count) || typeof data.incomplete_results!=='boolean' || !Array.isArray(data.items) || data.items.length>8) throw new SourceError('sourceFailed');
    const entries=data.items.map(item=>{
      if (!item || typeof item.full_name!=='string' || !/^[\w-]+\/[\w.-]+$/.test(item.full_name) || item.html_url!=='https://github.com/'+item.full_name || !nonnegative(item.stargazers_count) || typeof item.fork!=='boolean' || typeof item.archived!=='boolean' || typeof item.created_at!=='string' || !Number.isFinite(Date.parse(item.created_at)) || !(item.description===null || typeof item.description==='string')) throw new SourceError('sourceFailed');
      const license=typeof item.license?.spdx_id==='string' && item.license.spdx_id!=='NOASSERTION' ? item.license.spdx_id.slice(0,100) : null;
      return {full_name:item.full_name,html_url:item.html_url,description:item.description===null?null:item.description.slice(0,500),created_at:item.created_at,stargazers_count:item.stargazers_count,fork:item.fork,license};
    });
    return {query:parsed.query,days,created_since,captured_at:new Date().toISOString(),reported_total:data.total_count,incomplete_results:data.incomplete_results,entries,requests:c.requests};
  }
  async function collectHN(id, options) {
    if (!positive(id)) throw new SourceError('invalidInput');
    const c = client(options), result = report(c, true);
    const story = await c.get(FIREBASE+'item/'+id+'.json');
    if (!story || story.id!==id || !['story','poll'].includes(story.type) || story.deleted || story.dead || typeof story.title!=='string' || !positive(story.time) || !nonnegative(story.score) || !nonnegative(story.descendants)) throw new SourceError('unavailableThread');
    const thread = {key:'hn#'+id,source_kind:'hackernews',number:id,url:'https://news.ycombinator.com/item?id='+id,available:true,title:plain(story.title).slice(0,1000),author:String(story.by||'[unavailable]').slice(0,200),points:nonnegative(story.score)?story.score:0,state:'discussion',created_at:new Date(story.time*1000).toISOString(),updated_at:'',body:excerpt(plain(story.text)),references:[],comments:{available:true,reported_total:nonnegative(story.descendants)?story.descendants:0,pages:[],entries:[],order:'newest_and_oldest_index_pages',indexed_total:null}};
    const project = core.external(story.url);
    if (project) thread.references.push({url:project,kind:'project_link',check:'link_only',reason:'Story link; source, license and current implementation not checked.'});
    result.threads.push(thread);
    const base=HN+'search_by_date?'+new URLSearchParams({tags:'comment,story_'+id,hitsPerPage:String(PAGE_SIZE)});
    const seen = new Set();
    function addPage(page, data) {
      if (!Array.isArray(data.hits) || data.hits.length>PAGE_SIZE || data.page!==page || !nonnegative(data.nbHits) || !nonnegative(data.nbPages)) throw new SourceError('sourceFailed');
      thread.comments.pages.push(page+1);
      for (const hit of data.hits) {
        const cid = Number(hit.objectID);
        if (seen.has(cid)) continue;
        if (!positive(cid) || hit.story_id!==id || !positive(hit.parent_id) || typeof hit.comment_text!=='string' || !Number.isFinite(Date.parse(hit.created_at))) {
          thread.comments.available=false;result.collection_status='partial';result.failures.push('Indexed comment text/identity unavailable on page '+(page+1));continue;
        }
        seen.add(cid);thread.comments.entries.push({id:cid,parent_id:hit.parent_id,url:'https://news.ycombinator.com/item?id='+cid,author:String(hit.author||'[unavailable]').slice(0,200),account_type:'Unknown',association:'',created_at:hit.created_at,page:page+1,body:excerpt(plain(hit.comment_text))});
      }
    }
    try {
      const first = await c.get(base+'&page=0'); addPage(0,first);
      thread.comments.indexed_total=first.nbHits;
      if (first.nbPages>1) {
        const last = first.nbPages-1;
        try { addPage(last,await c.get(base+'&page='+last)); }
        catch(error) { thread.comments.available=false;unavailable(result,'oldest indexed comments',error,c); }
      }
    } catch(error) { thread.comments.available=false;unavailable(result,'indexed comments',error,c); }
    if (thread.comments.entries.length < thread.comments.reported_total && thread.comments.indexed_total===0) {
      thread.comments.available=false;result.collection_status='partial';result.failures.push('Indexed comments are unavailable although HN reports comments.');
    }
    thread.comments.has_unread=thread.comments.entries.length < Math.max(thread.comments.reported_total,thread.comments.indexed_total||0);
    result.captured_at=new Date().toISOString();core.validate(result);return result;
  }
  function references(repository, text) {
    const entries = [], seen = new Set();
    function add(repo, number) {
      const key=repo+'#'+number;if (seen.has(key.toLowerCase()) || entries.length>=12) return;
      seen.add(key.toLowerCase());entries.push({url:'https://github.com/'+repo+'/issues/'+number,repository:repo,number:Number(number),kind:'issue',check:'not_checked'});
    }
    for (const m of text.matchAll(/https:\/\/github\.com\/([\w-]+\/[\w.-]+)\/(?:issues|pull)\/([1-9][0-9]*)/g)) add(m[1],m[2]);
    for (const m of text.matchAll(/(?<![\w/])#([1-9][0-9]*)\b/g)) add(repository,m[1]);
    return entries;
  }
  async function collectGitHub(repository, number, options) {
    if (!/^[\w-]+\/[\w.-]+$/.test(repository) || !positive(number)) throw new SourceError('invalidInput');
    const c=client(options),result=report(c),info=await c.get(GH+'repos/'+repository);
    if (!info || info.private!==false || info.visibility && info.visibility!=='public') throw new SourceError('unavailableThread');
    result.repositories.push({full_name:info.full_name,available:true,stars:info.stargazers_count,url:info.html_url,captured_at:new Date().toISOString()});
    const base=GH+'repos/'+repository+'/issues/'+number;
    const data=await c.get(base);
    if (!data || data.number!==number || data.pull_request || !['open','closed'].includes(data.state) || typeof data.title!=='string' || !nonnegative(data.comments)) throw new SourceError('unavailableThread');
    const issue={key:repository+'#'+number,repository,number,url:'https://github.com/'+repository+'/issues/'+number,available:true,title:data.title.slice(0,1000),state:data.state,state_reason:data.state_reason||null,author:String(data.user?.login||'[unavailable]').slice(0,200),created_at:data.created_at,updated_at:data.updated_at,body:excerpt(data.body),references:[],comments:{available:true,reported_total:data.comments,pages:[],entries:[],order:'first_and_last_pages',has_unread:false}};
    result.issues.push(issue);
    const pages=data.comments ? [...new Set([1,Math.ceil(data.comments/PAGE_SIZE)])] : [];
    const ids=new Set();
    for (const page of pages) {
      try {
        const comments=await c.get(base+'/comments?per_page='+PAGE_SIZE+'&page='+page);
        if (!Array.isArray(comments) || comments.length>PAGE_SIZE) throw new SourceError('sourceFailed');
        issue.comments.pages.push(page);
        for (const item of comments) {
          if (!positive(item.id) || ids.has(item.id) || !core.github(item.html_url)) continue;
          ids.add(item.id);issue.comments.entries.push({id:item.id,url:item.html_url,author:String(item.user?.login||'[unavailable]').slice(0,200),account_type:item.user?.type||'Unknown',association:item.author_association||'NONE',created_at:item.created_at,updated_at:item.updated_at,page,body:excerpt(item.body)});
        }
      } catch(error) { issue.comments.available=false;unavailable(result,'GitHub comments page '+page,error,c); }
    }
    issue.comments.has_unread=issue.comments.entries.length<issue.comments.reported_total;
    issue.references=references(repository,[issue.body.text,...issue.comments.entries.map(c=>c.body.text)].join('\n')).filter(r=>!(r.repository.toLowerCase()===repository.toLowerCase()&&r.number===number));
    for (const ref of issue.references.slice(0,2)) {
      try {
        const publicInfo=ref.repository.toLowerCase()===repository.toLowerCase()?info:await c.get(GH+'repos/'+ref.repository);
        if (publicInfo.private!==false || publicInfo.visibility && publicInfo.visibility!=='public') throw new SourceError('unavailableThread');
        const target=await c.get(GH+'repos/'+ref.repository+'/issues/'+ref.number);
        if (!target || target.number!==ref.number || !['open','closed'].includes(target.state)) throw new SourceError('sourceFailed');
        let detail=target;
        if (target.pull_request) detail=await c.get(GH+'repos/'+ref.repository+'/pulls/'+ref.number);
        Object.assign(ref,{kind:target.pull_request?'pull_request':'issue',state:target.pull_request&&detail.merged_at?'merged':detail.state,url:target.html_url,check:'checked',captured_at:new Date().toISOString()});
      } catch(error) { ref.check='unavailable';ref.reason=error.code||'sourceFailed';unavailable(result,'GitHub reference '+ref.repository+'#'+ref.number,error,c); }
    }
    result.captured_at=new Date().toISOString();core.validate(result);return result;
  }
  async function collect(value, options) {
    const parsed=input(value);
    if (parsed.kind==='hackernews') return collectHN(parsed.id,options);
    if (parsed.kind==='github') return collectGitHub(parsed.repository,parsed.number,options);
    throw new SourceError('invalidInput');
  }
  const api={PAGE_SIZE,MAX_RESPONSE,SourceError,plain,excerpt,input,search,searchRepositories,collect,collectHN,collectGitHub};
  if (typeof module==='object'&&module.exports) module.exports=api;else globalThis.GapCueLive=api;
})();
