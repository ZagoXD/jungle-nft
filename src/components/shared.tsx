import { responsiveImage } from '../lib/images'
import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Nft } from '../domain/contracts'
import { formatEth } from '../domain/money'
import { api, errorMessage } from '../lib/api'
import { useCart, usePrivateQuery, useSession } from '../lib/state'
import { Button } from './ui/button'
import { Dialog } from './ui/dialog'

export const art = [
  '/images/artwork/8459204731e6eba9d474cbc8ebc37071360d3ba5.png',
  '/images/artwork/2986a7cb16d09de8970824d2dd58bf0bb021702c.png',
  '/images/artwork/9df2ff42dd27ba657621c304557d1a855a4be6a5.png',
  '/images/artwork/87580f2def9af0ce13f4b6f6ce17bb2449bcfc16.png',
]
export const tokenId = (name: string) => (name.match(/#(\d+)/)?.[1] ?? '').padStart(4, '0')
export function Icon({ name }: { name: 'search' | 'cart' | 'login' | 'heart' | 'arrow' }) {
  const paths = {
    search: 'search-icon-2.svg',
    cart: 'cart-icon-3.svg',
    login: 'iconly-curved-logout-4.svg',
    heart: 'heart-1-29.svg',
    arrow: 'iconly-curved-arrow-right-9.svg',
  }
  return <img src={`/images/vectors/${paths[name]}`} alt="" aria-hidden="true" />
}
export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, connected, notice } = useSession(),
    cart = useCart(),
    location = useLocation()
  const [menu, setMenu] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [search, setSearch] = useState('')
  const navigate = useNavigate()
  const mobileTab =
    location.pathname === '/favoritos'
      ? 'favorites'
      : ['/perfil', '/carteiras', '/pedidos'].includes(location.pathname)
        ? 'profile'
        : location.pathname === '/carrinho'
          ? 'cart'
          : 'home'
  const nav = (
    <>
      <Link
        to="/"
        className={['/perfil', '/carteiras'].includes(location.pathname) ? 'active' : ''}
        activeProps={{ className: 'active' }}
        activeOptions={{ exact: true, includeHash: true, includeSearch: false }}
      >
        Início
      </Link>
      <Link
        to="/"
        hash="catalogo"
        activeOptions={{ includeHash: true }}
        className={
          ['/carrinho', '/pagamento'].includes(location.pathname) ||
          location.pathname.startsWith('/nft/')
            ? 'active'
            : ''
        }
      >
        Mercado
      </Link>
      <button
        onClick={() =>
          notice(
            'Estamos preparando este espaço para os criadores. Ele estará disponível em breve.',
          )
        }
      >
        Criadores
      </button>
      <button
        onClick={() => notice('Estamos preparando novos conteúdos para você. Volte em breve.')}
      >
        Aprenda
      </button>
    </>
  )
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header
        className={`site-header container ${location.pathname.startsWith('/pedido/') ? 'receipt-chrome' : ''}`}
      >
        <Link to="/" aria-label="Kurio, início">
          <img
            src="/images/vectors/logo-1.svg"
            alt="KURIO"
            className="logo"
            width="160"
            height="35"
          />
        </Link>
        <nav className="desktop-nav" aria-label="Principal">
          {nav}
        </nav>
        <div className="header-actions">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Buscar NFTs"
            onClick={() => setSearchOpen(true)}
          >
            <Icon name="search" />
          </Button>
          <Link
            to="/carrinho"
            className="cart-link"
            aria-label={`Carrinho, ${cart.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0} itens`}
          >
            <Icon name="cart" />
            <span className="cart-count">
              {cart.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0}
            </span>
          </Link>
          {user ? (
            <Link to="/perfil" className="account-link">
              {user.avatar && <img src={user.avatar} alt="" width="28" height="28" />}
              <span>{user.name.split(' ')[0]}</span>
            </Link>
          ) : (
            <Button asChild size="sm">
              <Link to="/login" search={{ next: location.href }}>
                <Icon name="login" />
                <span>Entrar</span>
              </Link>
            </Button>
          )}
          <Button
            className="mobile-menu-button"
            variant="ghost"
            size="icon"
            aria-label="Abrir menu"
            onClick={() => setMenu(true)}
          >
            ☰
          </Button>
        </div>
      </header>
      <div
        className={`mobile-page-header container ${location.pathname.startsWith('/pedido/') ? 'receipt-chrome' : ''}`}
      >
        {location.pathname !== '/' && (
          <>
            <Link to="/" aria-label="Voltar ao início">
              <img src="/images/vectors/browser-back-16-393.svg" alt="" width="35" height="35" />
            </Link>
            <span>
              {location.pathname.startsWith('/nft/')
                ? 'Detalhes do NFT'
                : location.pathname === '/carrinho'
                  ? 'Carrinho de NFTs'
                  : location.pathname === '/pagamento'
                    ? 'Pagamento com carteira'
                    : location.pathname === '/carteiras'
                      ? 'Minhas carteiras'
                      : location.pathname === '/perfil'
                        ? 'Meu perfil'
                        : 'Kurio'}
            </span>
          </>
        )}
      </div>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen} title="Encontre sua próxima coleção">
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault()
            setSearchOpen(false)
            void navigate({ to: '/', search: { q: search, page: 1 }, hash: 'catalogo' })
          }}
        >
          <label htmlFor="global-search">Buscar por NFT, coleção ou criador</label>
          <input
            id="global-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="O que você procura?"
          />
          <Button type="submit">Buscar</Button>
        </form>
      </Dialog>
      <Dialog open={menu} onOpenChange={setMenu} title="Explore a Kurio">
        <nav className="stack mobile-nav" onClick={() => setMenu(false)}>
          {nav}
          <Link to="/perfil">Meu perfil</Link>
          <Link to="/carteiras">Carteiras</Link>
          {user && <button onClick={() => void logout()}>Sair da conta</button>}
        </nav>
      </Dialog>
      <main id="conteudo" className="container" tabIndex={-1}>
        {children}
      </main>
      {!['/perfil', '/carteiras'].includes(location.pathname) &&
        !location.pathname.startsWith('/pedido/') && (
          <Footer purchase={['/carrinho', '/pagamento'].includes(location.pathname)} />
        )}
      {['/', '/perfil', '/favoritos', '/pedidos', '/carteiras'].includes(location.pathname) && (
        <nav className="bottom-nav" aria-label="Navegação mobile">
          <Link to="/" aria-label="Início" aria-current={mobileTab === 'home' ? 'page' : undefined}>
            <img src="/images/vectors/iconly-bold-home-156.svg" alt="" width="20" height="20" />
          </Link>
          <Link
            to="/favoritos"
            aria-label="Favoritos"
            aria-current={mobileTab === 'favorites' ? 'page' : undefined}
          >
            <img src="/images/vectors/browser-vector-15-5527.svg" alt="" width="20" height="18" />
          </Link>
          <Button
            className="scan-button"
            variant="ghost"
            aria-label="Explorar o catálogo"
            onClick={() => void navigate({ to: '/', hash: 'catalogo' })}
          >
            <img src="/images/vectors/browser-group-15-5529.svg" alt="" width="27" height="24" />
          </Button>
          <Link
            to="/carrinho"
            aria-label="Carrinho"
            aria-current={mobileTab === 'cart' ? 'page' : undefined}
          >
            <img src="/images/vectors/browser-vector-15-5525.svg" alt="" width="18" height="17" />
          </Link>
          <Link
            to="/perfil"
            aria-label="Perfil"
            aria-current={mobileTab === 'profile' ? 'page' : undefined}
          >
            <img src="/images/vectors/browser-vector-15-5523.svg" alt="" width="14" height="17" />
          </Link>
        </nav>
      )}
      <div
        className="connection-status"
        title={connected ? 'Socket.IO conectado' : 'Reconectando ao tempo real'}
        aria-label={connected ? 'Tempo real conectado' : 'Tempo real reconectando'}
      >
        <span className={connected ? 'online' : ''} />
        {connected ? 'Ao vivo' : 'Reconectando'}
      </div>
    </>
  )
}
function Footer({ purchase = false }: { purchase?: boolean }) {
  const { notice } = useSession()
  const outside = () =>
    notice('Ainda estamos trabalhando nesta página. Ela estará disponível em breve.')
  return (
    <footer className="site-footer container" data-purchase={purchase}>
      <section className="footer-benefits">
        <div>
          <span className="benefit-icon">W</span>
          <h3>Segurança da carteira</h3>
          <p>Proteja sua carteira e colecione arte digital verificada com confiança.</p>
        </div>
        <div>
          <span className="benefit-icon">C</span>
          <h3>Criadores em destaque</h3>
          <p>Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.</p>
        </div>
        <div>
          <span className="benefit-icon">D</span>
          <h3>Alertas de lançamentos</h3>
          <p>
            Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.
          </p>
        </div>
        <div>
          <h3>Antecipe-se ao próximo lançamento</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              notice('Estamos preparando os alertas por e-mail. Em breve você poderá se inscrever.')
            }}
          >
            <label className="sr-only" htmlFor="newsletter">
              Seu e-mail
            </label>
            <div className="inline newsletter-input">
              <input id="newsletter" type="email" required placeholder="digite seu e-mail..." />
              <Button size="sm">Enviar</Button>
            </div>
          </form>
          <p>Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
        </div>
      </section>
      <div className="footer-strip">
        <img src="/images/vectors/logo-11.svg" alt="KURIO" width="211" height="34" />
        <p>
          Feito para colecionadores,
          <br /> criadores e cultura
        </p>
        <a href="mailto:contato@email.com">contato@email.com</a>
        <span>+55 11 4002 8922</span>
      </div>
      <div className="footer-links">
        <div>
          <h3>Meu perfil</h3>
          <Link to="/perfil">Meu perfil</Link>
          <Link to="/pedidos">Minha coleção</Link>
          <Link to="/pedidos">Atividade</Link>
          <button onClick={outside}>Estúdio do criador</button>
          <Link to="/favoritos">Lista de interesse</Link>
        </div>
        <div>
          <h3>Central de ajuda</h3>
          {[
            'Central de ajuda',
            'Como comprar NFTs',
            'Carteira e segurança',
            'Política do mercado',
            'Denunciar item',
          ].map((text) => (
            <button key={text} onClick={outside}>
              {text}
            </button>
          ))}
        </div>
        <div>
          <h3>Coleções</h3>
          {['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade'].map((category) => (
            <Link key={category} to="/" search={{ category }} hash="catalogo">
              {category}
            </Link>
          ))}
        </div>
        <div>
          <h3>Redes sociais</h3>
          <div className="socials">
            {[
              'frame-108-12.svg',
              'frame-109-13.svg',
              'frame-110-14.svg',
              'frame-111-15.svg',
              'frame-112-16.svg',
            ].map((image, i) => (
              <button
                key={image}
                onClick={outside}
                aria-label={['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'YouTube'][i]}
              >
                <img src={`/images/vectors/${image}`} alt="" />
              </button>
            ))}
          </div>
          <h3>Carteiras compatíveis</h3>
          <small className="wallet-badge">METAMASK · WALLETCONNECT · COINBASE</small>
        </div>
      </div>
    </footer>
  )
}
export function Skeleton({ type = 'cards' }: { type?: 'cards' | 'detail' | 'summary' }) {
  return (
    <div
      role="status"
      aria-label="Carregando conteúdo"
      className={`skeleton-layout skeleton-${type}`}
    >
      <span className="sr-only">Carregando…</span>
      {Array.from({ length: type === 'cards' ? 9 : type === 'detail' ? 2 : 4 }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  )
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="state-box" role="alert">
      <h2>Algo não saiu como esperado</h2>
      <p>{errorMessage(error)}</p>
      {retry && <Button onClick={retry}>Tentar novamente</Button>}
    </div>
  )
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="state-box">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}
export function PageHeading({
  title,
  subtitle,
  compact = false,
  market = false,
}: {
  title: string
  subtitle?: string
  compact?: boolean
  market?: boolean
}) {
  return (
    <div className={`page-heading ${compact ? 'page-heading-compact' : ''}`}>
      <nav aria-label="Navegação estrutural">
        <Link to="/">Início</Link>
        <span aria-hidden="true"> / </span>
        {market && (
          <>
            <Link to="/" hash="catalogo">
              Mercado
            </Link>
            <span aria-hidden="true"> / </span>
          </>
        )}
        <span>{title}</span>
      </nav>
      <h1 className={compact ? 'sr-only' : undefined}>{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}
    </div>
  )
}
export function FavoriteButton({ nft, showLabel = false }: { nft: Nft; showLabel?: boolean }) {
  const { user, notice } = useSession(),
    client = useQueryClient(),
    navigate = useNavigate(),
    location = useLocation()
  const favorites = usePrivateQuery<string[]>('favorites'),
    key = ['favorites', user?.id ?? 'visitor']
  const active = favorites.data?.includes(nft.id) ?? false
  const mutation = useMutation({
    mutationFn: async (wasActive: boolean) =>
      (
        await api.request<string[]>({
          method: wasActive ? 'delete' : 'put',
          url: `/favorites/${nft.id}`,
        })
      ).data,
    onMutate: async (wasActive) => {
      const token = localStorage.getItem('kurio.session')
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<string[]>(key)
      if (token === localStorage.getItem('kurio.session'))
        client.setQueryData<string[]>(key, (previous) =>
          wasActive
            ? (previous?.filter((id) => id !== nft.id) ?? [])
            : [...(previous ?? []), nft.id],
        )
      return { previous, token }
    },
    onError: (error, _variables, context) => {
      if (context?.token !== localStorage.getItem('kurio.session')) return
      client.setQueryData(key, context?.previous)
      notice(errorMessage(error))
    },
    onSuccess: (_data, wasActive, context) => {
      if (context.token === localStorage.getItem('kurio.session'))
        notice(wasActive ? 'NFT removido dos favoritos.' : 'NFT salvo nos favoritos.')
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.token === localStorage.getItem('kurio.session'))
        return client.invalidateQueries({ queryKey: key })
    },
  })
  return (
    <Button
      variant="ghost"
      size={showLabel ? 'default' : 'icon'}
      className={`favorite ${active ? 'is-favorite' : ''}`}
      aria-label={`${active ? 'Remover' : 'Adicionar'} ${nft.name} ${active ? 'dos' : 'aos'} favoritos`}
      aria-pressed={active}
      disabled={mutation.isPending}
      onClick={() => {
        if (!user) {
          void navigate({ to: '/login', search: { next: location.href } })
          return
        }
        mutation.mutate(active)
      }}
    >
      <span className="favorite-icon" aria-hidden="true">
        {active ? <img src="/images/vectors/heart-filled.svg" alt="" /> : <Icon name="heart" />}
      </span>
      {showLabel && <span>{active ? 'Favoritado' : 'Favoritar'}</span>}
    </Button>
  )
}
export function NftCard({
  nft,
  favorite = false,
  priority = false,
}: {
  nft: Nft
  favorite?: boolean
  priority?: boolean
}) {
  return (
    <article className="nft-card">
      <div className="nft-art">
        <Link to="/nft/$id" params={{ id: nft.id }} aria-label={`Ver ${nft.name}`}>
          <img
            {...responsiveImage(nft.image, '(max-width: 600px) 42vw, 258px')}
            src={nft.image}
            alt={nft.name}
            width="258"
            height="300"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
          />
        </Link>
        {nft.rarity && <span className="nft-rarity">{nft.rarity}</span>}
        {favorite && <FavoriteButton nft={nft} />}
      </div>
      <Link to="/nft/$id" params={{ id: nft.id }} className="nft-name">
        {nft.name}
      </Link>
      <p className="price">
        {formatEth(nft.price)} ETH
        {nft.compareAtPrice && (
          <span className="compare-price">{formatEth(nft.compareAtPrice)} ETH</span>
        )}
      </p>
    </article>
  )
}
