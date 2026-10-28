// pocketbase/hooks/password_reset_email.js
// Customiza o email de redefinição de senha para garantir que o link aponte
// diretamente para a rota /redefinir-senha?token=... do frontend do aplicativo.

onMailerRecordPasswordResetSend((e) => {
  try {
    const token = e.meta ? e.meta.token : null
    let siteUrl = $os.getenv('SITE_URL') || ''

    if (siteUrl && siteUrl.endsWith('/')) {
      siteUrl = siteUrl.slice(0, -1)
    }

    if (siteUrl && token) {
      const resetUrl = `${siteUrl}/redefinir-senha?token=${token}`

      // Substitui links padrão do PocketBase (ex: /_/#/auth/confirm-password-reset/...) pelo link do frontend
      if (e.message && e.message.html) {
        // Substituir qualquer href no formato href="...auth/confirm-password-reset..." ou similar
        e.message.html = e.message.html.replace(
          /href="[^"]*(?:confirm-password-reset|\/_)[^"]*"/gi,
          `href="${resetUrl}"`,
        )
      }

      if (e.message && e.message.text) {
        e.message.text = e.message.text.replace(
          /https?:\/\/[^\s]+(?:confirm-password-reset|\/_)[^\s]*/gi,
          resetUrl,
        )
      }
    }
  } catch (err) {
    console.error('[password_reset_email] Erro ao personalizar link do e-mail:', err)
  }

  e.next()
}, 'users')
