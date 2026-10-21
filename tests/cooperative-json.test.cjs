const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require('typescript');
const file=path.resolve(__dirname,'../cooperative-json.ts');
const mod=new Module(file,module);mod.filename=file;mod.paths=module.paths;
mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {parseCooperatively,stringifyCooperatively,hashJsonCooperatively,cloneJsonStructure}=mod.exports;

for (const [name, create] of [
  ['direct', () => ({s:new String('@autooc-string-0')})],
  ['existing-slot', () => ({first:'retained',s:new String('@autooc-string-0')})],
  ['toJSON', () => ({s:{toJSON:()=>new String('@autooc-string-0')}})],
  ['cross-realm', () => ({s:require('node:vm').runInNewContext('new String("@autooc-string-0")')})],
  ['custom-conversion', () => ({s:Object.assign(new String('original'),{toString:()=> '@autooc-string-0'})})],
  ['spoofed-tag', () => ({s:{[Symbol.toStringTag]:'String',value:'preserved'}})]
]) test(`boxed strings preserve native snapshot, clone and hash: ${name}`, async()=>{
  const value=create(), expected=JSON.stringify(value,null,2);
  assert.equal(await stringifyCooperatively(value),expected);
  assert.deepEqual(cloneJsonStructure(value),JSON.parse(expected));
  assert.equal(await hashJsonCooperatively(value),require('node:crypto').createHash('sha256').update(expected).digest('hex'));
});

test('cooperative JSON agrees with native JSON, including large escaped fields and prototype keys',async()=>{
  const values=[null,true,0,-0,1e100,'',[],{},
    {text:('a\\\"\n\t😀\ud800').repeat(30000),empty:'',nested:[null,false,1e-10]},
    JSON.parse('{"__proto__":{"polluted":true},"constructor":"kept","duplicate":1,"duplicate":2}'),
    {date:new Date('2026-01-01'),missing:undefined,array:[undefined,NaN,Infinity]}];
  for(const value of values){
    const expected=JSON.stringify(value,null,2);
    assert.equal(await stringifyCooperatively(value),expected);
    assert.deepEqual(await parseCooperatively(expected),JSON.parse(expected));
    assert.deepEqual(cloneJsonStructure(value),JSON.parse(expected));
  }
  assert.equal({}.polluted,undefined);
  const marker={"@autooc-string-0":'@autooc-string-1',other:'plain'};
  assert.equal(await stringifyCooperatively(marker),JSON.stringify(marker,null,2));
  const crypto=require('node:crypto');
  for(const value of values)assert.equal(await hashJsonCooperatively(value),crypto.createHash('sha256').update(JSON.stringify(value,null,2)).digest('hex'));
});

test('deep valid JSON loads without recursive parser stack limits',async()=>{
  const text='['.repeat(10000)+'0'+']'.repeat(10000);
  let value=await parseCooperatively(text);
  for(let i=0;i<10000;i++)value=value[0];
  assert.equal(value,0);
});
test('cooperative parser rejects invalid and truncated JSON without echoing contents',async()=>{
  for(const text of ['', ' ', '{', '[1,]', '{"x":1,}', '{"x":01}', 'true false', '"bad\\x"','"bad\n"','[undefined]','{"x":"private']){
    assert.throws(()=>JSON.parse(text));
    await assert.rejects(parseCooperatively(text),e=>e.message==='Cannot read valid AutoOC configuration');
  }
});
test('serialization captures values before yielding, preserving queued snapshots',async()=>{
  const value={large:'z'.repeat(8*1024*1024),nested:{revision:1}};
  const saving=stringifyCooperatively(value);
  value.nested.revision=2;
  assert.equal(JSON.parse(await saving).nested.revision,1);
});
test('large individual fields let input macrotasks run during parse and stringify',async()=>{
  const value={payload:('synthetic\\\n😀').repeat(1500000)};
  const text=JSON.stringify(value,null,2);
  for(const operation of [()=>parseCooperatively(text),()=>stringifyCooperatively(value)]){
    let ticks=0;const timer=setInterval(()=>ticks++,1);
    try{await operation();assert.ok(ticks>=2,`input macrotasks processed: ${ticks}`);}finally{clearInterval(timer);}
  }
});

test('repeated large fields bound native decoding allocations while retaining every value',async()=>{
  const payload=('synthetic text \\ \n 😀 ').repeat(45000);
  const text=JSON.stringify(Array.from({length:35},(_,id)=>({id,payload})));
  const parse=JSON.parse;
  let decodedCharacters=0;
  JSON.parse=function(source,...args){decodedCharacters+=source.length;return parse.call(this,source,...args);};
  let result;
  try{result=await parseCooperatively(text);}finally{JSON.parse=parse;}
  assert.deepEqual(result,parse(text));
  assert.ok(decodedCharacters<text.length/4,`native decoding allocated ${decodedCharacters} characters for ${text.length} input characters`);
});

test('bounded decoding reuse preserves distinct strings, escapes, budget exhaustion and invalid suffixes',async()=>{
  const values=Array.from({length:180},(_,i)=>`${i}:`+('x\\\n😀'+String(i)).repeat(4000));
  values.push(values[0],values[90],values.at(-1));
  const text=JSON.stringify(values);
  assert.deepEqual(await parseCooperatively(text),JSON.parse(text));
  await assert.rejects(parseCooperatively(text.slice(0,-1)+',"bad\\x"]'),/Cannot read valid/);
  assert.deepEqual(await parseCooperatively('["fresh","fresh"]'),['fresh','fresh']);
});

test('equal large strings do not allocate a complete assembly on every occurrence',async()=>{
  const payload=('synthetic \\ \n 😀 ').repeat(45000);
  const text=JSON.stringify(Array.from({length:35},(_,id)=>({id,payload})));
  const join=Array.prototype.join;
  let assembledCharacters=0;
  Array.prototype.join=function(...args){const value=join.apply(this,args);assembledCharacters+=value.length;return value;};
  let result;
  try{result=await parseCooperatively(text);}finally{Array.prototype.join=join;}
  assert.deepEqual(result,JSON.parse(text));
  assert.ok(assembledCharacters<text.length/4,`assembled ${assembledCharacters} characters for ${text.length} input characters`);
});
