import PageIntro from '../components/common/PageIntro';
import CustomersModule from '../modules/customers/components/CustomersModule';

function CustomersPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="CRM"
        title="Clientes"
        description="Base real de clientes da store com dados essenciais para atendimento, entrega e uso futuro no PDV."
      />

      <CustomersModule />
    </div>
  );
}

export default CustomersPage;
