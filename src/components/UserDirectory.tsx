import { useState } from 'react'
import { Pencil, Search, ShieldCheck, UserCheck, Users, UserX } from 'lucide-react'
import { api } from '../lib/data'
import { roleLabel } from '../lib/labels'
import type { UserProfile } from '../types'
import { AccountForm } from './AccountForm'
import { Empty, Modal } from './TaskUi'

type Action = (fn: () => Promise<unknown>, message: string) => Promise<void>
export function UserDirectory({ users, actor, edit, action }: { users: UserProfile[]; actor: UserProfile; edit: (user: UserProfile) => void; action: Action }) {
  const [account,setAccount]=useState<UserProfile | 'new' | null>(null)
  const [filter, setFilter] = useState('active'), [search, setSearch] = useState('')
  const [target, setTarget] = useState<UserProfile | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const active = users.filter(u => u.active).length, inactive = users.length - active
  const shown = users.filter(u => (filter === 'all' || (filter === 'active' ? u.active : !u.active)) && `${u.fullName} ${u.username || u.email}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')))
  async function confirm() {
    if (!target || busy) return
    setBusy(true); setError('')
    try {
      await action(() => api.setEmployeeAccess(target.uid, !target.active), target.active ? `Đã thu hồi quyền của ${target.fullName}. Công việc và kết quả cũ được giữ lại.` : `Đã cấp lại quyền cho ${target.fullName}. Nhân viên có thể đăng nhập trở lại.`)
      setTarget(null)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <section className="panel user-directory">
    <div className="users-summary"><div><span className="users-summary-icon"><Users size={21} /></span><p><b>{active} thành viên đang hoạt động</b><small>ADMIN và quản lý thu hồi hoặc cấp lại quyền nhân viên. ADMIN cấp tài khoản, mật khẩu, mức lương và vị trí.</small></p></div>{actor.role==='admin'&&<button className="button primary compact" onClick={()=>setAccount('new')}>+ Cấp tài khoản</button>}</div>
    <div className="directory-toolbar"><div className="directory-tabs" aria-label="Lọc nhân sự">{[['active', 'Đang hoạt động', active], ['inactive', 'Đã thu hồi quyền', inactive], ['all', 'Tất cả', users.length]].map(([key, label, count]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(String(key))}>{label}<span>{count}</span></button>)}</div><div className="search-box"><Search size={16} /><input aria-label="Tìm nhân sự" placeholder="Tìm tên hoặc tài khoản…" value={search} onChange={e => setSearch(e.target.value)} /></div></div>
    <div className="table-scroll"><table><thead><tr><th>Thành viên</th><th>Tài khoản</th><th>Vị trí</th><th>Vai trò</th><th>Trạng thái</th><th className="directory-action-heading">Quản lý quyền</th></tr></thead><tbody>{shown.map(u => <tr key={u.uid}><td><span className="person-cell"><span className="avatar small">{u.fullName[0]}</span><b>{u.fullName}</b></span></td><td><b>{u.username || 'Chưa cấp tài khoản'}</b></td><td>{u.position==='media'?'Media':u.position==='content'?'Content':'—'}</td><td>{roleLabel[u.role]}</td><td><span className={`user-status ${u.active ? 'active' : 'inactive'}`}><i />{u.active ? 'Hoạt động' : 'Đã thu hồi quyền'}</span></td><td><div className="directory-row-actions">{u.role === 'employee' && <button className={`button compact ${u.active ? 'access-revoke' : 'soft'}`} onClick={() => { setTarget(u); setError('') }}>{u.active ? <UserX size={15} /> : <UserCheck size={15} />}{u.active ? 'Thu hồi quyền' : 'Cấp lại quyền'}</button>}{actor.role === 'admin' && <><button className="button soft compact" onClick={()=>setAccount(u)}>{u.username?'Tài khoản & lương':'Cấp tài khoản'}</button><button className="icon-button" aria-label={`Sửa nhân sự ${u.fullName}`} onClick={() => edit(u)}><Pencil size={16} /></button></>}</div></td></tr>)}</tbody></table></div>
    {!shown.length && <Empty title="Chưa có nhân sự phù hợp" text={filter === 'inactive' ? 'Nhân viên đã bị thu hồi quyền sẽ xuất hiện tại đây để cấp lại quyền khi cần.' : 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.'} />}
    <div className="directory-note"><ShieldCheck size={17} /><p>Thu hồi quyền giữ nguyên tên và kết quả trong task cũ. Tài khoản đó không thể tự đăng ký lại; cần ADMIN hoặc quản lý cấp lại quyền.</p></div>
    {account&&actor.role==='admin'&&<Modal compact title={account==='new'?'Cấp tài khoản nhân viên':'Tài khoản & mức lương'} close={()=>setAccount(null)}><AccountForm user={account==='new'?undefined:account} save={async data=>{await action(()=>api.account(data,account==='new'?undefined:account.uid),'Đã lưu tài khoản nhân sự.');setAccount(null)}}/></Modal>}
    {target && <Modal compact title={target.active ? 'Thu hồi quyền nhân viên?' : 'Cấp lại quyền nhân viên?'} close={() => { if (!busy) setTarget(null) }}><div className="form-stack"><div className="access-person"><span className="avatar">{target.fullName[0]}</span><div><b>{target.fullName}</b><small>{target.email}</small></div></div><p>{target.active ? 'Nhân viên sẽ mất quyền truy cập và không thể tự đăng ký lại. Tên, phần việc và kết quả đã nộp trong các công việc cũ vẫn được giữ nguyên.' : 'Nhân viên có thể đăng nhập lại bằng tài khoản này và tiếp tục xem các công việc được giao.'}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button autoFocus className="button soft" disabled={busy} onClick={() => setTarget(null)}>Hủy</button><button className={`button ${target.active ? 'danger' : 'primary'}`} disabled={busy} onClick={() => void confirm()}>{busy ? 'Đang cập nhật…' : target.active ? 'Thu hồi quyền' : 'Cấp lại quyền'}</button></div></div></Modal>}
  </section>
}
