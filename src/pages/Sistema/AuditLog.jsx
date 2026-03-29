import PageIntro from '../../components/common/PageIntro'
import AuditLogModule from '../../modules/audit/components/AuditLogModule'

function SistemaAuditLogPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Sistema"
        title="Audit Log"
        description="Registro completo de operacoes criticas com contexto, before/after e trilha de investigacao."
      />
      <AuditLogModule />
    </div>
  )
}

export default SistemaAuditLogPage
