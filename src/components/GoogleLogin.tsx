import { useState } from 'react'
import { ArrowRight, BellRing, Clapperboard, FileText, ShieldCheck, Sprout } from 'lucide-react'
import { api } from '../lib/data'
import type { UserProfile } from '../types'
export function GoogleLogin({ onReady, initialError }: { onReady: (user: UserProfile) => void; initialError: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)
  async function login() { setBusy(true); setError(''); try { onReady((await api.loginGoogle()).user) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  return <div className="auth-page"><div className="auth-visual">
    <div className="auth-brand"><span className="brand-icon"><Sprout size={23} /></span>SALE - MARKETING · VUA TỎI</div>
    <div className="auth-visual-body"><span className="eyebrow light">SALE - MARKETING · VUA TỎI</span><h1>Cùng làm nội dung.<br /><span>Cùng tạo kết quả.</span></h1><p>Một không gian cho kịch bản, nội dung và media. Phối hợp rõ phần việc, theo dõi deadline và chia sẻ kết quả cùng đội ngũ.</p><div className="google-benefits"><span><FileText size={19} />Tiêu đề & link kịch bản</span><span><Clapperboard size={19} />Link media & kết quả chung</span><span><BellRing size={19} />Nhắc deadline trước 30 phút</span></div></div><div className="auth-bottom">Không gian riêng của SALE - MARKETING VUA TỎI</div>
    </div><div className="auth-panel"><div className="auth-card"><div className="auth-mobile-brand"><span className="brand-icon"><Sprout size={21} /></span>SALE - MARKETING · VUA TỎI</div><span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span><h2>Đăng nhập cùng đội ngũ</h2><p className="muted auth-intro">Dùng tài khoản Google để bắt đầu. Thành viên mới tự động có quyền nhân viên.</p>{error && <p className="form-error">{error}</p>}<button className="button google-button full" disabled={busy} onClick={login}><b className="google-g">G</b>{busy ? 'Đang đăng nhập…' : 'Tiếp tục với Google'}<ArrowRight size={17} /></button><div className="auth-footer"><ShieldCheck size={15} />Nhân viên chỉ xem các công việc được giao</div></div></div></div>
}
