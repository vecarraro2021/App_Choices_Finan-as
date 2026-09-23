// pocketbase/hooks/sync_exchange_rates.js
// Sincronização automatizada de taxas de câmbio EUR -> BRL via Frankfurter API
// Cron diário na madrugada (03:15 UTC) e rotas HTTP para re-sincronização

// 1. Cron diário para atualizar o mês corrente e fechar meses anteriores
cronAdd('sync_exchange_rates_daily', '15 3 * * *', () => {
  const pad = (n) => String(n).padStart(2, '0')
  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const currentMonthNum = now.getUTCMonth() + 1
  const currentMonthStr = `${currentYear}-${pad(currentMonthNum)}`

  // Buscar taxas desde o início do ano corrente até a data de hoje
  const startDate = `${currentYear}-01-01`
  const endDate = `${currentYear}-${pad(currentMonthNum)}-${pad(now.getUTCDate())}`

  try {
    const url = `https://api.frankfurter.dev/v1/${startDate}..${endDate}?base=EUR&symbols=BRL`
    const res = $http.send({
      url: url,
      method: 'GET',
      timeout: 20,
    })

    if (res.statusCode !== 200) {
      console.error(
        '[exchange_rates_cron] Falha ao consultar Frankfurter:',
        res.statusCode,
        res.raw,
      )
      return
    }

    const data = res.json
    if (!data || !data.rates) {
      console.warn('[exchange_rates_cron] Resposta sem taxas da Frankfurter')
      return
    }

    // Agrupar cotações por mês: { '2026-01': [6.37, 6.34, ...], ... }
    const monthlyRates = {}
    const dates = Object.keys(data.rates)
    for (let i = 0; i < dates.length; i++) {
      const dt = dates[i]
      const mStr = dt.slice(0, 7)
      const dayRate = data.rates[dt] && data.rates[dt].BRL
      if (typeof dayRate === 'number' && dayRate > 0) {
        if (!monthlyRates[mStr]) {
          monthlyRates[mStr] = []
        }
        monthlyRates[mStr].push(dayRate)
      }
    }

    const months = Object.keys(monthlyRates)
    const col = $app.findCollectionByNameOrId('exchange_rates')

    for (let i = 0; i < months.length; i++) {
      const m = months[i]
      const arr = monthlyRates[m]
      if (!arr || arr.length === 0) continue

      const sum = arr.reduce((acc, val) => acc + val, 0)
      const avg = Number((sum / arr.length).toFixed(4))

      // Buscar registros existentes globais para esse mês (sem dono específico)
      const existingRecords = $app.findRecordsByFilter(
        'exchange_rates',
        `month = '${m}' && (owner = '' || owner = null) && (user = '' || user = null)`,
        '-created',
        10,
        0,
      )

      if (existingRecords.length > 0) {
        for (let j = 0; j < existingRecords.length; j++) {
          const rec = existingRecords[j]
          // Não sobrescrever se marcado manual_override
          if (rec.getBool('manual_override')) {
            console.log(`[exchange_rates_cron] Mês ${m} ignorado devido a manual_override=true`)
            continue
          }
          rec.set('rate', avg)
          rec.set('manual_override', false)
          $app.save(rec)
          console.log(`[exchange_rates_cron] Mês ${m} atualizado para taxa média ${avg}`)
        }
      } else {
        // Criar novo registro global para o mês
        const rec = new Record(col)
        rec.set('month', m)
        rec.set('rate', avg)
        rec.set('manual_override', false)
        rec.set('owner', null)
        rec.set('user', null)
        $app.save(rec)
        console.log(`[exchange_rates_cron] Mês ${m} criado com taxa média ${avg}`)
      }
    }
  } catch (err) {
    console.error('[exchange_rates_cron] Exceção durante sincronização:', err)
  }
})

// 2. Rota HTTP POST para re-sincronizar um mês específico ou ano inteiro
routerAdd(
  'POST',
  '/backend/v1/exchange-rates/sync',
  (e) => {
    const body = e.requestInfo().body || {}
    const requestedMonth = body.month ? String(body.month).slice(0, 7) : null
    const requestedYear = body.year ? parseInt(body.year, 10) : null
    const force = Boolean(body.force) // se true, pode sobrescrever mesmo se manual_override estiver setado quando o usuário explicitamente pediu "reverter para automático"

    const pad = (n) => String(n).padStart(2, '0')
    const now = new Date()
    const targetYear =
      requestedYear ||
      (requestedMonth ? parseInt(requestedMonth.slice(0, 4), 10) : now.getUTCFullYear())

    // Determinar intervalo da Frankfurter
    let startDate = `${targetYear}-01-01`
    let endDate = `${targetYear}-12-31`

    // Se for o ano corrente, limitar até a data de hoje para evitar 404 em datas futuras se a Frankfurter limitar
    if (targetYear === now.getUTCFullYear()) {
      endDate = `${targetYear}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`
    }

    try {
      const url = `https://api.frankfurter.dev/v1/${startDate}..${endDate}?base=EUR&symbols=BRL`
      const res = $http.send({
        url: url,
        method: 'GET',
        timeout: 20,
      })

      if (res.statusCode !== 200) {
        return e.json(502, {
          success: false,
          error: `Falha ao obter dados da Frankfurter (status ${res.statusCode})`,
        })
      }

      const data = res.json
      if (!data || !data.rates) {
        return e.json(502, {
          success: false,
          error: 'Resposta inválida da Frankfurter API',
        })
      }

      // Agrupar médias mensais
      const monthlyRates = {}
      const dates = Object.keys(data.rates)
      for (let i = 0; i < dates.length; i++) {
        const dt = dates[i]
        const mStr = dt.slice(0, 7)
        if (requestedMonth && mStr !== requestedMonth) {
          continue
        }
        const dayRate = data.rates[dt] && data.rates[dt].BRL
        if (typeof dayRate === 'number' && dayRate > 0) {
          if (!monthlyRates[mStr]) {
            monthlyRates[mStr] = []
          }
          monthlyRates[mStr].push(dayRate)
        }
      }

      const months = Object.keys(monthlyRates)
      const col = $app.findCollectionByNameOrId('exchange_rates')
      const updatedMonths = []

      for (let i = 0; i < months.length; i++) {
        const m = months[i]
        const arr = monthlyRates[m]
        if (!arr || arr.length === 0) continue

        const sum = arr.reduce((acc, val) => acc + val, 0)
        const avg = Number((sum / arr.length).toFixed(4))

        const existingRecords = $app.findRecordsByFilter(
          'exchange_rates',
          `month = '${m}' && (owner = '' || owner = null) && (user = '' || user = null)`,
          '-created',
          10,
          0,
        )

        if (existingRecords.length > 0) {
          for (let j = 0; j < existingRecords.length; j++) {
            const rec = existingRecords[j]
            if (rec.getBool('manual_override') && !force) {
              continue
            }
            rec.set('rate', avg)
            rec.set('manual_override', false)
            $app.save(rec)
            updatedMonths.push({ month: m, rate: avg, overridden: false })
          }
        } else {
          const rec = new Record(col)
          rec.set('month', m)
          rec.set('rate', avg)
          rec.set('manual_override', false)
          rec.set('owner', null)
          rec.set('user', null)
          $app.save(rec)
          updatedMonths.push({ month: m, rate: avg, overridden: false })
        }
      }

      return e.json(200, {
        success: true,
        updated: updatedMonths,
        requestedMonth: requestedMonth,
      })
    } catch (err) {
      console.error('[exchange_rates_sync_route] Erro:', err)
      return e.json(500, {
        success: false,
        error: String(err && err.message ? err.message : err),
      })
    }
  },
  $apis.requireAuth(),
)

// 3. Carga retroativa ao inicializar a aplicação (onBootstrap / onServe)
onBootstrap((e) => {
  e.next()

  try {
    const pad = (n) => String(n).padStart(2, '0')
    const now = new Date()
    const currentYear = now.getUTCFullYear()
    const currentMonthNum = now.getUTCMonth() + 1

    // Verificar se o ano anterior possui transações registradas
    const previousYear = currentYear - 1
    const prevYearTxs = $app.findRecordsByFilter(
      'transactions',
      `month >= '${previousYear}-01' && month <= '${previousYear}-12'`,
      '',
      1,
      0,
    )
    const yearsToSync = [currentYear]
    if (prevYearTxs.length > 0) {
      yearsToSync.push(previousYear)
    }

    for (let y = 0; y < yearsToSync.length; y++) {
      const year = yearsToSync[y]
      let startDate = `${year}-01-01`
      let endDate = `${year}-12-31`
      if (year === currentYear) {
        endDate = `${year}-${pad(currentMonthNum)}-${pad(now.getUTCDate())}`
      }

      const url = `https://api.frankfurter.dev/v1/${startDate}..${endDate}?base=EUR&symbols=BRL`
      const res = $http.send({
        url: url,
        method: 'GET',
        timeout: 20,
      })

      if (res.statusCode !== 200) {
        console.warn(
          `[exchange_rates_bootstrap] Falha ao consultar Frankfurter para ${year}:`,
          res.statusCode,
        )
        continue
      }

      const data = res.json
      if (!data || !data.rates) continue

      const monthlyRates = {}
      const dates = Object.keys(data.rates)
      for (let i = 0; i < dates.length; i++) {
        const dt = dates[i]
        const mStr = dt.slice(0, 7)
        const dayRate = data.rates[dt] && data.rates[dt].BRL
        if (typeof dayRate === 'number' && dayRate > 0) {
          if (!monthlyRates[mStr]) {
            monthlyRates[mStr] = []
          }
          monthlyRates[mStr].push(dayRate)
        }
      }

      const months = Object.keys(monthlyRates)
      const col = $app.findCollectionByNameOrId('exchange_rates')

      for (let i = 0; i < months.length; i++) {
        const m = months[i]
        const arr = monthlyRates[m]
        if (!arr || arr.length === 0) continue

        const sum = arr.reduce((acc, val) => acc + val, 0)
        const avg = Number((sum / arr.length).toFixed(4))

        const existingRecords = $app.findRecordsByFilter(
          'exchange_rates',
          `month = '${m}' && (owner = '' || owner = null) && (user = '' || user = null)`,
          '-created',
          10,
          0,
        )

        if (existingRecords.length > 0) {
          for (let j = 0; j < existingRecords.length; j++) {
            const rec = existingRecords[j]
            // Não sobrescrever taxas que o usuário marcou como ajuste manual
            if (rec.getBool('manual_override')) {
              continue
            }
            rec.set('rate', avg)
            rec.set('manual_override', false)
            $app.save(rec)
          }
        } else {
          const rec = new Record(col)
          rec.set('month', m)
          rec.set('rate', avg)
          rec.set('manual_override', false)
          rec.set('owner', null)
          rec.set('user', null)
          $app.save(rec)
        }
      }
      console.log(
        `[exchange_rates_bootstrap] Sincronização inicial concluída com sucesso para o ano ${year}`,
      )
    }
  } catch (err) {
    console.error('[exchange_rates_bootstrap] Exceção durante sincronização:', err)
  }
})
