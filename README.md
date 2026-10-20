# KURIO · Jungle NFT

Marketplace de NFTs implementado em React e TypeScript a partir do [desafio Jungle](https://github.com/junglegaming/frontend-challenge) e do [Figma de referência](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1). Compras, contas, carteiras e transações são simuladas; nenhuma extensão ou serviço privado é necessário.

## Executar localmente

Requer Node.js 24.14+ e npm. Na pasta do aplicativo:

```sh
npm ci
npm run dev
```

Abra [localhost:5173](http://127.0.0.1:5173). Os mocks estão habilitados por padrão, inclusive no build de demonstração. As imagens e a fonte Roboto Mono são locais.

| Comando               | Função                                             |
| --------------------- | -------------------------------------------------- |
| `npm run dev`         | Desenvolvimento com MSW e Socket.IO simulado       |
| `npm run build`       | Verificação de tipos e build otimizado em `dist`   |
| `npm run preview`     | Servir o build localmente                          |
| `npm run typecheck`   | Verificar contratos e TypeScript                   |
| `npm run lint`        | ESLint, sem warnings permitidos                    |
| `npm run test:e2e`    | Chromium desktop e mobile; relatório HTML          |
| `npm run test:visual` | Regressão de início, detalhe, carrinho e pagamento |
| `npm run lighthouse`  | Build existente: 3 medições × 2 páginas × 2 perfis |

Antes dos testes/auditorias, instale o navegador com `npx playwright install --no-shell chromium`. Em Linux, instale também as dependências do sistema indicadas pelo Playwright. Para rever resultados: `npx playwright show-report reports/playwright`. Traces de falhas ficam em `test-results/`. Para atualizar baselines deliberadamente, após comparação com o design: `npm run test:visual -- --update-snapshots`.

## Contas e compra de demonstração

| E-mail fictício      | Senha fictícia     |
| -------------------- | ------------------ |
| `alice@example.test` | `Colecionador123!` |
| `bruno@example.test` | `Colecionador123!` |

As duas contas têm carteiras Ethereum fictícias. Cadastro cria uma conta independente, inicialmente sem carteira. É possível cadastrar uma carteira de teste usando `0x` seguido de 40 caracteres hexadecimais. As senhas são guardadas somente como hashes no simulador. Esse mecanismo demonstrativo não substitui autenticação de produção.

Explore o catálogo, abra um NFT, escolha edição/quantidade e compre. O carrinho visitante é mesclado ao da conta no login, limitado pelo estoque. Use `KURIO10` para desconto de 10%; `EXPIRED` reproduz cupom expirado. Outros códigos são inválidos. No pagamento, conecte uma carteira de teste e preencha os dados. **Confirmar compra** abre a revisão exigida pelo desafio; o segundo clique confirma o envio. **Tem um código promocional? Aplique aqui** expande o campo de cupom. Alterações posteriores da cotação exigem nova confirmação.

No carrinho, **Conectar e finalizar** abre login/cadastro em modal e mantém a URL e os itens. Após autenticar, a aplicação segue para o pagamento. Para quem já entrou na conta, **Finalizar** leva diretamente ao pagamento. Fechar o modal devolve o foco ao botão do carrinho.

No mobile, **Trocar carteira** abre a escolha de rede e carteira cadastrada. **Confirmar compra** abre a revisão dos itens e valores. Nela, **Editar dados** abre o formulário do colecionador, validado por **Salvar dados** e novamente antes do envio; o código promocional também fica disponível na revisão. Os painéis de compra do NFT, resumo do carrinho e confirmação do pagamento ficam fixos no rodapé, enquanto o conteúdo mantém espaço para rolagem. A galeria permite deslizar horizontalmente e usar os controles anterior/próxima. A ordenação está nos filtros.

Após timeout, use **Recuperar tentativa**: o payload e a chave originais são reutilizados. Pedidos pendentes podem ser reabertos pela página de pedidos ou recarregados. Confirmação e recibo só aparecem após o estado confirmado retornado pela simulação. O botão do explorador informa que a consulta está em preparação; os dados da transação permanecem no recibo, sem consultar uma blockchain real.

## Configuração e cenários

`VITE_ENABLE_MOCKS=true` é o padrão; `.env.example` documenta a opção. Desabilitar MSW exige fornecer uma implementação compatível dos contratos; não existe backend de produção neste projeto.

Os cenários são configurados pelos endpoints MSW no console do navegador, sem uma tela adicional no marketplace. Os controles abaixo são requisições reais interceptadas por MSW; não alteram estado React nem cache diretamente:

```js
// Restaurar todo o banco e o cenário padrão. Depois recarregue a página.
await fetch('/api/demo/reset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
})
localStorage.removeItem('kurio.session')
sessionStorage.clear()
location.reload()
```

```js
// Configurar uma condição sem apagar os dados. Exemplos abaixo.
await fetch('/api/demo', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ latency: 1500 }),
})
```

| Payload de configuração                                                 | Cenário                                                                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `{ latency: 1500 }`                                                     | Skeletons e latência lenta                                                              |
| `{ variableLatency: true }`                                             | Busca com 1 caractere leva 1000 ms; outras, 80 ms; respostas fora de ordem              |
| `{ empty: true }`                                                       | Catálogo vazio                                                                          |
| `{ offline: true }`                                                     | Erro de conexão; `/api/demo` continua disponível para restaurar                         |
| `{ offline: false, latency: 80, empty: false, variableLatency: false }` | Recuperação das condições normais                                                       |
| `{ failNext: 'PUT /api/favorites', status: 503 }`                       | Próxima mutation falha; favorito otimista faz rollback                                  |
| `{ failNext: 'PATCH /api/profile', status: 422 }`                       | Falha de validação retornada pela API                                                   |
| `{ payment: 'declined' }`                                               | Próximo pedido será recusado; carrinho preservado                                       |
| `{ orderDelay: 60000 }`                                                 | Pedido pendente para testar refresh/reconexão                                           |
| `{ couponExpired: true }`                                               | Expira o cupom já aplicado e bloqueia o envio                                           |
| `{ networkFee: '0.01' }`                                                | Altera a taxa; a revisão exige nova confirmação                                         |
| `{ timeoutAfterCreate: true }`                                          | Pedido é criado, resposta demora 10 s, Axios expira em 8 s; recuperar a mesma tentativa |

Para alterar preço/estoque e emitir `nft.updated`, envie `POST /api/demo/nft` com `{ id: 'nft-1', price: '2', stock: 2 }`. `duplicate: true` repete o mesmo evento; `old: true` emite uma versão antiga sem alterar os dados atuais. Para desconectar, `POST /api/demo/disconnect`; o cliente reconecta e consulta REST. `POST /api/demo/settle` resolve os pedidos pendentes de forma determinística. `POST /api/demo/order-event` com `{ id: 'order-...', old: true, duplicate: true }` emite eventos antigos/duplicados, sem mudar o pedido persistido.

`POST /api/session/expire` exige `Authorization: Bearer <token da sessão fictícia>` e permite expirar a sessão durante o fluxo. Cadastro com e-mail existente reproduz HTTP 409; endereço inválido, cupom expirado e estoque insuficiente reproduzem validações/conflitos. Os testes compartilham os mesmos handlers e cenários.

## Auditorias e arquitetura

`npm run build && npm run lighthouse` produz relatórios HTML/JSON e `reports/lighthouse/summary.json`, com medianas, LCP, CLS, TBT, versões e condições. Cada medição abre um navegador limpo, usa MSW padrão e os assets reais. `CHROME_PATH` permite selecionar outro Chrome compatível; `LIGHTHOUSE_URL` permite auditar uma URL já servida.

O build também gera versões Brotli (`.br`) dos recursos de texto. O preview negocia `Accept-Encoding` e mantém os arquivos originais como fallback; imagens e fontes permanecem inalteradas. No ambiente publicado, verifique a negociação de compressão do host, pois o middleware do preview não é executado por um servidor estático externo.

Para executar a suíte contra o mesmo build auditado, mantenha `npm run preview -- --port 4173` em um terminal e, em outro terminal PowerShell, execute:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:4173'
npm run test:e2e
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

Veja [ARCHITECTURE.md](ARCHITECTURE.md) para contratos REST/eventos, sessão, carrinho, cache, idempotência, reconciliação, decisões de UX e limitações.

Os testes instalam um relógio com início conhecido nos cenários de fluxo, configuram a latência e disparam eventos pela API de demonstração. As dez baselines foram produzidas com Chromium 156 no Windows, fontes locais e movimento reduzido: oito telas completas e dois recortes das edições. O teste responsivo percorre as nove telas em 390, 768 e 1440 px e verifica texto ampliado. Os relatórios atuais e as condições das medições estão em [reports/README.md](reports/README.md).
