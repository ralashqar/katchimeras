import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

for (const name of ['generate-asset','generate-katchimera-art','remove-image-background','generate-katchimera-idle','generate-player-avatar']) {
  test(`${name} can create an isolated handler and answer preflight without a provider call`,async()=> {
    const source=readFileSync(path.join(process.cwd(),'packages/art-service/src',`${name}.ts`),'utf8');
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const exports:Record<string,(config:{bucketName:string;renderBucketName:string})=>(request:Request)=>Promise<Response>>={};
    const context={exports,Response,Request,Headers,URL,console,Deno:{env:{get:()=>undefined}},require:()=>new Proxy({}, {get:()=>()=>{throw new Error('Unexpected provider call');}})};
    vm.runInNewContext(code,context,{timeout:1000});
    const factory=Object.values(exports)[0];
    assert.equal(typeof factory,'function');
    const response=await factory({bucketName:'another-game-art',renderBucketName:'another-game-avatars'})(new Request('https://example.invalid/art',{method:'OPTIONS'}));
    assert.equal(response.status,200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');
  });
}
