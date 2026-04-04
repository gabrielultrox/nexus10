import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ensureRemoteSession, firebaseReady } from '../services/firebase'
import { isE2eMode } from '../services/e2eRuntime'
import { E2E_LIVE_NOTIFICATION_EVENT } from '../services/notificationService'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '')
const INITIAL_RETRY_DELAY = 1000
const MAX_RETRY_DELAY = 10000

type LiveNotificationEvent = Record<string, any>
type LiveNotificationHandler = (payload: LiveNotificationEvent) => void

interface UseLiveNotificationsOptions {
  enabled?: boolean
  storeId?: string | null
}

export function useLiveNotifications(options: UseLiveNotificationsOptions = {}) {
  const { enabled = true, storeId = null } = options
  const subscribersRef = useRef<Map<string, Set<LiveNotificationHandler>>>(new Map())
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY)
  const unmountedRef = useRef(false)
  const lastEventRef = useRef<LiveNotificationEvent | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<string>('idle')
  const [lastConnectedAt, setLastConnectedAt] = useState<string | null>(null)

  const updateConnectionStatus = useCallback((nextStatus: string) => {
    setConnectionStatus((currentStatus) =>
      currentStatus === nextStatus ? currentStatus : nextStatus,
    )
  }, [])

  const dispatchEvent = useCallback((eventName: string, payload: LiveNotificationEvent) => {
    const exactSubscribers = subscribersRef.current.get(eventName) ?? new Set()
    const wildcardSubscribers = subscribersRef.current.get('*') ?? new Set()

    for (const handler of [...exactSubscribers, ...wildcardSubscribers]) {
      handler(payload)
    }
  }, [])

  const cleanupConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const connect = useCallback(async () => {
    cleanupConnection()

    if (!enabled || !storeId || !firebaseReady || isE2eMode()) {
      updateConnectionStatus(enabled ? 'disconnected' : 'idle')
      return
    }

    updateConnectionStatus('connecting')

    try {
      const user = await ensureRemoteSession().catch(() => null)
      const idToken = user ? await user.getIdToken().catch(() => '') : ''

      if (!idToken) {
        updateConnectionStatus('disconnected')
        return
      }

      const streamUrl = `${apiBaseUrl}/events?access_token=${encodeURIComponent(idToken)}&storeId=${encodeURIComponent(storeId)}`
      const source = new EventSource(streamUrl)
      eventSourceRef.current = source

      source.addEventListener('connected', (rawEvent) => {
        retryDelayRef.current = INITIAL_RETRY_DELAY
        updateConnectionStatus('connected')
        setLastConnectedAt(new Date().toISOString())
        try {
          lastEventRef.current = JSON.parse(rawEvent.data)
        } catch {
          lastEventRef.current = null
        }
      })

      source.addEventListener('notification', (rawEvent) => {
        try {
          const payload = JSON.parse(rawEvent.data)
          lastEventRef.current = payload
          dispatchEvent(String(payload.type ?? 'notification'), payload)
          dispatchEvent('notification', payload)
        } catch {
          // ignore invalid payload
        }
      })

      source.onerror = () => {
        cleanupConnection()
        if (!unmountedRef.current) {
          updateConnectionStatus('reconnecting')
          reconnectTimerRef.current = window.setTimeout(() => {
            reconnectTimerRef.current = null
            void connect()
          }, retryDelayRef.current)
          retryDelayRef.current = Math.min(MAX_RETRY_DELAY, retryDelayRef.current * 2)
        }
      }
    } catch {
      if (!unmountedRef.current && !reconnectTimerRef.current) {
        updateConnectionStatus('reconnecting')
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null
          void connect()
        }, retryDelayRef.current)
        retryDelayRef.current = Math.min(MAX_RETRY_DELAY, retryDelayRef.current * 2)
      }
    }
  }, [cleanupConnection, dispatchEvent, enabled, storeId, updateConnectionStatus])

  const scheduleReconnect = useCallback(() => {
    if (unmountedRef.current || reconnectTimerRef.current) {
      return
    }

    updateConnectionStatus('reconnecting')
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null
      void connect()
    }, retryDelayRef.current)
    retryDelayRef.current = Math.min(MAX_RETRY_DELAY, retryDelayRef.current * 2)
  }, [connect, updateConnectionStatus])

  useEffect(() => {
    unmountedRef.current = false

    if (isE2eMode()) {
      updateConnectionStatus('connected')
      setLastConnectedAt(new Date().toISOString())

      const handler = (event: Event) => {
        const payload = (event as CustomEvent).detail ?? null

        if (!payload) {
          return
        }

        lastEventRef.current = payload
        dispatchEvent(String(payload.type ?? 'notification'), payload)
        dispatchEvent('notification', payload)
      }

      window.addEventListener(E2E_LIVE_NOTIFICATION_EVENT, handler)
      return () => {
        unmountedRef.current = true
        window.removeEventListener(E2E_LIVE_NOTIFICATION_EVENT, handler)
      }
    }

    void connect()

    return () => {
      unmountedRef.current = true
      cleanupConnection()
    }
  }, [cleanupConnection, connect, dispatchEvent, updateConnectionStatus])

  const subscribe = useCallback((eventName: string, handler: LiveNotificationHandler) => {
    if (!subscribersRef.current.has(eventName)) {
      subscribersRef.current.set(eventName, new Set())
    }

    subscribersRef.current.get(eventName)?.add(handler)

    return () => {
      const handlers = subscribersRef.current.get(eventName)
      handlers?.delete(handler)
      if (handlers && handlers.size === 0) {
        subscribersRef.current.delete(eventName)
      }
    }
  }, [])

  const reconnect = useCallback(() => {
    retryDelayRef.current = INITIAL_RETRY_DELAY
    void connect()
  }, [connect])

  return useMemo(
    () => ({
      connectionStatus,
      lastConnectedAt,
      lastEvent: lastEventRef.current,
      subscribe,
      reconnect,
    }),
    [connectionStatus, lastConnectedAt, reconnect, subscribe],
  )
}
