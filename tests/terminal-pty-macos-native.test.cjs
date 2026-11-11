const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module');
const esbuild=require('esbuild');

// Explicit CI opt-in: download the pinned official package into a synthetic
// installation, never into the user's vault. No real AI CLI/authentication.
test('native macOS PTY installs, streams Unicode, resizes and confirms silent stop',{
  skip:process.platform!=='darwin'||process.env.AUTOOC_TEST_NATIVE_PTY!=='1',timeout:180000,
},async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'autooc-mac-native-'));
  const built=esbuild.buildSync({entryPoints:[path.resolve(__dirname,'../terminal-pty.ts')],bundle:true,platform:'node',format:'cjs',write:false});
  const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(built.outputFiles[0].text,__filename);
  const {installTerminalSupport,loadTerminalPty}=m.exports;
  const sessions=[];
  t.after(async()=>{
    await Promise.all(sessions.map(session=>session.kill()));
    assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(os.tmpdir()));
    fs.rmSync(directory,{recursive:true,force:true});
  });
  await installTerminalSupport(directory);const backend=await loadTerminalPty(directory);
  const env={HOME:os.homedir(),PATH:'/usr/bin:/bin',LANG:'en_US.UTF-8'};
  const options={cwd:directory,env,cols:80,rows:24,name:'xterm-256color'};
  const script='printf "READY\\n"; while IFS= read -r line; do case "$line" in size) stty size ;; quit) exit 0 ;; *) printf "REPLY:%s\\n" "$line" ;; esac; done';
  const pty=backend.spawn('/bin/sh',['-c',script],options);sessions.push(pty);
  let output='';pty.onData(data=>{output+=data;});
  const waitFor=pattern=>new Promise((resolve,reject)=>{
    const deadline=setTimeout(()=>{clearInterval(timer);reject(Error('Native PTY output missing: '+pattern));},10000);
    const timer=setInterval(()=>{if(pattern.test(output)){clearTimeout(deadline);clearInterval(timer);resolve();}},20);
  });
  await waitFor(/READY/);pty.resize(117,39);pty.write('size\r');await waitFor(/39\s+117/);
  pty.write('hola ñ 😀\r');await waitFor(/REPLY:hola ñ 😀/);
  const exited=new Promise(resolve=>pty.onExit(resolve));pty.write('quit\r');assert.equal((await exited).exitCode,0);await pty.kill();
  const silent=backend.spawn('/bin/sleep',['60'],options);sessions.push(silent);
  let nativeExit=false;silent.onExit(()=>{nativeExit=true;});await silent.kill();assert.equal(nativeExit,true);
});
