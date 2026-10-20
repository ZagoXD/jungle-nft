import { responsiveImage } from '../lib/images'
import { useEffect } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Catalog, Order } from '../domain/contracts'
import { api } from '../lib/api'
import { usePrivateQuery, useSession } from '../lib/state'
import { formatEth } from '../domain/money'
import {
  tokenId,
  EmptyState,
  ErrorState,
  NftCard,
  PageHeading,
  Skeleton,
} from '../components/shared'
import { Button } from '../components/ui/button'
import { QuoteSummary } from './cart'
import { AccountLayout } from './account'

export function OrderPage() {
  const { id } = useParams({ strict: false }),
    { user, notice } = useSession(),
    client = useQueryClient()
  const order = useQuery({
    queryKey: ['order', user!.id, id],
    queryFn: async ({ signal }) => (await api.get<Order>(`/orders/${id}`, { signal })).data,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 1500 : false),
  })
  useEffect(() => {
    if (order.data && order.data.status !== 'pending') {
      localStorage.removeItem(`kurio.attempt:${user!.id}`)
      void client.invalidateQueries({ queryKey: ['cart'] })
      void client.invalidateQueries({ queryKey: ['quote'] })
    }
  }, [order.data?.id, order.data?.status, user?.id, client])
  if (order.isPending) return <Skeleton type="detail" />
  if (order.isError) return <ErrorState error={order.error} retry={() => void order.refetch()} />
  const value = order.data
  if (value.status === 'pending')
    return (
      <>
        <PageHeading title="Pedido em processamento" />
        <div className="state-box">
          <h2>Aguardando confirmação</h2>
          <p>Pedido {value.id}. Estamos processando seu pagamento.</p>
          <p>Você pode recarregar esta página ou voltar depois. Não será criado outro pedido.</p>
          <Skeleton type="summary" />
          <Button variant="outline" onClick={() => void order.refetch()}>
            Consultar estado
          </Button>
        </div>
      </>
    )
  if (value.status === 'declined')
    return (
      <>
        <PageHeading title="Pagamento recusado" />
        <div className="state-box" role="alert">
          <h2>Não foi possível confirmar o pagamento</h2>
          <p>Pedido {value.id} recusado. Os itens foram preservados no carrinho.</p>
          <Button asChild>
            <Link to="/carrinho">Voltar ao carrinho</Link>
          </Button>
        </div>
      </>
    )
  return (
    <article className="receipt">
      <Link className="receipt-close" to="/" aria-label="Fechar confirmação">
        ×
      </Link>
      <div className="receipt-heading">
        <img src="/images/vectors/thank-you-1-88.svg" alt="" width="80" height="80" />
        <h1>Seus NFTs agora estão na sua carteira</h1>
      </div>
      <dl className="receipt-meta">
        <div>
          <dt>ID da transação</dt>
          <dd title={value.transaction ?? value.id}>
            {value.transaction
              ? `${value.transaction.slice(0, 6)}…${value.transaction.slice(-4)}`
              : value.id}
          </dd>
        </div>
        <div>
          <dt>Data</dt>
          <dd>{new Date(value.createdAt).toLocaleDateString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatEth(value.quote.total)} ETH</dd>
        </div>
        <div>
          <dt>Carteira</dt>
          <dd>{value.wallet.name}</dd>
        </div>
      </dl>
      <div className="receipt-body">
        <h2>Detalhes da transação</h2>
        <div className="receipt-items-heading">
          <span>NFTs</span>
          <span>Edições</span>
          <span>Subtotal</span>
        </div>
        <div className="receipt-items">
          {value.quote.lines.map((line) => (
            <article key={`${line.nftId}:${line.editionId}`}>
              <img
                {...responsiveImage(line.image, '70px')}
                src={line.image}
                alt={line.name}
                width="70"
                height="70"
              />
              <div>
                <h3>{line.name}</h3>
                <p>ID do token: #{tokenId(line.name)}</p>
              </div>
              <span className="receipt-quantity">(× {line.quantity})</span>
              <strong className="price">{formatEth(line.total)} ETH</strong>
            </article>
          ))}
        </div>
        <QuoteSummary quote={value.quote} receipt />
        <p className="receipt-message">
          Transação confirmada na {value.wallet.network} de testes. A propriedade foi transferida
          para sua carteira conectada e registrada na rede de testes.
        </p>
        <Button
          onClick={() =>
            notice('Estamos preparando a consulta no explorador. Os detalhes estão neste recibo.')
          }
        >
          Ver no Etherscan
        </Button>
      </div>
    </article>
  )
}
export function OrdersPage() {
  const orders = usePrivateQuery<Order[]>('orders')
  return (
    <AccountLayout>
      <h1>Meus pedidos</h1>
      {orders.isPending ? (
        <Skeleton type="summary" />
      ) : orders.isError ? (
        <ErrorState error={orders.error} retry={() => void orders.refetch()} />
      ) : !orders.data.length ? (
        <EmptyState
          title="Sua coleção começa aqui"
          description="Você ainda não realizou uma compra."
          action={
            <Button asChild>
              <Link to="/">Explorar NFTs</Link>
            </Button>
          }
        />
      ) : (
        <div className="stack">
          {orders.data.map((order) => (
            <Link
              className="order-list-item"
              key={order.id}
              to="/pedido/$id"
              params={{ id: order.id }}
            >
              <strong>{order.id}</strong>
              <span>
                {order.status === 'confirmed'
                  ? 'Confirmado'
                  : order.status === 'declined'
                    ? 'Recusado'
                    : 'Pendente'}
              </span>
              <span>{formatEth(order.quote.total)} ETH</span>
            </Link>
          ))}
        </div>
      )}
    </AccountLayout>
  )
}
export function FavoritesPage() {
  const favorites = usePrivateQuery<string[]>('favorites')
  const catalog = useQuery({
    queryKey: ['catalog', 'all-favorites'],
    queryFn: async ({ signal }) => {
      const first = (await api.get<Catalog>('/nfts', { signal })).data
      const rest = await Promise.all(
        Array.from({ length: first.pages - 1 }, (_, i) =>
          api.get<Catalog>('/nfts', { params: { page: i + 2 }, signal }),
        ),
      )
      return [...first.items, ...rest.flatMap((response) => response.data.items)]
    },
  })
  return (
    <AccountLayout>
      <h1>Lista de interesse</h1>
      {favorites.isPending || catalog.isPending ? (
        <Skeleton />
      ) : favorites.isError || catalog.isError ? (
        <ErrorState
          error={favorites.error ?? catalog.error}
          retry={() => {
            void favorites.refetch()
            void catalog.refetch()
          }}
        />
      ) : !favorites.data.length ? (
        <EmptyState
          title="Salve suas próximas descobertas"
          description="Favorite NFTs para encontrá-los aqui."
          action={
            <Button asChild>
              <Link to="/">Explorar NFTs</Link>
            </Button>
          }
        />
      ) : (
        <div className="nft-grid">
          {catalog.data
            .filter((nft) => favorites.data.includes(nft.id))
            .map((nft) => (
              <NftCard key={nft.id} nft={nft} favorite />
            ))}
        </div>
      )}
    </AccountLayout>
  )
}
