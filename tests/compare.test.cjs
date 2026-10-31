const test=require('node:test'),assert=require('node:assert/strict'),core=require('../app/compare-core.js');
const repo=(id,name,stars)=>({id,full_name:name,html_url:'https://github.com/'+name,stargazers_count:stars});
const sample=(time,entries,extra={})=>({tool:'GapCue',kind:'repo-snapshot',schema_version:1,query:'agents',days:30,created_since:'2026-10-01',captured_at:time,incomplete_results:false,entries,...extra});
test('compare uses stable IDs, actual timestamps and never treats missing rows as zero',()=>{
 const a=sample('2026-10-31T01:00:00.000Z',[repo(1,'old/name',20),repo(2,'only/old',5)]);
 const b=sample('2026-11-01T01:00:00.000Z',[repo(1,'new/name',18),repo(3,'only/new',99)],{created_since:'2026-10-02',incomplete_results:true});
 const x=core.compare(b,a);assert.equal(x.earlier,a);assert.equal(x.later,b);assert.equal(x.earlier_only,1);assert.equal(x.later_only,1);assert.deepEqual(x.matches.map(v=>[v.id,v.old_name,v.full_name,v.before,v.after,v.change]),[[1,'old/name','new/name',20,18,-2]]);
});
test('reject incompatible, ambiguous and unsafe inputs',()=>{
 const a=sample('2026-10-31T01:00:00.000Z',[repo(1,'x/y',2)]),b=sample('2026-11-01T01:00:00.000Z',[repo(1,'x/y',3)]);
 assert.throws(()=>core.compare(a,{...b,query:'other'}),/different_search/);assert.throws(()=>core.compare(a,{...b,days:90}),/different_search/);assert.throws(()=>core.compare(a,{...b,captured_at:a.captured_at}),/same_time/);
 assert.throws(()=>core.validate({...a,entries:[a.entries[0],a.entries[0]]}),/invalid/);assert.throws(()=>core.validate({...a,entries:[{...a.entries[0],html_url:'https://github.com.evil/x/y'}]}),/invalid/);
 assert.throws(()=>core.validate({...a,entries:[{...a.entries[0],id:undefined}]}),/invalid/);assert.throws(()=>core.validate({...a,captured_at:'not a time'}),/invalid/);
});
test('snapshot exports bounded fields rather than descriptions or request metadata',()=>{
 const source={query:'agents',days:0,created_since:null,captured_at:'2026-11-01T01:00:00.000Z',incomplete_results:false,requests:[{secret:'not needed'}],entries:[{...repo(1,'x/y',5),description:'not needed'}]};
 const snap=core.snapshot(source);assert.equal(snap.entries[0].id,1);assert.equal('description' in snap.entries[0],false);assert.equal('requests' in snap,false);
});
