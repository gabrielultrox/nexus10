import '../../styles/assistant.css';

import { useAssistant } from './AssistantContextProvider';
import AssistantInput from './AssistantInput';
import AssistantMessageList from './AssistantMessageList';
import AssistantQuickActions from './AssistantQuickActions';

function AssistantPanel() {
  const {
    closePanel,
    handleQuickAction,
    isLoading,
    isOpen,
    messages,
    navigateTo,
    openPanel,
    pageContext,
    quickActions,
    sendMessage,
  } = useAssistant();

  return (
    <>
      <button type="button" className="assistant-fab" onClick={openPanel}>
        <span className="assistant-fab__label">NEXA</span>
      </button>

      <div className={`assistant-shell ${isOpen ? 'assistant-shell--open' : ''}`}>
        <button type="button" className="assistant-backdrop" aria-label="Fechar NEXA" onClick={closePanel} />

        <aside className={`assistant-panel ${isOpen ? 'assistant-panel--open' : ''}`}>
          <header className="assistant-panel__header">
            <div>
              <p className="assistant-panel__eyebrow">NEXA</p>
              <h2 className="assistant-panel__title">Assistente Operacional</h2>
              <p className="assistant-panel__context">
                {pageContext.routeTitle ?? 'ERP'}
                {pageContext.orderId ? ` - Pedido ${pageContext.orderId}` : ''}
                {pageContext.saleId ? ` - Venda ${pageContext.saleId}` : ''}
              </p>
            </div>

            <button type="button" className="ui-button ui-button--ghost" onClick={closePanel}>
              Fechar
            </button>
          </header>

          <div className="assistant-panel__body">
            <section className="assistant-panel__quick-actions">
              <div className="assistant-section-heading">
                <span className="assistant-section-heading__eyebrow">Atalhos</span>
                <strong>Acesso rapido</strong>
              </div>
              <AssistantQuickActions actions={quickActions} onAction={handleQuickAction} />
            </section>

            <section className="assistant-panel__conversation">
              <div className="assistant-section-heading assistant-section-heading--conversation">
                <span className="assistant-section-heading__eyebrow">Conversa</span>
                <strong>Perguntas e busca operacional</strong>
              </div>
              <AssistantMessageList messages={messages} onNavigate={navigateTo} />
              <footer className="assistant-panel__footer">
                <AssistantInput disabled={isLoading} onSend={sendMessage} />
              </footer>
            </section>
          </div>
        </aside>
      </div>
    </>
  );
}

export default AssistantPanel;
