import { useState, type FormEvent } from 'react'
import { positionForProfile, positionLabels, roleForPosition } from '../../shared/accounts.mjs'
import type { AccountPosition, UserProfile } from '../types'
export function UserForm({ user, self=false, save }: { user: UserProfile; self?:boolean; save: (data: Pick<UserProfile, 'fullName' | 'role' | 'active' | 'position'>) => Promise<void> }) {
  const [data, setData] = useState({ fullName: user.fullName, position: positionForProfile(user), active: user.active })
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); try { await save({...data,role:roleForPosition(data.position)}) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  return <form className="form-stack" onSubmit={submit}><p className="muted">{user.username || user.contactEmail || user.email}</p><label>Họ và tên<input required maxLength={120} value={data.fullName} onChange={e => setData({ ...data, fullName: e.target.value })} /></label><label>Vị trí<select disabled={self} value={data.position} onChange={e => setData({ ...data, position: e.target.value as AccountPosition })}>{Object.entries(positionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="toggle-line"><input type="checkbox" disabled={self} checked={data.active} onChange={e => setData({ ...data, active: e.target.checked })} />Tài khoản hoạt động</label>{error && <p className="form-error">{error}</p>}<button className="button primary" disabled={busy}>Lưu nhân sự</button></form>
}
