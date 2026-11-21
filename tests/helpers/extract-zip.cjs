const {spawnSync}=require('node:child_process');
// Validate our writer with an independent, native ZIP reader on each platform.
module.exports=function extractZip(zip,destination) {
  const quoted=value=>"'"+value.replace(/'/g,"''")+"'";
  const command=`Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory(${quoted(zip)}, ${quoted(destination)})`;
  return process.platform==='win32'
    ? spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{encoding:'utf8',timeout:30000,windowsHide:true})
    : spawnSync('unzip',['-q',zip,'-d',destination],{encoding:'utf8',timeout:30000});
};
