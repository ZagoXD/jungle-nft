# Arquitetura e contratos

## Camadas

`src/domain` define contratos e operações ETH com Decimal.js. `src/mocks` é o serviço simulado: banco, regras, handlers REST e Socket.IO. `src/lib` contém Axios, políticas Query, sessão e ciclo do socket. `src/pages` e `src/components` consomem contratos pela rede. Componentes não importam fixtures ou o banco.

Vite carrega a aplicação e a rota de descoberta solicitada em paralelo à inicialização de MSW. A montagem React aguarda o worker estar pronto. `socket.io-client` é importado depois dessa etapa, pois o transporte captura o construtor WebSocket no import. As outras páginas são carregadas sob demanda. Tailwind CSS 4 participa da configuração, tokens, utilitários e componentes shadcn/ui Button/Dialog; os estilos de composição preservam a identidade Kurio. Radix fornece foco, Escape e semântica dos diálogos.

## Contratos REST

Base `/api`, JSON. Todas as chamadas da aplicação passam pelo Axios; os testes de contratos também usam requisições interceptadas no navegador. Identificação de visitante por `X-Visitor-Id`, autenticação por `Authorization: Bearer <token fictício>`. Erros: `{ code, message, fields? }`, com HTTP 401, 403, 404, 409, 422 e falhas transitórias 5xx.

| Método e caminho                              | Entrada → resultado                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /session`                                | Sessão recuperável: `{user, expiresAt}` ou `user: null`                                                             |
| `POST /session/register`                      | `{name,email,password}` → `{token,user,expiresAt}`; 409 se e-mail existente                                         |
| `POST /session/login`                         | `{email,password}` → mesma resposta; 401 se inválido                                                                |
| `POST /session/logout`, `/session/expire`     | Revogação/expiração da sessão                                                                                       |
| `GET /nfts`                                   | `q,category,collection,network,minPrice,maxPrice,sort,page` → `{items,total,page,pages,facets}`; página com 9 itens |
| `GET /nfts/:id`                               | NFT, galeria, edições/estoque, preço string e versão; 404 se ausente                                                |
| `GET /favorites`, `PUT/DELETE /favorites/:id` | IDs favoritos da conta autenticada                                                                                  |
| `GET /cart`                                   | `{items:[{nftId,editionId,quantity}],coupon,version}`                                                               |
| `POST /cart/items`                            | Adicionar quantidade, limitada pelo estoque da edição                                                               |
| `PATCH/DELETE /cart/items/:nftId/:editionId`  | `{quantity}` para alterar; remoção do par NFT/edição                                                                |
| `PUT/DELETE /cart/coupon`                     | `{coupon}`; validação e persistência do código                                                                      |
| `POST /quote`                                 | `{network,coupon?}` → linhas, subtotal, desconto, taxa, total, ID, validade de 5 minutos e fingerprint              |
| `POST /orders`                                | `{quoteId,collector,walletId,network}` + `Idempotency-Key` → pedido pendente ou mesmo pedido anterior               |
| `GET /orders`, `/orders/:id`                  | Lista da conta e snapshot/estado do pedido; 403 para outra conta                                                    |
| `GET/PATCH /profile`                          | Perfil, e-mail, usuário, ENS, apelido, bio e avatar                                                                 |
| `PUT /profile/password`                       | `{currentPassword,password}`; validação da senha atual e complexidade                                               |
| `GET/POST /wallets`, `PUT /wallets/:id`       | Carteiras, endereço/rede, campos do layout e papel principal/secundário                                             |
| `POST /wallets/:id/connection`                | `{action:'connect' \| 'decline' \| 'disconnect'}` → estado simulado ou conflito                                     |

Campos de `collector`: `name,email,username,profileName,walletAddress,secondaryAddress,walletType,referral,ens,note`. Os mesmos campos de identificação de carteira aparecem no cadastro de carteiras. Endereços usam `0x` e 40 caracteres hexadecimais; nome ENS termina em `.eth`. Os campos marcados no design são validados; observação e endereço secundário são opcionais. Avatar aceita PNG/JPEG/WebP de até 300 KB.

ETH trafega como string decimal com 18 casas. Decimal usa precisão de 48 dígitos; não há aritmética monetária com Number. Quantidades são inteiros positivos. A apresentação preserva a precisão, removendo somente zeros desnecessários. Taxas são valores simulados por rede, não estimativas de blockchain real.

## Persistência, sessão e cache

O banco de demonstração tem schema versionado e é persistido em `kurio.mock.v1`, no localStorage. Inclui hashes de senha, catálogo, sessões, carrinhos, favoritos, perfil, carteiras, cotações e pedidos. O token ativo fica em `kurio.session`; visitante em `kurio.visitor`. Senhas fictícias não são persistidas em claro. Não há promessa de segurança de backend real em armazenamento controlado pelo navegador.

Sessões duram uma hora e são reconsultadas em refresh, foco, navegação protegida e a cada 30 s. HTTP 401 remove o token e atualiza a sessão somente se a requisição ainda pertence ao token ativo; respostas atrasadas de outra sessão são descartadas. O endpoint de sessão representa credenciais vencidas como sessão anônima. Carrinho e cotação devolvem 401 para um token vencido, sem reinterpretar a compra autenticada como carrinho visitante. O guard Router valida o acesso; a proteção reativa preserva a URL de retomada quando a sessão muda. Retornos externos e URLs de autenticação como destino de retorno são rejeitados.

As chaves Query incluem o usuário para recursos privados, o ID do NFT e todos os parâmetros do catálogo. Axios recebe AbortSignal para cancelar consultas obsoletas. Queries têm staleTime de 15 s e uma repetição de falha transitória; 401/403/404/409/422 não são repetidos. Mutations não têm retries automáticos. Eventos e mutations invalidam os recursos afetados. A interface distingue carregamento inicial, atualização em segundo plano, erro, vazio e sucesso.

Favoritos usam `onMutate` para cancelar consultas, capturar snapshot e atualizar otimisticamente; `onError` restaura o snapshot; ao terminar há reconciliação REST. No logout/troca de usuário, consultas privadas são canceladas/removidas e o socket anterior é encerrado. O contexto de sessão é publicado por resposta de API, evitando reaproveitar uma consulta em andamento com credenciais anteriores.

O carrinho do visitante e os carrinhos das contas são separados. Login mescla pares NFT/edição, somando quantidades até o estoque disponível, adota o cupom visitante apenas quando a conta não tem cupom e esvazia o carrinho visitante. Logout não expõe o carrinho da conta. Uma confirmação subtrai somente as quantidades do snapshot; itens e quantidades adicionados posteriormente permanecem.

## Cotação e pedidos

Cada revisão consulta uma nova cotação. O fingerprint inclui linhas, quantidade, disponibilidade, preço, cupom, taxa e rede. Antes do envio, o cliente reconsulta a cotação; qualquer diferença exige um novo clique de confirmação. Cada cotação pertence ao visitante/usuário que a solicitou e expira em cinco minutos. O servidor confere propriedade, validade e os dados atuais novamente. O recibo é uma cópia independente da cotação aceita.

A tentativa usa UUID persistido por usuário em `kurio.attempt:<id>`, com o payload original. Cliques repetidos são bloqueados por estado e trava síncrona. Reenvio após timeout reutiliza o mesmo conteúdo e chave. O simulador indexa a chave por usuário e compara o payload com chaves JSON ordenadas (a ordem dos campos não altera a identidade): repetição idêntica retorna o mesmo pedido; conteúdo diferente gera 409. Timeout depois da criação não desfaz o pedido. Ao reencontrar uma tentativa, a UI oferece recuperação, preservando os dados originais.

Pedidos seguem `pending → confirmed|declined`. Estados terminais não regridem. A resolução também é calculada ao consultar REST, possibilitando recuperação após fechamento da página ou perda do evento. Estoque é conferido novamente na resolução. Apenas confirmação efetiva altera estoque e subtrai o carrinho. O recibo e o explorador simulado leem o snapshot persistido, sem consultar preços atuais.

## Socket.IO e MSW

O cliente real conecta em `wss://jungle-nft.test`, interceptado por MSW 2.15 e `@mswjs/socket.io-binding` 0.2.0. Transporte exclusivamente WebSocket, namespace padrão. Nenhum backend externo recebe a conexão. O binding codifica/decodifica frames Socket.IO e fornece handshake; não implementa todos os recursos de um servidor, como salas, namespaces e heartbeat completo. A reconexão usa o cliente real, com backoff entre 500 e 2000 ms.

`session.subscribe` envia o token fictício da sessão; `session.ready` confirma a inscrição. A emissão de pedidos é filtrada por usuário e sessão válida. Todos os listeners são removidos no encerramento do ciclo; uma geração de conexão impede que callbacks de sessões anteriores afetem a atual.

| Evento          | Payload e efeito                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `nft.updated`   | `{eventId,resourceId,version,nft}`; invalida catálogo, detalhe, carrinho e cotação                      |
| `order.updated` | `{eventId,resourceId,version,userId,sessionId,order}`; reconcilia estado do pedido, carrinho e catálogo |

IDs e versões são deduplicados por conexão; versões antigas são ignoradas. Eventos invalidam e reconciliam pela API, sem confiar em um payload para sobrepor uma resposta mais recente. Ao conectar/reconectar, os recursos ativos são invalidados. Pedidos pendentes também têm polling REST de 1500 ms para recuperar eventos perdidos. O banco compartilhado entre handlers e emissão é a autoridade; os controles `/demo` mudam o banco e emitem pela camada Socket.IO.

## Design, acessibilidade e limites

Roboto Mono local, cores e assets exportados do Figma. Os PNG originais continuam disponíveis; variantes WebP com qualidade 95 em 192/384/640 reduzem transferência em slots pequenos. As 12 variantes somam 472.126 bytes; o script valida dimensões e desvio visual antes da substituição, com resultados em `reports/assets.json`. Os PNG completos continuam usados na ampliação. Não há imagens geradas ou substituições por outros bancos. SVGs são arquivos locais, com geometria preservada. Os exports completos de referência são usados apenas na revisão e não fazem parte da implementação.

Os frames mobile guiam banner, busca, grade e navegação inferior. O conteúdo tem rolagem nativa, sem impor o recorte de 896 px ou uma moldura de aparelho. Perfil, carteiras e recibo têm adaptação mobile. Estados novos, revisão e falhas usam os mesmos tokens. Labels, mensagens associadas, foco visível, trap/retorno de foco, avisos ao vivo e movimento reduzido são tratados nos componentes compartilhados. Campos e botões têm áreas mínimas ampliadas quando necessário para operação por toque.

Login social, artigos, suporte, ofertas e downloads são auxiliares fora do escopo: exibem explicação coerente e não fingem concluir uma integração. Links de transação apontam para o explorador demonstrativo, sem apresentar uma compra fictícia como transação real. O perfil tem um único botão Salvar, como no Figma. PATCH /profile aceita currentPassword/password/confirm opcionais; valida a senha e o perfil antes de gravar qualquer alteração. Esses campos são removidos do payload antes de persistir o perfil, e somente o hash da nova senha é armazenado. PUT /profile/password continua disponível para compatibilidade do contrato.

O simulador foi desenhado para uma aba de demonstração por contexto. Sincronização concorrente entre abas/dispositivos e segurança de produção exigiriam um backend. Dados fictícios podem ser apagados integralmente pelo reset. Nenhum dado de carteira real deve ser utilizado.

O catálogo contém 36 NFTs em nove categorias, com quatro edições por NFT, nove resultados por página e contagens derivadas das fixtures. As contagens, contas, textos de exemplo e estado vazio variam conforme os dados simulados, em vez de representar contagens estáticas do design. Busca por coleção e preço, revisão de compra e controles de demonstração acrescentam comportamentos exigidos pelo enunciado. O mobile não reproduz a moldura do aparelho. Campos e ações de conta/pagamento se reorganizam para manter leitura e operação em 390 e 768 px.

O build usa o bundle ESM compacto oficial de `tldts`, preservando seus dados completos de sufixos e a API utilizada pelo suporte de cookies de MSW. O cenário normal tem 80 ms de latência REST; lentidão, inversão de respostas e timeout continuam configuráveis para toda a aplicação, inclusive no build. Não há ramificação por Lighthouse, user-agent ou ambiente de teste.

No pagamento mobile, os cartões das carteiras cadastradas precedem os provedores e o total, conforme a composição do frame. Trocar carteira permite escolher rede e carteira; a troca exige nova conexão. A tela principal não contém os atalhos Detalhes da compra ou Dados do colecionador. A revisão contém itens, valores, cupom e Editar dados para acessar todos os campos exigidos pelo README, com validação e Salvar dados; erros no envio também abrem o formulário. A revisão exibe a identidade antes do envio. No desktop, o formulário permanece aberto ao lado do resumo. O retorno de foco da conexão aponta para seu controle persistente; diálogos cujo acionador desapareceu devolvem o foco ao conteúdo principal.

A galeria mobile aceita gesto horizontal sobre a imagem e oferece controles anterior/próxima com contador acessível. A ampliação usa a imagem selecionada. A ordenação completa está disponível no drawer de filtros mobile e continua na URL. O carrinho mobile usa imagens de 100 px, quantidade ao lado do item e resumo em toda a largura; rodapé e sugestões não acompanham o fluxo de compra nessa largura. O cadastro usa o título e a ação Criar perfil do frame mobile. Selo RARO e preço anterior do Neon Vessel são metadados das fixtures REST, também preservados em bancos locais existentes.

O carrinho abre o mesmo formulário de autenticação em modal, carregado sob demanda, sem sair de /carrinho. Login e cadastro usam os mesmos contratos e a mesma mesclagem de itens das rotas de autenticação. Fechar retorna ao botão acionador; sucesso navega para /pagamento. Com sessão ativa, o botão mostra Finalizar e navega diretamente. A seleção de carteiras usa uma coleção normalizada enquanto a consulta não tem dados, inclusive nas expressões dos diálogos fechados. Skeletons e erros da consulta continuam explícitos, com recuperação por Tentar novamente; não são convertidos em sucesso vazio.

As edições usam borda elíptica; Salvar carteira não quebra linha. Taxa estimada ocupa uma linha centralizada em toda a largura do resumo. No recibo, a linha inferior dos valores usa a mesma largura dos detalhes da transação, mantendo os valores à direita. Dois recortes visuais adicionais protegem a geometria das edições, além das oito capturas completas.

A revisão cobre operação por toque em 390 × 844 e 414 × 896, autenticação em paisagem 844 × 390, as nove telas em 390/768/1440 e reflow equivalente a zoom de 200% no perfil (viewport CSS de 384 px e densidade 2). As dez baselines são regressões da aplicação revisada; a conferência com os quinze exports originais do Figma é manual. O conector não concedeu contexto detalhado por falta de acesso de edição; não se declara comparação automatizada pixel a pixel com o Figma.

O HTML inicial apresenta marca, mensagem acessível e skeletons enquanto as dependências e MSW carregam. É o mesmo carregamento para todos os visitantes, sem catálogo ou preços fabricados antes da API. O React substitui essa estrutura ao montar. A animação inicial também respeita movimento reduzido.

Na inicialização, uma inscrição anterior do service worker é removida somente quando seu script corresponde ao `mockServiceWorker.js` deste aplicativo. Isso evita reutilizar uma inscrição que MSW 2.15 pode estar removendo no fechamento do documento anterior, uma corrida observada em recargas rápidas no build. O arquivo gerado de MSW não é modificado. O banco e os dados de sessão persistentes são preservados.

Callbacks de favorito carregam a identidade da sessão que iniciou a atualização otimista. Respostas tardias após logout/troca não restauram snapshots antigos no cache nem notificam a nova conta.

## Revisão de fidelidade

Os textos estáticos, rodapé, proporções dos campos, selos de carteiras, edições e confirmação foram revistos com os exports do Figma. Início fica ativo no perfil/carteiras. O coração preenchido deriva do contorno externo do SVG original, preservando sua geometria; não é um ícone de outro banco. Filtros preservam inputs acessíveis, ocultando apenas o desenho nativo. As três redes aparecem no catálogo; as contagens continuam refletindo os dados retornados pela API, inclusive Solana, em vez dos números estáticos incompatíveis entre os grupos do design.

ENS separa o seletor .eth e o nome, mantendo uma única string normalizada no contrato. O código promocional do checkout abre sob demanda. Confirmação usa o cartão isolado da referência, sem header/rodapé. Sua altura varia conforme os itens efetivamente comprados. O recibo preserva informação de desconto quando aplicável no snapshot, e a confirmação informa o ambiente de testes. O explorador continua local.

Conexão/desconexão, recusa e revisão anterior ao envio permanecem operáveis conforme o README, mesmo sem frames específicos para cada estado. São as extensões funcionais ao desenho. O botão Confirmar compra abre a revisão e o segundo clique envia o pedido. Avisos duram seis segundos e pausam durante interação; ficam acima dos modais, sem que seu fechamento seja interpretado como clique fora do diálogo. Controles de cenários ficam disponíveis por URL documentada, sem link adicional no rodapé. Ações auxiliares usam mensagens de disponibilidade futura, sem afirmar que uma integração foi concluída.

## Painéis fixos no mobile

Compra do NFT, resumo do carrinho e confirmação do pagamento usam position: fixed até 600 px, com sombra superior, safe area e altura máxima com rolagem interna em telas pequenas. ResizeObserver mede a altura real e reserva espaço no conteúdo; limpeza ao desmontar ou mudar para desktop evita espaçamento residual. A edição de dados sai do modo fixo enquanto o formulário está aberto. Modais e avisos permanecem acima desses painéis.

A navegação mobile informa a aba ativa por aria-current e cor. Os mesmos SVGs locais são usados como máscaras para receber as cores ativa e neutra, preservando a geometria dos ícones. Perfil, carteiras e pedidos pertencem à aba Perfil; Favoritos usa sua própria aba. Nome de usuário fica alinhado à esquerda por preferência explícita do usuário, mesmo com o placeholder centralizado na referência.

O rascunho de checkout acompanha os valores atualizados por uma assinatura do React Hook Form, com cancelamento ao desmontar. A gravação não depende da ordem entre o onChange do campo e um handler do formulário pai. Isso preserva a última alteração digitada na expiração da sessão, inclusive ao editar os dados a partir da revisão mobile.
