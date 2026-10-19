import { validateCatalogSearch } from '../lib/catalogSearch'
import { responsiveImage } from '../lib/images'
import { useEffect, useState } from 'react'
import { useNavigate, useSearch, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { Catalog, CatalogSearch } from '../domain/contracts'
import { api } from '../lib/api'
import { useSession } from '../lib/state'
import { art, EmptyState, ErrorState, Icon, NftCard, Skeleton } from '../components/shared'
import { Button } from '../components/ui/button'
import { Dialog } from '../components/ui/dialog'

export function CatalogPage() {
  const search = validateCatalogSearch(useSearch({ strict: false })),
    navigate = useNavigate(),
    { notice } = useSession()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [minPrice, setMinPrice] = useState(search.minPrice || '0.02'),
    [maxPrice, setMaxPrice] = useState(search.maxPrice || '12.30')
  useEffect(() => {
    setMinPrice(search.minPrice || '0.02')
    setMaxPrice(search.maxPrice || '12.30')
  }, [search.minPrice, search.maxPrice])
  const catalog = useQuery({
    queryKey: ['catalog', search],
    queryFn: async ({ signal }) =>
      (await api.get<Catalog>('/nfts', { params: search, signal })).data,
  })
  const change = (value: Partial<CatalogSearch>) =>
    void navigate({
      to: '/',
      search: { ...search, ...value, page: value.page ?? 1 },
      hash: 'catalogo',
    })
  const filters = (prefix: string) => (
    <div className="filters stack">
      <div>
        <h3>Coleções</h3>
        {[
          'Arte digital',
          'Fotografia',
          'Música',
          'Arte 3D',
          'Colecionáveis',
          'Generativa',
          'Jogos',
          'Assinaturas',
          'Utilidade',
        ].map((category) => (
          <label
            className={`filter-choice ${search.category === category ? 'selected' : ''}`}
            key={category}
          >
            <input
              type="checkbox"
              aria-label={category}
              checked={search.category === category}
              onChange={() => change({ category: search.category === category ? '' : category })}
            />
            <span>{category}</span>
            <span>({catalog.data?.facets?.categories[category] ?? '…'})</span>
          </label>
        ))}
      </div>
      <div className="price-filter">
        <h3>Faixa de preço</h3>
        <div className="inline">
          <input
            type="range"
            aria-label="Preço mínimo"
            min="0.02"
            max="12.30"
            step="0.01"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
          />
          <input
            type="range"
            aria-label="Preço máximo"
            min="0.02"
            max="12.30"
            step="0.01"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
          />
        </div>
        <p>
          Preço: {minPrice} – {maxPrice} ETH
        </p>
        <Button size="sm" onClick={() => change({ minPrice, maxPrice })}>
          Aplicar preço
        </Button>
      </div>
      <div>
        <h3>Rede</h3>
        {['Ethereum', 'Polygon'].map((network) => (
          <label
            className={`filter-choice ${search.network === network ? 'selected' : ''}`}
            key={network}
          >
            <input
              type="checkbox"
              aria-label={network}
              checked={search.network === network}
              onChange={() => change({ network: search.network === network ? '' : network })}
            />
            <span>{network}</span>
            <span>({catalog.data?.facets?.networks[network] ?? '…'})</span>
          </label>
        ))}
      </div>
      <details className="advanced-filters">
        <summary>Mais filtros</summary>
        <div className="stack">
          <div>
            <h3>Pesquisar</h3>
            <label className="sr-only" htmlFor={`${prefix}-catalog-search`}>
              Buscar no catálogo
            </label>
            <input
              id={`${prefix}-catalog-search`}
              type="search"
              placeholder="NFT, coleção, criador..."
              value={search.q}
              onChange={(event) => change({ q: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor={`${prefix}-collection`}>
              <h3>Coleção</h3>
            </label>
            <select
              id={`${prefix}-collection`}
              value={search.collection}
              onChange={(event) => change({ collection: event.target.value })}
            >
              <option value="">Todas as coleções</option>
              <option>Kurio Originals</option>
              <option>Nomad Collection</option>
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMinPrice('0.02')
              setMaxPrice('12.30')
              change({
                q: '',
                category: '',
                collection: '',
                network: '',
                minPrice: '',
                maxPrice: '',
                sort: 'recent',
              })
            }}
          >
            Limpar filtros
          </Button>
        </div>
      </details>
    </div>
  )
  return (
    <>
      <div className="mobile-search">
        <button
          onClick={() => document.getElementById('mobile-catalog-search')?.focus()}
          aria-label="Buscar coleções"
        >
          <Icon name="search" />
        </button>
        <input
          id="mobile-catalog-search"
          type="search"
          aria-label="Explorar coleções"
          placeholder="Explorar coleções"
          value={search.q}
          onChange={(event) => change({ q: event.target.value })}
        />
        <button
          className="mobile-filter"
          aria-label="Abrir filtros"
          onClick={() => setFiltersOpen(true)}
        >
          <img
            src="/images/vectors/browser-frame-402-70410-4122.svg"
            alt=""
            width="45"
            height="45"
          />
        </button>
      </div>
      <section className="mobile-hero">
        <div>
          <p>Bem-vindo à Kurio</p>
          <h1>
            SEJA DONO DA
            <br /> CULTURA DIGITAL
          </h1>
          <p className="muted">Descubra NFTs selecionados de criadores do mundo todo.</p>
          <a href="#catalogo">EXPLORAR →</a>
        </div>
        <div className="mobile-hero-art">
          <img
            {...responsiveImage(art[0], '(max-width: 600px) 138px, 450px')}
            src={art[0]}
            alt="Emerald Ape"
            width="138"
            height="138"
            fetchPriority="high"
          />
          <img
            {...responsiveImage(art[1], '(max-width: 600px) 58px, 310px')}
            src={art[1]}
            alt="Sage Nomad"
            width="58"
            height="58"
          />
        </div>
        <img
          className="mobile-hero-dots"
          src="/images/vectors/frame-4-151.svg"
          alt=""
          width="33"
          height="7"
        />
      </section>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Bem-vindo à Kurio</p>
          <h1>
            SEJA DONO DO FUTURO
            <br /> DA ARTE DIGITAL
          </h1>
          <p>
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital
            rara, apoie artistas e tenha uma parte da cultura da internet.
          </p>
          <Button asChild>
            <a href="#catalogo">EXPLORAR</a>
          </Button>
          <img
            className="hero-dots"
            src="/images/vectors/group-4-6.svg"
            alt=""
            width="40"
            height="8"
          />
        </div>
        <img
          className="hero-art"
          {...responsiveImage(art[0], '(max-width: 900px) 40vw, 450px')}
          src={art[0]}
          alt="Ape de jaqueta verde e óculos, arte digital da coleção Emerald"
          width="450"
          height="450"
          fetchPriority="high"
        />
      </section>
      <section className="catalog-layout" id="catalogo" aria-label="Catálogo de NFTs">
        <aside className="catalog-sidebar">
          {filters('desktop')}
          <div className="featured-banner">
            <h3>NFT EM DESTAQUE</h3>
            <p>OFERTA LIMITADA</p>
            <Link to="/nft/$id" params={{ id: 'nft-2' }}>
              <img
                {...responsiveImage(art[1], '(max-width: 600px) 58px, 310px')}
                src={art[1]}
                alt="Sage Nomad em destaque"
                width="310"
                height="368"
                loading="lazy"
              />
            </Link>
          </div>
        </aside>
        <div className="catalog-main">
          <div className="catalog-toolbar">
            <div className="catalog-tabs">
              <button
                className={search.sort === 'recent' ? 'active' : ''}
                onClick={() => change({ sort: 'recent' })}
              >
                Todos os NFTs
              </button>
              <button onClick={() => change({ sort: 'name' })}>Novos lançamentos</button>
              <button onClick={() => change({ sort: 'price-desc' })}>Em alta</button>
            </div>
            <label>
              Ordenar por:
              <select
                aria-label="Ordenar NFTs"
                value={search.sort}
                onChange={(event) => change({ sort: event.target.value })}
              >
                <option value="recent">Listados recentemente</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="name">Nome</option>
              </select>
            </label>
          </div>
          <div className="mobile-filter-row">
            <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
              Filtros
            </Button>
            <span>{catalog.data?.total ?? '…'} NFTs encontrados</span>
          </div>
          <Dialog open={filtersOpen} onOpenChange={setFiltersOpen} title="Filtrar NFTs">
            {filters('drawer')}
            <Button onClick={() => setFiltersOpen(false)}>Ver resultados</Button>
          </Dialog>
          {catalog.isPending ? (
            <Skeleton />
          ) : catalog.isError ? (
            <ErrorState error={catalog.error} retry={() => void catalog.refetch()} />
          ) : !catalog.data.items.length ? (
            <EmptyState
              title="Nenhum NFT encontrado"
              description="Experimente outra busca ou remova os filtros."
              action={
                <Button
                  onClick={() =>
                    change({
                      q: '',
                      category: '',
                      collection: '',
                      network: '',
                      minPrice: '',
                      maxPrice: '',
                      page: 1,
                    })
                  }
                >
                  Limpar busca
                </Button>
              }
            />
          ) : (
            <>
              <div className="nft-grid" aria-busy={catalog.isFetching}>
                {catalog.data.items.map((nft, index) => (
                  <NftCard key={nft.id} nft={nft} favorite priority={index < 2} />
                ))}
              </div>
              <nav className="pagination" aria-label="Paginação">
                {Array.from({ length: catalog.data.pages }, (_, i) => (
                  <button
                    key={i}
                    aria-label={`Página ${i + 1}`}
                    aria-current={search.page === i + 1 ? 'page' : undefined}
                    onClick={() => change({ page: i + 1 })}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  aria-label="Próxima página"
                  disabled={search.page >= catalog.data.pages}
                  onClick={() => change({ page: search.page + 1 })}
                >
                  ›
                </button>
              </nav>
            </>
          )}
        </div>
      </section>
      <section className="promo-grid" aria-label="Explore coleções">
        <div className="promo">
          <img
            {...responsiveImage(art[0], '(max-width: 600px) 138px, 450px')}
            src={art[0]}
            alt="Emerald Ape"
            width="288"
            height="250"
            loading="lazy"
          />
          <div>
            <h2>Lançamentos gênesis de edição limitada</h2>
            <p>Colecione edições escassas diretamente dos criadores antes da revelação pública.</p>
            <Button asChild size="sm">
              <Link to="/nft/$id" params={{ id: 'nft-1' }}>
                Explorar <Icon name="arrow" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="promo">
          <img
            {...responsiveImage(art[2], '288px')}
            src={art[2]}
            alt="Neon Vessel"
            width="288"
            height="250"
            loading="lazy"
          />
          <div>
            <h2>Arte digital selecionada e muito mais</h2>
            <p>
              Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.
            </p>
            <Button asChild size="sm">
              <Link to="/" hash="catalogo">
                Explorar <Icon name="arrow" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="journal">
        <h2>Diário da Cunhagem</h2>
        <p className="muted">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
        <div className="journal-grid">
          {[
            'Como funciona a propriedade de NFTs',
            '10 artistas digitais para acompanhar',
            'Raridade, atributos e procedência',
            'Como proteger sua carteira',
          ].map((title, i) => (
            <article key={title}>
              <img
                {...responsiveImage(art[[2, 0, 1, 3][i]], '(max-width: 600px) 150px, 268px')}
                src={art[[2, 0, 1, 3][i]]}
                alt=""
                width="268"
                height="195"
                loading="lazy"
              />
              <div>
                <small>
                  {12 + i} de setembro | Leitura de {i + 2} min
                </small>
                <h3>{title}</h3>
                <p>Explore histórias e novas perspectivas para a sua coleção.</p>
                <button
                  onClick={() => notice('Artigos editoriais fora do escopo desta demonstração.')}
                >
                  Ler mais →
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
