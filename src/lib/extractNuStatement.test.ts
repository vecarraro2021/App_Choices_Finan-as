import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { parsePDFStatement } from './pdfStatementParser'
import { NU_STATEMENT_LINES, NU_STATEMENT_FULL_TEXT } from './nuStatementDump'

describe('extractNuStatement - Parser do Extrato Nu real', () => {
  it('parsa as linhas estáticas da fixture do Extrato Nu e bate os totais reais', () => {
    const lines = [...NU_STATEMENT_LINES]
    const fullText = NU_STATEMENT_FULL_TEXT
    const result = parsePDFStatement(lines, fullText)

    expect(result.isNuAccountStatement).toBe(true)
    expect(result.transactions.length).toBeGreaterThan(0)

    const debits = result.transactions.filter((tx) => tx.type === 'debit')
    const credits = result.transactions.filter((tx) => tx.type === 'credit')

    const sumDebits = debits.reduce((acc, tx) => acc + tx.amount, 0)
    const sumCredits = credits.reduce((acc, tx) => acc + tx.amount, 0)

    console.log('Parsed transactions count:', result.transactions.length)
    console.log('Debits count:', debits.length, 'Sum:', sumDebits.toFixed(2))
    console.log('Credits count:', credits.length, 'Sum:', sumCredits.toFixed(2))
    console.log('Unrecognized lines count:', result.unrecognizedLines.length)

    // TOTAIS REAIS DO ARQUIVO: saídas = 9.030,98; entradas = 7.523,11 (BRL)
    expect(Number(sumDebits.toFixed(2))).toBe(9030.98)
    expect(Number(sumCredits.toFixed(2))).toBe(7523.11)

    // Lançamentos específicos reconhecidos
    // 1. Pagamento de fatura: 1.257,28
    const faturaTx = result.transactions.find((tx) =>
      tx.description.includes('Pagamento de fatura'),
    )
    expect(faturaTx).toBeDefined()
    expect(faturaTx?.amount).toBe(1257.28)
    expect(faturaTx?.type).toBe('debit')

    // 2. Compra no débito JIM.COM: 6,00
    const debitoTx = result.transactions.find((tx) => tx.description.includes('JIM.COM'))
    expect(debitoTx).toBeDefined()
    expect(debitoTx?.amount).toBe(6.0)
    expect(debitoTx?.type).toBe('debit')

    // 3. Pix enviado com valor: Camila Sousa 50,00
    const pixCamila = result.transactions.find((tx) =>
      tx.description.includes('Camila Sousa da Silva'),
    )
    expect(pixCamila).toBeDefined()
    expect(pixCamila?.amount).toBe(50.0)
    expect(pixCamila?.type).toBe('debit')

    // 4. Pix recebido: VERONICA DE SOUZA CARRARO LTDA 2.600,00
    const pixRecebido = result.transactions.find((tx) =>
      tx.description.includes('VERONICA DE SOUZA CARRARO LTDA'),
    )
    expect(pixRecebido).toBeDefined()
    expect(pixRecebido?.amount).toBe(2600.0)
    expect(pixRecebido?.type).toBe('credit')
  })

  it('extrai diretamente do arquivo PDF fixture e valida integridade end-to-end', async () => {
    const pdfPath = path.resolve('src/assets/nu76223058401set202630set2026-b97da.pdf')
    expect(fs.existsSync(pdfPath)).toBe(true)
    const buffer = fs.readFileSync(pdfPath)
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise

    const allLines: string[] = []
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const textContent = await page.getTextContent()
      const items = textContent.items as Array<any>

      const lineBuckets = new Map<number, Array<{ x: number; text: string }>>()
      for (const item of items) {
        if (!item.str || item.str.trim() === '') continue
        const x = item.transform ? item.transform[4] : 0
        const y = item.transform ? Math.round(item.transform[5] * 2) / 2 : 0

        let matchedY: number | null = null
        for (const existingY of lineBuckets.keys()) {
          if (Math.abs(existingY - y) <= 3) {
            matchedY = existingY
            break
          }
        }
        const targetY = matchedY ?? y
        if (!lineBuckets.has(targetY)) {
          lineBuckets.set(targetY, [])
        }
        lineBuckets.get(targetY)!.push({ x, text: item.str })
      }

      const sortedYKeys = Array.from(lineBuckets.keys()).sort((a, b) => b - a)
      for (const y of sortedYKeys) {
        const rowItems = lineBuckets.get(y)!
        rowItems.sort((a, b) => a.x - b.x)
        let lineText = ''
        for (let i = 0; i < rowItems.length; i++) {
          const item = rowItems[i]
          if (i === 0) {
            lineText = item.text
          } else {
            const prev = rowItems[i - 1].text
            if (prev.endsWith(' ') || item.text.startsWith(' ')) {
              lineText += item.text
            } else {
              lineText += ' ' + item.text
            }
          }
        }
        if (lineText.trim()) {
          allLines.push(lineText.trim())
        }
      }
    }

    const fullText = allLines.join('\n')
    const result = parsePDFStatement(allLines, fullText)

    expect(result.isNuAccountStatement).toBe(true)
    const sumDebits = result.transactions
      .filter((tx) => tx.type === 'debit')
      .reduce((acc, tx) => acc + tx.amount, 0)
    const sumCredits = result.transactions
      .filter((tx) => tx.type === 'credit')
      .reduce((acc, tx) => acc + tx.amount, 0)

    expect(Number(sumDebits.toFixed(2))).toBe(9030.98)
    expect(Number(sumCredits.toFixed(2))).toBe(7523.11)
  })

  it('parsa a saída Markdown REAL do backend Skip Cloud ($documents.toMarkdown) e bate os totais exatos', () => {
    const mdPath = path.resolve('src/lib/nu_backend_markdown_dump.md')
    expect(fs.existsSync(mdPath)).toBe(true)
    const mdContent = fs.readFileSync(mdPath, 'utf-8')
    expect(mdContent.length).toBeGreaterThan(0)

    const lines = mdContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    const result = parsePDFStatement(lines, mdContent)

    expect(result.isNuAccountStatement).toBe(true)
    expect(result.detectedCurrency).toBe('BRL')
    expect(result.detectedCompetenceMonth).toBe('2026-09')

    const debits = result.transactions.filter((tx) => tx.type === 'debit')
    const credits = result.transactions.filter((tx) => tx.type === 'credit')

    const sumDebits = debits.reduce((acc, tx) => acc + tx.amount, 0)
    const sumCredits = credits.reduce((acc, tx) => acc + tx.amount, 0)

    // TOTAIS REAIS DO EXTRATO NUBANK SET/2026
    expect(Number(sumDebits.toFixed(2))).toBe(9030.98)
    expect(Number(sumCredits.toFixed(2))).toBe(7523.11)

    // Validar transações-chave que antes ficavam não reconhecidas no markdown do backend:
    // 1. Pagamento de fatura 1.257,28
    const fatura = result.transactions.find((tx) => tx.description.includes('Pagamento de fatura'))
    expect(fatura).toBeDefined()
    expect(fatura?.amount).toBe(1257.28)

    // 2. Compra no débito JIM.COM* 62948758 MAYR 6,00
    const debito = result.transactions.find((tx) => tx.description.includes('JIM.COM'))
    expect(debito).toBeDefined()
    expect(debito?.amount).toBe(6.0)

    // 3. Pix com sufixo Nu Pagamentos: Camila Sousa 50,00
    const pixCamila = result.transactions.find((tx) =>
      tx.description.includes('Camila Sousa da Silva'),
    )
    expect(pixCamila).toBeDefined()
    expect(pixCamila?.amount).toBe(50.0)

    // 4. Pix KYTA PROJETOS 450,00
    const pixKyta = result.transactions.find((tx) =>
      tx.description.includes('KYTA PROJETOS IMOBILIARIOS'),
    )
    expect(pixKyta).toBeDefined()
    expect(pixKyta?.amount).toBe(450.0)

    // 5. Pagamento de boleto efetuado PJBANK 623,63
    const boleto = result.transactions.find(
      (tx) => tx.description.includes('PJBANK') && tx.amount === 623.63,
    )
    expect(boleto).toBeDefined()

    // 6. Testes de regressão: estabelecimento em linha seguinte após tabela de 2 colunas
    // Caso 1: Compra no débito NETFLIX.COM 20,90 (15 SET 2026)
    const netflixTx = result.transactions.find(
      (tx) => tx.date === '2026-09-15' && tx.amount === 20.9,
    )
    expect(netflixTx).toBeDefined()
    expect(netflixTx?.description.toUpperCase()).toContain('NETFLIX')
    expect(netflixTx?.type).toBe('debit')

    // Caso 2: Pix enviado para Mirosmar de Sousa Xavier 60,00 (10 SET 2026)
    const mirosmarTx = result.transactions.find(
      (tx) => tx.date === '2026-09-10' && tx.amount === 60.0,
    )
    expect(mirosmarTx).toBeDefined()
    expect(mirosmarTx?.description).toContain('Mirosmar de Sousa Xavier')
    expect(mirosmarTx?.type).toBe('debit')

    // Caso 3: Pix recebido de THAYANE GABRYELE GALVAO GUERRA 250,00 (28 SET 2026)
    const thayaneTx = result.transactions.find(
      (tx) => tx.date === '2026-09-28' && tx.amount === 250.0,
    )
    expect(thayaneTx).toBeDefined()
    expect(thayaneTx?.description).toContain('THAYANE GABRYELE GALVAO GUERRA')
    expect(thayaneTx?.type).toBe('credit')
  })

  it('categoriza TODOS os lançamentos de entrada do extrato Nu como "Entradas Pontuais & Variáveis no Período"', async () => {
    const { evaluateCategoryMatch, PUNCTUAL_INCOME_CATEGORY_NAME } = await import('./categorizer')
    const lines = [...NU_STATEMENT_LINES]
    const fullText = NU_STATEMENT_FULL_TEXT
    const parseResult = parsePDFStatement(lines, fullText)

    // Simulando árvore de categorias do usuário contendo despesas e a categoria de entradas
    const mockCategories: any[] = [
      { id: 'cat-income', name: 'Entradas Pontuais & Variáveis no Período', type: 'main' },
      { id: 'cat-lazer', name: 'Restaurantes', type: 'sub' },
      { id: 'cat-mercado', name: 'Mercado', type: 'sub' },
      { id: 'cat-transporte', name: 'Uber / Táxi', type: 'sub' },
      { id: 'cat-moradia', name: 'Aluguel', type: 'sub' },
      { id: 'cat-extras', name: 'Extras', type: 'main' },
    ]

    const credits = parseResult.transactions.filter((tx) => tx.type === 'credit')
    const debits = parseResult.transactions.filter((tx) => tx.type === 'debit')

    expect(credits.length).toBeGreaterThan(0)
    expect(debits.length).toBeGreaterThan(0)

    // 1. TODAS as transações de crédito/entrada DEVEM receber a categoria de Entradas Pontuais
    for (const creditTx of credits) {
      const match = evaluateCategoryMatch(creditTx.description, mockCategories, {
        type: creditTx.type,
        amount: creditTx.amount,
      })
      expect(match.categoryId).toBe('cat-income')
      expect(match.categoryName).toBe(PUNCTUAL_INCOME_CATEGORY_NAME)
      expect(match.matchedBy).toBe('income_rule')
    }

    // 2. Se a categoria não estiver na árvore com o id, deve sugerir o nome padrão do sistema
    const emptyCategories: any[] = []
    for (const creditTx of credits) {
      const match = evaluateCategoryMatch(creditTx.description, emptyCategories, {
        type: creditTx.type,
        amount: creditTx.amount,
      })
      expect(match.categoryId).toBeUndefined()
      expect(match.categoryName).toBe(PUNCTUAL_INCOME_CATEGORY_NAME)
      expect(match.matchedBy).toBe('income_rule')
    }

    // 3. Despesas (debit) seguem o fluxo normal de despesas (NÃO são marcadas como entradas pontuais)
    for (const debitTx of debits) {
      const match = evaluateCategoryMatch(debitTx.description, mockCategories, {
        type: debitTx.type,
        amount: debitTx.amount,
      })
      expect(match.matchedBy).not.toBe('income_rule')
      expect(match.categoryId).not.toBe('cat-income')
    }
  })
})
