import { useState } from 'react'
import { Pencil, RotateCcw, Search, ShieldCheck, Trash2, UserCheck, Users, UserX } from 'lucide-react'
import { api } from '../lib/data'
import { roleLabel } from '../lib/labels'
import type { UserProfile } from '../types'
import { AccountForm } from './AccountForm'
import { positionForProfile, positionLabels } from '../../shared/accounts.mjs'
import { Empty, Modal } from './TaskUi'

type Action = (fn: () => Promise<unknown>, message: string) => Promise<void>
export function UserDirectory({ users, actor, edit, action }: { users: UserProfile[]; actor: UserProfile; edit: (user: UserProfile) => void; action: Action }) {
  const [account, setAccount] = useState<UserProfile | 'new' | null>(null)
  const [filter, setFilter] = useState('active'), [search, setSearch] = useState('')
  const [target, setTarget] = useState<UserProfile | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [archiveAction, setArchiveAction] = useState<{ users: UserProfile[]; archived: boolean } | null>(null)
  const present = users.filter(user => !user.archived), removed = users.filter(user => user.archived)
  const active = present.filter(user => user.active).length, inactive = present.length - active
  const shown = users.filter(user => (filter === 'deleted' ? user.archived : !user.archived && (filter === 'all' || (filter === 'active' ? user.active : !user.active))) && `${user.fullName} ${user.username || user.email}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')))
  const canManage = (user: UserProfile) => user.uid !== actor.uid && (actor.role === 'admin' || user.role === 'employee')
  const selectable = shown.filter(canManage).slice(0, 8)
  const selected = shown.filter(user => canManage(user) && selectedIds.includes(user.uid))
  const allSelected = selectable.length > 0 && selectable.every(user => selectedIds.includes(user.uid))

  async function confirmAccess() {
    if (!target || busy) return
    setBusy(true); setError('')
    try {
      await action(() => api.setEmployeeAccess(target.uid, !target.active), target.active ? `Đã thu hồi quyền của ${target.fullName}. Công việc và kết quả cũ được giữ lại.` : `Đã cấp lại quyền cho ${target.fullName}. Nhân viên có thể đăng nhập trở lại.`)
      setTarget(null)
    } catch (failure) { setError((failure as Error).message) } finally { setBusy(false) }
  }
  async function confirmArchive() {
    if (!archiveAction || busy) return
    setBusy(true); setError('')
    try {
      await action(() => api.setUsersArchived(archiveAction.users.map(user => user.uid), archiveAction.archived), archiveAction.archived ? `Đã xóa ${archiveAction.users.length} nhân sự khỏi danh sách. Tên và kết quả trong task cũ được giữ lại.` : 'Đã khôi phục hồ sơ. Quyền truy cập vẫn bị thu hồi cho đến khi được cấp lại.')
      setArchiveAction(null); setSelectedIds([])
    } catch (failure) { setError((failure as Error).message) } finally { setBusy(false) }
  }
  function requestArchive(values: UserProfile[], archived: boolean) { setArchiveAction({ users: values, archived }); setError('') }
  function toggleSelected(uid: string) { setSelectedIds(current => current.includes(uid) ? current.filter(value => value !== uid) : current.length < 8 ? [...current, uid] : current) }

  return <section className="panel user-directory">
    <div className="users-summary"><div><span className="users-summary-icon"><Users size={21} /></span><p><b>{active} thành viên đang hoạt động</b><small>ADMIN cấp tài khoản, mật khẩu, mức lương và vị trí. Quản lý được thu hồi quyền hoặc xóa hồ sơ nhân viên.</small></p></div>{actor.role === 'admin' && <button className="button primary compact" onClick={() => setAccount('new')}>+ Cấp tài khoản</button>}</div>
    <div className="directory-toolbar">
      <div className="directory-tabs" aria-label="Lọc nhân sự">{[['active', 'Đang hoạt động', active], ['inactive', 'Đã thu hồi quyền', inactive], ['all', 'Tất cả', present.length], ['deleted', 'Đã xóa', removed.length]].map(([key, label, count]) => <button key={key} aria-pressed={filter === key} onClick={() => { setFilter(String(key)); setSelectedIds([]) }}>{label}<span>{count}</span></button>)}</div>
      <div className="search-box"><Search size={16} /><input aria-label="Tìm nhân sự" placeholder="Tìm tên hoặc tài khoản…" value={search} onChange={event => { setSearch(event.target.value); setSelectedIds([]) }} /></div>
    </div>
    {selected.length > 0 && <div className="board-selection-bar"><span><b>Đã chọn {selected.length} nhân sự</b><small>Mỗi lần tối đa 8 hồ sơ · Giữ tài khoản đang đăng nhập</small></span><div><button className="button soft compact" onClick={() => setSelectedIds([])}>Bỏ chọn</button><button className={`button compact ${filter === 'deleted' ? 'soft' : 'danger'}`} onClick={() => requestArchive(selected, filter !== 'deleted')}>{filter === 'deleted' ? <RotateCcw size={15} /> : <Trash2 size={15} />}{filter === 'deleted' ? 'Khôi phục hồ sơ' : `Xóa ${selected.length} nhân sự`}</button></div></div>}
    <div className="table-scroll"><table><thead><tr><th className="directory-select"><input type="checkbox" aria-label="Chọn tất cả nhân sự có thể xóa đang hiển thị" checked={allSelected} disabled={!selectable.length} ref={element => { if (element) element.indeterminate = selected.length > 0 && !allSelected }} onChange={() => setSelectedIds(allSelected ? [] : selectable.map(user => user.uid))} /></th><th>Thành viên</th><th>Tài khoản</th><th>Vị trí</th><th>Vai trò</th><th>Trạng thái</th><th className="directory-action-heading">Quản lý quyền</th></tr></thead><tbody>{shown.map(user => <tr key={user.uid}>
      <td className="directory-select"><input type="checkbox" aria-label={`Chọn nhân sự ${user.fullName}`} checked={selectedIds.includes(user.uid)} disabled={!canManage(user) || selected.length >= 8 && !selectedIds.includes(user.uid)} onChange={() => toggleSelected(user.uid)} /></td>
      <td><span className="person-cell"><span className="avatar small">{user.fullName[0]}</span><b>{user.fullName}</b></span></td><td><b>{user.username || 'Chưa cấp tài khoản'}</b></td><td>{positionLabels[positionForProfile(user)]}</td><td>{roleLabel[user.role]}</td>
      <td><span className={`user-status ${user.active ? 'active' : 'inactive'}`}><i />{user.archived ? 'Đã xóa' : user.active ? 'Hoạt động' : 'Đã thu hồi quyền'}</span></td>
      <td><div className="directory-row-actions">{user.archived ? canManage(user) && <button className="button soft compact" onClick={() => requestArchive([user], false)}><RotateCcw size={15} />Khôi phục</button> : <>
        {user.role === 'employee' && <button className={`button compact ${user.active ? 'access-revoke' : 'soft'}`} onClick={() => { setTarget(user); setError('') }}>{user.active ? <UserX size={15} /> : <UserCheck size={15} />}{user.active ? 'Thu hồi quyền' : 'Cấp lại quyền'}</button>}
        {actor.role === 'admin' && <><button className="button soft compact" onClick={() => setAccount(user)}>{user.username ? 'Tài khoản & lương' : 'Cấp tài khoản'}</button><button className="icon-button" aria-label={`Sửa nhân sự ${user.fullName}`} onClick={() => edit(user)}><Pencil size={16} /></button></>}
        {canManage(user) && <button className="icon-button delete-task-button" aria-label={`Xóa nhân sự ${user.fullName}`} onClick={() => requestArchive([user], true)}><Trash2 size={16} /></button>}
      </>}</div></td>
    </tr>)}</tbody></table></div>
    {!shown.length && <Empty title={filter === 'deleted' ? 'Chưa có nhân sự đã xóa' : 'Chưa có nhân sự phù hợp'} text={filter === 'deleted' ? 'Hồ sơ đã xóa có thể được khôi phục tại đây.' : filter === 'inactive' ? 'Nhân viên đã bị thu hồi quyền sẽ xuất hiện tại đây để cấp lại quyền khi cần.' : 'ADMIN cấp tài khoản mới để bắt đầu giao việc.'} />}
    <div className="directory-note"><ShieldCheck size={17} /><p>Xóa nhân sự thu hồi quyền và giữ nguyên tên, kết quả trong task cũ. Hồ sơ có thể khôi phục ở mục Đã xóa; tài khoản cần được cấp lại quyền mới vào được web.</p></div>
    {account && actor.role === 'admin' && <Modal compact title={account === 'new' ? 'Cấp tài khoản' : 'Tài khoản & mức lương'} close={() => setAccount(null)}><AccountForm self={account !== 'new' && account.uid === actor.uid} user={account === 'new' ? undefined : account} save={async data => { await action(() => api.account(data, account === 'new' ? undefined : account.uid), 'Đã lưu tài khoản nhân sự.'); setAccount(null) }} /></Modal>}
    {target && <Modal compact title={target.active ? 'Thu hồi quyền nhân viên?' : 'Cấp lại quyền nhân viên?'} close={() => { if (!busy) setTarget(null) }}><div className="form-stack"><div className="access-person"><span className="avatar">{target.fullName[0]}</span><div><b>{target.fullName}</b><small>{target.username || target.email}</small></div></div><p>{target.active ? 'Nhân viên sẽ mất quyền truy cập và không thể tự đăng ký lại. Tên, phần việc và kết quả đã nộp trong các công việc cũ vẫn được giữ nguyên.' : 'Nhân viên có thể đăng nhập lại bằng tài khoản này và tiếp tục xem các công việc được giao.'}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button autoFocus className="button soft" disabled={busy} onClick={() => setTarget(null)}>Hủy</button><button className={`button ${target.active ? 'danger' : 'primary'}`} disabled={busy} onClick={() => void confirmAccess()}>{busy ? 'Đang cập nhật…' : target.active ? 'Thu hồi quyền' : 'Cấp lại quyền'}</button></div></div></Modal>}
    {archiveAction && <Modal compact title={archiveAction.archived ? `Xóa ${archiveAction.users.length} nhân sự khỏi danh sách?` : 'Khôi phục hồ sơ nhân sự?'} close={() => { if (!busy) setArchiveAction(null) }}><div className="form-stack"><div className="directory-archive-list">{archiveAction.users.map(user => <div className="access-person" key={user.uid}><span className="avatar">{user.fullName[0]}</span><div><b>{user.fullName}</b><small>{user.username || 'Chưa cấp tài khoản'} · {roleLabel[user.role]}</small></div></div>)}</div><p>{archiveAction.archived ? 'Các hồ sơ này sẽ chuyển vào mục Đã xóa và mất quyền truy cập. Tên, phần việc và kết quả trong task cũ được giữ nguyên. Bạn có thể khôi phục hồ sơ khi cần.' : 'Hồ sơ sẽ trở lại danh sách đã thu hồi quyền. Tài khoản chỉ truy cập được khi ADMIN hoặc quản lý cấp lại quyền.'}</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button autoFocus className="button soft" disabled={busy} onClick={() => setArchiveAction(null)}>Hủy</button><button className={`button ${archiveAction.archived ? 'danger' : 'primary'}`} disabled={busy} onClick={() => void confirmArchive()}>{busy ? 'Đang cập nhật…' : archiveAction.archived ? `Xóa ${archiveAction.users.length} nhân sự` : 'Khôi phục hồ sơ'}</button></div></div></Modal>}
  </section>
}
