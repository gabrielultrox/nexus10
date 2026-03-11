import { useEffect, useState } from 'react';

import SurfaceCard from '../common/SurfaceCard';
import { loadIfoodWidgetScript } from '../../services/ifoodWidget';

function IFoodWidgetBridge({ merchantConfig, externalOrderId }) {
  const [statusMessage, setStatusMessage] = useState('Widget do iFood aguardando configuracao.');

  useEffect(() => {
    let active = true;

    async function prepareWidget() {
      if (!merchantConfig?.widgetEnabled || !merchantConfig?.widgetId) {
        setStatusMessage('Widget oficial indisponivel para esta loja.');
        return;
      }

      try {
        await loadIfoodWidgetScript();

        if (!active) {
          return;
        }

        setStatusMessage(
          externalOrderId
            ? `Widget pronto para o pedido ${externalOrderId}.`
            : 'Widget oficial carregado e pronto para uso.',
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setStatusMessage(error.message ?? 'Nao foi possivel preparar o widget do iFood.');
      }
    }

    prepareWidget();

    return () => {
      active = false;
    };
  }, [externalOrderId, merchantConfig?.widgetEnabled, merchantConfig?.widgetId]);

  return (
    <SurfaceCard title="Widget oficial iFood">
      <div className="settings-summary">
        <div className="settings-summary__row">
          <span>Status</span>
          <strong>{statusMessage}</strong>
        </div>
        <div className="settings-summary__row">
          <span>Widget ID</span>
          <strong>{merchantConfig?.widgetId ?? 'Nao configurado'}</strong>
        </div>
        <p className="text-caption">
          O widget permanece desacoplado do tracking interno e pode ser habilitado por merchant no Firestore.
        </p>
      </div>
    </SurfaceCard>
  );
}

export default IFoodWidgetBridge;
