import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import DashboardPage from '../pages/DashboardPage'
import LoginPage from '../pages/LoginPage'
import { ToastProvider } from '../hooks'

const mockNavigate = vi.fn()
const mockUseAuth = vi.fn()
const mockUseStore = vi.fn()
const mockHasStoredPin = vi.fn()
const mockVerifyStoredPin = vi.fn()
const mockPlayError = vi.fn()
const mockPlaySuccess = vi.fn()
const mockSubscribeToDashboardSources = vi.fn()
const mockLoadDashboardOperationalSources = vi.fn()
const mockBuildDashboardData = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null }),
  }
})

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../contexts/StoreContext', () => ({
  useStore: () => mockUseStore(),
}))

vi.mock('../services/localAccess', () => ({
  DEFAULT_ACCESS_PIN: '0101',
  LOCAL_RECORDS_EVENT: 'nexus10:local-records',
  hasStoredPin: () => mockHasStoredPin(),
  verifyStoredPin: (value) => mockVerifyStoredPin(value),
}))

vi.mock('../services/soundManager', () => ({
  playError: () => mockPlayError(),
  playSuccess: () => mockPlaySuccess(),
}))

vi.mock('../components/theme/ThemeToggle', () => ({
  default: function ThemeToggleMock() {
    return (
      <button type="button" aria-label="Alternar tema">
        Tema
      </button>
    )
  },
}))

vi.mock('../services/firebase', () => ({
  firebaseReady: true,
  canUseRemoteSync: () => false,
}))

vi.mock('../services/firebaseAuthRuntime', () => ({
  firebaseReady: true,
  ensureRemoteSession: vi.fn(async () => null),
  clearRemoteSession: vi.fn(async () => {}),
}))

vi.mock('../services/dashboard', () => ({
  getDefaultDashboardPeriod: () => ({ startDate: '2026-03-20', endDate: '2026-03-27' }),
  loadDashboardOperationalSources: () => mockLoadDashboardOperationalSources(),
  subscribeToDashboardSources: (...args) => mockSubscribeToDashboardSources(...args),
  buildDashboardData: (...args) => mockBuildDashboardData(...args),
}))

vi.mock('../components/dashboard/DashboardCharts', () => ({
  default: function DashboardChartsMock() {
    return <section aria-label="Graficos do dashboard">Graficos</section>
  },
}))

describe('Accessibility audit', () => {
  beforeEach(() => {
    vi.useRealTimers()
    mockNavigate.mockReset()
    mockPlayError.mockReset()
    mockPlaySuccess.mockReset()
    mockUseAuth.mockReturnValue({
      signIn: vi.fn(),
      authError: '',
      operatorOptions: ['Gabriel', 'Tito'],
      getLastOperator: () => 'Gabriel',
    })
    mockHasStoredPin.mockReturnValue(false)
    mockVerifyStoredPin.mockReturnValue(true)
    mockUseStore.mockReturnValue({
      currentStoreId: 'store-1',
    })
    mockLoadDashboardOperationalSources.mockReturnValue({
      scheduleRecords: [],
      machineChecklist: [],
      changeRecords: [],
      advanceRecords: [],
      occurrenceRecords: [],
      courierRecords: [],
      deliveryReadingRecords: [],
      financialPendingRecords: [],
      cashState: {
        status: 'fechado',
        currentBalance: 0,
        initialBalance: 0,
        pendingCount: 0,
      },
    })
    mockSubscribeToDashboardSources.mockImplementation(
      (_storeId, { onSales, onOrders, onInventoryItems, onFinancialEntries }) => {
        onSales?.([])
        onOrders?.([])
        onInventoryItems?.([])
        onFinancialEntries?.([])
        return () => {}
      },
    )
    mockBuildDashboardData.mockReturnValue({
      kpis: [
        {
          id: 'orders',
          label: 'Pedidos',
          value: '12',
          meta: 'sem atraso',
          badgeText: 'ok',
          badgeClass: 'ui-badge--success',
        },
      ],
      charts: {
        primary: { title: 'Faturamento', description: 'Serie 1', kind: 'trend', data: [] },
        secondary: { title: 'Pedidos por hora', description: 'Serie 2', kind: 'bar', data: [] },
      },
      operations: {
        hero: {
          eyebrow: 'Loja teste - Tarde',
          title: 'Leitura executiva da operacao',
          description: 'Resumo do turno',
          statusLabel: 'Operacao sob controle',
          statusTone: 'success',
          signals: [],
          actions: [],
        },
        reminders: [
          {
            id: 'advances-open',
            type: 'warning',
            title: 'Existe 1 vale em aberto',
            message: 'Desconte do entregador antes do fechamento do turno.',
            route: '/advances',
          },
        ],
        commandCenter: [],
        risks: [],
        financialPulse: [],
        deliveryPulse: [],
        integrationWatch: [],
        activeShift: [],
        topProducts: [],
        lowStock: [],
      },
    })
  })

  it('keeps core components free from axe violations', async () => {
    const { container } = render(
      <div>
        <Button title="Abrir notificacoes">
          <span aria-hidden="true">+</span>
        </Button>
        <Table
          caption="Tabela de pedidos"
          columns={[{ key: 'name', label: 'Pedido' }]}
          data={[{ id: '1', name: 'Pedido 1' }]}
        />
        <Select
          aria-label="Selecionar operador"
          searchable
          value="gabriel"
          options={[
            { value: 'gabriel', label: 'Gabriel' },
            { value: 'tito', label: 'Tito' },
          ]}
        />
      </div>,
    )

    expect(await axe(container)).toHaveNoViolations()
  })

  it('supports keyboard escape on modal and keeps dialog accessible', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <Modal open title="Detalhes da venda" onClose={onClose}>
        <button type="button">Acao</button>
      </Modal>,
    )

    expect(await axe(container)).toHaveNoViolations()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders login page shell without accessibility violations', async () => {
    const { container } = render(
      <ToastProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </ToastProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Confirmar PIN local' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Digito 0' })).toBeInTheDocument()

    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders dashboard page without accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard Operacional' })).toBeInTheDocument()
    })

    expect(await axe(container)).toHaveNoViolations()
  })
})
