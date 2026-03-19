import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import SurfaceCard from '../components/common/SurfaceCard'
import NativeModuleWorkspace from '../modules/operations/components/NativeModuleWorkspace'
import { routeDefinitions } from '../utils/routeCatalog'
import Select from '../components/ui/Select'

const ANALYSIS_ROUTE_IDS = ['reports', 'monthly-report', 'orders-hour', 'ratings']

function AnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const analysisRoutes = useMemo(
    () => routeDefinitions.filter((route) => ANALYSIS_ROUTE_IDS.includes(route.path)),
    [],
  )
  const selectedScreen = searchParams.get('screen') ?? 'reports'
  const activeRoute =
    analysisRoutes.find((route) => route.path === selectedScreen) ?? analysisRoutes[0]

  function handleScreenChange(nextScreen) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('screen', nextScreen)
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <>
      <SurfaceCard title="Analise">
        <div className="analysis-switcher">
          <div className="analysis-switcher__copy">
            <span className="text-overline">Categoria</span>
            <p className="text-section-title">Selecione a tela de analise</p>
          </div>

          <div className="ui-field analysis-switcher__field">
            <label className="ui-label" htmlFor="analysis-screen-select">
              Tela
            </label>
            <Select
              id="analysis-screen-select"
              className="ui-select"
              value={activeRoute.path}
              onChange={(event) => handleScreenChange(event.target.value)}
            >
              {analysisRoutes.map((route) => (
                <option key={route.path} value={route.path}>
                  {route.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </SurfaceCard>

      <NativeModuleWorkspace route={activeRoute} />
    </>
  )
}

export default AnalysisPage


