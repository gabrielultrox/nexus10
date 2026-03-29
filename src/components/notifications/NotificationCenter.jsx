import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useNotifications } from '../../contexts/NotificationsContext'
import EmptyState from '../ui/EmptyState'

function formatDateTime(value) {
  const dateValue = typeof value?.toDate === 'function' ? value.toDate() : new Date(value)

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue)
}

function NotificationCenter() {
  const navigate = useNavigate()
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismiss,
    preferences,
    updatePreferences,
    connectionStatus,
  } = useNotifications()
  const [open, setOpen] = useState(false)

  function handleNotificationClick(notification) {
    markAsRead(notification.id)

    if (notification.metadata?.route) {
      navigate(notification.metadata.route)
      setOpen(false)
    }
  }

  return (
    <div className={`notification-center${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="notification-center__trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Abrir notificacoes operacionais"
      >
        <span className="notification-center__icon" aria-hidden="true" />
        <span className="notification-center__count">{unreadCount}</span>
      </button>

      {open ? (
        <div className="notification-center__panel">
          <div className="notification-center__panel-head">
            <div>
              <p className="text-overline">Notifications</p>
              <h3 className="text-section-title">Centro operacional</h3>
            </div>
            <button type="button" className="ui-button ui-button--ghost" onClick={markAllAsRead}>
              Marcar tudo
            </button>
          </div>

          <div className="notification-center__preferences">
            <span className={`notification-center__live notification-center__live--${connectionStatus}`}>
              {connectionStatus === 'connected' ? 'Tempo real ativo' : 'Tempo real indisponivel'}
            </span>
            <button
              type="button"
              className="ui-button ui-button--ghost"
              onClick={() =>
                updatePreferences({
                  channels: {
                    sound: !(preferences?.channels?.sound !== false),
                  },
                })
              }
            >
              Som {preferences?.channels?.sound !== false ? 'ligado' : 'desligado'}
            </button>
            <button
              type="button"
              className="ui-button ui-button--ghost"
              onClick={() =>
                updatePreferences({
                  channels: {
                    vibration: !Boolean(preferences?.channels?.vibration),
                  },
                })
              }
            >
              Vibracao {preferences?.channels?.vibration ? 'ligada' : 'desligada'}
            </button>
          </div>

          {notifications.length === 0 ? (
            <EmptyState message="Sem alertas no momento" />
          ) : (
            <div className="notification-center__list">
              {notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`notification-center__item notification-center__item--${notification.type}${notification.read ? ' is-read' : ''}`}
                >
                  <button
                    type="button"
                    className="notification-center__item-main"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="notification-center__item-top">
                      <strong>{notification.title}</strong>
                      <span>{formatDateTime(notification.createdAt)}</span>
                    </div>
                    <p>{notification.message}</p>
                  </button>
                  <button
                    type="button"
                    className="notification-center__dismiss"
                    onClick={() => dismiss(notification.id)}
                  >
                    Fechar
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default NotificationCenter
