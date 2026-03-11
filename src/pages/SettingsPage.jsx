import { useState } from 'react';

import PageIntro from '../components/common/PageIntro';
import SurfaceCard from '../components/common/SurfaceCard';
import ThemeToggle from '../components/theme/ThemeToggle';
import PwaStatusCard from '../components/settings/PwaStatusCard';
import { useAuth } from '../contexts/AuthContext';
import {
  DEFAULT_ACCESS_PIN,
  clearStoredPin,
  getStoredPin,
  hasStoredPin,
  setStoredPin,
} from '../services/localAccess';
import {
  isSoundEnabled,
  playError,
  playNotification,
  playSuccess,
  setSoundEnabled,
} from '../services/soundManager';

function SettingsPage() {
  const { session, can } = useAuth();
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pinEnabled, setPinEnabled] = useState(() => hasStoredPin());
  const [currentPinMask, setCurrentPinMask] = useState(() => (hasStoredPin() ? '****' : `${DEFAULT_ACCESS_PIN} padrao`));
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(() => isSoundEnabled());

  function handleSavePin(event) {
    event.preventDefault();
    if (!can('settings:write')) {
      setErrorMessage('Seu perfil nao pode alterar configuracoes sensiveis.');
      playError();
      return;
    }
    setFeedback('');
    setErrorMessage('');

    if (pinDraft !== pinConfirm) {
      setErrorMessage('Os campos de PIN precisam ser iguais.');
      playError();
      return;
    }

    try {
      setStoredPin(pinDraft);
      setPinEnabled(true);
      setCurrentPinMask(getStoredPin().replace(/\d/g, '*'));
      setPinDraft('');
      setPinConfirm('');
      setFeedback('PIN local atualizado com sucesso.');
      playSuccess();
    } catch (error) {
      setErrorMessage(error.message);
      playError();
    }
  }

  function handleRemovePin() {
    if (!can('settings:write')) {
      setErrorMessage('Seu perfil nao pode alterar configuracoes sensiveis.');
      playError();
      return;
    }

    clearStoredPin();
    setPinEnabled(false);
    setCurrentPinMask(`${DEFAULT_ACCESS_PIN} padrao`);
    setPinDraft('');
    setPinConfirm('');
    setFeedback(`PIN customizado removido. O acesso volta para o PIN padrao ${DEFAULT_ACCESS_PIN}.`);
    setErrorMessage('');
    playNotification();
  }

  function handleToggleSoundEffects() {
    if (!can('settings:write')) {
      setErrorMessage('Seu perfil nao pode alterar configuracoes sensiveis.');
      playError();
      return;
    }

    const nextValue = !soundEffectsEnabled;
    setSoundEnabled(nextValue);
    setSoundEffectsEnabled(nextValue);
    setFeedback(`Efeitos sonoros ${nextValue ? 'ativados' : 'desativados'} com sucesso.`);
    setErrorMessage('');

    if (nextValue) {
      playNotification();
    }
  }

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="System"
        title="Configuracoes"
        description="Preferencias locais do shell, controle de PIN e ajustes de experiencia sem depender do legado."
      />

      <div className="card-grid">
        <SurfaceCard title="Acesso local">
          <div className="settings-summary">
            <div className="settings-summary__row">
              <span>Operador atual</span>
              <strong>{session?.operatorName ?? 'Nao identificado'}</strong>
            </div>
            <div className="settings-summary__row">
              <span>Papel</span>
              <strong>{session?.roleLabel ?? session?.role ?? 'Operador'}</strong>
            </div>
            <div className="settings-summary__row">
              <span>Modo</span>
              <strong>Boot + PIN + login</strong>
            </div>
            <div className="settings-summary__row">
              <span>PIN ativo</span>
              <strong>{currentPinMask}</strong>
            </div>
            <div className="settings-summary__row">
              <span>Camada</span>
              <strong>{pinEnabled ? 'Customizada' : 'Padrao local'}</strong>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Tema">
          <div className="settings-summary">
            <p>O tema do shell controla diretamente o boot, o PIN e o login React nativo.</p>
            <ThemeToggle />
          </div>
        </SurfaceCard>

        <SurfaceCard title="Sound Effects">
          <div className="settings-summary">
            <div className="settings-summary__row">
              <span>Status</span>
              <strong>{soundEffectsEnabled ? 'Ativado' : 'Desativado'}</strong>
            </div>
            <div className="settings-summary__row">
              <span>Perfil</span>
              <strong>Feedback curto e discreto</strong>
            </div>
            <button type="button" className="ui-button ui-button--secondary" onClick={handleToggleSoundEffects}>
              {soundEffectsEnabled ? 'Desligar sons' : 'Ligar sons'}
            </button>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard title="Seguranca local">
        <form className="settings-pin-form" onSubmit={handleSavePin}>
          <div className="ui-field">
            <label className="ui-label" htmlFor="settings-pin">
              Novo PIN
            </label>
            <input
              id="settings-pin"
              className="ui-input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinDraft}
              onChange={(event) => setPinDraft(event.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
            />
          </div>

          <div className="ui-field">
            <label className="ui-label" htmlFor="settings-pin-confirm">
              Confirmar PIN
            </label>
            <input
              id="settings-pin-confirm"
              className="ui-input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinConfirm}
              onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
            />
          </div>

          <p className="text-caption">
            Se nao houver PIN customizado salvo, o sistema usa o PIN padrao <strong>{DEFAULT_ACCESS_PIN}</strong>.
          </p>

          <div className="settings-pin-form__actions">
            <button type="submit" className="ui-button ui-button--secondary">
              Salvar PIN
            </button>
            <button type="button" className="ui-button ui-button--ghost" onClick={handleRemovePin}>
              Restaurar padrao
            </button>
          </div>

          {feedback ? <div className="auth-error auth-error--success">{feedback}</div> : null}
          {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}
        </form>
      </SurfaceCard>

      <PwaStatusCard />
    </div>
  );
}

export default SettingsPage;
