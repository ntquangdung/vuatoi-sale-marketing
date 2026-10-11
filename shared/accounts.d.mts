export const accountDomain: string
export function normalizeUsername(value: string): string
export function loginEmail(username: string): string
export function validatePassword(password: string): string
export function validateAccount(input: { username: string; fullName: string; position: 'content' | 'media'; salary: number; password?: string }, creating?: boolean): { username: string; fullName: string; position: 'content' | 'media'; salary: number; password?: string }
