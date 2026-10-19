import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useSession } from '../lib/state'
import { Skeleton } from './shared'

export function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useSession(),
    location = useLocation(),
    navigate = useNavigate()
  const resume = useRef(location.href)
  useEffect(() => {
    if (!user && !loading)
      void navigate({ to: '/login', search: { next: resume.current }, replace: true })
  }, [user?.id, loading, navigate])
  if (loading || !user) return <Skeleton type="detail" />
  return children
}
