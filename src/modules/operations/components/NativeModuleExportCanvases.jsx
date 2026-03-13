function NativeModuleExportCanvases({
  routePath,
  scheduleImageRef,
  scheduleMachinesImageRef,
  machineChecklistImageRef,
  visibleRecords,
  usedScheduleMachines,
  metrics,
  formatChecklistDate,
  session,
  presentMachineChecklistRecords,
}) {
  return (
    <>
      {routePath === 'schedule' ? (
        <div className="schedule-export-image" aria-hidden="true">
          <div ref={scheduleImageRef} className="schedule-export-image__canvas">
            <header className="schedule-export-image__header">
              <div>
                <span className="schedule-export-image__eyebrow">Nexus 10 ERP</span>
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
                      <span>Janela</span>
                      <strong>{record.window}</strong>
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
                <span className="schedule-export-image__eyebrow">Nexus 10 ERP</span>
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
                <span className="schedule-export-image__eyebrow">Nexus 10 ERP</span>
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
    </>
  )
}

export default NativeModuleExportCanvases
