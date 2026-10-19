import { useEffect, useState, useSyncExternalStore } from 'react'

const media = window.matchMedia('(max-width: 600px)')
const subscribe = (callback: () => void) => {
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

export function useMobileDock(active = true) {
  const isMobile = useSyncExternalStore(subscribe, () => media.matches)
  const [element, ref] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!element || !isMobile || !active) return
    const root = document.documentElement
    const main = document.getElementById('conteudo')
    const measure = () => {
      root.style.setProperty('--mobile-dock-height', `${element.getBoundingClientRect().height}px`)
    }
    main?.setAttribute('data-mobile-dock', 'true')
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => {
      observer.disconnect()
      main?.removeAttribute('data-mobile-dock')
      root.style.removeProperty('--mobile-dock-height')
    }
  }, [element, isMobile, active])
  return { ref, isMobile }
}
