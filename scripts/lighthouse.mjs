import { spawn } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import puppeteer from 'puppeteer-core'
import { chromium } from '@playwright/test'

const root = new URL('../', import.meta.url)
const reports = new URL('../reports/lighthouse/', import.meta.url)
await mkdir(reports, { recursive: true })
const baseUrl = process.env.LIGHTHOUSE_URL ?? 'http://127.0.0.1:4173'
const repetitions = Number.parseInt(process.env.LIGHTHOUSE_RUNS ?? '3', 10)
if (![1, 2, 3].includes(repetitions)) throw new Error('LIGHTHOUSE_RUNS deve ser 1, 2 ou 3.')
const server = process.env.LIGHTHOUSE_URL
  ? null
  : spawn(
      process.execPath,
      [
        fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        '4173',
        '--strictPort',
      ],
      { cwd: root, stdio: 'pipe', windowsHide: true },
    )
let serverError = ''
server?.stderr.on('data', (value) => {
  serverError += value.toString()
})
async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (server?.exitCode !== null && server?.exitCode !== undefined)
      throw new Error(serverError || 'Preview encerrou antes da auditoria.')
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      /* preview still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('Preview indisponível. Execute npm run build antes da auditoria.')
}
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const runs = []
let chromiumVersion = ''
try {
  await waitForServer()
  for (const [page, path] of [
    ['inicio', '/'],
    ['detalhe', '/nft/nft-1'],
  ])
    for (const profile of ['mobile', 'desktop'])
      for (let run = 1; run <= repetitions; run++) {
        const chrome = await puppeteer.launch({
          executablePath: process.env.CHROME_PATH ?? chromium.executablePath(),
          headless: true,
          args: ['--disable-gpu', '--no-sandbox'],
        })
        const browserPage = await chrome.newPage()
        chromiumVersion = await chrome.version()
        try {
          const options = {
            logLevel: 'error',
            output: ['json', 'html'],
            onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
            ...(profile === 'desktop'
              ? {
                  preset: 'desktop',
                  formFactor: 'desktop',
                  screenEmulation: {
                    mobile: false,
                    width: 1440,
                    height: 1000,
                    deviceScaleFactor: 1,
                    disabled: false,
                  },
                }
              : {}),
            disableStorageReset: false,
          }
          const result = await lighthouse(
            `${baseUrl}${path}`,
            options,
            profile === 'desktop' ? desktopConfig : undefined,
            browserPage,
          )
          if (!result) throw new Error('Lighthouse não retornou relatório.')
          const prefix = `${page}-${profile}-${run}`
          await writeFile(new URL(`${prefix}.json`, reports), result.report[0])
          await writeFile(new URL(`${prefix}.html`, reports), result.report[1])
          const scores = Object.fromEntries(
            Object.entries(result.lhr.categories).map(([key, category]) => [
              key,
              Math.round((category.score ?? 0) * 100),
            ]),
          )
          runs.push({
            page,
            profile,
            run,
            scores,
            metrics: {
              LCP: result.lhr.audits['largest-contentful-paint'].numericValue,
              CLS: result.lhr.audits['cumulative-layout-shift'].numericValue,
              TBT: result.lhr.audits['total-blocking-time'].numericValue,
            },
          })
          console.log(prefix, JSON.stringify(scores))
        } finally {
          await browserPage.close().catch(() => {})
          await chrome.close()
        }
      }
  const medians = []
  for (const page of ['inicio', 'detalhe'])
    for (const profile of ['mobile', 'desktop']) {
      const subset = runs.filter((run) => run.page === page && run.profile === profile)
      medians.push({
        page,
        profile,
        scores: Object.fromEntries(
          ['performance', 'accessibility', 'best-practices', 'seo'].map((key) => [
            key,
            median(subset.map((run) => run.scores[key])),
          ]),
        ),
        metrics: Object.fromEntries(
          ['LCP', 'CLS', 'TBT'].map((key) => [key, median(subset.map((run) => run.metrics[key]))]),
        ),
      })
    }
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'))
  await writeFile(
    new URL('summary.json', reports),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        environment: {
          os: `${os.platform()} ${os.release()} ${os.arch()}`,
          cpu: os.cpus()[0].model,
          node: process.version,
          lighthouse: lock.packages['node_modules/lighthouse'].version,
          playwright: lock.packages['node_modules/@playwright/test'].version,
          chromium: chromiumVersion,
        },
        conditions: {
          build: 'Vite production preview',
          baseUrl,
          scenario: 'default MSW; real assets and fonts; fresh browser for every run',
          mobile: 'Lighthouse default simulated mobile throttling',
          desktop: 'Lighthouse desktop preset, 1440x1000',
          runsPerPageAndProfile: repetitions,
        },
        runs,
        medians,
      },
      null,
      2,
    ),
  )
  console.log('Medianas:', JSON.stringify(medians, null, 2))
} finally {
  server?.kill()
}
