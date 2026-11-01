/* MIT © 2026 LydiaTools. Stack Exchange search is a bounded public read. */
(function (root, factory) {
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.GapCueStack=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const API='https://api.stackexchange.com/2.3/';
  const STORE='gapcue-stackexchange-throttle-v1';
  const LIMIT=1024*1024;
  const SEARCH_FILTER='!*M*dC)MfMUxnKjPG';
  const licenses={'CC BY-SA 2.5':'https://creativecommons.org/licenses/by-sa/2.5/','CC BY-SA 3.0':'https://creativecommons.org/licenses/by-sa/3.0/','CC BY-SA 4.0':'https://creativecommons.org/licenses/by-sa/4.0/'};
  const isInt=n=>Number.isSafeInteger(n)&&n>=0;
  const isId=n=>isInt(n)&&n>0;
  const text=(v,max)=>typeof v==='string'&&v.length<=max;
  class SourceError extends Error{constructor(code,wait=0){super(code);this.code=code;this.wait=wait;}}
  function questionUrl(value){
    if(!text(value,1500))return null;
    try{const u=new URL(value),m=u.pathname.match(/^\/(?:questions|q)\/([1-9][0-9]*)(?:\/[^/?#]+)?\/?$/);
      return u.protocol==='https:'&&u.hostname==='stackoverflow.com'&&!u.username&&!u.password&&!u.port&&m&&isId(Number(m[1]))?'https://stackoverflow.com/questions/'+m[1]:null;
    }catch{return null;}
  }
  function personUrl(value){
    if(!text(value,1500))return null;
    try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='stackoverflow.com'&&!u.username&&!u.password&&!u.port&&/^\/users\/[1-9][0-9]*(?:\/[^/?#]+)?\/?$/.test(u.pathname)?u.origin+u.pathname:null;}catch{return null;}
  }
  function repoUrl(value){
    try{const u=new URL(value),m=u.pathname.match(/^\/([A-Za-z0-9_-]{1,39})\/([A-Za-z0-9_.-]{1,100})(?:\/|$)/);
      if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password||u.port||!m||m[2]==='.'||m[2]==='..')return null;
      return 'https://github.com/'+m[1]+'/'+m[2].replace(/\.git$/i,'');
    }catch{return null;}
  }
  function repos(html){
    const found=[];for(const match of String(html||'').matchAll(/https:\/\/github\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+(?:\/[^\s"'<>)]*)?/gi)){
      const u=repoUrl(match[0]);if(u&&!found.some(x=>x.toLowerCase()===u.toLowerCase()))found.push(u);if(found.length===10)break;
    }return found;
  }
  function plain(v){return String(v||'').replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,(_,url,label)=>label+' ('+url+')').replace(/<(?:p|br|\/p|\/pre|\/div|\/li)\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/gi,(m,e)=>{if(e[0]==='#'){const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1));return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):m;}return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[e.toLowerCase()]||m;}).trim();}
  function excerpt(v){const chars=[...plain(v)],max=6000;return {text:chars.slice(0,max).join(''),characters:chars.length,truncated:chars.length>max};}
  function author(owner){return {name:text(owner?.display_name,200)?plain(owner.display_name).slice(0,200):'[deleted or unavailable]',url:personUrl(owner?.link)};}
  function date(n){if(!isId(n)||n>253402300799)throw new SourceError('sourceFailed');return new Date(n*1000).toISOString();}
  function attribution(item){if(!text(item.content_license,80)||!item.content_license.trim())throw new SourceError('licenseUnavailable');return {author:author(item.owner),license:item.content_license};}
  function snapshotQuestion(item){
    const url=questionUrl(item.link);if(!isId(item.question_id)||!url||!url.endsWith('/'+item.question_id)||!text(item.title,1500)||!text(item.body,500000)||!isInt(item.answer_count))throw new SourceError('sourceFailed');
    return {id:item.question_id,title:plain(item.title).slice(0,1000),url,created_at:date(item.creation_date),answer_count:item.answer_count,body:excerpt(item.body),attribution:attribution(item),repositories:repos(item.body)};
  }
  function snapshotAnswer(item,qid){
    if(!isId(item.answer_id)||item.question_id!==qid||!text(item.body,500000)||typeof item.is_accepted!=='boolean')throw new SourceError('sourceFailed');
    return {id:item.answer_id,url:'https://stackoverflow.com/a/'+item.answer_id,created_at:date(item.creation_date),accepted:item.is_accepted,body:excerpt(item.body),attribution:attribution(item),repositories:repos(item.body)};
  }
  function memoryStore(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};}
  async function hash(value){if(!globalThis.crypto?.subtle)throw new SourceError('storageUnavailable');const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
  function throttle(storage){
    function load(){try{const raw=storage.getItem(STORE);if(!raw)return {methods:{},seen:{}};const o=JSON.parse(raw);if(!o||typeof o.methods!=='object'||typeof o.seen!=='object')throw Error();return o;}catch{throw new SourceError('storageUnavailable');}}
    function save(s){try{storage.setItem(STORE,JSON.stringify(s));}catch{throw new SourceError('storageUnavailable');}}
    async function reserve(method,fingerprint,now){const s=load(),until=Number(s.methods[method]||0);if(until>now)throw new SourceError('backoff',Math.ceil((until-now)/1000));const last=Number(s.seen[fingerprint]||0);if(last>now-60000)throw new SourceError('duplicate',Math.ceil((last+60000-now)/1000));s.seen=Object.fromEntries(Object.entries(s.seen).filter(([,v])=>Number(v)>now-60000).slice(-63));s.seen[fingerprint]=now;save(s);}
    function pause(method,seconds,now){if(!isInt(seconds)||seconds>2147483647)throw new SourceError('sourceFailed');if(!seconds)return;const s=load();s.methods[method]=Math.max(Number(s.methods[method]||0),now+seconds*1000);save(s);}
    return {reserve,pause};
  }
  function browserStorage(){try{return globalThis.localStorage;}catch{return null;}}
  function client({fetcher=globalThis.fetch,storage=browserStorage(),signal,now=()=>Date.now(),locks=globalThis.navigator?.locks}={}){
    if(!storage)throw new SourceError('storageUnavailable');const state=throttle(storage);
    async function get(method,path,params){
      if(!['search','question','answers'].includes(method))throw new SourceError('invalidInput');
      const url=API+path+'?'+new URLSearchParams(params),keyParams=new URLSearchParams(params);if(method==='search'&&keyParams.has('q'))keyParams.set('q',keyParams.get('q').toLowerCase());const fingerprint=await hash(API+path+'?'+keyParams);
      const run=async()=>{
        if(signal?.aborted)throw new DOMException('Stopped','AbortError');
        await state.reserve(method,fingerprint,now());
        const controller=new AbortController();let timed=false;const cancel=()=>controller.abort();if(signal?.aborted)throw new DOMException('Stopped','AbortError');signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(()=>{timed=true;controller.abort();},20000);
        try{const response=await fetcher(url,{method:'GET',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error',signal:controller.signal,headers:{Accept:'application/json'}});
          if(Number(response.headers.get('content-length'))>LIMIT)throw new SourceError('responseTooLarge');
          const reader=response.body.getReader(),chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>LIMIT){await reader.cancel();throw new SourceError('responseTooLarge');}chunks.push(value);}
          const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new SourceError('sourceFailed');}
          if(data?.backoff!==undefined)state.pause(method,data.backoff,now());
          if(!response.ok)throw new SourceError(response.status===429||data?.error_id===502||data?.error_id===402?'rateLimited':'sourceFailed');
          if(!data||!Array.isArray(data.items)||typeof data.has_more!=='boolean')throw new SourceError('sourceFailed');
          return data;
        }catch(e){if(timed)throw new SourceError('timeout');throw e;}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
      };
      return locks?.request?locks.request('gapcue-stackexchange',signal?{signal}:{},run):run();
    }
    return {get};
  }
  async function search(query,days,options){
    query=String(query||'').trim().replace(/\s+/g,' ');if(query.length<2||query.length>120||!['0','30','90','365'].includes(String(days)))throw new SourceError('invalidInput');
    const params={site:'stackoverflow',q:query,pagesize:'8',sort:'creation',order:'desc',filter:SEARCH_FILTER};if(Number(days))params.fromdate=String((Math.floor(Date.now()/86400000)-Number(days))*86400);
    const data=await client(options).get('search','search/advanced',params);
    if(data.items.length>8)throw new SourceError('sourceFailed');
    const entries=data.items.map(item=>{const url=questionUrl(item.link);if(!isId(item.question_id)||!url||!url.endsWith('/'+item.question_id)||!text(item.title,1500)||!isInt(item.answer_count))throw new SourceError('sourceFailed');return {id:item.question_id,title:plain(item.title).slice(0,1000),url,created_at:date(item.creation_date),answer_count:item.answer_count,attribution:attribution(item)};});
    return {query,days:Number(days),captured_at:new Date().toISOString(),has_more:data.has_more,entries};
  }
  async function collect(id,options){
    if(!isId(id))throw new SourceError('invalidInput');const c=client(options),q=await c.get('question','questions/'+id,{site:'stackoverflow',filter:'withbody'});
    if(q.items.length!==1)throw new SourceError('unavailable');const question=snapshotQuestion(q.items[0]);if(question.id!==id)throw new SourceError('sourceFailed');
    let answers=[],partial=false,hasMore=false;
    try{const a=await c.get('answers','questions/'+id+'/answers',{site:'stackoverflow',filter:'withbody',pagesize:'10',sort:'votes',order:'desc'});if(a.items.length>10)throw new SourceError('sourceFailed');answers=a.items.map(item=>snapshotAnswer(item,id));hasMore=a.has_more;}
    catch(e){if(e.name==='AbortError')throw e;partial=true;}
    const source={schema:1,tool:'GapCueStackOverflow',source:'Stack Overflow',captured_at:new Date().toISOString(),question,answers,answers_has_more:hasMore,partial};validate(source);return source;
  }
  function validate(s){
    if(!s||s.schema!==1||s.tool!=='GapCueStackOverflow'||s.source!=='Stack Overflow'||!text(s.captured_at,100)||!Number.isFinite(Date.parse(s.captured_at))||(s.search_query!==undefined&&!text(s.search_query,120))||!s.question||!isId(s.question.id)||s.question.url!=='https://stackoverflow.com/questions/'+s.question.id||!text(s.question.title,1000)||!text(s.question.created_at,100)||!isInt(s.question.answer_count)||!Array.isArray(s.answers)||s.answers.length>10||typeof s.partial!=='boolean'||typeof s.answers_has_more!=='boolean')throw new SourceError('invalidSnapshot');
    function check(v){if(!v||!v.body||!text(v.body.text,16000)||!isInt(v.body.characters)||[...v.body.text].length>v.body.characters||typeof v.body.truncated!=='boolean'||!v.attribution||!v.attribution.author||!text(v.attribution.author.name,200)||(v.attribution.author.url!==null&&personUrl(v.attribution.author.url)!==v.attribution.author.url)||!text(v.attribution.license,80)||!v.attribution.license||!Array.isArray(v.repositories)||v.repositories.length>10||v.repositories.some(u=>repoUrl(u)!==u))throw new SourceError('invalidSnapshot');}
    check(s.question);const ids=new Set();for(const a of s.answers){if(!isId(a.id)||ids.has(a.id)||a.url!=='https://stackoverflow.com/a/'+a.id||!text(a.created_at,100)||typeof a.accepted!=='boolean')throw new SourceError('invalidSnapshot');ids.add(a.id);check(a);}return s;
  }
  const api={SourceError,questionUrl,personUrl,repoUrl,repos,plain,excerpt,author,hash,throttle,memoryStore,client,search,collect,validate,licenses};return api;
}));
