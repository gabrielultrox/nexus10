import { Suspense, lazy } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';

import ProtectedRoute from '../components/auth/ProtectedRoute';
import PublicOnlyRoute from '../components/auth/PublicOnlyRoute';
import EmptyState from '../components/ui/EmptyState';
import { routeDefinitions } from '../utils/routeCatalog';

const MainLayout = lazy(() => import('../components/layout/MainLayout'));
const AnalysisPage = lazy(() => import('../pages/AnalysisPage'));
const AuditLogPage = lazy(() => import('../pages/AuditLogPage'));
const CommerceWorkspaceLayout = lazy(() => import('../components/layout/CommerceWorkspaceLayout'));
const CourierProfilePage = lazy(() => import('../pages/CourierProfilePage'));
const CouriersPage = lazy(() => import('../pages/CouriersPage'));
const CustomersPage = lazy(() => import('../pages/CustomersPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const CashPage = lazy(() => import('../pages/CashPage'));
const HistoryPage = lazy(() => import('../pages/HistoryPage'));
const InventoryPage = lazy(() => import('../pages/InventoryPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const NativeModulePage = lazy(() => import('../pages/NativeModulePage'));
const OrdersPage = lazy(() => import('../pages/OrdersPage'));
const PdvPage = lazy(() => import('../pages/PdvPage'));
const PosReportsPage = lazy(() => import('../pages/PosReportsPage'));
const ProductsPage = lazy(() => import('../pages/ProductsPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const SalesPage = lazy(() => import('../pages/SalesPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const ordersRoute = routeDefinitions.find((route) => route.path === 'orders');
const salesRoute = routeDefinitions.find((route) => route.path === 'sales');

function RouteLoader() {
  return (
    <div className="page-stack page-stack--loading">
      <EmptyState message="Carregando area" />
    </div>
  );
}

function withRouteSuspense(element) {
  return <Suspense fallback={<RouteLoader />}>{element}</Suspense>;
}

function getRouteElement(route) {
  const pageElement = (() => {
    switch (route.path) {
      case 'dashboard':
        return withRouteSuspense(<DashboardPage />);
      case 'couriers':
        return withRouteSuspense(<CouriersPage />);
      case 'analysis':
        return withRouteSuspense(<AnalysisPage />);
      case 'audit-log':
        return withRouteSuspense(<AuditLogPage />);
      case 'cash':
        return withRouteSuspense(<CashPage />);
      case 'history':
        return withRouteSuspense(<HistoryPage />);
      case 'inventory':
        return withRouteSuspense(<InventoryPage />);
      case 'orders':
        return withRouteSuspense(<OrdersPage />);
      case 'pdv':
        return withRouteSuspense(<PdvPage />);
      case 'pos-reports':
        return withRouteSuspense(<PosReportsPage />);
      case 'products':
        return withRouteSuspense(<ProductsPage />);
      case 'sales':
        return withRouteSuspense(<SalesPage />);
      case 'customers':
        return withRouteSuspense(<CustomersPage />);
      case 'reports':
        return withRouteSuspense(<ReportsPage />);
      case 'settings':
        return withRouteSuspense(<SettingsPage />);
      default:
        return withRouteSuspense(<NativeModulePage route={route} />);
    }
  })();

  return <ProtectedRoute requiredRoles={route.requiredRoles}>{pageElement}</ProtectedRoute>;
}

const appChildren = routeDefinitions
  .filter(
    (route) =>
      ![
        'pos',
        'orders',
        'sales',
        'reports',
        'monthly-report',
        'orders-hour',
        'ratings',
      ].includes(route.path),
  )
  .map((route) => ({
    path: route.path,
    element: getRouteElement(route),
  }));

const routes = [
  {
    element: <PublicOnlyRoute />,
    children: [{ path: '/login', element: withRouteSuspense(<LoginPage />) }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: withRouteSuspense(<MainLayout />),
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'pos', element: <Navigate to="/pdv" replace /> },
          { path: 'reports', element: <Navigate to="/analysis?screen=reports" replace /> },
          { path: 'monthly-report', element: <Navigate to="/analysis?screen=monthly-report" replace /> },
          { path: 'orders-hour', element: <Navigate to="/analysis?screen=orders-hour" replace /> },
          { path: 'ratings', element: <Navigate to="/analysis?screen=ratings" replace /> },
          { path: 'finance', element: <Navigate to="/cash" replace /> },
          { path: 'couriers', element: <Navigate to="/couriers/consulta" replace /> },
          { path: 'couriers/consulta', element: getRouteElement(routeDefinitions.find((route) => route.path === 'couriers')) },
          { path: 'couriers/cadastro', element: getRouteElement(routeDefinitions.find((route) => route.path === 'couriers')) },
          { path: 'couriers/:courierId', element: withRouteSuspense(<CourierProfilePage />) },
          ...appChildren,
        ],
      },
      {
        path: '/',
        element: withRouteSuspense(<CommerceWorkspaceLayout />),
        children: [
          { path: 'orders', element: getRouteElement(ordersRoute) },
          { path: 'orders/new', element: getRouteElement(ordersRoute) },
          { path: 'orders/:orderId', element: getRouteElement(ordersRoute) },
          { path: 'orders/:orderId/edit', element: getRouteElement(ordersRoute) },
          { path: 'sales', element: getRouteElement(salesRoute) },
          { path: 'sales/new', element: getRouteElement(salesRoute) },
          { path: 'sales/:saleId', element: getRouteElement(salesRoute) },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
];

function AppRoutes() {
  return useRoutes(routes);
}

export default AppRoutes;
