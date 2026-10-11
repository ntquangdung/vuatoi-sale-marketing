import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { OAuth2Client } from 'google-auth-library'
import { setDevelopmentCredentials } from './firebase-admin.mjs'
import admin from '../api/admin.mjs'
import board from '../api/board.mjs'

export function accountApiPlugin() {
  return {name:'local-account-api',configureServer(server) {
    // Reuse a local Firebase CLI login in development only; never copy its tokens
    // into environment files or deploy them. Other machines can use standard ADC.
    const modulePath=process.env.FIREBASE_CLI_AUTH_MODULE || 'C:/Users/Acer/AppData/Local/npm-cache/_npx/7750544ccf494d8b/node_modules/firebase-tools/lib/auth.js'
    if(existsSync(modulePath)) {
      const localAuth=createRequire(import.meta.url)(modulePath)
      const account=localAuth.findAccountByEmail('dungbadao0704@gmail.com')
      if(account) {
        const refresh=async()=>{const t=await localAuth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);return {access_token:t.access_token,expiry_date:Date.now()+Number(t.expires_in || 3000)*1000}}
        const client=new OAuth2Client();client.refreshHandler=refresh
        setDevelopmentCredentials(client,{async getAccessToken(){const t=await refresh();return {access_token:t.access_token,expires_in:Math.floor((t.expiry_date-Date.now())/1000)}}})
      }
    }
    server.middlewares.use('/api',async(req,res,next)=>{
      const handler=req.url==='/admin'?admin:req.url==='/board'?board:null
      if(!handler) return next()
      if(req.method!=='POST') {res.statusCode=405;res.end();return}
      try {
        let size=0;const chunks=[]
        for await(const chunk of req) {size+=chunk.length;if(size>100000){res.statusCode=413;res.end();return}chunks.push(chunk)}
        req.body=JSON.parse(Buffer.concat(chunks).toString('utf8'))
        res.status=code=>{res.statusCode=code;return res}
        res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))}
        await handler(req,res)
      }catch{res.statusCode=400;res.end(JSON.stringify({error:'Yêu cầu không hợp lệ.'}))}
    })
  }}
}
