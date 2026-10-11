import { describe, expect, it } from 'vitest'
import { demoExpenses, isExpenseEntry, summarizeExpenses } from './expenses'

describe('expense demo', () => {
  it('keeps income separate from both expense columns and calculates the balance', () => {
    expect(summarizeExpenses(demoExpenses('2026-10'))).toEqual({ supplies: 2270000, other: 830000, revenue: 5430000, spending: 3100000, balance: 2330000 })
  })
  it('handles a month with no entries and a month with only expenses', () => {
    expect(summarizeExpenses([]).balance).toBe(0)
    expect(summarizeExpenses(demoExpenses('2026-10').filter(entry => entry.category !== 'revenue')).balance).toBe(-3100000)
  })
  it('accepts saved demo records and rejects invalid amounts or unknown categories', () => {
    const entry = demoExpenses('2026-10')[0]
    expect(isExpenseEntry(JSON.parse(JSON.stringify(entry)))).toBe(true)
    for (const amount of [0, -1, 1.5, NaN, Infinity, '1000', Number.MAX_SAFE_INTEGER + 1]) expect(isExpenseEntry({ ...entry, amount })).toBe(false)
    expect(isExpenseEntry({ ...entry, category: '__proto__' })).toBe(false)
    expect(isExpenseEntry({ ...entry, category: 'toString' })).toBe(false)
  })
})
