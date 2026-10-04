import { describe, it, expect } from 'vitest'
import { sanitizeDescription } from './BudgetLineDetailDrawer'

describe('sanitizeDescription', () => {
  it('removes bullet + number prefix from screenshot case', () => {
    const input = '• 6 Compra no débito JIM.COM* 62948758 MAYR'
    expect(sanitizeDescription(input)).toBe('Compra no débito JIM.COM* 62948758 MAYR')
  })

  it('removes bullet with space and number', () => {
    expect(sanitizeDescription('• 1257 Pagamento de fatura')).toBe('Pagamento de fatura')
  })

  it('removes dash or asterisk + number prefix', () => {
    expect(sanitizeDescription('- 10 Transferência Pix')).toBe('Transferência Pix')
    expect(sanitizeDescription('* 45 Mercado')).toBe('Mercado')
    expect(sanitizeDescription('• 6. Compra com ponto')).toBe('Compra com ponto')
    expect(sanitizeDescription('• 6 - Compra com traço')).toBe('Compra com traço')
  })

  it('removes standalone bullets and dashes', () => {
    expect(sanitizeDescription('• Compra simples')).toBe('Compra simples')
    expect(sanitizeDescription('- Despesa padaria')).toBe('Despesa padaria')
  })

  it('keeps clean descriptions intact', () => {
    expect(sanitizeDescription('Compra no débito JIM.COM* 62948758 MAYR')).toBe(
      'Compra no débito JIM.COM* 62948758 MAYR',
    )
    expect(sanitizeDescription('Supermercado Pinheiro R$ 332,33')).toBe(
      'Supermercado Pinheiro R$ 332,33',
    )
  })

  it('returns "Sem descrição" for null, undefined or whitespace-only', () => {
    expect(sanitizeDescription(null)).toBe('Sem descrição')
    expect(sanitizeDescription(undefined)).toBe('Sem descrição')
    expect(sanitizeDescription('')).toBe('Sem descrição')
    expect(sanitizeDescription('   ')).toBe('Sem descrição')
    expect(sanitizeDescription('• ')).toBe('Sem descrição')
  })
})
