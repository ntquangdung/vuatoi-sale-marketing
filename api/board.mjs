import { adminServices } from '../backend/firebase-admin.mjs'
import { authorize } from '../backend/accounts.mjs'
import { boardAction } from '../backend/board.mjs'
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff')
  if(req.method!=='POST') {res.setHeader('Allow','POST');return res.status(405).json({error:'Chỉ hỗ trợ POST.'})}
  if(Number(req.headers['content-length'] || 0)>100000) return res.status(413).json({error:'Dữ liệu quá lớn.'})
  try {
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body,services=adminServices()
    if(!body||typeof body!=='object') return res.status(400).json({error:'Dữ liệu không hợp lệ.'})
    const actor=await authorize(services.auth,services.db,/^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1],false,true)
    return res.status(200).json(await boardAction(services.db,actor,body))
  } catch(e) {return res.status(e instanceof SyntaxError?400:e.status || 503).json({error:e instanceof SyntaxError?'Dữ liệu không hợp lệ.':e.status?e.message:'Chưa kết nối được API bảng nội dung. Vui lòng thử lại.'})}
}
