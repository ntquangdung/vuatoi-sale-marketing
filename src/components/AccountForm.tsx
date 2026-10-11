import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { api } from '../lib/data'
import { positionForProfile, positionLabels, roleForPosition, validateAccount } from '../../shared/accounts.mjs'
import { roleLabel } from '../lib/labels'
import type { AccountInput, AccountPosition, UserProfile } from '../types'
export function AccountForm({user,migration=false,self=false,save}:{user?:UserProfile;migration?:boolean;self?:boolean;save:(data:AccountInput)=>Promise<void>}) {
  const [data,setData]=useState<AccountInput>({username:user?.username || '',fullName:user?.fullName || '',password:'',salary:0,position:user ? positionForProfile(user) : 'content'})
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[show,setShow]=useState(false),[salaryReady,setSalaryReady]=useState(!user||migration)
  useEffect(()=>{if(user&&!migration) void api.salary(user.uid).then(amount=>{setData(d=>({...d,salary:amount}));setSalaryReady(true)}).catch(e=>setError(e.message))},[user,migration])
  async function submit(e:FormEvent) {e.preventDefault();setBusy(true);setError('');try{await save(validateAccount(data,!user?.username))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <form className="form-stack" onSubmit={submit}>
    <div className="form-grid">
      <label>Họ và tên<input required maxLength={120} value={data.fullName} onChange={e=>setData({...data,fullName:e.target.value})}/></label>
      <label>Vị trí<select value={data.position} disabled={migration||self} onChange={e=>setData({...data,position:e.target.value as AccountPosition})}>
        {Object.entries(positionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select><small className="form-help">{migration||self ? 'Giữ quyền ADMIN của tài khoản đang đăng nhập.' : `Quyền truy cập: ${roleLabel[roleForPosition(data.position)]}.`}</small></label>
    </div>
    <label>Tài khoản<input required autoComplete="off" autoCapitalize="none" spellCheck={false} minLength={3} maxLength={40} disabled={!!user?.username} value={data.username} onChange={e=>setData({...data,username:e.target.value})} placeholder="Ví dụ: ngoc.content"/><small className="form-help">3–40 ký tự không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới.</small></label>
    <label>{user?.username?'Mật khẩu mới · để trống để giữ nguyên':'Mật khẩu'}<div className="password-input"><input required={!user?.username} autoComplete="new-password" type={show?'text':'password'} minLength={10} maxLength={128} value={data.password} onChange={e=>setData({...data,password:e.target.value})}/><button type="button" className="icon-button" aria-label={show?'Ẩn mật khẩu':'Hiện mật khẩu'} onClick={()=>setShow(!show)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div><small className="form-help">Ít nhất 10 ký tự, có chữ và số. Mật khẩu không hiển thị lại sau khi lưu.</small></label>
    <label>Mức lương · VNĐ/tháng<input required type="number" min={0} max={1000000000} step={1} disabled={!salaryReady} value={data.salary} onChange={e=>setData({...data,salary:Number(e.target.value)})}/></label>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="button primary" disabled={busy||!salaryReady}>{busy?'Đang lưu…':migration?'Thiết lập và đăng nhập':user?'Lưu tài khoản':'Cấp tài khoản'}</button></div>
  </form>
}
