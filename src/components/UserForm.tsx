import { useState, type FormEvent } from 'react'
import { roleLabel } from '../lib/labels'
import type { Role, UserProfile } from '../types'
export function UserForm({ user, save }: { user: UserProfile; save: (data: Pick<UserProfile, 'fullName' | 'role' | 'active'>) => Promise<void> }) {
  const [data, setData] = useState({ fullName: user.fullName, role: user.role, active: user.active })
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); try { await save(data) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  return <form className="form-stack" onSubmit={submit}><p className="muted">{user.email}</p><label>Họ và tên<input required maxLength={120} value={data.fullName} onChange={e => setData({ ...data, fullName: e.target.value })} /></label><label>Vai trò<select value={data.role} onChange={e => setData({ ...data, role: e.target.value as Role })}>{Object.entries(roleLabel).map(([r, label]) => <option key={r} value={r}>{label}</option>)}</select></label><label className="toggle-line"><input type="checkbox" checked={data.active} onChange={e => setData({ ...data, active: e.target.checked })} />Tài khoản hoạt động</label>{error && <p className="form-error">{error}</p>}<button className="button primary" disabled={busy}>Lưu nhân sự</button></form>
}
