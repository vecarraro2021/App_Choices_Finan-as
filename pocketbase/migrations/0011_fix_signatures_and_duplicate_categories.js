/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Garantir que a categoria principal "Assinaturas" exista com ID yw00bc0ym6i9blt
    let assinaturasMainId = 'yw00bc0ym6i9blt'
    try {
      const assinaturasRecord = app.findCollectionByNameOrId('categories')
      // Checar se o id existe
      const rec = app.findFirstRecordByData('categories', 'id', assinaturasMainId)
      // Se encontrada, atualizar cor se necessário
      rec.set('color', '#8B5CF6')
      app.save(rec)
    } catch (_) {
      // Se não existir por id, tentar achar por nome ou criar
      try {
        const byName = app.findFirstRecordByData('categories', 'name', 'Assinaturas')
        assinaturasMainId = byName.id
      } catch (__) {
        const catCol = app.findCollectionByNameOrId('categories')
        const newCat = new Record(catCol)
        newCat.set('id', assinaturasMainId)
        newCat.set('name', 'Assinaturas')
        newCat.set('type', 'main')
        newCat.set('color', '#8B5CF6')
        newCat.set('estimated', 0)
        app.save(newCat)
      }
    }

    // 2. Mapeamento e restauração das 18 subcategorias de Assinaturas
    // Mapeamos por id conhecido ou nome aproximado / corrompido
    const signatureSubs = [
      {
        id: '69l4132r8l1mxio',
        originalNames: ['Google Gsuite \\[Armazenamento]', 'Google Gsuite [Armazenamento]'],
        cleanName: 'Google Gsuite [Armazenamento]',
      },
      {
        id: 'l163009q9zmot1i',
        originalNames: [
          'Google (Assinatura Gmail \\',
          'Google (Assinatura Gmail | Storage)',
          'Google (Assinatura Gmail \\)',
        ],
        cleanName: 'Google (Assinatura Gmail | Storage)',
      },
      { id: 'gdg1u2ta8q0dsg8', cleanName: 'Apple' },
      { id: '8hotih7fgfal4b5', cleanName: 'Loom' },
      { id: 'pfi2s8hcwqzanu7', cleanName: 'Claude' },
      { id: 'ttzoicvo67c5i2f', cleanName: 'Adapta' },
      { id: '89nzvipamoj7xos', cleanName: 'Netflix' },
      { id: '629nkquuobdfpls', cleanName: 'Figma' },
      { id: 'y5uxhc2h5m4cb26', cleanName: 'Spotfiy' },
      { id: 'ycer9p966nhsx0r', cleanName: 'Skip AI' },
      { id: 'bdci9i8g2t9i8j2', cleanName: 'Wix' },
      { id: 'hb5bjwpdpvaat1i', cleanName: 'Chat GPT' },
      { id: 'igqewx0vq7vkzwe', cleanName: 'Vercel' },
      { id: '3448zeusly399b6', cleanName: 'Rise (app)' },
      { id: 'oppgv5fzoc27i2r', cleanName: 'Domínios (Godaddy)' },
      { id: 'yt7elnaoywi803k', cleanName: 'Hospedagem' },
      { id: '0hfrq53rj7asuz8', cleanName: 'Amazon Prime' },
      { id: 'y3b9moz1gfdu6j6', cleanName: 'Otter.ai' },
    ]

    for (const sub of signatureSubs) {
      try {
        let rec = null
        try {
          rec = app.findFirstRecordByData('categories', 'id', sub.id)
        } catch (_) {
          // Se não achou pelo id, procurar por qualquer nome alternativo ou cleanName
          const searchNames = sub.originalNames || [sub.cleanName]
          for (const sName of searchNames) {
            try {
              rec = app.findFirstRecordByData('categories', 'name', sName)
              break
            } catch (___) {}
          }
        }

        if (rec) {
          rec.set('name', sub.cleanName)
          rec.set('parent', assinaturasMainId)
          rec.set('color', '#8B5CF6')
          rec.set('type', 'sub')
          app.save(rec)
        }
      } catch (e) {
        console.log('Erro ao restaurar subcategoria de assinatura ' + sub.cleanName + ':', e)
      }
    }

    // 3. Devolver subcategorias de Educação:
    // "SOUL CRIATIVA E..." (id 9vmlo3pp54oh5ii) continha:
    // Materiais e Livros (id gyf8udpt0gpo02l), Mentoria UI (id 6isw46tn84gfokd), Outros cursos (id hh7jka2yvdqjc9n), Mentoroa Financeira (id xem67ozhvk1vzlo)
    // Devem ir para "Educação" (id hsiaasr2a1j23th)
    const educacaoMainId = 'hsiaasr2a1j23th'
    const educacaoSubIds = [
      'gyf8udpt0gpo02l',
      '6isw46tn84gfokd',
      'hh7jka2yvdqjc9n',
      'xem67ozhvk1vzlo',
    ]
    for (const subId of educacaoSubIds) {
      try {
        const rec = app.findFirstRecordByData('categories', 'id', subId)
        rec.set('parent', educacaoMainId)
        rec.set('color', '#EC4899')
        rec.set('type', 'sub')
        app.save(rec)
      } catch (_) {}
    }

    // 4. Devolver subcategorias de Tarifas Financeiras:
    // "TARIFAS FINANCEIROS" (id bhfqj7r40q1v8o7) continha:
    // Taxa banco Milenium (lpeqsosqcifrzut), Taxa banco Nubank (7byvuim27azycim), Empréstimos (pp859dmf3b6r2yu), Juros e taxas (jiyu6yuuustmbgp), Pix protegido (y7ws5eyvcwnpxc0)
    // Devem ir para "Tarifas Financeiras" (id b1r76oiymbfhze8)
    const tarifasMainId = 'b1r76oiymbfhze8'
    const tarifasSubIds = [
      'lpeqsosqcifrzut',
      '7byvuim27azycim',
      'pp859dmf3b6r2yu',
      'jiyu6yuuustmbgp',
      'y7ws5eyvcwnpxc0',
    ]
    for (const subId of tarifasSubIds) {
      try {
        const rec = app.findFirstRecordByData('categories', 'id', subId)
        rec.set('parent', tarifasMainId)
        rec.set('color', '#F97316')
        rec.set('type', 'sub')
        app.save(rec)
      } catch (_) {}
    }

    // 5. Verificar se sobrou alguma subcategoria apontando para 9tg5wsnr52x9cwe, 9vmlo3pp54oh5ii ou bhfqj7r40q1v8o7
    // Se sobrou algo não mapeável, mover para "Extras" (zcgxx0hbk1j5v9j)
    const corruptedParents = ['9tg5wsnr52x9cwe', '9vmlo3pp54oh5ii', 'bhfqj7r40q1v8o7']
    const extrasId = 'zcgxx0hbk1j5v9j'

    for (const corruptId of corruptedParents) {
      try {
        const leftoverSubs = app.findRecordsByFilter(
          'categories',
          `parent = '${corruptId}'`,
          '',
          100,
          0,
        )
        for (const sub of leftoverSubs) {
          sub.set('parent', extrasId)
          sub.set('color', '#64748B')
          app.save(sub)
        }
      } catch (_) {}

      // Verificar se alguma transação ainda aponta diretamente para essa categoria antes de deletar
      try {
        app
          .db()
          .newQuery('UPDATE transactions SET category = {:target} WHERE category = {:corrupt}')
          .bind({ target: extrasId, corrupt: corruptId })
          .execute()
      } catch (_) {}

      // Agora excluir com segurança a categoria corrompida / duplicada vazia
      try {
        const corruptCat = app.findFirstRecordByData('categories', 'id', corruptId)
        app.delete(corruptCat)
      } catch (_) {}
    }

    // 6. Também verificar se há categorias truncadas pelo nome terminando em "..."
    try {
      const allMains = app.findRecordsByFilter('categories', "type = 'main'", '', 100, 0)
      for (const m of allMains) {
        if (m.getString('name').endsWith('...')) {
          // Checar se tem subcategorias
          const children = app.findRecordsByFilter('categories', `parent = '${m.id}'`, '', 10, 0)
          if (children.length === 0) {
            // Reatribuir transações se houver
            app
              .db()
              .newQuery('UPDATE transactions SET category = {:target} WHERE category = {:id}')
              .bind({ target: extrasId, id: m.id })
              .execute()
            app.delete(m)
          }
        }
      }
    } catch (_) {}
  },
  (app) => {
    // Rollback não aplicável para limpeza de corrupção
  },
)
