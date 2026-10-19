import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Scenario } from '../domain/contracts'
import { api, errorMessage } from '../lib/api'
import { useSession } from '../lib/state'
import { ErrorState, PageHeading } from '../components/shared'
import { Button } from '../components/ui/button'
import { Field } from '../components/forms'

const scenarios: Record<string, Partial<Scenario>> = {
  Sucesso: {
    latency: 80,
    empty: false,
    offline: false,
    variableLatency: false,
    failNext: '',
    payment: 'confirmed',
    timeoutAfterCreate: false,
    orderDelay: 1800,
    couponExpired: false,
    networkFee: null,
  },
  'Catálogo vazio': { empty: true },
  'Rede lenta': { latency: 1800 },
  'Respostas fora de ordem': { variableLatency: true },
  'Sem conexão': { offline: true },
  'Falha no próximo favorito': { failNext: 'PUT /api/favorites', status: 503 },
  'Pagamento recusado': { payment: 'declined' },
  'Pedido pendente por 60 s': { orderDelay: 60_000 },
  'Timeout após criar pedido': { timeoutAfterCreate: true },
  'Cupom expirou durante a compra': { couponExpired: true },
  'Taxa de rede alterada': { networkFee: '0.005' },
}
export function DemoPage() {
  const { user, notice } = useSession(),
    client = useQueryClient(),
    [scenario, setScenario] = useState('Sucesso'),
    [price, setPrice] = useState('2'),
    [stock, setStock] = useState('2')
  const query = useQuery({
    queryKey: ['demo'],
    queryFn: async () => (await api.get<{ scenario: Scenario }>('/demo')).data,
  })
  const action = useMutation({
    mutationFn: async ({
      path,
      data,
      method = 'post',
    }: {
      path: string
      data?: unknown
      method?: string
    }) => (await api.request({ method, url: path, data })).data,
    onSuccess: async () => {
      notice('Condição da demonstração atualizada.')
      await client.invalidateQueries()
    },
    onError: (error) => notice(errorMessage(error)),
  })
  return (
    <>
      <PageHeading
        title="Cenários da demonstração"
        subtitle="Controle a simulação pela rede e reproduza as condições de avaliação."
      />
      <div className="demo-grid">
        <section className="stack">
          <label htmlFor="scenario">Condição a simular</label>
          <select
            id="scenario"
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
          >
            {Object.keys(scenarios).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <Button
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                path: '/demo',
                method: 'patch',
                data: { ...scenarios[scenario], name: scenario },
              })
            }
          >
            Aplicar cenário
          </Button>
          <p className="muted">
            Para retomar as condições normais, escolha Sucesso. Os controles continuam acessíveis
            mesmo com a simulação sem conexão.
          </p>
          <h2>Alteração em tempo real</h2>
          <Field
            label="Novo preço de Emerald Ape (ETH)"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
          />
          <Field
            label="Novo estoque da edição padrão"
            type="number"
            min="0"
            step="1"
            value={stock}
            onChange={(event) => setStock(event.target.value)}
          />
          <Button
            disabled={action.isPending}
            onClick={() =>
              action.mutate({
                path: '/demo/nft',
                data: { id: 'nft-1', price, stock: Number(stock) },
              })
            }
          >
            Atualizar NFT e emitir evento
          </Button>
        </section>
        <section className="stack">
          <h2>Sessão e pedidos</h2>
          <Button
            variant="outline"
            disabled={!user || action.isPending}
            onClick={() => action.mutate({ path: '/session/expire' })}
          >
            Expirar sessão atual
          </Button>
          <Button
            variant="outline"
            disabled={action.isPending}
            onClick={() => action.mutate({ path: '/demo/disconnect' })}
          >
            Interromper conexão de tempo real
          </Button>
          <Button
            variant="outline"
            disabled={action.isPending}
            onClick={() => action.mutate({ path: '/demo/settle' })}
          >
            Resolver pedidos pendentes
          </Button>
          <h2>Restaurar demonstração</h2>
          <p>
            Restaura catálogo, contas fictícias, carrinhos, favoritos, carteiras e pedidos. Use para
            iniciar uma avaliação independente.
          </p>
          <Button
            variant="outline"
            disabled={action.isPending}
            onClick={() =>
              action.mutate(
                { path: '/demo/reset', data: {} },
                {
                  onSuccess: () => {
                    for (const key of Object.keys(localStorage))
                      if (key.startsWith('kurio.')) localStorage.removeItem(key)
                    for (const key of Object.keys(sessionStorage))
                      if (key.startsWith('kurio.')) sessionStorage.removeItem(key)
                    location.href = '/'
                  },
                },
              )
            }
          >
            Restaurar todos os dados fictícios
          </Button>
        </section>
      </div>
      {query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <details className="demo-details">
            <summary>Configuração ativa</summary>
            <pre>{JSON.stringify(query.data.scenario, null, 2)}</pre>
          </details>
        )
      )}
    </>
  )
}
