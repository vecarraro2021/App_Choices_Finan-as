migrate(
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('users')
      if (usersCol) {
        usersCol.resetPasswordTemplate = {
          subject: 'Redefina sua senha - Meu Planejamento Financeiro',
          body: `<p>Olá,</p>
<p>Recebemos uma solicitação para redefinir a sua senha no Meu Planejamento Financeiro.</p>
<p>Clique no botão abaixo para definir sua nova senha com segurança:</p>
<p style="padding: 16px 0;">
  <a class="btn" href="https://gestao-financeira-pessoal-fbcab.goskip.app/redefinir-senha?token={TOKEN}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-family: sans-serif;" target="_blank" rel="noopener">Redefinir minha senha</a>
</p>
<p>Caso o botão não funcione, você pode copiar e colar o link abaixo diretamente em seu navegador:</p>
<p><a href="https://gestao-financeira-pessoal-fbcab.goskip.app/redefinir-senha?token={TOKEN}">https://gestao-financeira-pessoal-fbcab.goskip.app/redefinir-senha?token={TOKEN}</a></p>
<p><i>Se você não solicitou a redefinição de senha, nenhuma ação é necessária e você pode ignorar esta mensagem com total segurança.</i></p>
<p>Atenciosamente,<br/>Equipe Meu Planejamento Financeiro</p>`,
        }
        app.save(usersCol)
      }
    } catch (e) {
      console.log('Erro ao configurar resetPasswordTemplate na migration 0024:', e)
    }
  },
  (app) => {
    // Reversão
  },
)
