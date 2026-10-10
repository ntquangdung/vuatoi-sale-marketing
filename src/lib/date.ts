export function todayVN(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function monthVN(): string { return todayVN().slice(0, 7) }
/** datetime-local controls always represent Vietnam time, regardless of the browser timezone. */
export function dateTimeInputVN(value: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
  const part = (key: string) => parts.find(p => p.type === key)!.value
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}
export function dateTimeFromVN(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return ''
  const date = new Date(`${value}:00+07:00`)
  return Number.isFinite(date.getTime()) && dateTimeInputVN(date.toISOString()) === value ? date.toISOString() : ''
}
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
