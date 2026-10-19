import { responsiveImage } from '../lib/images'
import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { Catalog, Nft } from '../domain/contracts'
import { formatEth } from '../domain/money'
import { api, statusOf } from '../lib/api'
import { useApiMutation, useSession } from '../lib/state'
import { EmptyState, ErrorState, FavoriteButton, NftCard, Skeleton } from '../components/shared'
import { Button } from '../components/ui/button'
import { Dialog } from '../components/ui/dialog'

export function RelatedNfts({ exclude = '' }: { exclude?: string }) {
  const query = useQuery({
    queryKey: ['catalog', 'related'],
    queryFn: async ({ signal }) => (await api.get<Catalog>('/nfts', { signal })).data,
  })
  return (
    <section className="related">
      <h2>Mais desta coleção</h2>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <div className="related-grid">
          {query.data.items
            .filter((nft) => nft.id !== exclude)
            .slice(2, 7)
            .map((nft) => (
              <NftCard key={nft.id} nft={nft} />
            ))}
        </div>
      )}
      <img
        className="carousel-dots"
        src="/images/vectors/carousel-dots-33.svg"
        alt=""
        width="52"
        height="12"
      />
    </section>
  )
}
export function DetailPage() {
  const { id } = useParams({ strict: false }),
    navigate = useNavigate(),
    { notice } = useSession()
  const query = useQuery({
    queryKey: ['nft', id],
    queryFn: async ({ signal }) => (await api.get<Nft>(`/nfts/${id}`, { signal })).data,
  })
  const [quantity, setQuantity] = useState(1),
    [editionId, setEditionId] = useState('standard'),
    [image, setImage] = useState(0),
    [zoom, setZoom] = useState(false),
    [tab, setTab] = useState('details')
  const add = useApiMutation<{ nftId: string; editionId: string; quantity: number }>(
    'post',
    '/cart/items',
    ['cart', 'quote'],
    'NFT adicionado ao carrinho.',
  )
  if (query.isPending)
    return (
      <div className="detail-loading">
        <Skeleton type="detail" />
      </div>
    )
  if (query.isError)
    return statusOf(query.error) === 404 ? (
      <EmptyState
        title="NFT não encontrado"
        description="Esta obra não está disponível no catálogo."
        action={
          <Button asChild>
            <Link to="/">Explorar NFTs</Link>
          </Button>
        }
      />
    ) : (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    )
  const nft = query.data,
    edition = nft.editions.find((edition) => edition.id === editionId) ?? nft.editions[0],
    available = edition.stock > 0 && quantity <= edition.stock
  const gallery = nft.gallery.length ? nft.gallery : [nft.image]
  return (
    <>
      <nav className="detail-breadcrumb" aria-label="Navegação estrutural">
        <Link to="/">Início</Link> /{' '}
        <Link to="/" hash="catalogo">
          Mercado
        </Link>
      </nav>
      <section className="product-detail">
        <div className="product-gallery">
          <div className="thumbnails">
            {gallery.map((source, index) => (
              <button
                key={index}
                aria-label={`Ver imagem ${index + 1}`}
                aria-pressed={image === index}
                onClick={() => setImage(index)}
              >
                <img
                  {...responsiveImage(source, '100px')}
                  src={source}
                  alt={`Vista ${index + 1} de ${nft.name}`}
                  width="100"
                  height="100"
                />
              </button>
            ))}
          </div>
          <div className="main-art">
            <div className="mobile-detail-favorite">
              <FavoriteButton nft={nft} />
            </div>
            <img
              {...responsiveImage(gallery[image], '(max-width: 600px) 90vw, 404px')}
              src={gallery[image]}
              alt={nft.name}
              width="404"
              height="404"
              fetchPriority="high"
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ampliar imagem"
              className="zoom-button"
              onClick={() => setZoom(true)}
            >
              <img src="/images/vectors/frame-399-21.svg" alt="" width="30" height="30" />
            </Button>
          </div>
        </div>
        <div className="product-info">
          <h1>{nft.name}</h1>
          <span className="mobile-rating">
            <img src="/images/vectors/browser-star-15-5663.svg" alt="" width="14" height="14" />
            4.8(19)
          </span>
          <div className="product-price">
            <strong className="price">{formatEth(nft.price)} ETH</strong>
            <span className="rating" aria-label="4 de 5 estrelas">
              <span aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <img
                    key={i}
                    src={`/images/vectors/${i === 4 ? 'iconly-bold-star-26.svg' : 'iconly-bold-star-22.svg'}`}
                    alt=""
                  />
                ))}
              </span>
              19 avaliações de colecionadores
            </span>
          </div>
          <div className="product-about">
            <h2>Sobre este NFT:</h2>
            <p>
              Um colecionável digital <span className="mobile-only">1/50 </span>finalizado à mão da
              coleção Kurio Editions, verificado na {nft.network}
              <span className="desktop-only">
                , com arte desbloqueável e acesso para colecionadores
              </span>
              .
            </p>
          </div>
          <fieldset className="edition-picker">
            <legend>Edição:</legend>
            {[...nft.editions]
              .sort(
                (a, b) =>
                  ['rare', 'limited', 'standard', 'open'].indexOf(a.id) -
                  ['rare', 'limited', 'standard', 'open'].indexOf(b.id),
              )
              .map((value) => (
                <label key={value.id} className={editionId === value.id ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="edition"
                    value={value.id}
                    checked={editionId === value.id}
                    disabled={!value.stock}
                    onChange={() => {
                      setEditionId(value.id)
                      setQuantity(1)
                    }}
                  />
                  {value.name}
                  {!value.stock && ' · Esgotada'}
                </label>
              ))}
          </fieldset>
          <div className="buy-row">
            <div className="quantity-control">
              <button
                aria-label="Diminuir quantidade"
                disabled={quantity <= 1}
                onClick={() => setQuantity((value) => value - 1)}
              >
                −
              </button>
              <input
                aria-label="Quantidade"
                type="number"
                min="1"
                max={edition.stock}
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    Math.max(
                      1,
                      Math.min(edition.stock || 1, Math.trunc(Number(event.target.value) || 1)),
                    ),
                  )
                }
              />
              <button
                aria-label="Aumentar quantidade"
                disabled={quantity >= edition.stock}
                onClick={() => setQuantity((value) => value + 1)}
              >
                +
              </button>
            </div>
            <strong className="mobile-buy-price price">{formatEth(nft.price)} ETH</strong>
            <div className="buy-actions">
              <Button
                disabled={!available || add.isPending}
                onClick={() =>
                  add.mutate(
                    { nftId: nft.id, editionId, quantity },
                    { onSuccess: () => void navigate({ to: '/carrinho' }) },
                  )
                }
              >
                {add.isPending ? (
                  'Adicionando…'
                ) : available ? (
                  <>
                    <span className="desktop-only">COMPRAR</span>
                    <span className="mobile-only">Comprar NFT</span>
                  </>
                ) : (
                  'Indisponível'
                )}
              </Button>
              <FavoriteButton nft={nft} showLabel />
              <Link className="mobile-cart-button" to="/carrinho" aria-label="Ver carrinho">
                <img
                  src="/images/vectors/browser-frame-436-70410-4212.svg"
                  alt=""
                  width="60"
                  height="60"
                />
              </Link>
            </div>
          </div>
          <p className="availability">{edition.stock} unidade(s) disponível(is)</p>
          <div className="product-meta">
            <p>ID do token: #{nft.id.replace('nft-', '').padStart(4, '0')}</p>
            <p>Coleção: {nft.collection}</p>
            <p>Atributos: Óculos, Esmeralda, Raro</p>
          </div>
          <div className="inline share">
            <span>Compartilhar este NFT:</span>
            {['linkedin-30.svg', 'vector-13-stroke-31.svg', 'twitter-32.svg'].map((source, i) => (
              <button
                key={source}
                aria-label={
                  [
                    'Compartilhar no LinkedIn',
                    'Compartilhar por e-mail',
                    'Compartilhar no Twitter',
                  ][i]
                }
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(location.href)
                    .then(() => notice('Link copiado para compartilhar.'))
                    .catch(() => notice('Copie o endereço da página para compartilhar.'))
                }}
              >
                <img src={`/images/vectors/${source}`} alt="" />
              </button>
            ))}
          </div>
        </div>
      </section>
      <Dialog open={zoom} onOpenChange={setZoom} title={nft.name}>
        <img src={nft.image} alt={`Imagem ampliada de ${nft.name}`} width="1254" height="1254" />
      </Dialog>
      <section className="product-description">
        <div className="description-tabs" role="tablist" aria-label="Informações da obra">
          <button
            role="tab"
            aria-selected={tab === 'details'}
            aria-controls="detail-panel"
            id="detail-tab"
            onClick={() => setTab('details')}
          >
            Detalhes do NFT
          </button>
          <button
            role="tab"
            aria-selected={tab === 'reviews'}
            aria-controls="review-panel"
            id="review-tab"
            onClick={() => setTab('reviews')}
          >
            Avaliações de colecionadores (19)
          </button>
        </div>
        {tab === 'details' ? (
          <div role="tabpanel" id="detail-panel" aria-labelledby="detail-tab">
            <p>
              {nft.name} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada
              atributo fica armazenado nos metadados do token. A obra explora identidade, movimento
              e luz em um mundo digital sem fronteiras.
            </p>
            <p>
              A propriedade inclui a arte em alta resolução, lançamentos exclusivos para
              colecionadores e um registro permanente de procedência registrada na rede. Nova Sato
              recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e
              lançamentos da comunidade.
            </p>
            <h3>Rede:</h3>
            <p>Cunhado na {nft.network} com procedência e metadados na simulação.</p>
            <h3>Contrato:</h3>
            <p>0x7A42...19E8 · Referência demonstrativa ERC-721.</p>
            <h3>Direitos autorais:</h3>
            <p>
              Direitos autorais do criador: 5% nas vendas secundárias, pagos pelos mercados
              compatíveis.
            </p>
          </div>
        ) : (
          <div role="tabpanel" id="review-panel" aria-labelledby="review-tab">
            <p>
              As avaliações do layout são ilustrativas. Esta demonstração não permite publicar
              avaliações.
            </p>
          </div>
        )}
      </section>
      <RelatedNfts exclude={nft.id} />
    </>
  )
}
