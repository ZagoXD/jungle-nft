import type { CatalogSearch } from '../domain/contracts'
export const validateCatalogSearch = (raw: Record<string, unknown>): CatalogSearch => ({
  q: String(raw.q ?? ''),
  category: String(raw.category ?? ''),
  collection: String(raw.collection ?? ''),
  network: String(raw.network ?? ''),
  minPrice: /^\d+(\.\d{1,18})?$/.test(String(raw.minPrice)) ? String(raw.minPrice) : '',
  maxPrice: /^\d+(\.\d{1,18})?$/.test(String(raw.maxPrice)) ? String(raw.maxPrice) : '',
  sort: ['recent', 'price-asc', 'price-desc', 'name'].includes(String(raw.sort))
    ? String(raw.sort)
    : 'recent',
  page:
    Number.isSafeInteger(Number(raw.page)) && Number(raw.page) > 0
      ? Math.min(100000, Number(raw.page))
      : 1,
})
