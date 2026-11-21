const fs=require('node:fs');
// Opt-in for restricted local diagnostics only. CI and ordinary npm test must
// execute these security checks; an unavailable capability still fails there.
function allowUnavailable(t,reason) {
  if(process.env.AUTOOC_ALLOW_UNAVAILABLE_NATIVE_TESTS!=='1' || process.env.CI)return false;
  t.skip(`Native validation pending: ${reason}`);return true;
}
function directoryLink(t,target,link,type) {
  try{fs.symlinkSync(target,link,type);return true;}
  catch(error){
    if(['EPERM','EACCES','ENOTSUP'].includes(error.code) && allowUnavailable(t,`directory links unavailable (${error.code})`))return false;
    throw error;
  }
}
module.exports={directoryLink,allowUnavailable};
