import { adminServices } from '../backend/firebase-admin.mjs'
import { assertAccountReady, authorize, HttpError, manageAccount } from '../backend/accounts.mjs'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }) }
  const length = Number(req.headers['content-length'] || 0)
  if (length > 16000) return res.status(413).json({ error: 'Dữ liệu quá lớn.' })
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (!body || !['create','update','migrate'].includes(body.action)) throw new HttpError(400, 'Thao tác không hợp lệ.')
    if (body.action === 'update' && (typeof body.uid !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.uid))) throw new HttpError(400, 'Nhân sự không hợp lệ.')
    if (body.action === 'create' && body.uid) throw new HttpError(400, 'Không được chỉ định tài khoản khác khi tạo mới.')
    const services = adminServices(), token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1]
    const actor = await authorize(services.auth, services.db, token, body.action === 'migrate')
    await assertAccountReady(services.db)
    const result = await manageAccount(services, actor, body)
    return res.status(200).json(result)
  } catch (error) {
    // Never log request bodies, passwords, tokens or service credentials.
    return res.status(error instanceof SyntaxError?400:error.status || 503).json({ error: error instanceof SyntaxError?'Dữ liệu không hợp lệ.':error.status ? error.message : 'API quản lý tài khoản chưa kết nối được Firebase. Liên hệ ADMIN.' })
  }
}
