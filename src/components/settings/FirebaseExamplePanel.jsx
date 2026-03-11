import { useEffect, useState } from 'react';

import { useStore } from '../../contexts/StoreContext';
import { getCurrentUser, loginAnonymously, logout, subscribeToAuthChanges } from '../../services/auth';
import { FIRESTORE_COLLECTIONS } from '../../services/firestoreCollections';
import { firebaseReady } from '../../services/firebase';
import { getStoreDocument, setStoreDocument } from '../../services/firestore';

function FirebaseExamplePanel() {
  const { currentStoreId } = useStore();
  const [user, setUser] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Aguardando interação');
  const [documentPreview, setDocumentPreview] = useState(null);

  useEffect(() => {
    if (!firebaseReady) {
      return undefined;
    }

    setUser(getCurrentUser());

    const unsubscribe = subscribeToAuthChanges((nextUser) => {
      setUser(nextUser);
    });

    return unsubscribe;
  }, []);

  async function handleAnonymousLogin() {
    try {
      await loginAnonymously();
      setStatusMessage('Autenticação anônima realizada com sucesso.');
    } catch (error) {
      setStatusMessage(`Erro no login: ${error.message}`);
    }
  }

  async function handleWriteDemoDocument() {
    try {
      if (!currentStoreId) {
        throw new Error('Nenhuma store ativa disponível para este usuário.');
      }

      await setStoreDocument(
        currentStoreId,
        FIRESTORE_COLLECTIONS.settings,
        'demo_connection',
        {
          environment: 'development',
          scope: 'store-scoped',
          message: 'Conexão básica com Firestore funcionando por storeId.',
        },
        { merge: true },
      );

      setStatusMessage('Documento de demonstração salvo no escopo da store.');
    } catch (error) {
      setStatusMessage(`Erro ao gravar: ${error.message}`);
    }
  }

  async function handleReadDemoDocument() {
    try {
      if (!currentStoreId) {
        throw new Error('Nenhuma store ativa disponível para este usuário.');
      }

      const documentData = await getStoreDocument(
        currentStoreId,
        FIRESTORE_COLLECTIONS.settings,
        'demo_connection',
      );

      setDocumentPreview(documentData);
      setStatusMessage(documentData ? 'Documento carregado com sucesso.' : 'Documento ainda não existe.');
    } catch (error) {
      setStatusMessage(`Erro ao ler: ${error.message}`);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      setStatusMessage('Sessão encerrada com sucesso.');
    } catch (error) {
      setStatusMessage(`Erro ao sair: ${error.message}`);
    }
  }

  return (
    <section className="ui-card firebase-example-panel">
      <div className="firebase-example-panel__inner">
        <header className="firebase-example-panel__header">
          <div>
            <p className="text-overline">Firebase SDK</p>
            <h2 className="text-section-title">Exemplo de uso no app</h2>
          </div>
          <span className={`ui-badge ${firebaseReady ? 'ui-badge--success' : 'ui-badge--danger'}`}>
            {firebaseReady ? 'Configurado' : 'Pendente'}
          </span>
        </header>

        <div className="firebase-example-panel__status">
          <div>
            <span className="text-label">Store ativa</span>
            <strong>{currentStoreId ?? 'Nenhuma store vinculada'}</strong>
          </div>
          <div>
            <span className="text-label">Usuário atual</span>
            <strong>{user?.uid ?? 'Nenhuma sessão ativa'}</strong>
          </div>
          <div>
            <span className="text-label">Status</span>
            <strong>{statusMessage}</strong>
          </div>
        </div>

        <div className="firebase-example-panel__actions">
          <button type="button" className="ui-button ui-button--secondary" onClick={handleAnonymousLogin}>
            Login anônimo
          </button>
          <button type="button" className="ui-button ui-button--ghost" onClick={handleWriteDemoDocument}>
            Gravar demo
          </button>
          <button type="button" className="ui-button ui-button--ghost" onClick={handleReadDemoDocument}>
            Ler demo
          </button>
          <button type="button" className="ui-button ui-button--danger" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="firebase-example-panel__preview">
          <span className="text-label">Preview do documento</span>
          <pre>{documentPreview ? JSON.stringify(documentPreview, null, 2) : 'Sem leitura carregada.'}</pre>
        </div>
      </div>
    </section>
  );
}

export default FirebaseExamplePanel;
