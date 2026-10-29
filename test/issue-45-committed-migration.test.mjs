// R: Verify real G7 committed-source producer/consumer binding and persistence phases.
import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,chmodSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {captureAdvanceHistoryBaseline} from '../dist/history/git-probe.js';
import {planMilestoneAcceptanceMigration,recheckCommittedMigrationProof} from '../dist/milestone-acceptance/migration.js';
const cli=path.resolve('dist/cli.js');
const source=`project PROBE:\n  version 5\n  title "Committed input"\n  duration_unit point\n  finish DONE\n\nmilestone START:\n  title "Start"\n  state reached\n\nmilestone DONE:\n  title "Done"\n\ntask WORK START -> DONE:\n  title "Work"\n  duration 1p\n  status planned\n`;
const digest=s=>'sha256:'+createHash('sha256').update(s).digest('hex');
function git(directory,args){const r=spawnSync('git',args,{cwd:directory,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
function fixture(t,text=source,format='sha1'){
 const directory=mkdtempSync(path.join(tmpdir(),'perttool-issue45-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 git(directory,['init','--quiet',`--object-format=${format}`]);git(directory,['config','user.name','migration test']);git(directory,['config','user.email','test@example.invalid']);
 const file=path.join(directory,'plan.pert');writeFileSync(file,text);git(directory,['add','plan.pert']);git(directory,['commit','--quiet','-m','committed baseline']);return {directory,file,text};
}
function migrate(f,{write=false,expected=digest(readFileSync(f.file)),env=process.env,target='7'}={}){
 const args=[cli,'document','migrate','plan.pert','--target-grammar',target,'--format','json',...(write?['--write','--expect-digest',expected]:[])];
 const r=spawnSync(process.execPath,args,{cwd:f.directory,env,encoding:'utf8'});return {status:r.status,value:JSON.parse(r.stdout),stderr:r.stderr};
}
for(const write of [false,true])test(`Stable dirty source is rejected at committed proof consumer; write=${write}`,t=>{
 const f=fixture(t),dirty=source.replace('Committed input','Uncommitted change');writeFileSync(f.file,dirty);
 const before=git(f.directory,['rev-parse','HEAD:plan.pert']);assert.equal(git(f.directory,['rev-parse',':plan.pert']),before);
 const result=migrate(f,{write});assert.equal(result.status,1,JSON.stringify(result.value));assert.equal(result.value.ok,false);assert.ok(result.value.diagnostics.includes('source_digest_mismatch'));
 assert.equal(readFileSync(f.file,'utf8'),dirty);assert.equal(git(f.directory,['rev-parse','HEAD:plan.pert']),before);assert.equal(git(f.directory,['rev-parse',':plan.pert']),before);
});
for(const format of ['sha1','sha256'])test(`Clean committed source retains exact preview/write candidate in ${format}`,t=>{
 const f=fixture(t,source,format),preview=migrate(f);assert.equal(preview.status,0,JSON.stringify(preview.value));assert.equal(preview.value.ok,true);assert.equal(readFileSync(f.file,'utf8'),source);
 const written=migrate(f,{write:true});assert.equal(written.status,0,JSON.stringify(written.value));assert.equal(written.value.candidate_text,preview.value.candidate_text);assert.equal(readFileSync(f.file,'utf8'),preview.value.candidate_text);assert.deepEqual(written.value.grandfathered_milestone_ids,['START']);
 assert.match(written.value.candidate_text,new RegExp('  source_digest '+digest(source)));assert.doesNotMatch(written.value.candidate_text,/milestone_criterion_set|milestone_acceptance_receipt/u);
});

for(const state of ['index_only','both'])test(`Staged mismatch is refused without losing ${state} bytes`,t=>{
 const f=fixture(t),staged=source.replace('Committed input','Staged change');writeFileSync(f.file,staged);git(f.directory,['add','plan.pert']);if(state==='index_only')writeFileSync(f.file,source);
 const before=readFileSync(f.file,'utf8'),index=git(f.directory,['rev-parse',':plan.pert']);const result=migrate(f,{write:true});assert.equal(result.status,1);assert.equal(result.value.ok,false);assert.ok(result.value.diagnostics.includes('stage0_not_equal_to_head'));assert.equal(readFileSync(f.file,'utf8'),before);assert.equal(git(f.directory,['rev-parse',':plan.pert']),index);
});
test('Whole repository cleanliness is not required for a committed target',t=>{
 const f=fixture(t);writeFileSync(path.join(f.directory,'unrelated.txt'),'unrelated dirty work\n');const result=migrate(f,{write:true});assert.equal(result.status,0);assert.equal(readFileSync(path.join(f.directory,'unrelated.txt'),'utf8'),'unrelated dirty work\n');
});
test('A different tracked path cannot supply the target HEAD proof',t=>{
 const f=fixture(t);git(f.directory,['mv','plan.pert','other.pert']);git(f.directory,['commit','--quiet','-m','rename target']);writeFileSync(f.file,source);const result=migrate(f,{write:true});assert.equal(result.status,1);assert.deepEqual(result.value.diagnostics,['PTMAC-109']);assert.equal(readFileSync(f.file,'utf8'),source);
});
test('Unborn HEAD cannot produce a durable migration baseline',t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'perttool-issue45-unborn-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));git(directory,['init','--quiet']);const f={directory,file:path.join(directory,'plan.pert')};writeFileSync(f.file,source);git(directory,['add','plan.pert']);const result=migrate(f,{write:true});assert.equal(result.status,1);assert.deepEqual(result.value.diagnostics,['PTMAC-109']);assert.equal(readFileSync(f.file,'utf8'),source);
});
test('A clean CRLF Unicode source binds the raw committed bytes and its actual source grammar',t=>{
 const text=source.replace('version 5','version 6').replace('Committed input','Café Ω committed').replace(/\n/gu,'\r\n'),f=fixture(t,text);const result=migrate(f,{write:true});assert.equal(result.status,0,JSON.stringify(result.value));assert.equal(result.value.source_digest,digest(text));assert.equal(result.value.source_grammar_version,6);assert.match(result.value.candidate_text,/Café Ω committed/u);assert.match(result.value.candidate_text,/version 7\r\n/u);
});
test('The Core consumes committed HEAD origin rather than a self-consistent dirty digest',async t=>{
 const f=fixture(t),dirty=source.replace('Committed input','Stable dirty');writeFileSync(f.file,dirty);const baseline=await captureAdvanceHistoryBaseline({targetPath:f.file,expectedSourceDigest:digest(dirty)});assert.equal(baseline.status,'complete');assert.notEqual(baseline.currentSourceDigest,baseline.headSourceDigest);
 const proof={repositoryId:baseline.repositorySnapshotId,repositoryRelativePath:baseline.repositoryRelativePath,objectFormat:baseline.objectFormat,headCommit:baseline.headCommitId,headBlob:baseline.headBlobId,stage0Blob:baseline.indexBlobId,sourceDigest:baseline.headSourceDigest};
 assert.equal(planMilestoneAcceptanceMigration(dirty,proof).ok,false);assert.deepEqual(planMilestoneAcceptanceMigration(dirty,proof).diagnostics,['source_digest_mismatch']);assert.equal(planMilestoneAcceptanceMigration(source,proof).ok,true);
 for(const key of Object.keys(proof)){const changed={...proof,[key]:key==='objectFormat'?'sha256':'different'};assert.equal(recheckCommittedMigrationProof(proof,changed),false,key);}assert.equal(recheckCommittedMigrationProof(proof,{...proof}),true);
});
function raceEnvironment(f,kind,phase){
 const bin=path.join(f.directory,'.git','test-bin');mkdirSync(bin,{recursive:true});
 const realGit=spawnSync('sh',['-c','command -v git'],{encoding:'utf8'}).stdout.trim();assert.ok(realGit);
 const script=String.raw`#!/usr/bin/env node
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const args=process.argv.slice(2),statePath=process.env.ISSUE45_STATE;
const invoke=a=>cp.spawnSync(process.env.ISSUE45_REAL_GIT,a,{env:{...process.env,GIT_OPTIONAL_LOCKS:'1'},encoding:null});
const r=invoke(args);if(r.error)throw r.error;
const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):{root:0,blob:0,mutated:false};
const root=args.includes('--show-toplevel'),blob=args.includes('cat-file')&&args.includes('blob');if(root)state.root++;if(blob)state.blob++;
if(!state.mutated&&r.status===0&&((process.env.ISSUE45_PHASE==='capture'&&blob&&state.blob===2)||(process.env.ISSUE45_PHASE==='recheck'&&root&&state.root===2))){
 const file=process.env.ISSUE45_TARGET,repo=process.env.ISSUE45_REPO,original=fs.readFileSync(file,'utf8');
 if(process.env.ISSUE45_KIND==='head'){const x=invoke(['-C',repo,'commit','--allow-empty','--quiet','-m','external HEAD movement']);if(x.status!==0)throw Error(x.stderr.toString());}
 else {fs.writeFileSync(file,original.replace('Committed input','External change'));if(process.env.ISSUE45_KIND==='index'){const x=invoke(['-C',repo,'add','plan.pert']);if(x.status!==0)throw Error(x.stderr.toString());fs.writeFileSync(file,original);}}
 state.mutated=true;
}
fs.writeFileSync(statePath,JSON.stringify(state));process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exit(r.status);
`;
 const wrapper=path.join(bin,'git');writeFileSync(wrapper,script);chmodSync(wrapper,0o755);const state=path.join(f.directory,'.git','test-state.json');return {env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,ISSUE45_STATE:state,ISSUE45_REAL_GIT:realGit,ISSUE45_TARGET:f.file,ISSUE45_REPO:f.directory,ISSUE45_KIND:kind,ISSUE45_PHASE:phase},state};
}
for(const phase of ['capture','recheck'])for(const kind of ['source','head','index'])test(`${kind} movement during ${phase} is refused with the correct phase result`,t=>{
 const f=fixture(t),race=raceEnvironment(f,kind,phase),result=migrate(f,{write:true,env:race.env});assert.equal(JSON.parse(readFileSync(race.state)).mutated,true);assert.equal(result.status,phase==='capture'?1:5,JSON.stringify(result.value));assert.equal(result.value.ok,false);assert.deepEqual(result.value.diagnostics,[phase==='capture'?'PTMAC-109':'PTMAC-110']);const after=readFileSync(f.file,'utf8');assert.doesNotMatch(after,/milestone_acceptance_migration/u);assert.equal(after,kind==='source'?source.replace('Committed input','External change'):source);
});
test('The independent final safe-write digest guard remains enforced',t=>{
 const f=fixture(t),r=migrate(f,{write:true,expected:digest(source+'stale')});assert.equal(r.status,5);assert.equal(r.value.ok,false);assert.deepEqual(r.value.diagnostics,['PTMAC-110']);assert.equal(readFileSync(f.file,'utf8'),source);
});
test('Later grammar migrations retain the original G7 baseline rather than minting another origin',t=>{
 const f=fixture(t),first=migrate(f,{write:true});assert.equal(first.status,0);const record=first.value.candidate_text.match(/milestone_acceptance_migration GRAMMAR_7_BASELINE:[\s\S]*?(?=\nmilestone |\ntask |$)/u)[0];
 for(const target of ['8','9','10']){const r=migrate(f,{write:true,target});assert.equal(r.status,0,JSON.stringify(r.value));const text=readFileSync(f.file,'utf8');assert.ok(text.includes(record));assert.equal((text.match(/^milestone_acceptance_migration /gmu)||[]).length,1);}
});

test('A committed sibling content cannot stand in for the target HEAD blob',t=>{
 const f=fixture(t),other=source.replace('Committed input','Sibling committed');writeFileSync(path.join(f.directory,'other.pert'),other);git(f.directory,['add','other.pert']);git(f.directory,['commit','--quiet','-m','committed sibling']);writeFileSync(f.file,other);const r=migrate(f,{write:true});assert.equal(r.status,1);assert.deepEqual(r.value.diagnostics,['source_digest_mismatch']);assert.equal(readFileSync(f.file,'utf8'),other);assert.equal(readFileSync(path.join(f.directory,'other.pert'),'utf8'),other);
});
test('A missing committed digest cannot yield an eligible Core candidate',async t=>{
 const f=fixture(t),b=await captureAdvanceHistoryBaseline({targetPath:f.file,expectedSourceDigest:digest(source)});assert.equal(b.status,'complete');const proof={repositoryId:b.repositorySnapshotId,repositoryRelativePath:b.repositoryRelativePath,objectFormat:b.objectFormat,headCommit:b.headCommitId,headBlob:b.headBlobId,stage0Blob:b.indexBlobId};const r=planMilestoneAcceptanceMigration(source,proof);assert.equal(r.ok,false);assert.deepEqual(r.diagnostics,['source_digest_mismatch']);assert.equal(r.candidateText,null);
});

for(const kind of ['comment','line_endings'])test(`Committed content equality remains raw-byte exact for ${kind}`,t=>{
 const f=fixture(t),dirty=kind==='comment'?source+'\n# unchanged semantics, different committed bytes\n':source.replace(/\n/gu,'\r\n');writeFileSync(f.file,dirty);const r=migrate(f,{write:true});assert.equal(r.status,1);assert.deepEqual(r.value.diagnostics,['source_digest_mismatch']);assert.equal(readFileSync(f.file,'utf8'),dirty);
});
