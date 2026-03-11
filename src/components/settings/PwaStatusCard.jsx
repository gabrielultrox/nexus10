import { usePwaInstall } from '../../hooks/usePwaInstall';

function PwaStatusCard() {
  const { installApp, isInstallable, isOffline } = usePwaInstall();

  async function handleInstall() {
    await installApp();
  }

  return (
    <section className="ui-card pwa-status-card">
      <div className="pwa-status-card__inner">
        <header className="pwa-status-card__header">
          <div>
            <p className="text-overline">Progressive Web App</p>
            <h2 className="text-section-title">Instalação e modo offline</h2>
          </div>
          <span className={`ui-badge ${isOffline ? 'ui-badge--warning' : 'ui-badge--success'}`}>
            {isOffline ? 'Offline' : 'Online'}
          </span>
        </header>

        <div className="pwa-status-card__content">
          <div className="pwa-status-card__item">
            <span className="text-label">Manifest + Splash</span>
            <strong>Configurados via `vite-plugin-pwa`</strong>
          </div>
          <div className="pwa-status-card__item">
            <span className="text-label">Service Worker</span>
            <strong>Cache automático de páginas, assets e imagens</strong>
          </div>
          <div className="pwa-status-card__item">
            <span className="text-label">Instalação</span>
            <strong>{isInstallable ? 'Prompt disponível neste dispositivo' : 'Aguardando elegibilidade do navegador'}</strong>
          </div>
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
    </section>
  );
}

export default PwaStatusCard;
