function NativeModuleExportCanvases({
  routePath,
  scheduleImageRef,
  machineChecklistImageRef,
  visibleRecords,
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
