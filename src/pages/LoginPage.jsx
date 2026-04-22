import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import ThemeToggle from '../components/theme/ThemeToggle'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'
import ErrorDisplay from '../components/ui/ErrorDisplay'
import { useAuth } from '../contexts/AuthContext'
import { useError } from '../hooks'
import { playError, playSuccess } from '../services/soundManager'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, authError, operatorOptions, getLastOperator } = useAuth()
  const [operatorName, setOperatorName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [fieldError, setFieldError] = useState('')
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
    setOperatorName(getLastOperator())
  }, [getLastOperator])

  function handleOperatorChange(value) {
    clearError()
    setErrorMessage('')
    setFieldError('')
    setOperatorName(value)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage('')
    setFieldError('')

    if (!operatorName) {
      setFieldError('Selecione um usuario.')
      setSubmitting(false)
      return
    }

    try {
      await signIn({ operatorName })
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

      <section className="auth-stage auth-login">
        <div className="auth-login__shell">
          <div className="auth-login__hero">
            <p className="text-overline">Acesso operacional</p>
            <h1 id="login-page-title" className="text-display">
              Selecionar usuario
            </h1>
            <p className="text-body">
              Escolha o usuario para entrar no ERP. Nao ha senha nem PIN neste fluxo.
            </p>

            <div className="auth-login__hero-panels">
              <div className="auth-login__hero-card">
                <span>Entrada</span>
                <strong>Selecao de usuario</strong>
              </div>
              <div className="auth-login__hero-card">
                <span>Ambiente</span>
                <strong>ERP operacional da loja</strong>
              </div>
              <div className="auth-login__hero-card auth-login__hero-card--accent">
                <span>Usuarios</span>
                <strong>{operatorOptions.length || 0} disponiveis</strong>
              </div>
            </div>
          </div>

          <form className="auth-card auth-card--immersive auth-form" onSubmit={handleSubmit}>
            <div className="auth-card__hero">
              <p className="text-overline">Entrada do operador</p>
              <h2 className="text-display">Entrar no ERP</h2>
              <p className="text-body">Selecione apenas o usuario que vai operar o terminal.</p>
              <div className="auth-card__meta-strip" aria-label="Resumo do acesso">
                <div className="auth-card__meta-pill">
                  <span>Senha</span>
                  <strong>Desativada</strong>
                </div>
                <div className="auth-card__meta-pill">
                  <span>PIN</span>
                  <strong>Desativado</strong>
                </div>
                <div className="auth-card__meta-pill">
                  <span>Usuarios</span>
                  <strong>{operatorOptions.length || 0}</strong>
                </div>
              </div>
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="login-operator">
                Usuario
              </label>
              <Select
                id="login-operator"
                className={`ui-input${fieldError ? ' is-error' : ''}`}
                value={operatorName}
                onChange={(event) => handleOperatorChange(event.target.value)}
                aria-invalid={Boolean(fieldError || errorMessage || authError)}
                aria-describedby={
                  fieldError ? operatorErrorId : errorMessage || authError ? authErrorId : undefined
                }
              >
                <option value="">Selecione</option>
                {operatorOptions.map((currentOperatorName) => (
                  <option key={currentOperatorName} value={currentOperatorName}>
                    {currentOperatorName}
                  </option>
                ))}
              </Select>
              {fieldError ? (
                <p id={operatorErrorId} className="ui-field__error" role="alert">
                  {fieldError}
                </p>
              ) : null}
            </div>

            {errorMessage || authError ? (
              <div id={authErrorId}>
                <ErrorDisplay
                  code={errorModel?.code}
                  title={errorModel?.title ?? 'Falha ao abrir sessao'}
                  message={errorMessage || authError}
                  suggestion={errorModel?.suggestion ?? 'Revise a selecao e tente novamente.'}
                />
              </div>
            ) : null}

            <Button type="submit" variant="secondary" className="auth-submit" loading={submitting}>
              Entrar
            </Button>
          </form>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
