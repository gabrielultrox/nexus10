import { getObservabilitySnapshot } from '../../monitoring/metrics.js'
import { requireRole } from '../../middleware/requireAuth.js'

function renderMonitoringDashboard(snapshot) {
  const routeRows = snapshot.routes
    .map(
      (route) => `
    <tr>
      <td>${route.route}</td>
      <td>${route.totalRequests}</td>
      <td>${route.errorRate}%</td>
      <td>${route.p95}ms</td>
      <td>${route.max}ms</td>
    </tr>
  `,
    )
    .join('')

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Nexus10 Monitoring</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; background:#f7f8fa; color:#101828; }
        h1, h2 { margin: 0 0 12px; }
        .grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin: 16px 0 24px; }
        .card { background:#fff; border:1px solid #d0d5dd; border-radius:16px; padding:16px; }
        .label { font-size:12px; text-transform:uppercase; color:#667085; letter-spacing:.08em; }
        .value { font-size:28px; font-weight:700; margin-top:8px; }
        table { width:100%; border-collapse:collapse; background:#fff; border:1px solid #d0d5dd; border-radius:16px; overflow:hidden; }
        th, td { text-align:left; padding:12px 14px; border-bottom:1px solid #eaecf0; font-size:14px; }
        th { background:#f9fafb; color:#475467; }
      </style>
    </head>
    <body>
      <h1>Nexus10 Monitoring</h1>
      <p>Janela: ${snapshot.windowMinutes} minutos | Gerado em ${snapshot.generatedAt}</p>
      <div class="grid">
        <div class="card"><div class="label">Error Rate</div><div class="value">${snapshot.summary.errorRate}%</div></div>
        <div class="card"><div class="label">p95</div><div class="value">${snapshot.summary.p95}ms</div></div>
        <div class="card"><div class="label">Webhook Failures</div><div class="value">${snapshot.webhooks.failureCount}</div></div>
        <div class="card"><div class="label">Requests</div><div class="value">${snapshot.summary.totalRequests}</div></div>
      </div>
      <h2>Top Routes</h2>
      <table>
        <thead>
          <tr>
            <th>Route</th>
            <th>Requests</th>
            <th>Error Rate</th>
            <th>p95</th>
            <th>Max</th>
          </tr>
        </thead>
        <tbody>${routeRows || '<tr><td colspan="5">Sem tráfego suficiente.</td></tr>'}</tbody>
      </table>
    </body>
  </html>`
}

export function registerMonitoringRoutes(app) {
  app.get('/api/admin/monitoring/summary', requireRole('admin'), async (_request, response) => {
    response.json({
      data: await getObservabilitySnapshot(),
    })
  })

  app.get('/api/admin/monitoring/dashboard', requireRole('admin'), async (_request, response) => {
    response.type('html').send(renderMonitoringDashboard(await getObservabilitySnapshot()))
  })
}
