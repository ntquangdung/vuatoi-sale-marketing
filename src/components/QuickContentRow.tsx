import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { emptyContentInfo } from '../utils/content'
import { ContentInfoFields } from './ContentInfoFields'
import { workLabel } from './TaskUi'
import { dateTimeFromVN, dateTimeInputVN } from '../lib/date'
import type { TaskInput, UserProfile, WorkRole } from '../types'

export function QuickContentRow({ users, save, close }: { users: UserProfile[]; save: (data: TaskInput) => Promise<void>; close: () => void }) {
  const [data,setData] = useState<TaskInput>({title:'',description:'',taskType:'video',referenceUrl:'',contentInfo:{...emptyContentInfo(),pageName:'VUA TỎI'},assignees:[],deadlineAt:'',requiresPublishing:false})
  const [busy,setBusy] = useState(false),[error,setError] = useState('')
  const employees = users.filter(u=>u.role==='employee' && u.active)
  function field<K extends keyof TaskInput>(key:K,value:TaskInput[K]) { setData(d=>({...d,[key]:value})) }
  return <form className="quick-content-row" aria-label="Thêm dòng nội dung" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await save(data)}catch(e){setError((e as Error).message);setBusy(false)}}}>
    <div className="quick-row-heading"><span><Plus size={16}/><b>Dòng nội dung mới</b><small>SKU tự động khi lưu</small></span><button type="button" className="icon-button" disabled={busy} aria-label="Hủy thêm dòng" onClick={close}><X size={17}/></button></div>
    <fieldset disabled={busy} className="quick-row-fields">
      <label>Tên Page<input maxLength={180} value={data.contentInfo.pageName} onChange={e=>field('contentInfo',{...data.contentInfo,pageName:e.target.value})}/></label>
      <label className="quick-title">Tiêu đề / tên nội dung<input autoFocus required maxLength={180} placeholder="Nhập nội dung mới…" value={data.title} onChange={e=>field('title',e.target.value)}/></label>
      <div className="quick-assign"><span>Giao Content / Media</span><details><summary>{data.assignees.length?`${data.assignees.length} nhân viên đã chọn`:'Chọn nhân viên'}</summary><div className="quick-people">{employees.map(u=>{const selected=data.assignees.find(a=>a.uid===u.uid);return <div key={u.uid}><label><input type="checkbox" aria-label={`Chọn ${u.fullName} cho dòng mới`} checked={!!selected} disabled={!selected&&data.assignees.length>=8} onChange={e=>field('assignees',e.target.checked?[...data.assignees,{uid:u.uid,workRole:u.position === 'media' ? 'media' : 'content'}]:data.assignees.filter(a=>a.uid!==u.uid))}/>{u.fullName}</label>{selected&&<select aria-label={`Vai trò dòng mới của ${u.fullName}`} value={selected.workRole} onChange={e=>field('assignees',data.assignees.map(a=>a.uid===u.uid?{...a,workRole:e.target.value as WorkRole}:a))}>{Object.entries(workLabel).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>}</div>})}{!employees.length&&<p>ADMIN cấp tài khoản trong mục Nhân sự.</p>}</div></details></div>
      <label>Deadline · ngày và giờ<input type="datetime-local" required value={dateTimeInputVN(data.deadlineAt)} onChange={e=>field('deadlineAt',dateTimeFromVN(e.target.value))}/></label>
    </fieldset>
    <details className="quick-more"><summary>Thêm phân loại và yêu cầu công việc</summary><div className="form-stack"><ContentInfoFields value={data.contentInfo} change={value=>field('contentInfo',value)}/><label>Yêu cầu / ghi chú<textarea disabled={busy} rows={2} maxLength={5000} value={data.description} onChange={e=>field('description',e.target.value)}/></label><label>Link tài liệu<input disabled={busy} type="url" maxLength={2000} value={data.referenceUrl} onChange={e=>field('referenceUrl',e.target.value)}/></label><label className="toggle-line"><input disabled={busy} type="checkbox" checked={data.requiresPublishing} onChange={e=>field('requiresPublishing',e.target.checked)}/>Cần đăng bài / video · nhân viên tự chọn ngày đăng</label></div></details>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="quick-row-actions"><small>Chọn ít nhất 1 nhân viên · Ngày giờ theo giờ Việt Nam (GMT+7).</small><button className="button primary compact" disabled={busy||!data.assignees.length}><Plus size={15}/>{busy?'Đang lưu…':'Lưu dòng'}</button></div>
  </form>
}
