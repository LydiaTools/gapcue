/* MIT © 2026 LydiaTools. */
(function(root, factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GapCueCompare=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function validate(s){
  if(!s||s.tool!=='GapCue'||s.kind!=='repo-snapshot'||s.schema_version!==1||typeof s.query!=='string'||s.query.length<2||s.query.length>120||![0,30,90,365].includes(s.days)||typeof s.captured_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s.captured_at)||!Number.isFinite(Date.parse(s.captured_at))||typeof s.incomplete_results!=='boolean'||!Array.isArray(s.entries)||s.entries.length>8)throw Error('invalid');
  if(new Date(s.captured_at).toISOString()!==s.captured_at)throw Error('invalid');
  if(!(s.created_since===null||typeof s.created_since==='string'&&/^\d{4}-\d\d-\d\d$/.test(s.created_since)&&Number.isFinite(Date.parse(s.created_since+'T00:00:00Z'))&&new Date(s.created_since+'T00:00:00Z').toISOString().slice(0,10)===s.created_since))throw Error('invalid');
  if((s.days===0)!==(s.created_since===null))throw Error('invalid');
  const ids=new Set();
  for(const e of s.entries){if(!e||!Number.isSafeInteger(e.id)||e.id<=0||ids.has(e.id)||typeof e.full_name!=='string'||! /^[\w-]+\/[\w.-]+$/.test(e.full_name)||e.html_url!=='https://github.com/'+e.full_name||!Number.isSafeInteger(e.stargazers_count)||e.stargazers_count<0)throw Error('invalid');ids.add(e.id);}
  return s;
 }
 function snapshot(result){return validate({tool:'GapCue',kind:'repo-snapshot',schema_version:1,query:result.query,days:result.days,created_since:result.created_since,captured_at:result.captured_at,incomplete_results:result.incomplete_results,entries:result.entries.map(({id,full_name,html_url,stargazers_count})=>({id,full_name,html_url,stargazers_count}))});}
 function compare(a,b){validate(a);validate(b);if(a.query!==b.query||a.days!==b.days)throw Error('different_search');if(Date.parse(a.captured_at)===Date.parse(b.captured_at))throw Error('same_time');
  const [earlier,later]=Date.parse(a.captured_at)<Date.parse(b.captured_at)?[a,b]:[b,a],old=new Map(earlier.entries.map(e=>[e.id,e])),now=new Set(later.entries.map(e=>e.id));
  const matches=later.entries.filter(e=>old.has(e.id)).map(e=>({id:e.id,full_name:e.full_name,html_url:e.html_url,old_name:old.get(e.id).full_name,before:old.get(e.id).stargazers_count,after:e.stargazers_count,change:e.stargazers_count-old.get(e.id).stargazers_count}));
  return {earlier,later,matches,earlier_only:earlier.entries.filter(e=>!now.has(e.id)).length,later_only:later.entries.filter(e=>!old.has(e.id)).length};
 }
 return {validate,snapshot,compare};
});
