import PageIntro from '../components/common/PageIntro';
import AuditLogModule from '../modules/audit/components/AuditLogModule';

function AuditLogPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Sistema"
        title="Audit Log"
        description="Rastreamento de acoes criticas, alteracoes relevantes e eventos operacionais persistidos."
      />

      <AuditLogModule />
    </div>
  );
}

export default AuditLogPage;
