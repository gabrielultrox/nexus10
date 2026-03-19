import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import ThemeToggle from '../components/theme/ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { DEFAULT_ACCESS_PIN, hasStoredPin, verifyStoredPin } from '../services/localAccess';
import { playError, playSuccess } from '../services/soundManager';
import Select from '../components/ui/Select';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, authError, operatorOptions, getLastOperator } = useAuth();
  const [formState, setFormState] = useState({
    operatorName: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [stage, setStage] = useState('pin');
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [customPinEnabled, setCustomPinEnabled] = useState(false);

  const redirectPath = location.state?.from?.pathname ?? '/dashboard';

  useEffect(() => {
    setFormState((current) => ({
      ...current,
      operatorName: getLastOperator(),
    }));
    setCustomPinEnabled(hasStoredPin());
  }, [getLastOperator]);

  useEffect(() => {
    if (stage !== 'pin') {
      return undefined;
    }

    function handleKeyDown(event) {
      if (/^\d$/.test(event.key)) {
        setPinError('');
        setPinValue((current) => (current.length < 4 ? `${current}${event.key}` : current));
      }

      if (event.key === 'Backspace') {
        setPinError('');
        setPinValue((current) => current.slice(0, -1));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 'pin' || pinValue.length !== 4) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (verifyStoredPin(pinValue)) {
        setPinUnlocked(true);
        setPinError('');
        playSuccess();
        window.setTimeout(() => {
          setStage('login');
        }, 520);
        return;
      }

      setPinError('PIN invalido. Tente novamente.');
      playError();
      setPinValue('');
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pinValue, stage]);

  function handleChange(field, value) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handlePinDigit(digit) {
    setPinError('');
    setPinValue((current) => (current.length < 4 ? `${current}${digit}` : current));
  }

  function handlePinBackspace() {
    setPinError('');
    setPinValue((current) => current.slice(0, -1));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    try {
      await signIn(formState);
      playSuccess();
      navigate(redirectPath, { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
      playError();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen auth-sequence">
      <div className="auth-sequence__chrome">
        <div className="auth-sequence__chrome-brand">
          <img src="/brand-bolt-red.svg" alt="" />
          <div>
            <strong>Nexus 10 ERP</strong>
            <small>Operacao em tempo real</small>
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
              <h1 className="text-display">Confirmar PIN local</h1>
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

              <div className="auth-pin__dots" aria-label={`PIN com ${pinValue.length} digitos preenchidos`}>
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={`auth-pin__dot${pinValue[index] ? ' auth-pin__dot--filled' : ''}`}
                  />
                ))}
              </div>

              {pinError ? <div className="auth-error">{pinError}</div> : null}

              <div className="auth-pin__keypad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    className="auth-pin__key"
                    onClick={() => handlePinDigit(digit)}
                    disabled={pinValue.length >= 4}
                  >
                    {digit}
                  </button>
                ))}
                <button type="button" className="auth-pin__key auth-pin__key--wide" onClick={handlePinBackspace}>
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
                  <strong>Operador + senha curta</strong>
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
                  Entre com o operador local. A senha padrao atual continua sendo <strong>01</strong>.
                </p>
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="login-operator">
                  Operador
                </label>
                <Select
                  id="login-operator"
                  className="ui-input"
                  value={formState.operatorName}
                  onChange={(event) => handleChange('operatorName', event.target.value)}
                >
                  <option value="">Selecione</option>
                  {operatorOptions.map((operatorName) => (
                    <option key={operatorName} value={operatorName}>
                      {operatorName}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="login-password">
                  Senha
                </label>
                <input
                  id="login-password"
                  className="ui-input"
                  type="password"
                  value={formState.password}
                  onChange={(event) => handleChange('password', event.target.value)}
                  placeholder="******"
                  autoComplete="current-password"
                />
              </div>

              {errorMessage || authError ? <div className="auth-error">{errorMessage || authError}</div> : null}

              <button type="submit" className="ui-button ui-button--secondary auth-submit" disabled={submitting}>
                {submitting ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default LoginPage;


