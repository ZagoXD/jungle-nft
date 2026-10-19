# Validação da entrega local

A suíte Chromium contém 48 casos: **47 aprovados, zero falhas, zero instáveis e uma repetição dispensada**. A verificação responsiva já percorre as nove telas em 390, 768 e 1440 no projeto desktop; por isso não se repete no projeto mobile. A execução final usou dois workers e contextos isolados. Os fluxos também passaram na execução com um worker antes da última verificação de isolamento.

- [Relatório Playwright](playwright/index.html): `npx playwright show-report reports/playwright`.
- [Resumo E2E](e2e-summary.json), [validação geral](validation.json) e [smoke do build de produção](production-smoke.json).
- [Verificação do detector visual](visual-detector.json): deslocamento temporário de 40 px no hero produziu 2,48% de pixels diferentes, acima da tolerância de 0,3%; ao restaurar, a comparação voltou a zero. O fonte foi preservado.
- [Assets otimizados](assets.json) e [auditoria de dependências](dependencies.json): zero vulnerabilidades.

As oito baselines de início, detalhe, carrinho e pagamento ficam em `tests/visual.spec.ts-snapshots/`, para desktop e mobile. Foram revisadas contra os frames exportados do Figma. Capturas esperam fontes, imagens e estabilização do layout. Falhas futuras mantêm screenshot e trace em `test-results/`; a execução final aprovada não gerou traces de falha para conservar.

## Lighthouse

Três medições por página e perfil no **mesmo build otimizado**, com navegador limpo em cada medição. Configuração reproduzível: `scripts/lighthouse.mjs`; comando `npm run build` seguido de `npm run lighthouse`. O servidor de preview local foi usado em 127.0.0.1:4173. Cenário padrão MSW com 80 ms de latência REST; assets e funcionalidades completos. Mobile usa a simulação padrão Lighthouse, sem aliviar rede/CPU; desktop usa o preset oficial, 1440 × 1000. Não houve execução E2E concorrente durante as auditorias.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| inicio | mobile | 89 | 100 | 100 | 100 | 3.613 s | 0.000291 | 89 ms |
| inicio | desktop | 100 | 98 | 100 | 100 | 0.749 s | 0.000274 | 0 ms |
| detalhe | mobile | 89 | 99 | 100 | 100 | 3.595 s | 0.000097 | 94 ms |
| detalhe | desktop | 99 | 100 | 100 | 100 | 0.893 s | 0.000256 | 0 ms |

Medianas calculadas automaticamente em [summary.json](lighthouse/summary.json), que contém cada medição, versões de Node, Chromium, Lighthouse e Playwright, CPU, sistema operacional e condições. Os relatórios individuais `.html` e `.json` estão em `lighthouse/`, com nomes `inicio|detalhe-mobile|desktop-1|2|3`.

**Ressalva: performance mobile 89 nas duas páginas, abaixo da meta 90.** As outras categorias atingem as metas de 95/95/90; performance desktop também supera 90. O principal custo remanescente é a inicialização cliente antes de exibir a arte dependente da API: React, Router/Query e o serviço MSW completo precisam carregar e executar sob CPU/rede mobile simuladas. O LCP mediano é próximo de 3,6 s. A contribuição de deslocamento de layout é pequena; TBT mediano fica abaixo de 100 ms.

Foram aplicados imports paralelos, carregamento de rotas sob demanda, bundle ESM compacto oficial de `tldts` sem remover dados de cookies, WebP responsivo, dimensões reservadas e feedback inicial com skeletons. O bundle de MSW passou de aproximadamente 451 KB para 315 KB brutos; as 12 variantes de imagem somam 472.126 bytes. Os PNG originais continuam disponíveis para ampliação. Não foram removidos mocks, Socket.IO, imagens ou fontes para auditar, nem adicionadas ramificações exclusivas para Lighthouse. A meta mobile permanece registrada como não atingida, em vez de atribuir ao deploy ainda não realizado uma pontuação não medida.

## Publicação e Git

A publicação foi delegada ao usuário. `vercel.json` e instruções de deploy estão prontos, mas não houve validação de URL pública. Os arquivos da aplicação, lockfile, relatórios e baselines estão na árvore de trabalho; não houve commit ou push da implementação, conforme solicitado.
