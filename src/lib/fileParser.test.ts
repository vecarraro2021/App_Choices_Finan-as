import { describe, it, expect, vi } from 'vitest'
import {
  isZipBuffer,
  startsWithZipSignature,
  isBinaryOrCorruptedText,
  parseCSV,
  parseAmount,
  normalizeDate,
  validatePreviewSanity,
  parseXLSXBuffer,
  parseStatementFile,
  detectTableCurrency,
} from './fileParser'

describe('fileParser detection & sanity', () => {
  it('detecta magic bytes do formato ZIP/XLSX (0x50, 0x4B, 0x03, 0x04)', () => {
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00])
    expect(isZipBuffer(zipBytes)).toBe(true)
    expect(isZipBuffer(zipBytes.buffer)).toBe(true)

    const csvBytes = new TextEncoder().encode('Data,Descricao,Valor\n2026-01-01,Teste,100')
    expect(isZipBuffer(csvBytes)).toBe(false)
  })

  it('detecta texto binário ou assinatura ZIP em string', () => {
    // String começando com PK\x03\x04
    const pkText = 'PK\x03\x04\x14\x00\x08\x00xl/workbook.xml...'
    expect(startsWithZipSignature(pkText)).toBe(true)
    expect(isBinaryOrCorruptedText(pkText)).toBe(true)

    // Texto com caminhos internos de XLSX
    const xlPathText = 'Algo antes xl/comments1.xml e mais lixo binário \x00\x01\x02'
    expect(isBinaryOrCorruptedText(xlPathText)).toBe(true)

    // Texto com alta proporção de bytes de controle
    let corruptString = ''
    for (let i = 0; i < 100; i++) {
      corruptString += String.fromCharCode(i % 15) // muitos caracteres < 9
    }
    expect(isBinaryOrCorruptedText(corruptString)).toBe(true)

    // CSV normal nunca deve ser marcado como binário
    const cleanCsv =
      'Data;Descricao;Valor;Categoria\n12/03/2026;Supermercado Pão de Açúcar;150,50;Alimentação'
    expect(isBinaryOrCorruptedText(cleanCsv)).toBe(false)
  })

  it('valida sanidade do preview para bloquear dados binários acidentais', () => {
    const corruptRows = [
      {
        Data: '13/09/2026',
        Descricao: '`)\u0012W \\jO!@}1]\\ }2&...',
        Valor: '0,00',
      },
      {
        Data: '13/09/2026',
        Descricao: 'r֖  a J|*)Y22...',
        Valor: '0,00',
      },
      {
        Data: '13/09/2026',
        Descricao: 'xl/comments1.xml',
        Valor: '0,00',
      },
    ]

    const result = validatePreviewSanity(corruptRows)
    expect(result.isSane).toBe(false)
    expect(result.reason).toContain('dados binários ilegíveis')

    const cleanRows = [
      {
        Data: '10/05/2026',
        Descricao: 'Uber Viagem',
        Valor: '24,50',
      },
      {
        Data: '12/05/2026',
        Descricao: 'Restaurante Central',
        Valor: '65,00',
      },
    ]
    expect(validatePreviewSanity(cleanRows).isSane).toBe(true)
  })

  it('parseCSV processa corretamente vírgula e ponto-e-vírgula', () => {
    const csvSemicolon = 'Data;Descricao;Valor\n01/02/2026;Posto Combustivel;200,00'
    const resSemi = parseCSV(csvSemicolon)
    expect(resSemi.headers).toEqual(['Data', 'Descricao', 'Valor'])
    expect(resSemi.rows).toHaveLength(1)
    expect(resSemi.rows[0].Descricao).toBe('Posto Combustivel')

    const csvComma = 'Date,Description,Amount\n2026-03-01,"Coffee, Bakery",15.50'
    const resComma = parseCSV(csvComma)
    expect(resComma.headers).toEqual(['Date', 'Description', 'Amount'])
    expect(resComma.rows[0].Description).toBe('Coffee, Bakery')
  })

  it('parseAmount converte moedas e formatos brasileiros e internacionais', () => {
    expect(parseAmount('R$ 1.250,50')).toBe(1250.5)
    expect(parseAmount('1250,50')).toBe(1250.5)
    expect(parseAmount('1,250.50')).toBe(1250.5)
    expect(parseAmount('€ 45,20')).toBe(45.2)
    expect(parseAmount('-50,00')).toBe(50.0)
    expect(parseAmount('0,00')).toBe(0)
    expect(parseAmount(undefined)).toBe(0)
  })

  it('detectTableCurrency detecta moeda R$ ou EUR por cabeçalhos e valores', () => {
    const csvBrl = 'Data;Descricao;Valor (R$)\n01/01/2026;Teste;150,00'
    const parsedBrl = parseCSV(csvBrl)
    const resBrl = detectTableCurrency(parsedBrl.headers, parsedBrl.rows, 'EUR')
    expect(resBrl.currency).toBe('BRL')
    expect(resBrl.confidence).toBe('high')

    const csvEur = 'Date,Description,Amount\n2026-01-01,Test,€ 45.20'
    const parsedEur = parseCSV(csvEur)
    const resEur = detectTableCurrency(parsedEur.headers, parsedEur.rows, 'BRL')
    expect(resEur.currency).toBe('EUR')
    expect(resEur.confidence).toBe('high')

    const csvGeneric = 'Date,Description,Amount\n2026-01-01,Generic,100'
    const parsedGeneric = parseCSV(csvGeneric)
    const resFallback = detectTableCurrency(parsedGeneric.headers, parsedGeneric.rows, 'BRL')
    expect(resFallback.currency).toBe('BRL')
    expect(resFallback.confidence).toBe('fallback')
  })

  it('normalizeDate normaliza diferentes formatos para YYYY-MM-DD', () => {
    expect(normalizeDate('05/03/2026')).toBe('2026-03-05')
    expect(normalizeDate('05-03-2026')).toBe('2026-03-05')
    expect(normalizeDate('2026-03-05')).toBe('2026-03-05')
    expect(normalizeDate('2026/03/05')).toBe('2026-03-05')
  })

  it('parseStatementFile processa arquivo CSV normalmente mesmo com extensão maiúscula .CSV', async () => {
    const csvContent =
      'Data,Descricao,Valor\n15/04/2026,Mercado Extra,120.00\n16/04/2026,Farmacia,45.50'
    const file = new File([csvContent], 'extrato_abril.CSV', { type: 'text/csv' })

    const result = await parseStatementFile(file)
    expect(result.sourceType).toBe('csv')
    expect(result.headers).toEqual(['Data', 'Descricao', 'Valor'])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].Descricao).toBe('Mercado Extra')
  })

  it('parseStatementFile redireciona para XLSX quando arquivo tem magic bytes de ZIP mesmo nomeado como .csv', async () => {
    // Simula um arquivo XLSX renomeado para .csv ou detectado com magic bytes PK\x03\x04
    const zipBytes = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00,
    ])
    const file = new File([zipBytes], 'planilha_falsa.csv', { type: 'text/csv' })

    // Com mock de fallback caso SheetJS não consiga ler o buffer falso
    const fallbackMock = vi
      .fn()
      .mockResolvedValue('Data,Descricao,Valor\n01/01/2026,Item Fallback,50.00')

    const result = await parseStatementFile(file, fallbackMock)
    expect(result.sourceType).toBe('xlsx')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].Descricao).toBe('Item Fallback')
  })
})
