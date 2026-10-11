import { adminServices } from '../backend/firebase-admin.mjs'

// Operational readiness only. Never return account, staff or task data.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Chỉ hỗ trợ GET.' })
  }
  try {
    const { auth, db } = adminServices()
    const [marker] = await Promise.all([
      db.doc('system/accountAuth').get(),
      auth.projectConfigManager().getProjectConfig(),
    ])
    return res.status(200).json({ connected: true, ready: marker.data()?.ready === true })
  } catch {
    return res.status(503).json({ connected: false, ready: false })
  }
}
