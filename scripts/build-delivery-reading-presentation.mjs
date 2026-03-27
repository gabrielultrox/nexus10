import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const docsDir = path.join(projectRoot, 'docs')
const assetsDir = path.join(docsDir, 'presentation-assets')
const outputHtml = path.join(docsDir, 'leitura-entregas-apresentacao.html')
const outputPdf = path.join(docsDir, 'leitura-entregas-apresentacao.pdf')
const appUrl = 'http://127.0.0.1:5173/delivery-reading'

const sampleCouriers = [
  { id: 'courier-1', name: 'Arthur' },
  { id: 'courier-2', name: 'Kelvin' },
  { id: 'courier-3', name: 'Gustavo' },
  { id: 'courier-4', name: 'Tito' },
]

const sampleReadings = [
  {
    id: 'delivery-reading-1',
    deliveryCode: '10452',
    courier: 'Arthur',
    closed: false,
    status: 'Lida',
    updatedAt: '19:02',
    updatedBy: 'Gabriel',
  },
  {
    id: 'delivery-reading-2',
    deliveryCode: '10468',
    courier: 'Kelvin',
    closed: false,
    status: 'Lida',
    updatedAt: '19:05',
    updatedBy: 'Gabriel',
  },
  {
    id: 'delivery-reading-3',
    deliveryCode: '10477',
    courier: 'Gustavo',
    closed: false,
    status: 'Lida',
    updatedAt: '19:07',
    updatedBy: 'Gabriel',
  },
  {
    id: 'delivery-reading-4',
    deliveryCode: '10431',
    courier: 'Tito',
    closed: true,
    status: 'Fechada',
    updatedAt: '18:54',
    updatedBy: 'Gabriel',
  },
  {
    id: 'delivery-reading-5',
    deliveryCode: '10419',
    courier: 'Arthur',
    closed: true,
    status: 'Fechada',
    updatedAt: '18:48',
    updatedBy: 'Gabriel',
  },
]

function toFileUrl(targetPath) {
  const normalized = path.resolve(targetPath).replace(/\\/g, '/')
  return `file:///${normalized}`
}

function buildHtml({ screenshots, generatedAt }) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Apresentacao - Leitura de entregas</title>
    <style>
      :root {
        --bg: #07111f;
        --panel: rgba(9, 20, 37, 0.84);
        --panel-soft: rgba(13, 27, 46, 0.76);
        --text: #eff6ff;
        --muted: #8ca4c4;
        --cyan: #2fd8ff;
        --amber: #ffb347;
        --border: rgba(94, 146, 188, 0.22);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Segoe UI", system-ui, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(47, 216, 255, 0.14), transparent 24%),
          radial-gradient(circle at top right, rgba(255, 92, 92, 0.12), transparent 22%),
          linear-gradient(180deg, #07111f, #081523 42%, #050b14);
        color: var(--text);
      }

      .deck {
        width: min(1320px, calc(100vw - 40px));
        margin: 0 auto;
        padding: 24px 0 48px;
      }

      .slide {
        min-height: 100vh;
        padding: 32px;
        margin-bottom: 18px;
        border: 1px solid var(--border);
        border-radius: 28px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 22%),
          var(--panel);
        box-shadow: 0 24px 72px rgba(0, 0, 0, 0.24);
        display: grid;
        gap: 24px;
        page-break-after: always;
      }

      .eyebrow {
        color: var(--cyan);
        text-transform: uppercase;
        letter-spacing: 0.26em;
        font-size: 12px;
        font-weight: 700;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      h1 {
        font-size: 52px;
        line-height: 0.95;
      }

      h2 {
        font-size: 30px;
        line-height: 1;
      }

      p {
        color: var(--muted);
        line-height: 1.55;
      }

      .hero-grid,
      .split-grid {
        display: grid;
        grid-template-columns: 0.95fr 1.05fr;
        gap: 24px;
        align-items: start;
      }

      .hero-copy,
      .summary-column {
        display: grid;
        gap: 18px;
      }

      .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .pill {
        padding: 9px 13px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: rgba(10, 26, 44, 0.74);
        color: var(--text);
        font-size: 13px;
      }

      .shot {
        padding: 14px;
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.26);
      }

      .shot img {
        display: block;
        width: 100%;
        border-radius: 16px;
      }

      .kpis,
      .feature-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .feature-grid--two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .kpi,
      .feature-card {
        padding: 16px 18px;
        border-radius: 20px;
        border: 1px solid var(--border);
        background: var(--panel-soft);
      }

      .kpi span {
        display: block;
        margin-bottom: 6px;
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }

      .kpi strong,
      .feature-card strong {
        display: block;
        color: var(--text);
      }

      .kpi strong {
        font-size: 26px;
      }

      .feature-card strong {
        margin-bottom: 8px;
        font-size: 16px;
      }

      .steps {
        display: grid;
        gap: 14px;
      }

      .step {
        display: grid;
        grid-template-columns: 38px 1fr;
        gap: 14px;
      }

      .step-index {
        width: 38px;
        height: 38px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: rgba(47, 216, 255, 0.12);
        color: var(--cyan);
        border: 1px solid rgba(47, 216, 255, 0.28);
        font-weight: 700;
      }

      .footer-note {
        color: var(--muted);
        font-size: 13px;
      }

      .highlight {
        color: var(--amber);
      }

      @media (max-width: 980px) {
        .hero-grid,
        .split-grid,
        .kpis,
        .feature-grid,
        .feature-grid--two {
          grid-template-columns: 1fr;
        }

        h1 {
          font-size: 40px;
        }

        h2 {
          font-size: 26px;
        }
      }

      @media print {
        body {
          background: #07111f;
        }

        .deck {
          width: auto;
          margin: 0;
          padding: 0;
        }

        .slide {
          margin: 0;
          border-radius: 0;
          min-height: 100vh;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <main class="deck">
      <section class="slide">
        <div class="eyebrow">Nexus-10 - Proposta Desktop</div>
        <div class="hero-grid">
          <div class="hero-copy">
            <h1>Leitura de entregas <span class="highlight">mais clara</span> e pronta para operacao</h1>
            <p>
              Esta apresentacao mostra a nova aba de leitura de entregas em versao desktop, com foco em fluxo rapido,
              organizacao visual e separacao clara entre leituras em aberto e entregas ja fechadas.
            </p>
            <div class="pill-row">
              <span class="pill">Fluxo simples e direto</span>
              <span class="pill">Leitura limpa em desktop</span>
              <span class="pill">Estados bem diferenciados</span>
            </div>
            <div class="kpis">
              <div class="kpi">
                <span>Uso principal</span>
                <strong>Operacao</strong>
              </div>
              <div class="kpi">
                <span>Entrada</span>
                <strong>Codigo + entregador</strong>
              </div>
              <div class="kpi">
                <span>Fechamento</span>
                <strong>Visual claro</strong>
              </div>
            </div>
          </div>
          <div class="shot">
            <img src="${screenshots.overview}" alt="Visao geral da tela de leitura de entregas" />
          </div>
        </div>
        <div class="footer-note">Gerado automaticamente em ${generatedAt}</div>
      </section>

      <section class="slide">
        <div class="eyebrow">Visao Operacional</div>
        <h2>Area principal com entregas lidas</h2>
        <div class="split-grid">
          <div class="shot">
            <img src="${screenshots.open}" alt="Entregas lidas" />
          </div>
          <div class="summary-column">
            <div class="feature-grid">
              <div class="feature-card">
                <strong>Registro rapido</strong>
                <p>Cadastro simples com codigo da entrega e entregador, sem atrito na operacao.</p>
              </div>
              <div class="feature-card">
                <strong>Acao clara</strong>
                <p>O botao de fechamento fica visivel no proprio card, sem passos extras.</p>
              </div>
              <div class="feature-card">
                <strong>Rastro visivel</strong>
                <p>Ultima atualizacao fica no card para consulta imediata entre operadores.</p>
              </div>
            </div>
            <div class="feature-card">
              <strong>Leitura do turno</strong>
              <p>
                A fila de entregas lidas funciona como uma camada operacional de acompanhamento. O time enxerga rapidamente
                o que ja entrou no fluxo, quem esta responsavel e o que ainda precisa ser fechado.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="slide">
        <div class="eyebrow">Transicao</div>
        <h2>Fechamento com feedback forte</h2>
        <div class="split-grid">
          <div class="summary-column">
            <div class="steps">
              <div class="step">
                <div class="step-index">1</div>
                <div>
                  <strong>Entrega e lida</strong>
                  <p>Ela entra na fila principal com destaque proprio e foco em resolucao rapida.</p>
                </div>
              </div>
              <div class="step">
                <div class="step-index">2</div>
                <div>
                  <strong>Operador fecha a entrega</strong>
                  <p>O card recebe um feedback visual mais forte para confirmar a acao com seguranca.</p>
                </div>
              </div>
              <div class="step">
                <div class="step-index">3</div>
                <div>
                  <strong>O item migra de area</strong>
                  <p>A fila em aberto continua limpa, enquanto as entregas concluidas ficam organizadas abaixo.</p>
                </div>
              </div>
            </div>
            <div class="feature-card">
              <strong>Beneficio pratico</strong>
              <p>Esse comportamento reduz duvida, melhora conferencia e deixa o andamento do turno muito mais claro.</p>
            </div>
          </div>
          <div class="shot">
            <img src="${screenshots.after}" alt="Tela apos fechar uma entrega" />
          </div>
        </div>
      </section>

      <section class="slide">
        <div class="eyebrow">Consulta Final</div>
        <h2>Area dedicada para entregas fechadas</h2>
        <div class="split-grid">
          <div class="shot">
            <img src="${screenshots.closed}" alt="Entregas fechadas" />
          </div>
          <div class="summary-column">
            <div class="feature-grid feature-grid--two">
              <div class="feature-card">
                <strong>Separacao clara</strong>
                <p>O que ainda esta em andamento nao se mistura com o que ja foi encerrado.</p>
              </div>
              <div class="feature-card">
                <strong>Consulta rapida</strong>
                <p>A operacao consegue revisar o historico imediato do turno sem poluicao visual.</p>
              </div>
              <div class="feature-card">
                <strong>Leitura consistente</strong>
                <p>Codigo, entregador e horario de fechamento continuam visiveis no estado final.</p>
              </div>
              <div class="feature-card">
                <strong>Pronta para evoluir</strong>
                <p>A base ja suporta novos filtros, rastreios e integracoes futuras da operacao.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </body>
</html>`
}

async function ensureDirectories() {
  await fs.mkdir(docsDir, { recursive: true })
  await fs.mkdir(assetsDir, { recursive: true })
}

async function takeScreenshots() {
  console.log('Launching browser for screenshots...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 980 },
    colorScheme: 'dark',
  })

  await context.addInitScript(
    ({ couriers, readings }) => {
      window.localStorage.setItem('nexus10-theme', 'dark')
      window.localStorage.setItem('nexus-manual-couriers', JSON.stringify(couriers))
      window.localStorage.setItem('nexus-module-delivery-reading', JSON.stringify(readings))
    },
    {
      couriers: sampleCouriers,
      readings: sampleReadings,
    },
  )

  const page = await context.newPage()
  page.setDefaultTimeout(20000)

  console.log('Opening app...')
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
  console.log('Waiting boot...')
  await page.waitForTimeout(3800)

  console.log('Unlocking PIN...')
  for (const digit of ['0', '1', '0', '1']) {
    await page.getByRole('button', { name: digit, exact: true }).click()
  }

  console.log('Submitting login...')
  await page.waitForSelector('#login-operator', { state: 'visible' })
  await page.selectOption('#login-operator', 'Gabriel')
  await page.fill('#login-password', '01')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL('**/delivery-reading')
  await page.waitForTimeout(1000)

  const overviewPath = path.join(assetsDir, 'delivery-reading-overview-mobile.png')
  const openPath = path.join(assetsDir, 'delivery-reading-open-mobile.png')
  const afterPath = path.join(assetsDir, 'delivery-reading-after-mobile.png')
  const closedPath = path.join(assetsDir, 'delivery-reading-closed-mobile.png')

  const modulePage = page.locator('.page-stack.native-module-page--delivery-reading')

  console.log('Capturing overview...')
  await page.screenshot({ path: overviewPath, fullPage: false })

  console.log('Capturing open state...')
  await modulePage.screenshot({ path: openPath })

  console.log('Triggering close action...')
  await page
    .locator('.delivery-reading__section--open .delivery-reading__close-button')
    .first()
    .click()
  await page.waitForTimeout(700)

  console.log('Capturing after state...')
  await modulePage.screenshot({ path: afterPath })

  console.log('Capturing closed state...')
  await page.locator('.delivery-reading__section--closed').scrollIntoViewIfNeeded()
  await page.waitForTimeout(250)
  await modulePage.screenshot({ path: closedPath })

  console.log('Closing browser after screenshots...')
  await browser.close()

  return {
    overview: `presentation-assets/${path.basename(overviewPath)}`,
    open: `presentation-assets/${path.basename(openPath)}`,
    after: `presentation-assets/${path.basename(afterPath)}`,
    closed: `presentation-assets/${path.basename(closedPath)}`,
  }
}

async function buildPresentation() {
  await ensureDirectories()
  console.log('Building screenshots...')
  const screenshots = await takeScreenshots()
  const generatedAt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())

  const html = buildHtml({ screenshots, generatedAt })
  await fs.writeFile(outputHtml, html, 'utf8')
  console.log(`HTML written: ${outputHtml}`)

  console.log('Launching browser for PDF...')
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })
  const page = await browser.newPage()
  page.setDefaultTimeout(20000)
  await page.goto(toFileUrl(outputHtml), { waitUntil: 'networkidle' })
  console.log('Rendering PDF...')
  await page.pdf({
    path: outputPdf,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0',
      right: '0',
      bottom: '0',
      left: '0',
    },
  })
  await browser.close()

  console.log(`HTML: ${outputHtml}`)
  console.log(`PDF: ${outputPdf}`)
}

buildPresentation().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
