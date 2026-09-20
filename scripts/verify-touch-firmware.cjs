// Generates distributable sketches and compiles only; never uploads to hardware.
const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
const {firmwareSource}=require('../dist-electron/src/shared/arduino');
const {defaultTouch}=require('../dist-electron/src/shared/touch');
const root=path.resolve(__dirname,'..');const work=path.join(root,'test-output/touch-firmware');fs.mkdirSync(work,{recursive:true});
const config=path.join(work,'arduino-cli.json');
fs.writeFileSync(config,JSON.stringify({directories:{data:path.join(root,'resources/arduino/data'),downloads:path.join(work,'downloads'),user:path.join(work,'libraries')}}));
for(const mode of ['button','touch']){
  const c=defaultTouch();c.finalMode=mode;
  const name='centopia-touch-'+mode,dir=path.join(root,'firmware',name);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,name+'.ino'),firmwareSource('capacitive',c));
  console.log(execFileSync(path.join(root,'resources/arduino/cli/arduino-cli.exe'),['compile','--fqbn','arduino:avr:uno','--config-file',config,dir],{encoding:'utf8',windowsHide:true,timeout:180000}));
}
