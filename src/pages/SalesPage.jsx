import { useLocation, useNavigate, useParams } from 'react-router-dom';

import PageTabs from '../components/common/PageTabs';
import SalesModule from '../modules/sales/components/SalesModule';

function SalesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { saleId } = useParams();
  const isNew = location.pathname === '/sales/new';
  const viewMode = isNew ? 'create' : saleId ? 'detail' : 'list';
  const salesTabs = [
    { id: 'list', label: 'Lista de vendas' },
    { id: 'form', label: 'Nova venda' },
    ...(saleId ? [{ id: 'detail', label: 'Detalhe da venda' }] : []),
  ];
  const activeTab = viewMode === 'list' ? 'list' : viewMode === 'create' ? 'form' : 'detail';

  function handleTabChange(tabId) {
    if (tabId === 'list') {
      navigate('/sales');
      return;
    }

    if (tabId === 'form') {
      navigate('/sales/new', {
        state: { resetNonce: Date.now() },
      });
      return;
    }

    navigate(saleId ? `/sales/${saleId}` : '/sales');
  }

  return (
    <div className="workspace-shell workspace-shell--sales">
      <section className="workspace-header">
        <div className="workspace-header__copy">
          <p className="workspace-header__eyebrow">Vendas</p>
          <h2 className="workspace-header__title">
            {viewMode === 'create' ? 'Nova venda' : viewMode === 'detail' ? 'Detalhe da venda' : 'Lista de vendas'}
          </h2>
          <p className="workspace-header__description">
            {viewMode === 'create'
              ? 'Lance uma venda em uma tela dedicada, com formulario completo e leitura operacional mais clara.'
              : viewMode === 'detail'
                ? 'Consulte a venda selecionada em uma tela exclusiva, com status, totais e efeitos publicados.'
                : 'Acompanhe vendas reais em uma tela dedicada, com filtros claros e acesso rapido ao detalhe.'}
          </p>
        </div>

        <div className="workspace-nav">
          <PageTabs tabs={salesTabs} activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      </section>

      <SalesModule
        saleId={saleId ?? null}
        viewMode={viewMode}
        formResetToken={location.state?.resetNonce ?? null}
        onOpenCreate={() => navigate('/sales/new', { state: { resetNonce: Date.now() } })}
        onOpenDetail={(nextSaleId) => navigate(`/sales/${nextSaleId}`)}
        onOpenList={() => navigate('/sales')}
      />
    </div>
  );
}

export default SalesPage;
