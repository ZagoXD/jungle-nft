import { responsiveImage } from '../lib/images'
import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { CartItem, Nft, Quote } from '../domain/contracts'
import { formatEth, multiplyEth } from '../domain/money'
import { api } from '../lib/api'
import { useApiMutation, useCart, useQuote } from '../lib/state'
import { EmptyState, ErrorState, PageHeading, Skeleton } from '../components/shared'
import { Button } from '../components/ui/button'
import { Dialog } from '../components/ui/dialog'
import { RelatedNfts } from './detail'

export function CouponForm() {
  const cart = useCart(),
    [coupon, setCoupon] = useState('')
  const apply = useApiMutation<{ coupon: string }>(
      'put',
      '/cart/coupon',
      ['cart', 'quote'],
      'Cupom aplicado.',
    ),
    remove = useApiMutation('delete', '/cart/coupon', ['cart', 'quote'], 'Cupom removido.')
  return (
    <div className="coupon">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          apply.mutate({ coupon })
        }}
      >
        <label htmlFor="coupon">Código promocional</label>
        <div className="inline">
          <input
            id="coupon"
            placeholder="Digite o código promocional..."
            value={coupon}
            onChange={(event) => setCoupon(event.target.value)}
            aria-describedby={apply.isError ? 'coupon-error' : undefined}
          />
          <Button size="sm" disabled={apply.isPending || !coupon.trim()}>
            Aplicar
          </Button>
        </div>
      </form>
      {apply.isError && (
        <p id="coupon-error" className="field-error" role="alert">
          {apply.error && 'Cupom inválido ou expirado. Confira o código e tente novamente.'}
        </p>
      )}
      {cart.data?.coupon && (
        <div className="coupon-applied">
          <span>{cart.data.coupon} aplicado</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            Remover cupom
          </Button>
        </div>
      )}
    </div>
  )
}
export function QuoteSummary({ quote, children }: { quote: Quote; children?: ReactNode }) {
  return (
    <>
      <dl className="quote-values">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatEth(quote.subtotal)} ETH</dd>
        </div>
        <div>
          <dt>Desconto do lançamento</dt>
          <dd>− {formatEth(quote.discount)} ETH</dd>
        </div>
        <div>
          <dt>Taxa de rede</dt>
          <dd>{formatEth(quote.fee)} ETH</dd>
        </div>
        <div className="quote-total">
          <dt>Total</dt>
          <dd data-testid="quote-total">{formatEth(quote.total)} ETH</dd>
        </div>
      </dl>
      {children}
    </>
  )
}
function CartLine({ item }: { item: CartItem }) {
  const nft = useQuery({
    queryKey: ['nft', item.nftId],
    queryFn: async ({ signal }) => (await api.get<Nft>(`/nfts/${item.nftId}`, { signal })).data,
  })
  const [removeOpen, setRemoveOpen] = useState(false)
  const change = useApiMutation<{ quantity: number }>(
      'patch',
      `/cart/items/${item.nftId}/${item.editionId}`,
      ['cart', 'quote'],
      'Quantidade atualizada.',
    ),
    remove = useApiMutation(
      'delete',
      `/cart/items/${item.nftId}/${item.editionId}`,
      ['cart', 'quote'],
      'Item removido do carrinho.',
    )
  if (nft.isPending)
    return (
      <div className="cart-line">
        <Skeleton type="summary" />
      </div>
    )
  if (nft.isError)
    return (
      <div className="cart-line">
        <ErrorState error={nft.error} retry={() => void nft.refetch()} />
        <Button variant="outline" onClick={() => remove.mutate()}>
          Remover item indisponível
        </Button>
      </div>
    )
  const value = nft.data,
    edition = value.editions.find((edition) => edition.id === item.editionId),
    outOfStock = !edition || item.quantity > edition.stock
  return (
    <article
      className={`cart-line ${outOfStock ? 'unavailable' : ''}`}
      aria-label={`${value.name}, ${edition?.name ?? item.editionId}`}
    >
      <div className="cart-product">
        <Link to="/nft/$id" params={{ id: item.nftId }}>
          <img
            {...responsiveImage(value.image, '70px')}
            src={value.image}
            alt={value.name}
            width="70"
            height="70"
          />
        </Link>
        <div>
          <Link to="/nft/$id" params={{ id: item.nftId }}>
            <h2>{value.name}</h2>
          </Link>
          <p>ID do token: #{item.nftId.replace('nft-', '').padStart(4, '0')}</p>
          <small>{edition?.name}</small>
          {outOfStock && (
            <p role="alert" className="field-error">
              Disponibilidade: {edition?.stock ?? 0}. Ajuste a quantidade ou remova o item.
            </p>
          )}
        </div>
      </div>
      <p className="unit-price">{formatEth(value.price)} ETH</p>
      <div className="quantity-control">
        <button
          aria-label={`Diminuir quantidade de ${value.name}`}
          disabled={item.quantity <= 1 || change.isPending}
          onClick={() => change.mutate({ quantity: item.quantity - 1 })}
        >
          −
        </button>
        <span aria-label={`Quantidade de ${value.name}`}>{item.quantity}</span>
        <button
          aria-label={`Aumentar quantidade de ${value.name}`}
          disabled={item.quantity >= (edition?.stock ?? 0) || change.isPending}
          onClick={() => change.mutate({ quantity: item.quantity + 1 })}
        >
          +
        </button>
      </div>
      <p className="price line-total">{formatEth(multiplyEth(value.price, item.quantity))} ETH</p>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remover ${value.name}`}
        onClick={() => setRemoveOpen(true)}
      >
        <img src="/images/vectors/browser-delete-16-463.svg" alt="" width="24" height="24" />
      </Button>
      <Dialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remover NFT?"
        description={`${value.name} será removido do seu carrinho.`}
      >
        <div className="inline">
          <Button variant="outline" onClick={() => setRemoveOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={remove.isPending}
            onClick={() => remove.mutate(undefined, { onSuccess: () => setRemoveOpen(false) })}
          >
            Remover item
          </Button>
        </div>
      </Dialog>
    </article>
  )
}
export function CartPage() {
  const cart = useCart(),
    quote = useQuote()
  return (
    <>
      <PageHeading title="Carrinho de NFTs" compact />
      {cart.isPending ? (
        <Skeleton type="detail" />
      ) : cart.isError ? (
        <ErrorState error={cart.error} retry={() => void cart.refetch()} />
      ) : !cart.data.items.length ? (
        <EmptyState
          title="Seu carrinho está vazio"
          description="Encontre uma obra que conte a sua história."
          action={
            <Button asChild>
              <Link to="/" hash="catalogo">
                Explorar NFTs
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="cart-layout">
          <section aria-label="Itens do carrinho">
            <div className="cart-table-heading">
              <span>NFTs</span>
              <span>Preço</span>
              <span>Edições</span>
              <span>Total</span>
              <span />
            </div>
            <div className="cart-lines">
              {cart.data.items.map((item) => (
                <CartLine key={`${item.nftId}:${item.editionId}`} item={item} />
              ))}
            </div>
          </section>
          <aside className="cart-summary">
            <h2>Resumo da carteira</h2>
            <CouponForm />
            {quote.isPending ? (
              <Skeleton type="summary" />
            ) : quote.isError ? (
              <ErrorState error={quote.error} retry={() => void quote.refetch()} />
            ) : (
              <QuoteSummary quote={quote.data}>
                <Button asChild className="full-width">
                  <Link to="/pagamento">Conectar e finalizar</Link>
                </Button>
                <Link className="continue-link" to="/" hash="catalogo">
                  Continuar explorando
                </Link>
              </QuoteSummary>
            )}
          </aside>
        </div>
      )}
      <RelatedNfts />
    </>
  )
}
