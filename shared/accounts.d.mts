export const accountDomain: string
export type AccountPosition = 'content' | 'media' | 'manager' | 'admin'
export const positionLabels: Record<AccountPosition, string>
export function roleForPosition(position: AccountPosition): 'employee' | 'manager' | 'admin'
export function positionForProfile(profile: { role: 'employee' | 'manager' | 'admin'; position?: AccountPosition }): AccountPosition
export function normalizeUsername(value: string): string
export function loginEmail(username: string): string
export function validatePassword(password: string): string
export function validateAccount(input: { username: string; fullName: string; position: AccountPosition; salary: number; password?: string }, creating?: boolean): { username: string; fullName: string; position: AccountPosition; salary: number; password?: string }
