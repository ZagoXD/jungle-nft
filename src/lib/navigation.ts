export function safeNext(value: unknown) {
  const path = String(value ?? '/')
  return path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\') &&
    !/^\/(login|cadastro)/.test(path)
    ? path
    : '/'
}
