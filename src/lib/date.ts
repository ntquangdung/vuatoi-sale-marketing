export function todayVN(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function monthVN(): string { return todayVN().slice(0, 7) }
export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return day && month && year ? `${day}/${month}/${year}` : '—'
}
export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}
export function monthLabel(value: string): string {
  const [year, month] = value.split('-')
  return `Tháng ${Number(month)}/${year}`
}
