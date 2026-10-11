export const expenseCategories = {
  supplies: 'Vật dụng phục vụ',
  other: 'Công tác / Chi phí khác',
  revenue: 'Doanh thu bán lẻ',
} as const

export type ExpenseCategory = keyof typeof expenseCategories
export interface ExpenseEntry {
  id: string
  date: string
  description: string
  category: ExpenseCategory
  amount: number
  person: string
  note: string
}

export function demoExpenses(month: string): ExpenseEntry[] {
  return [
    { id: 'demo-1', date: `${month}-02`, description: 'Mua đèn và chân máy quay nội dung', category: 'supplies', amount: 1850000, person: 'Nhóm Media', note: 'Vật dụng phục vụ quay sản phẩm' },
    { id: 'demo-2', date: `${month}-03`, description: 'Doanh thu đơn hàng bán lẻ trên Page', category: 'revenue', amount: 3250000, person: 'Nhóm Sale', note: 'Đơn hàng tỏi Lý Sơn' },
    { id: 'demo-3', date: `${month}-05`, description: 'Cấp chi phí đi công tác quay tại cửa hàng', category: 'other', amount: 650000, person: 'Nhóm Content & Media', note: 'Di chuyển và ăn uống' },
    { id: 'demo-4', date: `${month}-07`, description: 'Mua phông nền và phụ kiện chụp ảnh', category: 'supplies', amount: 420000, person: 'Nhóm Media', note: '' },
    { id: 'demo-5', date: `${month}-08`, description: 'Doanh thu bán lẻ tại cửa hàng', category: 'revenue', amount: 2180000, person: 'Nhóm Sale', note: '' },
    { id: 'demo-6', date: `${month}-09`, description: 'Chi phí gửi mẫu sản phẩm', category: 'other', amount: 180000, person: 'Nhóm Content', note: 'Gửi mẫu phục vụ sản xuất nội dung' },
  ]
}

export function summarizeExpenses(entries: ExpenseEntry[]) {
  const totals = entries.reduce((sum, entry) => ({ ...sum, [entry.category]: sum[entry.category] + entry.amount }), { supplies: 0, other: 0, revenue: 0 })
  return { ...totals, spending: totals.supplies + totals.other, balance: totals.revenue - totals.supplies - totals.other }
}

export function isExpenseEntry(value: unknown): value is ExpenseEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return typeof entry.id === 'string' && typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
    && typeof entry.description === 'string' && typeof entry.person === 'string' && typeof entry.note === 'string'
    && typeof entry.category === 'string' && Object.hasOwn(expenseCategories, entry.category)
    && typeof entry.amount === 'number' && Number.isSafeInteger(entry.amount) && entry.amount > 0
}
