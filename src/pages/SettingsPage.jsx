import { useEffect, useState } from 'react'

import PageIntro from '../components/common/PageIntro'
import SurfaceCard from '../components/common/SurfaceCard'
import PwaStatusCard from '../components/settings/PwaStatusCard'
import ThemeToggle from '../components/theme/ThemeToggle'
import KeyboardSettings from './Sistema/KeyboardSettings'
import Select from '../components/ui/Select'
import { useConfirm } from '../hooks/useConfirm'
import { useAuth } from '../contexts/AuthContext'
import {
  DEFAULT_REMOTE_ACCESS_PIN_MASK,
  getRemoteAccessPinStatus,
  updateRemoteAccessPin,
} from '../services/accessPinService'
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

function formatSettingsDateTime(value) {
  if (!value) {
    return 'Sem registro'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Sem registro'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedDate)
}

function resolvePinStorageLabel(storageMode) {
  if (storageMode === 'firestore') {
    return 'Store remota'
  }

  if (storageMode === 'default-fallback') {
    return 'Fallback padrao'
  }

  return 'Nao identificado'
}

function resolvePinHealth(storageMode) {
  if (storageMode === 'firestore') {
    return {
      label: 'Saudavel',
      meta: 'Leitura remota ativa',
      tone: 'success',
    }
  }

  if (storageMode === 'default-fallback') {
    return {
      label: 'Degradado',
      meta: 'Store remota indisponivel',
      tone: 'warning',
    }
  }

  return {
    label: 'Indefinido',
    meta: 'Sem telemetria',
    tone: 'neutral',
  }
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
  const [pinEnabled, setPinEnabled] = useState(false)
  const [currentPinMask, setCurrentPinMask] = useState(DEFAULT_REMOTE_ACCESS_PIN_MASK)
  const [pinStorageMode, setPinStorageMode] = useState('unknown')
  const [pinUpdatedAt, setPinUpdatedAt] = useState(null)
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(() => isSoundEnabled())
  const [soundProfile, setSoundProfileState] = useState(() => getSoundProfile())
  const soundProfiles = getSoundProfiles()
  const activeSoundProfile =
    soundProfiles.find((profile) => profile.id === soundProfile)?.label ?? 'Padrao'
  const canWriteSettings = can('settings:write')
  const pinHealth = resolvePinHealth(pinStorageMode)

  async function loadAccessPinStatus() {
    const status = await getRemoteAccessPinStatus()

    setPinEnabled(Boolean(status.hasCustomPin))
    setCurrentPinMask(status.maskedPin ?? DEFAULT_REMOTE_ACCESS_PIN_MASK)
    setPinStorageMode(String(status.storageMode ?? 'unknown'))
    setPinUpdatedAt(status.updatedAt ?? null)
  }

  useEffect(() => {
    let active = true

    async function loadAccessPinStatusState() {
      try {
        const status = await getRemoteAccessPinStatus()

        if (!active) {
          return
        }

        setPinEnabled(Boolean(status.hasCustomPin))
        setCurrentPinMask(status.maskedPin ?? DEFAULT_REMOTE_ACCESS_PIN_MASK)
        setPinStorageMode(String(status.storageMode ?? 'unknown'))
        setPinUpdatedAt(status.updatedAt ?? null)
      } catch (error) {
        if (!active) {
          return
        }

        setErrorMessage(error.message ?? 'Nao foi possivel carregar o PIN remoto do terminal.')
      }
    }

    loadAccessPinStatusState()

    return () => {
      active = false
    }
  }, [])

  function resetMessages() {
    setFeedback('')
    setErrorMessage('')
  }

  function handleUnlockSettings(event) {
    event.preventDefault()
    resetMessages()

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
    resetMessages()
    playNotification()
  }

  async function handleSavePin(event) {
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
      await updateRemoteAccessPin(pinDraft)
      await loadAccessPinStatus()
      setPinDraft('')
      setPinConfirm('')
      setFeedback('PIN remoto atualizado com sucesso.')
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

    try {
      await updateRemoteAccessPin(null)
      await loadAccessPinStatus()
      setPinDraft('')
      setPinConfirm('')
      setFeedback('PIN remoto restaurado para a configuracao padrao compartilhada.')
      setErrorMessage('')
      playNotification()
    } catch (error) {
      setErrorMessage(error.message ?? 'Nao foi possivel restaurar o PIN remoto.')
      playError()
    }
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
                  Esta tela controla PIN remoto do terminal, perfil sonoro, tema e instalacao.
                </p>
                <div className="settings-lock-highlights">
                  <span>PIN remoto</span>
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
        description="Centro de controle do terminal para acesso, tema, som e instalacao operacional."
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
              eyebrow="PIN remoto"
              value={pinEnabled ? currentPinMask : DEFAULT_REMOTE_ACCESS_PIN_MASK}
              meta={pinEnabled ? 'Customizado remoto' : 'Padrao compartilhado'}
              tone={pinEnabled ? 'warning' : 'neutral'}
            />
            <SettingsStatusTile
              eyebrow="Saude remota"
              value={pinHealth.label}
              meta={pinHealth.meta}
              tone={pinHealth.tone}
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
              <span>Modo de acesso</span>
              <strong>PIN remoto + operador</strong>
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
        description="Estado do PIN compartilhado, saude da autenticacao remota e instalacao offline do terminal."
      >
        <div className="settings-grid settings-grid--duo">
          <SurfaceCard title="PIN remoto">
            <form className="settings-pin-form" onSubmit={handleSavePin}>
              <div className="settings-summary settings-summary--dense">
                <div className="settings-summary__row">
                  <span>PIN ativo</span>
                  <strong>{currentPinMask}</strong>
                </div>
                <div className="settings-summary__row">
                  <span>Origem</span>
                  <strong>{pinEnabled ? 'Customizado remoto' : 'Padrao compartilhado'}</strong>
                </div>
                <div className="settings-summary__row">
                  <span>Store de leitura</span>
                  <strong>{resolvePinStorageLabel(pinStorageMode)}</strong>
                </div>
                <div className="settings-summary__row">
                  <span>Ultima atualizacao</span>
                  <strong>{formatSettingsDateTime(pinUpdatedAt)}</strong>
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
                Se nao houver PIN remoto customizado salvo, o sistema usa a configuracao padrao
                compartilhada.
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

          <SurfaceCard title="Saude da autenticacao">
            <div className="settings-summary settings-summary--dense">
              <div className="settings-summary__row">
                <span>Status remoto</span>
                <strong>{pinHealth.label}</strong>
              </div>
              <div className="settings-summary__row">
                <span>Diagnostico</span>
                <strong>{pinHealth.meta}</strong>
              </div>
              <div className="settings-summary__row">
                <span>Comportamento atual</span>
                <strong>
                  {pinStorageMode === 'firestore'
                    ? 'Leitura do PIN customizado ou padrao remoto'
                    : 'Fallback para padrao compartilhado'}
                </strong>
              </div>
            </div>

            <p className="text-caption settings-remote-health__caption">
              Quando a store remota estiver indisponivel, o terminal continua aceitando apenas a
              configuracao padrao compartilhada. Um PIN customizado remoto depende da store
              saudavel.
            </p>
          </SurfaceCard>

          <div className="settings-grid-span-2">
            <PwaStatusCard />
          </div>
        </div>
      </SettingsSection>

      <KeyboardSettings canWriteSettings={canWriteSettings} />
    </div>
  )
}

export default SettingsPage
