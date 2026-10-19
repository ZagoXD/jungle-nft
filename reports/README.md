# Validação da revisão local

A suíte Chromium atual contém **68 casos: 67 aprovados, zero falhas, zero instáveis e uma repetição dispensada**. A verificação responsiva já percorre as nove telas em 390, 768 e 1440 no projeto desktop; por isso não se repete no mobile. Execução com dois workers e contextos isolados, sem atualizar snapshots na suíte final.

- [Relatório Playwright](playwright/index.html): `npx playwright show-report reports/playwright`.
- [Resumo E2E](e2e-summary.json), [validação](validation.json) e [smoke do build](production-smoke.json).
- [Correções do checkout](checkout-corrections.json): modal no carrinho, estados de carteiras e ajustes visuais solicitados.
- [Revisão de fidelidade e mobile](fidelity-corrections.json) e [auditoria anterior dos 157 blocos do README](requirements-audit.json), com a referência desta correção complementar.
- [Assets](assets.json), [dependências](dependencies.json) e [experimento anterior do detector visual](visual-detector.json) preservados.

Três novos cenários executam nos dois perfis e cobrem login/cadastro sem sair do carrinho, cancelamento e foco, sessão já ativa, mesclagem dos itens, conta sem carteiras, falha da API com retry, carregamento lento, refresh, botão Salvar carteira sem quebra, centralização da taxa e largura da linha do recibo. O helper da suíte verifica erros de runtime. O build concluiu duas compras sem erros e gerou vinte capturas fora do app, incluindo o modal sobre o carrinho em desktop e mobile.

As dez baselines são oito telas completas (início, detalhe, carrinho e pagamento nos dois perfis) e dois recortes das edições, com tolerância menor para proteger sua borda elíptica. Foram revistas manualmente e passaram na suíte completa sem atualização. Comparação com o Figma é manual, usando os exports originais e as referências enviadas; os testes visuais comparam a aplicação às suas baselines.

## Lighthouse e publicação

A última auditoria completa de Lighthouse está em [summary.json](lighthouse/summary.json), com data, doze relatórios HTML/JSON, versões, condições e medianas. **Ela foi executada antes desta correção pontual de checkout e não foi repetida nesta rodada.** O fingerprint correspondente está em `validation.json → lighthouseAudit`. Os resultados preservados foram: inicial P89 mobile/P100 desktop, detalhe P90 mobile/P99 desktop; Accessibility 98–100, Best Practices 100 e SEO 100. A inicial mobile ficou abaixo da meta 90; a ressalva e o custo de inicialização de aplicação/MSW e carregamento da arte permanecem documentados. Não se declara nova medição de performance para este build.

O deploy e o smoke da URL pública continuam delegados ao usuário. A base Git segue `e353a20` (`app v1`); **nenhum commit ou push foi feito nesta revisão**. Os relatórios funcionais anteriores nos mesmos caminhos foram substituídos pelos resultados atuais.

## Ajustes dos painéis mobile

Nome de usuário alinhado à esquerda. Navegação com cor e aria-current da aba ativa. Compra do NFT, resumo do carrinho e confirmação do pagamento fixos no rodapé, com sombra, safe area e espaço reservado dinamicamente no conteúdo. Os atalhos Detalhes da compra e Dados do colecionador foram retirados da tela principal; editar dados e aplicar cupom continuam disponíveis na revisão. Novo teste mobile cobre abas, alinhamento, scroll e painéis em 390 × 844 e 414 × 640.
