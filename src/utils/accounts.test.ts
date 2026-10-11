import { describe, expect, it } from 'vitest'
import { loginEmail, normalizeUsername, validateAccount, validatePassword } from '../../shared/accounts.mjs'
describe('ADMIN issued accounts',()=>{
  it('normalizes usernames for consistent case insensitive login',()=>{expect(normalizeUsername('  NGOC.Content ')).toBe('ngoc.content');expect(loginEmail('NGOC.Content')).toBe(loginEmail('ngoc.content'))})
  it('rejects email, accented or path-like usernames',()=>{for(const name of ['nv','dũng','a/b','a@example.com','a b'])expect(()=>normalizeUsername(name)).toThrow()})
  it('requires a password with letters and numbers and keeps meaningful bounds',()=>{for(const pass of ['1234567890','abcdefghijk','abc123'])expect(()=>validatePassword(pass)).toThrow();expect(validatePassword('Good-password-736')).toBe('Good-password-736')})
  it('validates salary and Content/Media before account provisioning',()=>{const base={username:'content01',fullName:'Ngọc',position:'content' as const,salary:10000000,password:'Good-password-736'};expect(validateAccount(base).salary).toBe(10000000);for(const salary of [-1,1.5,NaN,1000000001])expect(()=>validateAccount({...base,salary})).toThrow();expect(()=>validateAccount({...base,position:'other' as 'content'})).toThrow()})
  it('allows preserving an existing password, but new accounts require one',()=>{const base={username:'content01',fullName:'Ngọc',position:'content' as const,salary:0};expect(validateAccount(base,false).password).toBeUndefined();expect(()=>validateAccount(base,true)).toThrow()})
})
