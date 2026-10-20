# Validação após correção do hero mobile

O fundo mobile usa agora o SVG original do Figma, exportado sem alterações. A inicial mobile teve a baseline atualizada e ganhou uma comparação específica do hero. As outras nove baselines permanecem iguais.

A revisão atual e as evidências estão em [mobile-hero-correction.json](mobile-hero-correction.json). A otimização Brotli anterior está registrada historicamente em [performance.json](performance.json).

| Página  | Perfil  |   P |   A |  BP | SEO |     LCP |      CLS |   TBT |
| ------- | ------- | --: | --: | --: | --: | ------: | -------: | ----: |
| inicio  | mobile  |  90 | 100 | 100 | 100 | 3.424 s | 0.000291 | 79 ms |
| inicio  | desktop | 100 |  98 | 100 | 100 | 0.687 s | 0.000247 |  0 ms |
| detalhe | mobile  |  92 |  99 | 100 | 100 | 3.045 s | 0.077108 | 60 ms |
| detalhe | desktop | 100 | 100 | 100 | 100 | 0.805 s | 0.000247 |  0 ms |

Doze medições novas (três por página/perfil), com assets e funcionalidades completos. Mediana de performance mobile: início 90 e detalhe 92; desktop 100 nas duas telas. Todas as metas de categoria cumpridas. [Condições, versões e amostras](lighthouse/summary.json).

Suíte completa no build: 68 casos, 67 aprovados, uma repetição responsiva dispensada, zero falhas/instáveis. Onze baselines visuais. [Playwright HTML](playwright/index.html), [resumo E2E](e2e-summary.json) e [validação](validation.json).

Os fluxos de compra, conta, catálogo, persistência, erros e Socket.IO são revalidados pela suíte. O smoke detalhado anterior e a auditoria dos 157 blocos continuam identificados pela data e fingerprint originais; esta rodada altera apenas o fundo do hero e sua regressão visual.

Sem commit, push ou deploy nesta correção. A URL pública fornecida anteriormente ainda exige publicação do código local e conferência da correspondência da versão.
