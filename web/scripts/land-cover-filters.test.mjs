import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { importTs } from "./load-ts.mjs";
const { validateRequest, rankTerrain } = await importTs("search.ts");
const base = {title:'Cover constraints',objective:'',profile:'mobility',target:'jezero',mode:'live',west:-4,east:-2,south:42,north:44,minLandFraction:0.9,minSlopeP95:0,maxSlopeP95:20,desiredSlopeP95:8.4,maxJsd:0.6,requirements:[],strict:false,limit:9};
function cover(tree=0.6,built=0.02,bare=0.001) {
 return {status:'available',coverageFraction:1,totalSamples:250000,classifiedSamples:250000,classes:[{code:10,fractionOfWindow:tree},{code:50,fractionOfWindow:built},{code:60,fractionOfWindow:bare}]};
}
const row = {id:'test-window',lat:43,lon:-3,jsd:0.39,landFraction:1,landStatus:'ELIGIBLE',slopeP95:10,slopeMean:4};
function rank(filters, evidence=cover()) {return rankTerrain([{...row,landCover:evidence}],validateRequest({...base,landCoverConstraints:filters}));}
test('cover limits filter independently and boundaries are inclusive',()=>{
 assert.equal(rank({maxTreeFraction:0.6,maxBuiltFraction:0.02,minBareFraction:0.001}).candidates.length,1);
 for(const f of [{maxTreeFraction:0.599},{maxBuiltFraction:0.019},{minBareFraction:0.002}]) {
  const r=rank(f); assert.equal(r.candidates.length,0); assert.equal(r.landCoverRejected.outside,1);
 }
 assert.equal(rank({maxBuiltFraction:0},cover(0.6,0,0.001)).candidates.length,1);
 assert.equal(rank({maxBuiltFraction:0}).candidates.length,0);
});
test('unknown, partial and malformed cover never pass an active filter',()=>{
 const variants=[undefined,{...cover(),status:'partial',coverageFraction:0.5},{...cover(),status:'error'},{...cover(),status:'unavailable'},{...cover(),classifiedSamples:0},{...cover(),classes:undefined},{...cover(),classes:[]},{...cover(),totalSamples:Infinity,classifiedSamples:Infinity},{...cover(),classes:[{code:10,fractionOfWindow:NaN}]}];
 for(const c of variants){const r=rankTerrain([{...row,landCover:c}],validateRequest({...base,landCoverConstraints:{minBareFraction:0}}));assert.equal(r.candidates.length,0);assert.equal(r.landCoverRejected.missing,1);}
 assert.equal(rankTerrain([row],validateRequest(base)).candidates.length,1);
});
test('invalid cover requests and unsupported modes are rejected',()=>{
 for(const c of [[],{unknown:0.5},{maxTreeFraction:-1},{maxBuiltFraction:101},{minBareFraction:'0.1'},{minBareFraction:NaN}]) assert.throws(()=>validateRequest({...base,landCoverConstraints:c}));
 for(const mode of ['indexed','facilities']) assert.throws(()=>validateRequest({...base,mode,landCoverConstraints:{maxTreeFraction:1}}));
});
test('cover passes do not qualify critical evidence or replace JSD ranking',()=>{
 const rows=[{...row,id:'closer',jsd:0.1,landCover:cover(0.6)},{...row,id:'less-trees',jsd:0.4,landCover:cover(0.1)}];
 const req=validateRequest({...base,landCoverConstraints:{maxTreeFraction:0.7}});
 const result=rankTerrain(rows,req);
 assert.deepEqual(result.candidates.map(c=>c.id),['closer','less-trees']);
 assert.ok(result.candidates.every(c=>c.status==='verification-required' && c.missingEvidence.length>0));
 assert.equal(rankTerrain(rows,{...req,strict:true}).candidates.length,0);
});
test('real Northern Spain cover evidence is excluded at a 1% bare/sparse minimum',async()=>{
 const report=JSON.parse(await readFile(new URL('../../results/exp001/worldcover_northern_spain_validation.json',import.meta.url),'utf8'));
 const rows=report.rows.map(c=>({...row,...c}));
 const result=rankTerrain(rows,validateRequest({...base,landCoverConstraints:{minBareFraction:0.01}}));
 assert.equal(result.candidates.length,0);
 assert.equal(result.landCoverRejected.outside,9);
 assert.equal(result.landCoverRejected.missing,0);
});
