import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import PageIntro from '../components/common/PageIntro'
import SurfaceCard from '../components/common/SurfaceCard'
import { routeDefinitions } from '../utils/routeCatalog'

const PDV_ROUTE_IDS = ['pos', 'orders', 'sales', 'products', 'inventory', 'customers', 'pos-reports']

function PdvPage() {
  const navigate = useNavigate()

  const pdvRoutes = useMemo(
    () => routeDefinitions.filter((route) => PDV_ROUTE_IDS.includes(route.path)),
    [],
  )

  return (
    <div className="page-stack">
      <PageIntro eyebrow="PDV" title="Central do PDV" />

      <SurfaceCard title="Fluxos do PDV">
        <div className="pdv-hub-grid">
          {pdvRoutes.map((route) => (
            <button
              key={route.path}
              type="button"
              className="pdv-hub-card"
              onClick={() => navigate(route.path === 'pos' ? '/orders/new' : `/${route.path}`)}
            >
              <span className="pdv-hub-card__eyebrow">{route.eyebrow}</span>
              <strong className="pdv-hub-card__title">{route.label}</strong>
            </button>
          ))}
        </div>
      </SurfaceCard>
    </div>
  )
}

export default PdvPage
