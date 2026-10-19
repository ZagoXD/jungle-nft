import { responsiveImage } from '../lib/images'
import { useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Collector, Network, Order, OrderInput, Quote } from '../domain/contracts'
import { api, errorMessage, fieldErrors, statusOf } from '../lib/api'
import { useCart, useQuote, useSession, useWallets } from '../lib/state'
import { EmptyState, ErrorState, PageHeading, Skeleton } from '../components/shared'
import { Button } from '../components/ui/button'
import { Dialog } from '../components/ui/dialog'
import { Field } from '../components/forms'
import { CouponForm, QuoteSummary } from './cart'
import { formatEth } from '../domain/money'

interface Attempt {
  key: string
  input: OrderInput
  orderId?: string
}
function loadAttempt(userId: string): Attempt | null {
  try {
    return JSON.parse(localStorage.getItem(`kurio.attempt:${userId}`) ?? 'null') as Attempt | null
  } catch {
    return null
  }
}
function loadDraft(userId: string): Partial<Collector> {
  try {
    return JSON.parse(
      sessionStorage.getItem(`kurio.checkout:${userId}`) ?? '{}',
    ) as Partial<Collector>
  } catch {
    return {}
  }
}
export function CheckoutPage() {
  const { user, notice } = useSession(),
    navigate = useNavigate(),
    client = useQueryClient(),
    userId = user!.id
  const cart = useCart(),
    wallets = useWallets(),
    [network, setNetwork] = useState<Network>('Ethereum'),
    quote = useQuote(network)
  const [walletId, setWalletId] = useState(''),
    [collectorOpen, setCollectorOpen] = useState(false),
    [connectedWallet, setConnectedWallet] = useState(''),
    [connectOpen, setConnectOpen] = useState(false)
  const wallet =
    wallets.data?.find((wallet) => wallet.id === walletId) ??
    wallets.data?.find((wallet) => wallet.primary && wallet.network === network) ??
    wallets.data?.find((wallet) => wallet.network === network)
  const [review, setReview] = useState<Quote | null>(null),
    [reviewData, setReviewData] = useState<Collector | null>(null),
    [reviewChanged, setReviewChanged] = useState(false)
  const [attempt, setAttempt] = useState<Attempt | null>(() => loadAttempt(userId)),
    sending = useRef(false)
  const form = useForm<Collector>({
    defaultValues: {
      name: user!.name,
      email: user!.email,
      username: user!.username,
      profileName: user!.name,
      walletAddress: '',
      secondaryAddress: '',
      walletType: 'MetaMask',
      referral: 'KURIO',
      ens: user!.ens ?? `${user!.username}.eth`,
      note: '',
      ...loadDraft(userId),
    },
  })
  const errors = form.formState.errors
  const saveDraft = () =>
    sessionStorage.setItem(`kurio.checkout:${userId}`, JSON.stringify(form.getValues()))
  const connection = useMutation({
    mutationFn: async (action: 'connect' | 'decline' | 'disconnect') =>
      (
        await api.post<{ walletId: string; connected: boolean }>(
          `/wallets/${wallet?.id}/connection`,
          { action },
        )
      ).data,
    onSuccess: (result) => {
      setConnectedWallet(result.connected ? result.walletId : '')
      setConnectOpen(false)
      notice(result.connected ? 'Carteira conectada na simulação.' : 'Carteira desconectada.')
    },
    onError: (error) => {
      setConnectedWallet('')
      setConnectOpen(false)
      notice(errorMessage(error))
    },
  })
  const place = useMutation({
    mutationFn: async (current: Attempt) =>
      (
        await api.post<Order>('/orders', current.input, {
          headers: { 'Idempotency-Key': current.key },
        })
      ).data,
    onSuccess: (order) => {
      const saved = { ...loadAttempt(userId)!, orderId: order.id }
      localStorage.setItem(`kurio.attempt:${userId}`, JSON.stringify(saved))
      setAttempt(saved)
      setReview(null)
      void client.invalidateQueries({ queryKey: ['orders'] })
      void navigate({ to: '/pedido/$id', params: { id: order.id } })
    },
    onError: (error) => {
      if ([409, 422].includes(statusOf(error) ?? 0)) {
        localStorage.removeItem(`kurio.attempt:${userId}`)
        setAttempt(null)
        setReview(null)
        void client.invalidateQueries({ queryKey: ['quote'] })
        for (const [name, message] of Object.entries(fieldErrors(error)))
          form.setError(name as keyof Collector, { message })
      }
      notice(errorMessage(error))
    },
    onSettled: () => {
      sending.current = false
    },
  })
  const reviewing = useMutation({
    mutationFn: async (data: Collector) => {
      if (!wallet || connectedWallet !== wallet.id)
        throw new Error('Conecte uma carteira da rede selecionada antes de revisar.')
      const fresh = (await api.post<Quote>('/quote', { network })).data
      setReviewData({ ...data, walletAddress: wallet.address })
      setReview(fresh)
      setReviewChanged(false)
      return fresh
    },
    onError: (error) => notice(errorMessage(error)),
  })
  async function confirm() {
    if (sending.current || !review || !reviewData || !wallet || connectedWallet !== wallet.id)
      return
    sending.current = true
    try {
      const fresh = (await api.post<Quote>('/quote', { network })).data
      if (fresh.fingerprint !== review.fingerprint) {
        setReview(fresh)
        setReviewChanged(true)
        notice('A cotação mudou. Confira o novo total e confirme novamente.')
        sending.current = false
        return
      }
      const current: Attempt = {
        key: crypto.randomUUID(),
        input: { quoteId: fresh.id, collector: reviewData, walletId: wallet.id, network },
      }
      localStorage.setItem(`kurio.attempt:${userId}`, JSON.stringify(current))
      setAttempt(current)
      place.mutate(current)
    } catch (error) {
      sending.current = false
      setReview(null)
      notice(errorMessage(error))
      void client.invalidateQueries({ queryKey: ['quote'] })
    }
  }
  if (attempt)
    return (
      <>
        <PageHeading title="Recuperar pagamento" />
        <div className="state-box">
          <h2>Uma tentativa de compra está em andamento</h2>
          <p>Recupere o estado desta tentativa com a mesma chave, sem criar outro pedido.</p>
          {place.isError && (
            <p role="alert" className="field-error">
              {errorMessage(place.error)}
            </p>
          )}
          <Button
            disabled={place.isPending}
            onClick={() => {
              if (sending.current) return
              sending.current = true
              if (attempt.orderId)
                void navigate({ to: '/pedido/$id', params: { id: attempt.orderId } })
              else place.mutate(attempt)
            }}
          >
            {place.isPending ? 'Recuperando…' : 'Recuperar tentativa'}
          </Button>
        </div>
      </>
    )
  return (
    <>
      <PageHeading title="Pagamento" compact />
      {cart.isPending || wallets.isPending ? (
        <Skeleton type="detail" />
      ) : cart.isError || wallets.isError ? (
        <ErrorState
          error={cart.error ?? wallets.error}
          retry={() => {
            void cart.refetch()
            void wallets.refetch()
          }}
        />
      ) : !cart.data.items.length ? (
        <EmptyState
          title="Seu carrinho está vazio"
          action={
            <Button asChild>
              <Link to="/">Explorar NFTs</Link>
            </Button>
          }
        />
      ) : (
        <div className="checkout-layout">
          <section className="collector-section" data-expanded={collectorOpen}>
            <h1>Perfil do colecionador</h1>
            <Button
              type="button"
              variant="outline"
              className="collector-toggle full-width"
              aria-expanded={collectorOpen}
              aria-controls="collector-form"
              onClick={() => setCollectorOpen(!collectorOpen)}
            >
              {collectorOpen ? 'Ocultar dados do colecionador' : 'Dados do colecionador'}
            </Button>
            <form
              id="collector-form"
              className="stack"
              noValidate
              onChange={saveDraft}
              onSubmit={(event) => {
                if (wallet) form.setValue('walletAddress', wallet.address)
                void form.handleSubmit(
                  (data) => {
                    saveDraft()
                    reviewing.mutate(data)
                  },
                  (invalid) => {
                    setCollectorOpen(true)
                    requestAnimationFrame(() =>
                      form.setFocus(Object.keys(invalid)[0] as keyof Collector),
                    )
                  },
                )(event)
              }}
            >
              <div className="form-grid">
                <Field
                  label="Nome de exibição"
                  required
                  autoComplete="name"
                  error={errors.name?.message}
                  {...form.register('name', {
                    required: 'Informe seu nome.',
                    minLength: { value: 3, message: 'Use ao menos 3 caracteres.' },
                  })}
                />
                <Field
                  label="Nome de usuário"
                  required
                  error={errors.username?.message}
                  {...form.register('username', {
                    required: 'Informe o usuário.',
                    pattern: {
                      value: /^\w{3,24}$/,
                      message: 'Use de 3 a 24 letras, números ou sublinhado.',
                    },
                  })}
                />
                <div className="field">
                  <label htmlFor="checkout-network">
                    Rede <span className="required">*</span>
                  </label>
                  <select
                    id="checkout-network"
                    value={network}
                    onChange={(event) => {
                      setNetwork(event.target.value as Network)
                      setWalletId('')
                      setConnectedWallet('')
                      setReview(null)
                    }}
                  >
                    <option>Ethereum</option>
                    <option>Polygon</option>
                  </select>
                </div>
                <Field
                  label="Nome do perfil"
                  required
                  error={errors.profileName?.message}
                  {...form.register('profileName', {
                    required: 'Informe o nome do perfil.',
                    minLength: { value: 2, message: 'Use ao menos 2 caracteres.' },
                  })}
                />
                <Field
                  label="Endereço da carteira"
                  required
                  readOnly
                  value={wallet?.address ?? ''}
                  aria-describedby="address-help"
                />
                <Field
                  label="ENS ou carteira secundária (opcional)"
                  error={errors.secondaryAddress?.message}
                  {...form.register('secondaryAddress', {
                    validate: (value) =>
                      !value ||
                      /^0x[\da-fA-F]{40}$/.test(value) ||
                      /^[\w-]+\.eth$/.test(value) ||
                      'Informe endereço 0x ou nome .eth.',
                  })}
                />
                <div className="field">
                  <label htmlFor="wallet-type">
                    Tipo de carteira <span className="required">*</span>
                  </label>
                  <select id="wallet-type" {...form.register('walletType')}>
                    <option>MetaMask</option>
                    <option>WalletConnect</option>
                    <option>Coinbase Wallet</option>
                  </select>
                </div>
                <Field
                  label="Código de indicação"
                  required
                  error={errors.referral?.message}
                  {...form.register('referral', {
                    required: 'Informe o código.',
                    pattern: {
                      value: /^[\w-]{3,30}$/,
                      message: 'Use de 3 a 30 letras ou números.',
                    },
                  })}
                />
                <Field
                  label="E-mail"
                  type="email"
                  autoComplete="email"
                  required
                  error={errors.email?.message}
                  {...form.register('email', {
                    required: 'Informe seu e-mail.',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-mail inválido.' },
                  })}
                />
                <Field
                  label="Nome ENS"
                  required
                  error={errors.ens?.message}
                  {...form.register('ens', {
                    required: 'Informe o nome ENS.',
                    pattern: {
                      value: /^[\w-]{3,30}\.eth$/,
                      message: 'Informe um nome terminado em .eth.',
                    },
                  })}
                />
              </div>
              <p className="muted" id="address-help">
                O endereço é preenchido pela carteira cadastrada selecionada.
              </p>
              <Link className="text-button" to="/carteiras">
                Usar outra carteira?
              </Link>
              <div className="field">
                <label htmlFor="collector-note">Observação do colecionador (opcional)</label>
                <textarea
                  id="collector-note"
                  rows={6}
                  maxLength={1000}
                  {...form.register('note')}
                />
              </div>
            </form>
          </section>
          <aside className="checkout-summary">
            <div className="checkout-costs">
              <h2>Seus NFTs</h2>
              {quote.isPending ? (
                <Skeleton type="summary" />
              ) : quote.isError ? (
                <ErrorState error={quote.error} retry={() => void quote.refetch()} />
              ) : (
                <>
                  <div className="checkout-items">
                    {quote.data.lines.map((line) => (
                      <article key={`${line.nftId}:${line.editionId}`}>
                        <img
                          {...responsiveImage(line.image, '70px')}
                          src={line.image}
                          alt={line.name}
                          width="70"
                          height="70"
                        />
                        <div>
                          <strong>{line.name}</strong>
                          <small>
                            {line.edition} (× {line.quantity})
                          </small>
                        </div>
                        <strong className="price">{formatEth(line.total)} ETH</strong>
                      </article>
                    ))}
                  </div>
                  <CouponForm />
                  <QuoteSummary quote={quote.data} />
                </>
              )}
            </div>
            <div className="checkout-wallets">
              <h2>Carteira e rede</h2>
              {wallets.data.length ? (
                <fieldset className="wallet-selector">
                  <legend className="sr-only">Carteiras cadastradas</legend>
                  {wallets.data
                    .filter((value) => value.network === network)
                    .map((value) => (
                      <label className={wallet?.id === value.id ? 'selected' : ''} key={value.id}>
                        <input
                          type="radio"
                          name="wallet"
                          checked={wallet?.id === value.id}
                          onChange={() => {
                            setWalletId(value.id)
                            setConnectedWallet('')
                          }}
                        />
                        <span>
                          <strong>{value.primary ? 'Principal' : value.name}</strong>
                          <small>
                            {value.address.slice(0, 8)}…{value.address.slice(-4)}
                            <br />
                            Rede {value.network}
                          </small>
                        </span>
                      </label>
                    ))}
                </fieldset>
              ) : (
                <p>Nenhuma carteira cadastrada.</p>
              )}
              {!wallet && (
                <Button asChild variant="outline">
                  <Link to="/carteiras">Cadastrar carteira {network}</Link>
                </Button>
              )}
              {wallet && (
                <div className="wallet-connection">
                  <p>
                    {connectedWallet === wallet.id
                      ? 'Carteira conectada (simulação)'
                      : 'Conexão necessária'}
                  </p>
                  <Button
                    id="wallet-connection-control"
                    variant="outline"
                    className="full-width"
                    disabled={connection.isPending}
                    onClick={() =>
                      connectedWallet === wallet.id
                        ? connection.mutate('disconnect')
                        : setConnectOpen(true)
                    }
                  >
                    {connectedWallet === wallet.id ? 'Desconectar carteira' : 'Conectar carteira'}
                  </Button>
                </div>
              )}
            </div>
            {reviewing.isError && (
              <p role="alert" className="field-error">
                {errorMessage(reviewing.error)}
              </p>
            )}
            <Button
              type="submit"
              form="collector-form"
              className="full-width review-button"
              disabled={
                reviewing.isPending ||
                quote.isError ||
                quote.isPending ||
                connectedWallet !== wallet?.id
              }
            >
              {reviewing.isPending ? 'Revalidando…' : 'Revisar compra'}
            </Button>
            <p className="simulation-note">Demonstração: nenhum pagamento real será realizado.</p>
          </aside>
        </div>
      )}
      <Dialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        title="Conectar carteira"
        returnFocusId="wallet-connection-control"
        description="Escolha a resposta da carteira simulada. Nenhuma extensão será aberta."
      >
        <div className="stack">
          <Button disabled={connection.isPending} onClick={() => connection.mutate('connect')}>
            Autorizar conexão simulada
          </Button>
          <Button
            variant="outline"
            disabled={connection.isPending}
            onClick={() => connection.mutate('decline')}
          >
            Recusar conexão
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={!!review}
        onOpenChange={(open) => {
          if (!open && !place.isPending) setReview(null)
        }}
        title="Revise sua compra"
        description="Confira os itens e valores antes de enviar o pedido simulado."
      >
        {review && (
          <>
            <p>
              {reviewData?.name} · {reviewData?.email}
            </p>
            <p>
              {wallet?.name} · {network}
            </p>
            {review.lines.map((line) => (
              <p key={`${line.nftId}:${line.editionId}`}>
                {line.name} × {line.quantity}
              </p>
            ))}
            {(reviewChanged || (quote.data && quote.data.fingerprint !== review.fingerprint)) && (
              <p role="alert" className="field-error">
                A cotação mudou. Revise os novos valores e confirme novamente.
              </p>
            )}
            <QuoteSummary quote={review} />
            <Button
              className="full-width"
              onClick={() => void confirm()}
              disabled={place.isPending}
            >
              {place.isPending ? 'Enviando…' : 'Confirmar compra'}
            </Button>
          </>
        )}
      </Dialog>
    </>
  )
}
