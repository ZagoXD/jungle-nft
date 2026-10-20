# Validação atual: performance e fluxos

O build completo atingiu todas as metas Lighthouse nas medianas de três medições por página/perfil. Os resultados anteriores P88/P88 mobile foram substituídos pelos doze relatórios atuais; o resumo anterior consta em [performance.json](performance.json).

| Página  | Perfil  |   P |   A |  BP | SEO |     LCP |      CLS |   TBT |
| ------- | ------- | --: | --: | --: | --: | ------: | -------: | ----: |
| inicio  | mobile  |  90 | 100 | 100 | 100 | 3.401 s | 0.000291 | 76 ms |
| inicio  | desktop | 100 |  98 | 100 | 100 | 0.677 s | 0.000274 |  0 ms |
| detalhe | mobile  |  92 |  99 | 100 | 100 | 3.032 s | 0.077108 | 64 ms |
| detalhe | desktop | 100 | 100 | 100 | 100 | 0.785 s | 0.000247 |  0 ms |

A inicial mobile teve amostras 89, 90 e 90; sua mediana é 90. Detalhe mobile: 92, 92 e 92. Todas as medições usam navegador limpo, throttling padrão mobile, MSW padrão, funcionalidades reais e os assets locais completos. [Condições e versões](lighthouse/summary.json), com doze pares de relatórios HTML/JSON.

A melhora vem da entrega Brotli dos recursos de texto, negociada por Accept-Encoding no preview. Os originais continuam como fallback. Os 135 sidecars foram descompactados e comparados byte a byte; negociação, qualidade zero, HEAD, Range e rotas SPA foram verificados. Os três maiores módulos passaram de aproximadamente 255 KB gzip para 217 KB Brotli. Os hashes dos 17 módulos JavaScript e do CSS gerado permaneceram iguais aos anteriores à otimização; imagens e fontes não mudaram.

A suíte final foi executada contra esse build de produção: **68 casos, 67 aprovados, zero falhas, zero instáveis e uma repetição responsiva dispensada**. As dez baselines visuais passaram sem atualização. Um seletor ambíguo do teste de cupom foi delimitado ao resumo ativo; a suíte inteira foi repetida depois da correção.

- [Relatório Playwright](playwright/index.html) e [resumo E2E](e2e-summary.json).
- [Auditoria dos 157 blocos do README](requirements-audit.json) e [validação](validation.json).
- [Smoke do build](production-smoke.json): duas compras completas, desktop/mobile, vinte capturas e zero erros de runtime.
- [Performance e integridade dos arquivos](performance.json).

Fluxos de catálogo/URL/histórico, autenticação, favoritos, carrinho/cupom, pagamento/revisão, carteiras, perfil, falhas, expiração, idempotência e reconexão Socket.IO foram revalidados. Nove telas em 390/768/1440, cenários por toque, foco, paisagem, reflow e painéis fixos cobertos. A comparação com exports do Figma foi manual em revisões anteriores; as baselines atuais verificam regressão da aplicação.

## Publicação

O deploy permanece com o usuário. O middleware do preview não roda em um host estático externo: a publicação precisa negociar a compressão pelo próprio host. Validar Content-Encoding, acesso direto/refresh, mocks, Socket.IO e repetir a auditoria na URL pública. Essa validação continua pendente; a meta local de performance está cumprida.

Base Git app v2 (0c11100), já enviada antes destas revisões. Nenhum novo commit/push. Registros de fidelidade e checkout são históricos; auditoria geral, E2E, smoke e Lighthouse foram atualizados nos mesmos caminhos.
