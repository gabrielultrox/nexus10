import SurfaceCard from '../common/SurfaceCard';
import { usePwaInstall } from '../../hooks/usePwaInstall';

function PwaStatusCard() {
  const { installApp, isInstallable, isOffline } = usePwaInstall();

  async function handleInstall() {
    await installApp();
  }

  return (
    <SurfaceCard title="Aplicativo e offline">
      <div className="settings-summary pwa-status-card">
        <div className="pwa-status-card__hero">
          <div>
            <p className="settings-section-kicker">Progressive Web App</p>
            <h3 className="pwa-status-card__title">Instalacao local e operacao sem rede</h3>
            <p className="text-caption pwa-status-card__description">
              Fixe o app no terminal para abrir mais rapido e manter os recursos essenciais disponiveis durante instabilidade de rede.
            </p>
          </div>
          <span className={`ui-badge ${isOffline ? 'ui-badge--warning' : 'ui-badge--success'}`}>
            {isOffline ? 'Offline' : 'Online'}
          </span>
        </div>

        <div className="settings-summary__row">
          <span>Manifest + splash</span>
          <strong>Configurados</strong>
        </div>
        <div className="settings-summary__row">
          <span>Service worker</span>
          <strong>Cache automatico</strong>
        </div>
        <div className="settings-summary__row">
          <span>Instalacao</span>
          <strong>{isInstallable ? 'Pronta neste dispositivo' : 'Aguardando navegador'}</strong>
        </div>

        <div className="pwa-status-card__actions">
          <button
            type="button"
            className="ui-button ui-button--secondary"
            onClick={handleInstall}
            disabled={!isInstallable}
          >
            Instalar app
          </button>
        </div>
      </div>
    </SurfaceCard>
  );
}

export default PwaStatusCard;
