import { useEffect, useMemo, useRef, useState } from 'react'

import PageIntro from '../components/common/PageIntro'
import SurfaceCard from '../components/common/SurfaceCard'
import ZeDeliveryErrorModal from '../components/integrations/ZeDeliveryErrorModal'
import ZeDeliveryLogs from '../components/integrations/ZeDeliveryLogs'
import ZeDeliveryStatus from '../components/integrations/ZeDeliveryStatus'
import { Button, ErrorDisplay, LoadingOverlay, Select } from '../components/ui'
import { useStore } from '../hooks'
import { useTriggerZeDeliverySync } from '../hooks/mutations/useTriggerZeDeliverySync'
import { useZeDeliverySyncStatus } from '../hooks/queries/useZeDeliverySyncStatus'

const INTERVAL_OPTIONS = [
  { value: '5', label: '5 minutos' },
  { value: '10', label: '10 minutos' },
  { value: '15', label: '15 minutos' },
  { value: '30', label: '30 minutos' },
]

const INITIAL_SETTINGS = {
  enabled: true,
  intervalMinutes: 10,
  notificationsEnabled: false,
  notificationWebhookUrl: '',
}

function ZeDeliveryIntegrationPage() {
  const { currentStoreId } = useStore()
  const logsRef = useRef(null)
  const [selectedLog, setSelectedLog] = useState(null)
  const [retryLogId, setRetryLogId] = useState(null)
  const [settingsDraft, setSettingsDraft] = useState(INITIAL_SETTINGS)

  const {
    data: dashboard,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useZeDeliverySyncStatus({
    storeId: currentStoreId,
  })
  const { triggerSyncMutation, retrySyncMutation, updateSettingsMutation } =
    useTriggerZeDeliverySync({
      storeId: currentStoreId,
    })

  const currentStoreDashboard = useMemo(() => {
    if (!dashboard?.stores?.length) {
      return null
    }

    return (
      dashboard.stores.find((storeDashboard) => storeDashboard.storeId === currentStoreId) ??
      dashboard.stores[0]
    )
  }, [currentStoreId, dashboard])

  useEffect(() => {
    if (!currentStoreDashboard?.settings) {
      return
    }

    setSettingsDraft(currentStoreDashboard.settings)
  }, [currentStoreDashboard])

  if (!currentStoreId) {
    return (
      <div className="page-stack">
        <PageIntro
          eyebrow="Integracoes"
          title="Ze Delivery"
          description="Selecione uma loja para visualizar a operacao de sincronizacao."
        />
        <ErrorDisplay
          code="ZE_STORE_REQUIRED"
          title="Nenhuma loja selecionada"
          message="O dashboard do Ze Delivery depende de uma loja ativa no contexto atual."
          suggestion="Escolha a loja no seletor global e recarregue esta pagina."
        />
      </div>
    )
  }

  const effectiveSettings = currentStoreDashboard?.settings ?? settingsDraft
  const logs = dashboard?.recentRuns ?? []
  const stats24h = dashboard?.stats24h ?? {
    deliveriesSynced: 0,
    errors: 0,
    averageDurationMs: 0,
    failureRate: 0,
    totalRuns: 0,
  }
  const lastSyncError = currentStoreDashboard?.status?.lastSyncError ?? ''

  if (!isLoading && !error && !currentStoreDashboard) {
    return (
      <div className="page-stack">
        <PageIntro
          eyebrow="Integracoes"
          title="Ze Delivery"
          description="Nenhum dashboard disponivel para a loja selecionada."
        />
        <ErrorDisplay
          code="ZE_DASHBOARD_EMPTY"
          title="Sem dados de sincronizacao"
          message="Ainda nao ha execucoes ou configuracao persistida para esta loja."
          suggestion="Execute uma sincronizacao manual para inicializar o historico."
          actionLabel="Sincronizar agora"
          onAction={() =>
            triggerSyncMutation.mutate({
              storeId: currentStoreId,
              maxOrders: 100,
            })
          }
        />
      </div>
    )
  }

  return (
    <div className="page-stack ze-delivery-page">
      <PageIntro
        eyebrow="Integracoes"
        title="Ze Delivery"
        description="Painel operacional de sincronizacao, saude do scheduler, historico recente e configuracao por loja."
      />

      {error ? (
        <ErrorDisplay
          code="ZE_DASHBOARD_LOAD"
          title="Falha ao carregar o dashboard"
          message={error.message ?? 'Nao foi possivel consultar a integracao Ze Delivery.'}
          suggestion="Revise autenticacao, status do backend e estado do scheduler."
          actionLabel="Tentar novamente"
          onAction={() => refetch()}
        />
      ) : null}

      <div className="ze-delivery-page__stack">
        <ZeDeliveryStatus
          storeId={currentStoreId}
          summary={dashboard?.summary ?? {}}
          stats24h={stats24h}
          settings={effectiveSettings}
          onSyncNow={() =>
            triggerSyncMutation.mutate({
              storeId: currentStoreId,
              maxOrders: 100,
            })
          }
          onToggleEnabled={(enabled) => {
            setSettingsDraft((current) => ({
              ...current,
              enabled,
            }))

            const nextSettings = {
              ...settingsDraft,
              enabled,
            }

            updateSettingsMutation.mutate({
              storeId: currentStoreId,
              ...nextSettings,
            })
          }}
          onViewLogs={() => logsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          syncInProgress={triggerSyncMutation.isPending}
          toggleInProgress={updateSettingsMutation.isPending}
        />

        <div className="ze-delivery-page__grid">
          <SurfaceCard title="Configuracao da sincronizacao">
            <div className="ze-delivery-settings">
              <div className="ui-field">
                <label className="ui-label" htmlFor="ze-delivery-interval">
                  Intervalo
                </label>
                <Select
                  id="ze-delivery-interval"
                  value={String(settingsDraft.intervalMinutes)}
                  options={INTERVAL_OPTIONS}
                  onValueChange={(value) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      intervalMinutes: Number(value),
                    }))
                  }
                />
              </div>

              <div className="ze-delivery-settings__toggle-row">
                <div>
                  <span className="ze-delivery-settings__label">Notificacoes em erro</span>
                  <p className="ze-delivery-settings__hint">
                    Dispara alerta quando a sincronizacao falhar.
                  </p>
                </div>
                <Button
                  variant={settingsDraft.notificationsEnabled ? 'primary' : 'secondary'}
                  onClick={() =>
                    setSettingsDraft((current) => ({
                      ...current,
                      notificationsEnabled: !current.notificationsEnabled,
                    }))
                  }
                >
                  {settingsDraft.notificationsEnabled ? 'Ativado' : 'Desativado'}
                </Button>
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="ze-delivery-webhook">
                  Webhook de notificacao
                </label>
                <input
                  id="ze-delivery-webhook"
                  className="ui-input"
                  value={settingsDraft.notificationWebhookUrl}
                  onChange={(event) =>
                    setSettingsDraft((current) => ({
                      ...current,
                      notificationWebhookUrl: event.target.value,
                    }))
                  }
                  placeholder="https://hooks.seu-alerta.com/ze-delivery"
                />
              </div>

              <div className="ze-delivery-settings__actions">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setSettingsDraft(currentStoreDashboard?.settings ?? INITIAL_SETTINGS)
                  }
                  disabled={updateSettingsMutation.isPending}
                >
                  Reverter
                </Button>
                <Button
                  variant="primary"
                  onClick={() =>
                    updateSettingsMutation.mutate({
                      storeId: currentStoreId,
                      ...settingsDraft,
                    })
                  }
                  loading={updateSettingsMutation.isPending}
                  loadingLabel="Salvando configuracao"
                >
                  Salvar configuracao
                </Button>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Sinal operacional">
            <div className="ze-delivery-health">
              <div className="ze-delivery-health__item">
                <span className="ze-delivery-health__label">Workers</span>
                <strong>{dashboard?.scheduler?.workers?.length ?? 0}</strong>
              </div>
              <div className="ze-delivery-health__item">
                <span className="ze-delivery-health__label">Erros recentes</span>
                <strong>{dashboard?.recentErrors?.length ?? 0}</strong>
              </div>
              <div className="ze-delivery-health__item">
                <span className="ze-delivery-health__label">Total de ciclos</span>
                <strong>{stats24h.totalRuns}</strong>
              </div>
              <div className="ze-delivery-health__item">
                <span className="ze-delivery-health__label">Ultimo erro</span>
                <strong>{lastSyncError || 'Sem erro registrado'}</strong>
              </div>
            </div>
          </SurfaceCard>
        </div>

        <div ref={logsRef}>
          <ZeDeliveryLogs
            logs={logs}
            loading={isLoading}
            onOpenDetails={(log) => setSelectedLog(log)}
            onRetry={(log) => {
              setRetryLogId(log.id)
              retrySyncMutation.mutate(
                {
                  storeId: log.storeId,
                  maxOrders: 100,
                },
                {
                  onSettled: () => {
                    setRetryLogId(null)
                  },
                },
              )
            }}
            retryingLogId={retrySyncMutation.isPending ? retryLogId : null}
          />
        </div>
      </div>

      <ZeDeliveryErrorModal
        open={Boolean(selectedLog)}
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onRetry={(log) => {
          setRetryLogId(log.id)
          retrySyncMutation.mutate(
            {
              storeId: log.storeId,
              maxOrders: 100,
            },
            {
              onSettled: () => {
                setRetryLogId(null)
              },
            },
          )
        }}
        retrying={retrySyncMutation.isPending}
      />

      <LoadingOverlay active={isFetching && !isLoading} label="Atualizando dashboard Ze Delivery">
        Atualizando dados do scheduler e dos logs recentes.
      </LoadingOverlay>
    </div>
  )
}

export default ZeDeliveryIntegrationPage
