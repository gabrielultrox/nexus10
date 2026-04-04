import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import ThemeToggle from '../components/theme/ThemeToggle'
import Button from '../components/ui/Button'
import ErrorDisplay from '../components/ui/ErrorDisplay'
import { useError } from '../hooks'
import { useAuth } from '../contexts/AuthContext'
import { DEFAULT_ACCESS_PIN, hasStoredPin, verifyStoredPin } from '../services/localAccess'
import { playError, playSuccess } from '../services/soundManager'
import Select from '../components/ui/Select'

const PIN_VERIFY_DELAY_MS = 80
const PIN_UNLOCK_DELAY_MS = 140

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, authError, operatorOptions, getLastOperator } = useAuth()
  const [formState, setFormState] = useState({
    operatorName: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({
    operatorName: '',
  })
  const [stage, setStage] = useState('pin')
  const [pinValue, setPinValue] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinUnlocked, setPinUnlocked] = useState(false)
  const [customPinEnabled, setCustomPinEnabled] = useState(false)
  const pinErrorId = 'login-pin-error'
  const authErrorId = 'login-auth-error'
  const operatorErrorId = 'login-operator-error'
  const { captureError, errorModel, clearError } = useError({
    autoToast: false,
    context: {
      feature: 'auth',
      action: 'login',
    },
  })

  const redirectPath = location.state?.from?.pathname ?? '/dashboard'

  useEffect(() => {
    setFormState((current) => ({
      ...current,
      operatorName: getLastOperator(),
    }))
    setCustomPinEnabled(hasStoredPin())
  }, [getLastOperator])

  useEffect(() => {
    if (stage !== 'pin') {
      return undefined
    }

    function handleKeyDown(event) {
      if (/^\d$/.test(event.key)) {
        setPinError('')
        setPinValue((current) => (current.length < 4 ? `${current}${event.key}` : current))
      }

      if (event.key === 'Backspace') {
        setPinError('')
        setPinValue((current) => current.slice(0, -1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [stage])

  useEffect(() => {
    if (stage !== 'pin' || pinValue.length !== 4) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      if (verifyStoredPin(pinValue)) {
        setPinUnlocked(true)
        setPinError('')
        playSuccess()
        window.setTimeout(() => {
          setStage('login')
        }, PIN_UNLOCK_DELAY_MS)
        return
      }

      setPinError('PIN invalido. Tente novamente.')
      playError()
      setPinValue('')
    }, PIN_VERIFY_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [pinValue, stage])

  function handleChange(field, value) {
    clearError()
    setErrorMessage('')
    setFieldErrors((current) => ({
      ...current,
      [field]: '',
    }))
    setFormState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handlePinDigit(digit) {
    setPinError('')
    setPinValue((current) => (current.length < 4 ? `${current}${digit}` : current))
  }

  function handlePinBackspace() {
    setPinError('')
    setPinValue((current) => current.slice(0, -1))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage('')
    setFieldErrors({
      operatorName: '',
    })

    const nextFieldErrors = {
      operatorName: formState.operatorName ? '' : 'Selecione um operador.',
    }

    if (nextFieldErrors.operatorName) {
      setFieldErrors(nextFieldErrors)
      setSubmitting(false)
      return
    }

    try {
      await signIn({
        operatorName: formState.operatorName,
        pin: pinValue,
      })
      playSuccess()
      navigate(redirectPath, { replace: true })
    } catch (error) {
      const normalized = captureError(error)
      setErrorMessage(normalized.message)
      playError()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-screen auth-sequence" aria-labelledby="login-page-title">
      <div className="auth-sequence__chrome">
        <div className="auth-sequence__chrome-brand">
          <img src="/brand-bolt-red.svg" alt="" />
          <div>
            <strong>NEXUS</strong>
            <small>ERP operacional</small>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="auth-sequence__backdrop">
        <span className="auth-sequence__orb auth-sequence__orb--cyan" />
        <span className="auth-sequence__orb auth-sequence__orb--red" />
      </div>

      {stage === 'pin' ? (
        <section className={`auth-stage auth-pin${pinUnlocked ? ' auth-pin--unlocked' : ''}`}>
          <div className="auth-pin__shell">
            <div className="auth-pin__hero">
              <p className="text-overline">Acesso local</p>
              <h1 id="login-page-title" className="text-display">
                Confirmar PIN local
              </h1>
              <p className="text-body">
                Confirme o PIN da loja para liberar o acesso rapido ao ambiente operacional.
              </p>

              <div className="auth-pin__signal">
                <div className="auth-pin__signal-mark">
                  <img src="/brand-bolt-red.svg" alt="" className="auth-pin__signal-bolt" />
                </div>
                <div>
                  <strong>Seguranca local ativa</strong>
                  <span>Digite o PIN para seguir para a identificacao do operador.</span>
                </div>
              </div>

              <div className="auth-pin__intel-grid">
                <div className="auth-pin__intel-card">
                  <span>Modo de acesso</span>
                  <strong>{customPinEnabled ? 'PIN personalizado' : 'PIN padrao'}</strong>
                </div>
                <div className="auth-pin__intel-card">
                  <span>Proxima etapa</span>
                  <strong>Aguardando validacao</strong>
                </div>
              </div>

              {!customPinEnabled ? (
                <div className="auth-pin__fallback">
                  <span>PIN padrao ativo</span>
                  <strong>{DEFAULT_ACCESS_PIN}</strong>
                  <p>Troque este codigo em Configuracoes para reforcar a seguranca local.</p>
                </div>
              ) : null}
            </div>

            <div className="auth-pin__panel">
              <div className="auth-pin__panel-head">
                <span>Entrada segura</span>
                <strong>{pinUnlocked ? 'Acesso liberado' : 'Aguardando PIN'}</strong>
              </div>

              <div
                className="auth-pin__dots"
                aria-label={`PIN com ${pinValue.length} digitos preenchidos`}
                role="status"
                aria-live="polite"
              >
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={`auth-pin__dot${pinValue[index] ? ' auth-pin__dot--filled' : ''}`}
                  />
                ))}
              </div>

              {pinError ? (
                <div id={pinErrorId} className="auth-error" role="alert" aria-live="assertive">
                  {pinError}
                </div>
              ) : null}

              <div className="auth-pin__keypad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    className="auth-pin__key"
                    onClick={() => handlePinDigit(digit)}
                    disabled={pinValue.length >= 4}
                    aria-label={`Digito ${digit}`}
                    aria-describedby={pinError ? pinErrorId : undefined}
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  className="auth-pin__key auth-pin__key--wide"
                  onClick={handlePinBackspace}
                  aria-label="Apagar ultimo digito"
                  aria-describedby={pinError ? pinErrorId : undefined}
                >
                  Backspace
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {stage === 'login' ? (
        <section className="auth-stage auth-login">
          <div className="auth-login__shell">
            <div className="auth-login__hero">
              <p className="text-overline">Acesso operacional</p>
              <h1 className="text-display">Identificacao operacional</h1>
              <p className="text-body">
                Entre com o operador para acessar pedidos, vendas, entregas e a operacao da loja.
              </p>

              <div className="auth-login__hero-panels">
                <div className="auth-login__hero-card">
                  <span>Entrada</span>
                  <strong>PIN + operador</strong>
                </div>
                <div className="auth-login__hero-card">
                  <span>Ambiente</span>
                  <strong>ERP operacional da loja</strong>
                </div>
              </div>
            </div>

            <form className="auth-card auth-card--immersive auth-form" onSubmit={handleSubmit}>
              <div className="auth-card__hero">
                <p className="text-overline">Login do operador</p>
                <h2 className="text-display">Entrar no ERP</h2>
                <p className="text-body">
                  O PIN ja foi validado. Agora selecione apenas o operador para abrir a sessao.
                </p>
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="login-operator">
                  Operador
                </label>
                <Select
                  id="login-operator"
                  className={`ui-input${fieldErrors.operatorName ? ' is-error' : ''}`}
                  value={formState.operatorName}
                  onChange={(event) => handleChange('operatorName', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.operatorName || errorMessage || authError)}
                  aria-describedby={
                    fieldErrors.operatorName
                      ? operatorErrorId
                      : errorMessage || authError
                        ? authErrorId
                        : undefined
                  }
                >
                  <option value="">Selecione</option>
                  {operatorOptions.map((operatorName) => (
                    <option key={operatorName} value={operatorName}>
                      {operatorName}
                    </option>
                  ))}
                </Select>
                {fieldErrors.operatorName ? (
                  <p id={operatorErrorId} className="ui-field__error" role="alert">
                    {fieldErrors.operatorName}
                  </p>
                ) : null}
              </div>

              {errorMessage || authError ? (
                <div id={authErrorId}>
                  <ErrorDisplay
                    code={errorModel?.code}
                    title={errorModel?.title ?? 'Falha na autenticacao'}
                    message={errorMessage || authError}
                    suggestion={errorModel?.suggestion ?? 'Revise os dados e tente novamente.'}
                  />
                </div>
              ) : null}

              <Button
                type="submit"
                variant="secondary"
                className="auth-submit"
                loading={submitting}
              >
                Entrar
              </Button>
              <p className="text-caption">
                A autenticacao operacional agora usa apenas o PIN do terminal e a selecao do
                operador.
              </p>
            </form>
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default LoginPage
