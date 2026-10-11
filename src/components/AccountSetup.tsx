import { Sprout } from 'lucide-react'
import { api } from '../lib/data'
import type { UserProfile } from '../types'
import { AccountForm } from './AccountForm'
export function AccountSetup({user,onReady,logout}:{user:UserProfile;onReady:(u:UserProfile)=>void;logout:()=>void}) {
  return <div className="account-setup"><section className="panel"><span className="brand-icon"><Sprout/></span><span className="eyebrow">SALE - MARKETING · VUA TỎI</span><h1>Thiết lập tài khoản ADMIN</h1><p className="muted">Tạo tên đăng nhập và mật khẩu để tiếp tục. Công việc và quyền ADMIN hiện tại được giữ nguyên.</p><AccountForm user={user} migration save={async data=>onReady((await api.account(data,undefined,true)).user)}/><button className="button soft" onClick={logout}>Đăng xuất</button></section></div>
}
