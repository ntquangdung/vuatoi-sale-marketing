import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, BriefcaseBusiness, CircleHelp, Pencil, Plus, Search, ShoppingBag, Wallet } from 'lucide-react'
import { formatDate, monthVN, todayVN } from '../lib/date'
import { demoExpenses, expenseCategories, isExpenseEntry, summarizeExpenses, type ExpenseCategory, type ExpenseEntry } from '../utils/expenses'
import { Empty, Modal } from './TaskUi'

const money = (value: number) => new Intl.NumberFormat('vi-VN').format(value)
type View = 'all' | 'expenses' | 'revenue'

function EntryForm({ entry, month, save, close }: { entry?: ExpenseEntry; month: string; save: (entry: ExpenseEntry) => void; close: () => void }) {
  const [data, setData] = useState<ExpenseEntry>(entry || { id: crypto.randomUUID(), date: month === monthVN() ? todayVN() : `${month}-01`, description: '', category: 'supplies', amount: 0, person: '', note: '' })
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const next = { ...data, description: data.description.trim(), person: data.person.trim(), note: data.note.trim() }
    if (!next.description || !isExpenseEntry(next)) { setError('Nhập nội dung và số tiền nguyên lớn hơn 0.'); return }
    try { save(next) } catch { setError('Chưa lưu được trên thiết bị này. Vui lòng kiểm tra dung lượng trình duyệt và thử lại.') }
  }
  return <form className="form-stack" onSubmit={submit}>
    <p className="expense-form-note">Khoản demo được lưu riêng trên thiết bị này.</p>
    <div className="form-grid">
      <label>Loại khoản<select value={data.category} onChange={event => setData({ ...data, category: event.target.value as ExpenseCategory })}>{Object.entries(expenseCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Ngày ghi nhận<input required type="date" value={data.date} onChange={event => setData({ ...data, date: event.target.value })} /></label>
    </div>
    <label>Nội dung<input autoFocus required maxLength={180} value={data.description} placeholder="Ví dụ: Mua phụ kiện quay sản phẩm" onChange={event => setData({ ...data, description: event.target.value })} /></label>
    <div className="form-grid">
      <label>Số tiền · VNĐ<input required type="number" min={1} step={1} max={999999999999} value={data.amount || ''} placeholder="0" onChange={event => setData({ ...data, amount: Number(event.target.value) })} /></label>
      <label>Người / Nhóm thực hiện<input maxLength={100} value={data.person} placeholder="Ví dụ: Nhóm Media" onChange={event => setData({ ...data, person: event.target.value })} /></label>
    </div>
    <label>Ghi chú<textarea rows={3} maxLength={1000} value={data.note} placeholder="Thông tin bổ sung (nếu có)" onChange={event => setData({ ...data, note: event.target.value })} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button soft" onClick={close}>Hủy</button><button className="button primary">{entry ? 'Lưu thay đổi' : 'Thêm khoản demo'}</button></div>
  </form>
}

export function Expenses({ uid, month, changeMonth }: { uid: string; month: string; changeMonth: (month: string) => void }) {
  const storageKey = `vuatoi-expenses-demo:${uid}`
  const [entries, setEntries] = useState<ExpenseEntry[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || 'null')
      if (Array.isArray(saved) && saved.every(isExpenseEntry)) return saved
    } catch { /* Show the demo when saved browser data is unavailable. */ }
    return demoExpenses(monthVN())
  })
  const [search, setSearch] = useState(''), [view, setView] = useState<View>('all')
  const [editing, setEditing] = useState<ExpenseEntry | 'new' | null>(null)
  const monthEntries = useMemo(() => entries.filter(entry => entry.date.slice(0, 7) === month), [entries, month])
  const totals = summarizeExpenses(monthEntries)
  const filtered = monthEntries.filter(entry => (view === 'all' || (view === 'revenue' ? entry.category === 'revenue' : entry.category !== 'revenue')) && `${entry.description} ${entry.person} ${entry.note} ${expenseCategories[entry.category]}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
  const shownTotals = summarizeExpenses(filtered)
  const summary = [
    { label: 'Vật dụng phục vụ', value: totals.supplies, hint: 'Thiết bị, đạo cụ và vật tư', icon: ShoppingBag, tone: 'blue' },
    { label: 'Công tác / Chi phí khác', value: totals.other, hint: 'Di chuyển, phụ cấp và khoản khác', icon: BriefcaseBusiness, tone: 'orange' },
    { label: 'Doanh thu bán lẻ', value: totals.revenue, hint: 'Bán hàng trên Page và tại cửa hàng', icon: ArrowDownLeft, tone: 'green' },
    { label: 'Chênh lệch thu / chi', value: totals.balance, hint: 'Doanh thu bán lẻ − Tổng chi phí', icon: Wallet, tone: totals.balance < 0 ? 'orange' : 'indigo' },
  ]
  function save(entry: ExpenseEntry) {
    const next = editing === 'new' ? [...entries, entry] : entries.map(current => current.id === entry.id ? entry : current)
    localStorage.setItem(storageKey, JSON.stringify(next))
    setEntries(next); changeMonth(entry.date.slice(0, 7)); setView('all'); setSearch(''); setEditing(null)
  }
  return <div className="expenses-workspace">
    <div className="expense-demo-banner"><span className="expense-demo-tag">DEMO</span><p>Bản xem thử quản lý thu / chi <span>· Dữ liệu mẫu, chỉnh sửa được và lưu riêng trên thiết bị này.</span></p><CircleHelp size={17} aria-hidden="true" /></div>
    <div className="expense-summary">{summary.map(card => <article className={`expense-summary-card ${card.tone}`} key={card.label}><div><span>{card.label}</span><span className="expense-summary-icon"><card.icon size={18} /></span></div><strong>{money(card.value)}<small>₫</small></strong><p>{card.hint}</p></article>)}</div>
    <section className="panel expense-ledger">
      <div className="expense-ledger-heading"><div><h2>Sổ thu / chi</h2><p>{monthEntries.length} khoản trong tháng · Đơn vị: VNĐ</p></div><button className="button primary" onClick={() => setEditing('new')}><Plus size={17} />Thêm khoản</button></div>
      <div className="expense-ledger-toolbar"><div className="expense-tabs" role="group" aria-label="Lọc thu chi">{([{ id: 'all', label: 'Tất cả', count: monthEntries.length }, { id: 'expenses', label: 'Chi phí', count: monthEntries.filter(entry => entry.category !== 'revenue').length }, { id: 'revenue', label: 'Doanh thu', count: monthEntries.filter(entry => entry.category === 'revenue').length }] as const).map(tab => <button key={tab.id} aria-pressed={view === tab.id} onClick={() => setView(tab.id)}>{tab.label}<span>{tab.count}</span></button>)}</div><div className="search-box"><Search size={16} /><input aria-label="Tìm khoản thu chi" placeholder="Tìm nội dung, người thực hiện…" value={search} onChange={event => setSearch(event.target.value)} /></div></div>
      <div className="expense-table-scroll" tabIndex={0} aria-label="Bảng thu chi, cuộn ngang để xem các cột"><table className="expense-table"><thead><tr><th>Ngày</th><th>Nội dung / Người thực hiện</th><th>Vật dụng phục vụ</th><th>Công tác / Chi phí khác</th><th>Doanh thu bán lẻ</th><th aria-label="Thao tác" /></tr></thead><tbody>{filtered.map(entry => <tr key={entry.id}><td><time dateTime={entry.date}>{formatDate(entry.date)}</time></td><td><div className="expense-entry-content"><span className={`expense-entry-icon ${entry.category}`}>{entry.category === 'revenue' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span><div><b>{entry.description}</b><small>{entry.person || 'Chưa nhập người thực hiện'}{entry.note && <span> · {entry.note}</span>}</small></div></div></td>{(['supplies', 'other', 'revenue'] as const).map(category => <td key={category} className={`expense-amount ${category === 'revenue' ? 'income' : ''}`}>{entry.category === category ? money(entry.amount) : <span className="expense-dash">—</span>}</td>)}<td><button className="icon-button" aria-label={`Sửa khoản ${entry.description}`} onClick={() => setEditing(entry)}><Pencil size={15} /></button></td></tr>)}</tbody>{filtered.length > 0 && <tfoot><tr><td colSpan={2}>Tổng {filtered.length} khoản đang hiển thị</td><td>{money(shownTotals.supplies)}</td><td>{money(shownTotals.other)}</td><td className="income">{money(shownTotals.revenue)}</td><td /></tr></tfoot>}</table></div>
      {!filtered.length && <Empty title="Chưa có khoản phù hợp" text="Thêm khoản mới hoặc đổi tháng và bộ lọc để xem." />}
      <div className="expense-ledger-footer"><span><span className="expense-demo-dot" />Dữ liệu demo</span><span>Tổng chi trong tháng: <b>{money(totals.spending)} ₫</b></span></div>
    </section>
    {editing && <Modal title={editing === 'new' ? 'Thêm khoản thu / chi' : 'Sửa khoản thu / chi'} close={() => setEditing(null)}><EntryForm entry={editing === 'new' ? undefined : editing} month={month} save={save} close={() => setEditing(null)} /></Modal>}
  </div>
}
