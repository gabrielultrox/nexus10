import NativeModulePage from './NativeModulePage'
import { getRouteByPathname } from '../utils/routeCatalog'

function ReportsPage() {
  return <NativeModulePage route={getRouteByPathname('/reports')} />
}

export default ReportsPage
