import { createReadStream } from 'node:fs'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve, relative, extname, isAbsolute } from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'
import type { Plugin } from 'vite'

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
}

export function compressedDelivery(): Plugin {
  let output = ''
  return {
    name: 'marketplace-compressed-delivery',
    configResolved(config) {
      output = resolve(config.root, config.build.outDir)
    },
    async writeBundle() {
      const compress = async (directory: string): Promise<void> => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const file = resolve(directory, entry.name)
          if (entry.isDirectory()) await compress(file)
          else if (contentTypes[extname(file)]) {
            const original = await readFile(file)
            const compressed = brotliCompressSync(original, {
              params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
            })
            if (compressed.length < original.length) await writeFile(`${file}.br`, compressed)
          }
        }
      }
      await compress(output)
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!['GET', 'HEAD'].includes(request.method ?? '') || request.headers.range) return next()
        const acceptsBrotli = (request.headers['accept-encoding'] ?? '')
          .split(',')
          .some((value) => {
            const [encoding, quality] = value.trim().split(';')
            return encoding === 'br' && (!quality || Number(quality.trim().replace(/^q=/, '')) > 0)
          })
        if (!acceptsBrotli) return next()
        try {
          const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname)
          const spaRoute =
            !extname(pathname) && !/^\/(api|assets|images|fonts)(\/|$)/.test(pathname)
          const file = resolve(output, `.${spaRoute ? '/index.html' : pathname}`)
          const localPath = relative(output, file)
          if (localPath.startsWith('..') || isAbsolute(localPath)) return next()
          const contentType = contentTypes[extname(file)]
          if (!contentType) return next()
          const info = await stat(`${file}.br`)
          if (!info.isFile()) return next()
          response.setHeader('Content-Type', contentType)
          response.setHeader('Content-Encoding', 'br')
          response.setHeader('Content-Length', info.size)
          response.setHeader('Vary', 'Accept-Encoding')
          response.setHeader('Cache-Control', 'no-cache')
          if (request.method === 'HEAD') response.end()
          else
            createReadStream(`${file}.br`)
              .on('error', (error) => response.destroy(error))
              .pipe(response)
        } catch {
          next()
        }
      })
    },
  }
}
