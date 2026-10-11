export const accountDomain = 'accounts.vuatoi.internal'
export const positionLabels = { content: 'Content', media: 'Media', manager: 'Quản lý', admin: 'ADMIN' }
export function roleForPosition(position) {
  if (typeof position !== 'string' || !Object.hasOwn(positionLabels, position)) throw new Error('Chọn vị trí Content, Media, Quản lý hoặc ADMIN.')
  return position === 'admin' || position === 'manager' ? position : 'employee'
}
export function positionForProfile(profile) {
  if (profile.role === 'admin' || profile.role === 'manager') return profile.role
  return profile.position === 'media' ? 'media' : 'content'
}
export function normalizeUsername(value) {
  const username = String(value || '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) throw new Error('Tài khoản gồm 3–40 ký tự: chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới.')
  return username
}
export function loginEmail(username) { return `${normalizeUsername(username)}@${accountDomain}` }
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) throw new Error('Mật khẩu gồm 10–128 ký tự, có cả chữ và số.')
  return password
}
export function validateAccount(input, creating = true) {
  const username = normalizeUsername(input.username)
  const fullName = String(input.fullName || '').trim()
  if (!fullName || fullName.length > 120) throw new Error('Họ tên cần từ 1 đến 120 ký tự.')
  roleForPosition(input.position)
  if (typeof input.salary !== 'number' || !Number.isSafeInteger(input.salary) || input.salary < 0 || input.salary > 1000000000) throw new Error('Mức lương cần là số nguyên từ 0 đến 1 tỷ đồng/tháng.')
  if (creating || input.password) validatePassword(input.password)
  return { username, fullName, position: input.position, salary: input.salary, ...(input.password ? { password: input.password } : {}) }
}
