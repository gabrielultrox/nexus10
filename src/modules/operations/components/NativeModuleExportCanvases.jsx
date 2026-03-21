function NativeModuleExportCanvases({
  routePath,
  scheduleImageRef,
  scheduleMachinesImageRef,
  machineChecklistImageRef,
  changeDeliveredImageRef,
  deliveryReadingClosedImageRef,
  advancesPaidImageRef,
  visibleRecords,
  usedScheduleMachines,
  metrics,
  formatChecklistDate,
  formatCurrencyValue,
  session,
  presentMachineChecklistRecords,
  deliveredChangeRecords,
  deliveredChangeTotalValue,
  deliveredChangeCourierCount,
  closedDeliveryRecords,
  closedDeliveryCourierCount,
  paidAdvanceRecords,
  paidAdvanceTotalValue,
  paidAdvanceRecipientCount,
}) {
  function getScheduleEntryTime(windowLabel = '') {
    return String(windowLabel)
      .replace(/\s+/g, '')
      .split('-')[0]
      .trim()
  }

  return (
    <>
      {routePath === 'schedule' ? (
        <div className="schedule-export-image" aria-hidden="true">
          <div ref={scheduleImageRef} className="schedule-export-image__canvas">
            <header className="schedule-export-image__header">
              <div>
            <span className="schedule-export-image__eyebrow">NEXUS</span>
                <h2 className="schedule-export-image__title">Escala do dia</h2>
                <p className="schedule-export-image__meta">{formatChecklistDate()}</p>
              </div>
              <div className="schedule-export-image__stamp">
                <span>Turno ativo</span>
                <strong>{visibleRecords.length} entregadores</strong>
              </div>
            </header>

            <div className="schedule-export-image__metrics">
              {metrics.slice(0, 3).map((metric) => (
                <article key={metric.label} className="schedule-export-image__metric">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.meta}</small>
                </article>
              ))}
            </div>

            <div className="schedule-export-image__grid">
              {visibleRecords.map((record) => (
                <article key={record.id} className="schedule-export-image__card">
                  <div className="schedule-export-image__card-top">
                    <strong>{record.courier}</strong>
                    <span>{record.status}</span>
                  </div>
                  <div className="schedule-export-image__card-body">
                    <p>
                      <span>Entrada</span>
                      <strong>{getScheduleEntryTime(record.window)}</strong>
                    </p>
                    <p>
                      <span>Maquininha do dia</span>
                      <strong>{record.machine}</strong>
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <footer className="schedule-export-image__footer">
              <span>Gerado automaticamente pelo ERP operacional</span>
              <strong>{session?.operatorName ?? session?.displayName ?? 'Operador local'}</strong>
            </footer>
          </div>
        </div>
      ) : null}

      {routePath === 'schedule' ? (
        <div className="schedule-export-image" aria-hidden="true">
          <div
            ref={scheduleMachinesImageRef}
            className="schedule-export-image__canvas schedule-export-image__canvas--schedule-machines"
          >
            <header className="schedule-export-image__header">
              <div>
            <span className="schedule-export-image__eyebrow">NEXUS</span>
                <h2 className="schedule-export-image__title">Maquininhas usadas no dia</h2>
                <p className="schedule-export-image__meta">{formatChecklistDate()}</p>
              </div>
              <div className="schedule-export-image__stamp">
                <span>Uso na escala</span>
                <strong>{usedScheduleMachines.length} maquininhas</strong>
              </div>
            </header>

            <div className="schedule-export-image__metrics">
              <article className="schedule-export-image__metric">
                <span>Maquininhas usadas</span>
                <strong>{usedScheduleMachines.length}</strong>
                <small>Dispositivos vinculados na escala de hoje</small>
              </article>
              <article className="schedule-export-image__metric">
                <span>Entregadores com maquina</span>
                <strong>{usedScheduleMachines.reduce((total, machine) => total + machine.couriers.length, 0)}</strong>
                <small>Registros da escala com maquininha do dia</small>
              </article>
              <article className="schedule-export-image__metric">
                <span>Turno ativo</span>
                <strong>{visibleRecords.length}</strong>
                <small>Entregadores monitorados na exportacao</small>
              </article>
            </div>

            <div className="schedule-export-image__used-machine-grid">
              {usedScheduleMachines.map((machine) => (
                <article key={machine.device} className="schedule-export-image__used-machine-card">
                  <div className="schedule-export-image__used-machine-top">
                    <strong className="schedule-export-image__machine-number">{machine.device}</strong>
                    <span className="schedule-export-image__machine-badge schedule-export-image__machine-badge--present">
                      Em uso
                    </span>
                  </div>

                  <div className="schedule-export-image__used-machine-body">
                    <span className="schedule-export-image__used-machine-label">Entregadores</span>
                    <div className="schedule-export-image__used-machine-list">
                      {machine.couriers.map((courier) => (
                        <p key={`${machine.device}-${courier}`} className="schedule-export-image__used-machine-courier">
                          {courier}
                        </p>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <footer className="schedule-export-image__footer">
              <span>Gerado automaticamente pelo ERP operacional</span>
              <strong>{session?.operatorName ?? session?.displayName ?? 'Operador local'}</strong>
            </footer>
          </div>
        </div>
      ) : null}

      {routePath === 'machines' ? (
        <div className="schedule-export-image" aria-hidden="true">
          <div
            ref={machineChecklistImageRef}
            className="schedule-export-image__canvas schedule-export-image__canvas--machines"
          >
            <header className="schedule-export-image__header">
              <div>
            <span className="schedule-export-image__eyebrow">NEXUS</span>
                <h2 className="schedule-export-image__title">Maquininhas presentes do dia</h2>
                <p className="schedule-export-image__meta">{formatChecklistDate()}</p>
              </div>
              <div className="schedule-export-image__stamp">
                <span>Presentes hoje</span>
                <strong>{presentMachineChecklistRecords.length} dispositivos</strong>
              </div>
            </header>

            <div className="schedule-export-image__metrics">
              {metrics.slice(0, 3).map((metric) => (
                <article key={metric.label} className="schedule-export-image__metric">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </article>
              ))}
            </div>

            <div className="schedule-export-image__machine-grid">
              {presentMachineChecklistRecords.map((record) => (
                <article
                  key={record.id}
                  className="schedule-export-image__machine-card schedule-export-image__machine-card--present"
                >
                  <strong className="schedule-export-image__machine-number">{record.device}</strong>
                  <span className="schedule-export-image__machine-badge schedule-export-image__machine-badge--present">
                    Presente
                  </span>
                </article>
              ))}
            </div>

            <footer className="schedule-export-image__footer">
              <span>Gerado automaticamente pelo ERP operacional</span>
              <strong>{session?.operatorName ?? session?.displayName ?? 'Operador local'}</strong>
            </footer>
          </div>
        </div>
      ) : null}

      {routePath === 'change' ? (
        <div className="schedule-export-image" aria-hidden="true">
          <div
            ref={changeDeliveredImageRef}
            className="schedule-export-image__canvas schedule-export-image__canvas--changes"
          >
            <header className="schedule-export-image__header">
              <div>
                <span className="schedule-export-image__eyebrow">NEXUS</span>
                <h2 className="schedule-export-image__title">Trocos entregues do dia</h2>
                <p className="schedule-export-image__meta">{formatChecklistDate()}</p>
              </div>
              <div className="schedule-export-image__stamp">
                <span>Retornos confirmados</span>
                <strong>{deliveredChangeRecords.length} trocos</strong>
              </div>
            </header>

            <div className="schedule-export-image__metrics">
              <article className="schedule-export-image__metric">
                <span>Total entregue</span>
                <strong>{formatCurrencyValue(deliveredChangeTotalValue)}</strong>
                <small>Soma dos trocos concluidos no dia</small>
              </article>
              <article className="schedule-export-image__metric">
                <span>Entregadores</span>
                <strong>{deliveredChangeCourierCount}</strong>
                <small>Equipe que recebeu troco concluido hoje</small>
              </article>
              <article className="schedule-export-image__metric">
                <span>Conferencia</span>
                <strong>{deliveredChangeRecords.length}</strong>
                <small>Registros prontos para exportar e imprimir</small>
              </article>
            </div>

            <div className="schedule-export-image__grid">
              {deliveredChangeRecords.map((record) => (
                <article key={record.id} className="schedule-export-image__card">
                  <div className="schedule-export-image__card-top">
                    <strong>{record.destination || 'Entregador nao informado'}</strong>
                    <span>Concluido</span>
                  </div>
                  <div className="schedule-export-image__card-body schedule-export-image__card-body--stack">
                    <p>
                      <span>Operador</span>
                      <strong>{record.origin || 'Nao informado'}</strong>
                    </p>
                    <p>
                      <span>Valor</span>
                      <strong>{record.value || formatCurrencyValue(0)}</strong>
                    </p>
                    <p>
                      <span>Retorno</span>
                      <strong>
                        {record.returnedAt && record.returnedBy
                          ? `${record.returnedBy} - ${record.returnedAt}`
                          : 'Confirmado sem horario informado'}
                      </strong>
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <footer className="schedule-export-image__footer">
              <span>Gerado automaticamente pelo ERP operacional</span>
              <strong>{session?.operatorName ?? session?.displayName ?? 'Operador local'}</strong>
            </footer>
          </div>
        </div>
      ) : null}

      {routePath === 'delivery-reading' ? (
        <div className="schedule-export-image" aria-hidden="true">
          <div
            ref={deliveryReadingClosedImageRef}
            className="schedule-export-image__canvas schedule-export-image__canvas--changes"
          >
            <header className="schedule-export-image__header">
              <div>
                <span className="schedule-export-image__eyebrow">NEXUS</span>
                <h2 className="schedule-export-image__title">Leituras fechadas do dia</h2>
                <p className="schedule-export-image__meta">{formatChecklistDate()}</p>
              </div>
              <div className="schedule-export-image__stamp">
                <span>Entregas fechadas</span>
                <strong>{closedDeliveryRecords.length} leituras</strong>
              </div>
            </header>

            <div className="schedule-export-image__metrics">
              <article className="schedule-export-image__metric">
                <span>Fechadas</span>
                <strong>{closedDeliveryRecords.length}</strong>
                <small>Leituras encerradas no turno atual</small>
              </article>
              <article className="schedule-export-image__metric">
                <span>Entregadores</span>
                <strong>{closedDeliveryCourierCount}</strong>
                <small>Entregadores com entrega fechada hoje</small>
              </article>
              <article className="schedule-export-image__metric">
                <span>Auditoria</span>
                <strong>{closedDeliveryRecords.filter((record) => record.turbo).length}</strong>
                <small>Leituras fechadas marcadas como turbo</small>
              </article>
            </div>

            <div className="schedule-export-image__grid">
              {closedDeliveryRecords.map((record) => (
                <article key={record.id} className="schedule-export-image__card">
                  <div className="schedule-export-image__card-top">
                    <strong>{record.courier || 'Entregador nao informado'}</strong>
                    <span>Fechada</span>
                  </div>
                  <div className="schedule-export-image__card-body schedule-export-image__card-body--stack">
                    <p>
                      <span>Codigo</span>
                      <strong>{record.deliveryCode || 'Nao informado'}</strong>
                    </p>
                    <p>
                      <span>Turno</span>
                      <strong>{record.turn || 'Nao informado'}</strong>
                    </p>
                    <p>
                      <span>Tipo</span>
                      <strong>{record.turbo ? 'Turbo' : 'Padrao'}</strong>
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <footer className="schedule-export-image__footer">
              <span>Gerado automaticamente pelo ERP operacional</span>
              <strong>{session?.operatorName ?? session?.displayName ?? 'Operador local'}</strong>
            </footer>
          </div>
        </div>
      ) : null}

      {routePath === 'advances' ? (
        <div className="schedule-export-image" aria-hidden="true">
          <div
            ref={advancesPaidImageRef}
            className="schedule-export-image__canvas schedule-export-image__canvas--changes"
          >
            <header className="schedule-export-image__header">
              <div>
                <span className="schedule-export-image__eyebrow">NEXUS</span>
                <h2 className="schedule-export-image__title">Vales baixados do dia</h2>
                <p className="schedule-export-image__meta">{formatChecklistDate()}</p>
              </div>
              <div className="schedule-export-image__stamp">
                <span>Baixas confirmadas</span>
                <strong>{paidAdvanceRecords.length} vales</strong>
              </div>
            </header>

            <div className="schedule-export-image__metrics">
              <article className="schedule-export-image__metric">
                <span>Total baixado</span>
                <strong>{formatCurrencyValue(paidAdvanceTotalValue)}</strong>
                <small>Soma dos vales baixados no dia</small>
              </article>
              <article className="schedule-export-image__metric">
                <span>Entregadores</span>
                <strong>{paidAdvanceRecipientCount}</strong>
                <small>Entregadores com vale baixado hoje</small>
              </article>
              <article className="schedule-export-image__metric">
                <span>Controle</span>
                <strong>{paidAdvanceRecords.length}</strong>
                <small>Registros prontos para conferencia e impressao</small>
              </article>
            </div>

            <div className="schedule-export-image__grid">
              {paidAdvanceRecords.map((record) => (
                <article key={record.id} className="schedule-export-image__card">
                  <div className="schedule-export-image__card-top">
                    <strong>{record.recipient || 'Entregador nao informado'}</strong>
                    <span>Baixado</span>
                  </div>
                  <div className="schedule-export-image__card-body schedule-export-image__card-body--stack">
                    <p>
                      <span>Valor</span>
                      <strong>{record.value || formatCurrencyValue(0)}</strong>
                    </p>
                    <p>
                      <span>Data</span>
                      <strong>{record.date || 'Nao informada'}</strong>
                    </p>
                    <p>
                      <span>Motivo</span>
                      <strong>{record.reason || 'Nao informado'}</strong>
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <footer className="schedule-export-image__footer">
              <span>Gerado automaticamente pelo ERP operacional</span>
              <strong>{session?.operatorName ?? session?.displayName ?? 'Operador local'}</strong>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default NativeModuleExportCanvases
