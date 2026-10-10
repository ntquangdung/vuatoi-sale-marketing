import { cp, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
const root=process.cwd()
const temp=await mkdtemp(join(tmpdir(),'vua-toi-rules-'))
await writeFile(join(temp,'firestore.rules'),await readFile(join(root,'firestore.rules')))
await writeFile(join(temp,'firebase.json'),JSON.stringify({firestore:{rules:'firestore.rules'},emulators:{firestore:{port:8080},ui:{enabled:false}}}))
let javaHome=process.env.JAVA_HOME
const portableRoot=join(root,'.tools','java21')
if (process.platform==='win32' && existsSync(portableRoot)) {
 const name=(await readdir(portableRoot)).find(v=>v.endsWith('-jre'))
 if(name) { javaHome=join(temp,'java'); await cp(join(portableRoot,name),javaHome,{recursive:true}) }
}
const testCommand='node --test scripts/firestore-rules.test.mjs'
let child
if(process.platform==='win32') {
 const quote=v=>"'"+v.replace(/'/g,"''")+"'"
 const script=[
  "$ErrorActionPreference='Stop'",
  javaHome ? '$env:JAVA_HOME='+quote(javaHome) : '',
  javaHome ? "$env:PATH=$env:JAVA_HOME+'\\bin;'+$env:PATH" : '',
  'Set-Location -LiteralPath '+quote(root),
  '& npm.cmd exec --yes --package=firebase-tools -- firebase emulators:exec --only firestore --project demo-marketing-vua-toi --config '+quote(join(temp,'firebase.json'))+' '+quote(testCommand),
  'exit $LASTEXITCODE',
 ].filter(Boolean).join('\n')
 child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{stdio:'inherit'})
} else child=spawn('npx',['--yes','--package=firebase-tools','firebase','emulators:exec','--only','firestore','--project','demo-marketing-vua-toi','--config',join(temp,'firebase.json'),testCommand],{stdio:'inherit'})
child.on('error',error=>{console.error(error.message);process.exitCode=1})
child.on('exit',code=>{process.exitCode=code ?? 1})
