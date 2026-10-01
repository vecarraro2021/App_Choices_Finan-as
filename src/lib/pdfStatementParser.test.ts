import { describe, it, expect } from 'vitest'
import { parsePDFStatement, inferInvoiceCompetence } from './pdfStatementParser'

describe('inferInvoiceCompetence', () => {
  it('detecta competência de fatura Nubank com período 31 AGO a 30 SET e vencimento em OUT', () => {
    const text = `
      Olá, Verônica.
      Esta é a sua fatura de outubro, no valor de R$ 2.499,33
      Data de vencimento: 07 OUT 2026
      Período vigente: 31 AGO a 30 SET
      Limite total do cartão de crédito: R$ 5.211,74
    `
    const result = inferInvoiceCompetence(text, 2026)
    expect(result.isInvoice).toBe(true)
    expect(result.competenceMonth).toBe('2026-09')
    expect(result.periodLabel).toBe('31 AGO a 30 SET')
    expect(result.dueDate).toBe('07 OUT 2026')
  })

  it('detecta competência pelo vencimento quando período não está explícito', () => {
    const text = `
      Fatura de Cartão de Crédito
      Vencimento: 10/10/2026
      Total da fatura: R$ 1.500,00
    `
    const result = inferInvoiceCompetence(text, 2026)
    expect(result.isInvoice).toBe(true)
    expect(result.competenceMonth).toBe('2026-09')
  })
})

describe('parsePDFStatement', () => {
  it('deve extrair transações em formato brasileiro padrão (DD/MM/YYYY e valor 1.234,56)', () => {
    const lines = [
      'Extrato de Conta Corrente - Banco Nubank S.A.',
      'Data Lançamento Valor',
      '05/03/2026 SUPERMERCADO ABC R$ 150,50',
      '10/03/2026 POSTO IPIRANGA R$ 220,00',
      'Saldo Parcial: 3.500,00',
    ]
    const fullText = lines.join('\n')
    const result = parsePDFStatement(lines, fullText)

    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0].date).toBe('2026-03-05')
    expect(result.transactions[0].description).toBe('SUPERMERCADO ABC')
    expect(result.transactions[0].amount).toBe(150.5)
    expect(result.transactions[0].currency).toBe('BRL')

    expect(result.transactions[1].date).toBe('2026-03-10')
    expect(result.transactions[1].description).toBe('POSTO IPIRANGA')
    expect(result.transactions[1].amount).toBe(220)
  })

  it('deve extrair faturas de cartão com datas DD/MM e inferir o ano do documento', () => {
    const lines = [
      'Fatura do Cartão de Crédito',
      'Vencimento: 15/04/2026',
      '02/04 RESTAURANTE SABOR 89,90',
      '04/04 UBER *TRIP 24,50',
      'Total da Fatura 114,40',
    ]
    const fullText = lines.join('\n')
    const result = parsePDFStatement(lines, fullText)

    expect(result.detectedYear).toBe(2026)
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0].date).toBe('2026-04-02')
    expect(result.transactions[0].month).toBe('2026-04')
    expect(result.transactions[0].amount).toBe(89.9)

    expect(result.transactions[1].date).toBe('2026-04-04')
    expect(result.transactions[1].amount).toBe(24.5)
  })

  it('deve reconhecer formato internacional com milhar por vírgula (1,234.56)', () => {
    const lines = ['Statement Period: Jan 2026', '15/01/2026 LAPTOP STORE 1,234.56']
    const fullText = lines.join('\n')
    const result = parsePDFStatement(lines, fullText)

    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].amount).toBe(1234.56)
  })

  it('deve concatenar linhas de descrição quebradas e ignorar ruídos/rodapés', () => {
    const lines = [
      'Página 1 de 2',
      'Extrato Consolidado',
      '08/02/2026 COMPRA INTERNET PARC',
      '01/05 MAGAZINE LUIZA 345,67',
      'Total a pagar: 345,67',
      'Ouvidoria 0800 123 456',
    ]
    // A linha de continuação "01/05 MAGAZINE LUIZA" tem no final 345,67, o que pode ser uma nova linha se tiver data.
    // Vamos testar uma descrição sem data quebrada em 2 linhas:
    const linesMultiLine = [
      '12/02/2026 PAGAMENTO SERVICO EM NUVEM 50,00',
      'AMAZON WEB SERVICES BR',
      'Página 1 de 1',
    ]
    const fullText = linesMultiLine.join('\n')
    const result = parsePDFStatement(linesMultiLine, fullText, 2026)

    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].description).toContain('AMAZON WEB SERVICES BR')
    expect(result.transactions[0].amount).toBe(50.0)
  })

  it('deve detectar extratos em Euro (EUR) de bancos portugueses', () => {
    const lines = [
      'Millennium bcp - Extrato Mensal',
      'Período: 2026-05',
      '10/05/2026 CONTINENTE MATOSINHOS € 62,40',
      '18/05/2026 PINGO DOCE EUR 31,15',
    ]
    const fullText = lines.join('\n')
    const result = parsePDFStatement(lines, fullText)

    expect(result.detectedCurrency).toBe('EUR')
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0].currency).toBe('EUR')
    expect(result.transactions[0].amount).toBe(62.4)
    expect(result.transactions[1].currency).toBe('EUR')
    expect(result.transactions[1].amount).toBe(31.15)
  })

  it('deve classificar estornos e pagamentos como crédito', () => {
    const lines = [
      'Extrato de Cartão',
      '05/06/2026 PAGAMENTO RECEBIDO -500,00',
      '06/06/2026 ESTORNO COMPRA CANCELADA 80,00 CR',
      '07/06/2026 PADARIA CENTRAL 15,00',
    ]
    const fullText = lines.join('\n')
    const result = parsePDFStatement(lines, fullText, 2026)

    expect(result.transactions).toHaveLength(3)
    expect(result.transactions[0].type).toBe('credit')
    expect(result.transactions[1].type).toBe('credit')
    expect(result.transactions[2].type).toBe('debit')
  })

  it('deve retornar mensagem clara caso nenhuma transação seja identificada', () => {
    const lines = [
      'Termos de Uso e Condições Gerais',
      'Este documento não possui lançamentos financeiros.',
    ]
    const fullText = lines.join('\n')
    const result = parsePDFStatement(lines, fullText)

    expect(result.transactions).toHaveLength(0)
    expect(result.reason).toBeDefined()
    expect(result.reason).toContain('Não foi possível identificar transações')
  })

  it('identifica fatura Nubank com competência de setembro mesmo com compras iniciadas em agosto e moeda BRL', () => {
    const lines = [
      'Olá, Verônica.',
      'Esta é a sua fatura de outubro, no valor de R$ 2.499,33',
      'Data de vencimento: 07 OUT 2026',
      'Período vigente: 31 AGO a 30 SET',
      'TRANSAÇÕES DE 31 AGO A 30 SET',
      '31 AGO •••• 2072 Htm *Aura - Parcela 5/6 R$ 73,02',
      '31 AGO •••• 8930 Landmark Wor*Caplandma - Parcela 3/5 R$ 420,00',
      '02 SET •••• 4725 Supermercado Pinheir R$ 332,33',
      '15 SET Pix Protegido R$ 6,99',
    ]
    const fullText = lines.join('\n')
    const result = parsePDFStatement(lines, fullText)

    expect(result.isCreditCardInvoice).toBe(true)
    expect(result.detectedCompetenceMonth).toBe('2026-09')
    expect(result.detectedPeriodLabel).toBe('31 AGO a 30 SET')
    expect(result.detectedDueDate).toBe('07 OUT 2026')
    expect(result.detectedCurrency).toBe('BRL')
    expect(result.currencyConfidence).toBe('high')
    expect(result.transactions.length).toBeGreaterThanOrEqual(4)
  })

  it('deve usar a moeda padrão do usuário quando o PDF não tiver pistas de moeda', () => {
    const lines = ['Relatório de Transações Financeiras', '10/05/2026 COMPRA DIVERSA 50.00']
    const fullText = lines.join('\n')
    const result = parsePDFStatement(lines, fullText, 2026, 'EUR')
    expect(result.detectedCurrency).toBe('EUR')
    expect(result.currencyConfidence).toBe('fallback')
  })
})
