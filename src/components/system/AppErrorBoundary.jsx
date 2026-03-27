import { Component } from 'react'

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Falha de renderizacao capturada pelo AppErrorBoundary.', error, errorInfo)
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({
        hasError: false,
        error: null,
      })
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    })

    this.props.onReset?.()
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p className="text-overline">Estabilidade</p>
          <h1 className="text-page-title">O app encontrou uma falha nesta tela</h1>
          <p className="text-body">
            A tela foi interrompida para evitar uma pagina em branco. Voce pode tentar novamente ou
            recarregar o app.
          </p>
          {this.state.error?.message ? (
            <div className="auth-error">{this.state.error.message}</div>
          ) : null}
          <div className="settings-pin-form__actions">
            <button
              type="button"
              className="ui-button ui-button--secondary"
              onClick={this.handleRetry}
            >
              Tentar novamente
            </button>
            <button
              type="button"
              className="ui-button ui-button--ghost"
              onClick={this.handleReload}
            >
              Recarregar app
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default AppErrorBoundary
