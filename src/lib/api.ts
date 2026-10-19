import axios from 'axios'
import type { ApiError } from '../domain/contracts'

export const api = axios.create({
  baseURL: '/api',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})
export const visitorId = (): string => {
  let id = localStorage.getItem('kurio.visitor')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('kurio.visitor', id)
  }
  return id
}
api.interceptors.request.use((config) => {
  config.headers['X-Visitor-Id'] = visitorId()
  const token = localStorage.getItem('kurio.session')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiError>(error))
    return error.response?.data.message ?? 'Não foi possível conectar. Tente novamente.'
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
}
export function statusOf(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}
export function fieldErrors(error: unknown): Record<string, string> {
  return axios.isAxiosError<ApiError>(error) ? (error.response?.data.fields ?? {}) : {}
}
