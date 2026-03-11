import { useLocation, useNavigate, useParams } from 'react-router-dom';

import SalesModule from '../modules/sales/components/SalesModule';

function SalesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { saleId } = useParams();
  const isNew = location.pathname === '/sales/new';
  const viewMode = isNew ? 'create' : saleId ? 'detail' : 'list';

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
          <button
            type="button"
            className={`ui-button ${viewMode === 'list' ? 'ui-button--secondary' : 'ui-button--ghost'}`}
            onClick={() => navigate('/sales')}
          >
            Lista de vendas
          </button>
          <button
            type="button"
            className={`ui-button ${viewMode === 'create' ? 'ui-button--secondary' : 'ui-button--primary'}`}
            onClick={() => navigate('/sales/new')}
          >
            Nova venda
          </button>
          <button
            type="button"
            className={`ui-button ${viewMode === 'detail' ? 'ui-button--secondary' : 'ui-button--ghost'}`}
            onClick={() => navigate(saleId ? `/sales/${saleId}` : '/sales')}
            disabled={!saleId}
          >
            Detalhe da venda
          </button>
        </div>
      </section>

      <SalesModule
        saleId={saleId ?? null}
        viewMode={viewMode}
        onOpenCreate={() => navigate('/sales/new')}
        onOpenDetail={(nextSaleId) => navigate(`/sales/${nextSaleId}`)}
        onOpenList={() => navigate('/sales')}
      />
    </div>
  );
}

export default SalesPage;
