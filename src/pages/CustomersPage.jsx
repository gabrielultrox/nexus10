import PageIntro from '../components/common/PageIntro';
import CustomersModule from '../modules/customers/components/CustomersModule';

function CustomersPage() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="CRM"
        title="Clientes"
        description="Mantenha a base de clientes organizada para atendimento, entrega e reaproveitamento rapido no pedido."
      />

      <CustomersModule />
    </div>
  );
}

export default CustomersPage;
