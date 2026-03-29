import { useState } from 'react'

import PageIntro from '../components/common/PageIntro'
import SurfaceCard from '../components/common/SurfaceCard'
import PwaStatusCard from '../components/settings/PwaStatusCard'
import ThemeToggle from '../components/theme/ThemeToggle'
import KeyboardSettings from './Sistema/KeyboardSettings'
import Select from '../components/ui/Select'
import { useConfirm } from '../hooks/useConfirm'
import { useAuth } from '../contexts/AuthContext'
import {
  DEFAULT_ACCESS_PIN,
  clearStoredPin,
  getStoredPin,
  hasStoredPin,
  setStoredPin,
} from '../services/localAccess'
import {
  getSoundProfile,
  getSoundProfiles,
  isSoundEnabled,
  playError,
  playNotification,
  playSuccess,
  previewSoundCategory,
  setSoundEnabled,
  setSoundProfile,
} from '../services/soundManager'
import { isSettingsUnlocked, lockSettings, unlockSettings } from '../services/settingsAccess'

function SettingsStatusTile({ eyebrow, value, meta, tone = 'neutral' }) {
  return (
    <article className={`settings-status-tile settings-status-tile--${tone}`}>
      <span className="settings-status-tile__eyebrow">{eyebrow}</span>
      <strong className="settings-status-tile__value">{value}</strong>
      <span className="settings-status-tile__meta">{meta}</span>
    </article>
  )
}

function SettingsSection({ eyebrow, title, description, children }) {
  return (
    <section className="settings-section">
      <header className="settings-section__header">
        <div className="settings-section__copy">
          <p className="settings-section-kicker">{eyebrow}</p>
          <h2 className="settings-section__title">{title}</h2>
          <p className="settings-section__description">{description}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

function SettingsPage() {
  const { session, can } = useAuth()
  const confirm = useConfirm()
  const [masterPassword, setMasterPassword] = useState('')
  const [settingsUnlocked, setSettingsUnlocked] = useState(() => isSettingsUnlocked())
  const [pinDraft, setPinDraft] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [pinEnabled, setPinEnabled] = useState(() => hasStoredPin())
  const [currentPinMask, setCurrentPinMask] = useState(() =>
    hasStoredPin() ? '****' : `${DEFAULT_ACCESS_PIN} padrao`,
  )
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(() => isSoundEnabled())
  const [soundProfile, setSoundProfileState] = useState(() => getSoundProfile())
  const soundProfiles = getSoundProfiles()
  const activeSoundProfile =
    soundProfiles.find((profile) => profile.id === soundProfile)?.label ?? 'Padrao'
  const canWriteSettings = can('settings:write')

  function handleUnlockSettings(event) {
    event.preventDefault()
    setFeedback('')
    setErrorMessage('')

    try {
      unlockSettings(masterPassword)
      setSettingsUnlocked(true)
      setMasterPassword('')
      setFeedback('Configuracoes liberadas para esta sessao.')
      playSuccess()
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel liberar as configuracoes.')
      playError()
    }
  }

  function handleLockSettings() {
    lockSettings()
    setSettingsUnlocked(false)
    setMasterPassword('')
    setFeedback('')
    setErrorMessage('')
    playNotification()
  }

  function handleSavePin(event) {
    event.preventDefault()

    if (!canWriteSettings) {
      setErrorMessage('Seu perfil nao pode alterar configuracoes sensiveis.')
      playError()
      return
    }

    setFeedback('')
    setErrorMessage('')

    if (pinDraft !== pinConfirm) {
      setErrorMessage('Os campos de PIN precisam ser iguais.')
      playError()
      return
    }

    try {
      setStoredPin(pinDraft)
      setPinEnabled(true)
      setCurrentPinMask(getStoredPin().replace(/\d/g, '*'))
      setPinDraft('')
      setPinConfirm('')
      setFeedback('PIN local atualizado com sucesso.')
      playSuccess()
    } catch (error) {
      setErrorMessage(error.message)
      playError()
    }
  }

  async function handleRemovePin() {
    if (!canWriteSettings) {
      setErrorMessage('Seu perfil nao pode alterar configuracoes sensiveis.')
      playError()
      return
    }

    const confirmed = await confirm.ask({
      title: 'Remover PIN local',
      message: 'Confirma a remocao do PIN customizado deste terminal?',
      confirmLabel: 'Remover PIN',
      tone: 'danger',
    })

    if (!confirmed) {
      return
    }

    clearStoredPin()
    setPinEnabled(false)
    setCurrentPinMask(`${DEFAULT_ACCESS_PIN} padrao`)
    setPinDraft('')
    setPinConfirm('')
    setFeedback(`PIN customizado removido. O acesso volta para o PIN padrao ${DEFAULT_ACCESS_PIN}.`)
    setErrorMessage('')
    playNotification()
  }

  function handleToggleSoundEffects() {
    if (!canWriteSettings) {
      setErrorMessage('Seu perfil nao pode alterar configuracoes sensiveis.')
      playError()
      return
    }

    const nextValue = !soundEffectsEnabled
    setSoundEnabled(nextValue)
    setSoundEffectsEnabled(nextValue)
    setFeedback(`Efeitos sonoros ${nextValue ? 'ativados' : 'desativados'} com sucesso.`)
    setErrorMessage('')

    if (nextValue) {
      playNotification()
    }
  }

  function handleChangeSoundProfile(event) {
    const nextProfile = event.target.value
    setSoundProfile(nextProfile)
    setSoundProfileState(nextProfile)
    setFeedback(
      `Perfil sonoro ${soundProfiles.find((profile) => profile.id === nextProfile)?.label?.toLowerCase() ?? 'padrao'} aplicado.`,
    )
    setErrorMessage('')
    previewSoundCategory('operations')
  }

  function handlePreviewSound(category) {
    if (!soundEffectsEnabled) {
      setErrorMessage('Ative os efeitos sonoros para pre-ouvir os perfis.')
      playError()
      return
    }

    setFeedback('')
    setErrorMessage('')
    previewSoundCategory(category)
  }

  if (!settingsUnlocked) {
    return (
      <div className="page-stack settings-page settings-page--locked">
        <PageIntro
          eyebrow="Sistema"
          title="Configuracoes protegidas"
          description="Digite a senha mestra para acessar os ajustes sensiveis do app."
        />

        <div className="settings-lock-shell">
          <SurfaceCard title="Senha mestra">
            <form className="settings-lock-form" onSubmit={handleUnlockSettings}>
              <div className="ui-field">
                <label className="ui-label" htmlFor="settings-master-password">
                  Senha mestra
                </label>
                <input
                  id="settings-master-password"
                  className="ui-input"
                  type="password"
                  value={masterPassword}
                  onChange={(event) => setMasterPassword(event.target.value)}
                  placeholder="Digite a senha mestra"
                  autoComplete="current-password"
                />
              </div>

              <div className="settings-lock-notes">
                <p className="text-caption">
                  Esta tela controla PIN local, perfil sonoro, tema e instalacao do terminal.
                </p>
                <div className="settings-lock-highlights">
                  <span>PIN local</span>
                  <span>Sons</span>
                  <span>Tema</span>
                  <span>PWA</span>
                </div>
              </div>

              <div className="settings-pin-form__actions">
                <button type="submit" className="ui-button ui-button--secondary">
                  Liberar configuracoes
                </button>
              </div>

              {feedback ? <div className="auth-error auth-error--success">{feedback}</div> : null}
              {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}
            </form>
          </SurfaceCard>
        </div>
      </div>
    )
  }

  return (
    <div className="page-stack settings-page">
      <PageIntro
        eyebrow="Sistema"
        title="Configuracoes"
        description="Centro de controle local para acesso, tema, som e instalacao do terminal operacional."
      />

      {feedback ? <div className="auth-error auth-error--success">{feedback}</div> : null}
      {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

      <SurfaceCard title="Centro de controle">
        <div className="settings-overview">
          <div className="settings-overview__copy">
            <p className="settings-section-kicker">Terminal</p>
            <h2 className="settings-overview__title">
              Ajustes locais que afetam o uso diario deste posto
            </h2>
            <p className="text-caption">
              Use esta area para manter o terminal previsivel, seguro e confortavel para a operacao.
            </p>
          </div>

          <div className="settings-overview__tiles">
            <SettingsStatusTile
              eyebrow="Operador"
              value={session?.operatorName ?? 'Nao identificado'}
              meta={session?.roleLabel ?? session?.role ?? 'Operador'}
              tone="info"
            />
            <SettingsStatusTile
              eyebrow="Protecao"
              value={settingsUnlocked ? 'Liberado' : 'Bloqueado'}
              meta="Sessao atual"
              tone={settingsUnlocked ? 'success' : 'warning'}
            />
            <SettingsStatusTile
              eyebrow="PIN local"
              value={pinEnabled ? currentPinMask : 'Padrao'}
              meta={pinEnabled ? 'Customizado' : `${DEFAULT_ACCESS_PIN} ativo`}
              tone={pinEnabled ? 'warning' : 'neutral'}
            />
            <SettingsStatusTile
              eyebrow="Audio"
              value={soundEffectsEnabled ? activeSoundProfile : 'Desligado'}
              meta={soundEffectsEnabled ? 'Perfil ativo' : 'Sem feedback sonoro'}
              tone={soundEffectsEnabled ? 'success' : 'neutral'}
            />
          </div>

          <div className="settings-overview__actions">
            <div className="settings-overview__meta">
              <span>Modo local</span>
              <strong>Boot + PIN + login</strong>
            </div>
            <div className="settings-overview__meta">
              <span>Permissao</span>
              <strong>{canWriteSettings ? 'Completa' : 'Somente leitura'}</strong>
            </div>
            <div className="settings-overview__action-row">
              <button
                type="button"
                className="ui-button ui-button--ghost"
                onClick={handleLockSettings}
              >
                Bloquear configuracoes
              </button>
            </div>
          </div>
        </div>
      </SurfaceCard>

      <SettingsSection
        eyebrow="Experiencia"
        title="Interface e feedback"
        description="Ajustes que controlam a leitura do shell e a resposta sensorial das acoes do operador."
      >
        <div className="settings-grid settings-grid--duo">
          <SurfaceCard title="Tema e shell">
            <div className="settings-summary">
              <div className="settings-summary__row">
                <span>Escopo</span>
                <strong>Boot, PIN e login</strong>
              </div>
              <div className="settings-summary__row">
                <span>Visual</span>
                <strong>Dark mode operacional</strong>
              </div>
              <p className="text-caption">
                O tema afeta toda a sessao local, incluindo entrada no app e camadas sensiveis do
                terminal.
              </p>
              <div className="settings-inline-action">
                <ThemeToggle />
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Som e feedback">
            <div className="settings-summary settings-sound-panel">
              <div className="settings-summary__row">
                <span>Status</span>
                <strong>{soundEffectsEnabled ? 'Ativado' : 'Desativado'}</strong>
              </div>
              <div className="settings-summary__row">
                <span>Perfil</span>
                <strong>{activeSoundProfile}</strong>
              </div>
              <div className="ui-field settings-sound-panel__field">
                <label className="ui-label" htmlFor="settings-sound-profile">
                  Perfil sonoro
                </label>
                <Select
                  id="settings-sound-profile"
                  className="ui-select"
                  value={soundProfile}
                  disabled={!soundEffectsEnabled}
                  onChange={handleChangeSoundProfile}
                >
                  {soundProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="settings-sound-panel__preview">
                <span className="text-caption">Pre-ouvir categorias</span>
                <div className="settings-sound-panel__preview-grid">
                  <button
                    type="button"
                    className="ui-button ui-button--ghost"
                    onClick={() => handlePreviewSound('cash')}
                  >
                    Caixa
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost"
                    onClick={() => handlePreviewSound('pdv')}
                  >
                    PDV
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost"
                    onClick={() => handlePreviewSound('operations')}
                  >
                    Operacao
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--ghost"
                    onClick={() => handlePreviewSound('warning')}
                  >
                    Aviso
                  </button>
                </div>
              </div>
              <div className="settings-pin-form__actions">
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  onClick={handleToggleSoundEffects}
                >
                  {soundEffectsEnabled ? 'Desligar sons' : 'Ligar sons'}
                </button>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </SettingsSection>

      <SettingsSection
        eyebrow="Seguranca"
        title="Acesso e prontidao do app"
        description="Controles locais de PIN e o estado da instalacao offline do terminal."
      >
        <div className="settings-grid settings-grid--duo">
          <SurfaceCard title="Seguranca local">
            <form className="settings-pin-form" onSubmit={handleSavePin}>
              <div className="settings-summary settings-summary--dense">
                <div className="settings-summary__row">
                  <span>PIN ativo</span>
                  <strong>{currentPinMask}</strong>
                </div>
                <div className="settings-summary__row">
                  <span>Camada</span>
                  <strong>{pinEnabled ? 'Customizada' : 'Padrao local'}</strong>
                </div>
              </div>

              <div className="settings-form-grid">
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
                    onChange={(event) =>
                      setPinDraft(event.target.value.replace(/\D/g, '').slice(0, 4))
                    }
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
                    onChange={(event) =>
                      setPinConfirm(event.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="0000"
                  />
                </div>
              </div>

              <p className="text-caption">
                Se nao houver PIN customizado salvo, o sistema usa o PIN padrao{' '}
                <strong>{DEFAULT_ACCESS_PIN}</strong>.
              </p>

              <div className="settings-pin-form__actions">
                <button type="submit" className="ui-button ui-button--secondary">
                  Salvar PIN
                </button>
                <button
                  type="button"
                  className="ui-button ui-button--ghost"
                  onClick={handleRemovePin}
                >
                  Restaurar padrao
                </button>
              </div>
            </form>
          </SurfaceCard>

          <PwaStatusCard />
        </div>
      </SettingsSection>

      <KeyboardSettings canWriteSettings={canWriteSettings} />
    </div>
  )
}

export default SettingsPage
