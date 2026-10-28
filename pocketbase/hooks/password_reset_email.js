// pocketbase/hooks/password_reset_email.js
// Customiza o email de redefinição de senha para garantir que o link aponte
// diretamente para a rota /redefinir-senha?token=... do frontend do aplicativo.

// pocketbase/hooks/password_reset_email.js
// Customiza o email de redefinição de senha para garantir que o link aponte
// diretamente para a rota /redefinir-senha?token=... do frontend do aplicativo em produção.

const PROD_SITE_URL = 'https://gestao-financeira-pessoal-fbcab.goskip.app'

function getEffectiveSiteUrl() {
  let siteUrl = $os.getenv('SITE_URL') || ''
  if (!siteUrl || siteUrl.includes('.internal.') || siteUrl.includes('goskip.dev')) {
    siteUrl = PROD_SITE_URL
  }
  if (siteUrl.endsWith('/')) {
    siteUrl = siteUrl.slice(0, -1)
  }
  return siteUrl
}

onMailerRecordPasswordResetSend((e) => {
  try {
    const siteUrl = getEffectiveSiteUrl()
    const token = (e.meta && e.meta.token) || ''
    console.log(`[password_reset_email] Hook disparado. siteUrl=${siteUrl}, hasToken=${!!token}`)

    let effectiveResetUrl = token ? `${siteUrl}/redefinir-senha?token=${token}` : ''

    if (e.message) {
      const htmlContent = e.message.html || ''
      const textContent = e.message.text || ''

      if (!effectiveResetUrl) {
        const fullContent = htmlContent + ' ' + textContent
        const match =
          fullContent.match(/confirm-password-reset\/([A-Za-z0-9_.-]+)/i) ||
          fullContent.match(/token=([A-Za-z0-9_.-]+)/i)
        if (match && match[1]) {
          effectiveResetUrl = `${siteUrl}/redefinir-senha?token=${match[1]}`
        } else {
          effectiveResetUrl = `${siteUrl}/redefinir-senha`
        }
      }

      console.log(`[password_reset_email] Redefinindo link para: ${effectiveResetUrl}`)

      if (e.message.html) {
        // Substitui qualquer href que leve para confirm-password-reset, /_/, ou para o backend interno
        e.message.html = e.message.html.replace(
          /href=["'][^"']*(?:confirm-password-reset|\/_|goskip\.dev)[^"']*["']/gi,
          `href="${effectiveResetUrl}"`,
        )
      }

      if (e.message.text) {
        e.message.text = e.message.text.replace(
          /https?:\/\/[^\s"']+(?:confirm-password-reset|\/_|goskip\.dev)[^\s"']*/gi,
          effectiveResetUrl,
        )
      }
    }
  } catch (err) {
    console.error('[password_reset_email] Erro ao reescrever link:', err)
  }

  e.next()
})

onMailerSend((e) => {
  try {
    if (!e.message) return
    const subject = (e.message.subject || '').toLowerCase()
    const isReset =
      subject.includes('redefin') ||
      subject.includes('senha') ||
      subject.includes('reset') ||
      subject.includes('password')
    if (!isReset) return

    const siteUrl = getEffectiveSiteUrl()
    const htmlContent = e.message.html || ''
    const textContent = e.message.text || ''
    const fullContent = htmlContent + ' ' + textContent

    // Se já estiver no padrão correto, não precisa reprocessar
    if (fullContent.includes(`${siteUrl}/redefinir-senha?token=`)) {
      return
    }

    const match =
      fullContent.match(/confirm-password-reset\/([A-Za-z0-9_.-]+)/i) ||
      fullContent.match(/token=([A-Za-z0-9_.-]+)/i)
    if (match && match[1]) {
      const resetUrl = `${siteUrl}/redefinir-senha?token=${match[1]}`
      console.log(`[password_reset_email onMailerSend] Fallback: substituindo link por ${resetUrl}`)

      if (e.message.html) {
        e.message.html = e.message.html.replace(
          /href=["'][^"']*(?:confirm-password-reset|\/_|goskip\.dev)[^"']*["']/gi,
          `href="${resetUrl}"`,
        )
      }
      if (e.message.text) {
        e.message.text = e.message.text.replace(
          /https?:\/\/[^\s"']+(?:confirm-password-reset|\/_|goskip\.dev)[^\s"']*/gi,
          resetUrl,
        )
      }
    }
  } catch (err) {
    console.error('[password_reset_email onMailerSend] Erro:', err)
  }

  e.next()
})
