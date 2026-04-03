import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { useStore } from '../contexts/StoreContext'
import {
  BACKUP_SYNC_EVENT,
  flushBackupNow,
  getBackupSyncState,
  initializeBackupService,
  scheduleBackupForStorageKey,
  shutdownBackupService,
  subscribeToBackupSyncState,
} from '../services/backupService'
import { LOCAL_RECORDS_EVENT } from '../services/localAccess'

type BackupSyncState = ReturnType<typeof getBackupSyncState>

export function useBackupSync(): BackupSyncState & {
  flushNow: (reason?: string) => Promise<BackupSyncState>
} {
  const { session, isAuthenticated } = useAuth() as {
    session: Record<string, any> | null
    isAuthenticated: boolean
  }
  const { currentStoreId, tenantId } = useStore() as {
    currentStoreId: string | null
    tenantId: string | null
  }
  const [state, setState] = useState<BackupSyncState>(() => getBackupSyncState())

  useEffect(() => {
    const unsubscribe = subscribeToBackupSyncState(setState)
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    initializeBackupService({
      storeId: isAuthenticated ? currentStoreId : null,
      tenantId,
      userId: session?.uid ?? null,
      operatorName: session?.operatorName ?? session?.displayName ?? '',
    })

    return () => {
      shutdownBackupService()
    }
  }, [
    currentStoreId,
    isAuthenticated,
    session?.displayName,
    session?.operatorName,
    session?.uid,
    tenantId,
  ])

  useEffect(() => {
    if (!isAuthenticated || !currentStoreId) {
      return undefined
    }

    let visibilityTimerId: number | null = null
    let foregroundSyncRunning = false

    function handleLocalRecords(event: Event) {
      const customEvent = event as CustomEvent<{ storageKey?: string }>
      const storageKey = customEvent.detail?.storageKey

      if (!storageKey) {
        return
      }

      scheduleBackupForStorageKey(storageKey, {
        reason: 'local-storage-change',
      })
    }

    async function flushForegroundBackup(reason: string) {
      if (foregroundSyncRunning || !navigator.onLine) {
        return
      }

      const currentState = getBackupSyncState()

      if (currentState.pendingScopes.length === 0 && !currentState.lastError) {
        return
      }

      foregroundSyncRunning = true

      try {
        await flushBackupNow({ reason })
      } catch {
        // ignore foreground retry failures
      } finally {
        foregroundSyncRunning = false
      }
    }

    function handleReconnect() {
      void flushForegroundBackup('reconnect-sync')
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') {
        if (visibilityTimerId) {
          window.clearTimeout(visibilityTimerId)
          visibilityTimerId = null
        }
        return
      }

      visibilityTimerId = window.setTimeout(() => {
        visibilityTimerId = null
        void flushForegroundBackup('foreground-sync')
      }, 1500)
    }

    function handleBackgroundEvent(event: Event) {
      const customEvent = event as CustomEvent

      if (customEvent.detail?.status === 'error' && navigator.onLine) {
        flushBackupNow({ reason: 'retry-after-error' }).catch(() => {})
      }
    }

    window.addEventListener(LOCAL_RECORDS_EVENT, handleLocalRecords as EventListener)
    window.addEventListener('online', handleReconnect)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener(BACKUP_SYNC_EVENT, handleBackgroundEvent as EventListener)

    return () => {
      if (visibilityTimerId) {
        window.clearTimeout(visibilityTimerId)
      }
      window.removeEventListener(LOCAL_RECORDS_EVENT, handleLocalRecords as EventListener)
      window.removeEventListener('online', handleReconnect)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener(BACKUP_SYNC_EVENT, handleBackgroundEvent as EventListener)
    }
  }, [currentStoreId, isAuthenticated])

  return useMemo(
    () => ({
      ...state,
      async flushNow(reason = 'manual') {
        return flushBackupNow({ reason })
      },
    }),
    [state],
  )
}
