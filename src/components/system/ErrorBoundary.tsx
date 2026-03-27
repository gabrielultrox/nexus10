import { Component, type ErrorInfo, type ReactNode } from 'react'

import ErrorDisplay from '../ui/ErrorDisplay'
import { captureFrontendError } from '../../config/sentry'
import { getApiErrorDisplayModel, toApiError } from '../../services/apiErrorHandler'

interface IErrorBoundaryProps {
  children: ReactNode
  resetKey?: string
  onReset?: () => void
}

interface IErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<IErrorBoundaryProps, IErrorBoundaryState> {
  constructor(props: IErrorBoundaryProps) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureFrontendError(error, {
      feature: 'render',
      action: 'boundary-catch',
      componentStack: errorInfo.componentStack,
    })
  }

  componentDidUpdate(prevProps: IErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.handleRetry()
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
    if (!this.state.hasError || !this.state.error) {
      return this.props.children
    }

    const normalized = toApiError(this.state.error, {
      feature: 'render',
      action: 'boundary-fallback',
    })
    const display = getApiErrorDisplayModel(normalized)

    return (
      <main className="auth-screen">
        <div className="auth-card auth-card--immersive">
          <p className="text-overline">Recuperacao de falha</p>
          <h1 className="text-page-title">A tela foi interrompida com seguranca</h1>
          <p className="text-body">
            O Nexus10 bloqueou esta rota para evitar uma interface inconsistente.
          </p>
          <ErrorDisplay
            code={display.code}
            title={display.title}
            message={display.message}
            suggestion={display.suggestion}
            actionLabel="Tentar novamente"
            onAction={this.handleRetry}
            secondaryActionLabel="Recarregar app"
            onSecondaryAction={this.handleReload}
          />
        </div>
      </main>
    )
  }
}

export default ErrorBoundary
