import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { useAuth } from './AuthContext'

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const { session, loading: authLoading } = useAuth()
  const [currentStoreId, setCurrentStoreId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) {
      setLoading(true)
      return
    }

    if (!session?.storeIds?.length) {
      setCurrentStoreId(null)
      setLoading(false)
      return
    }

    setCurrentStoreId((existingStoreId) => {
      if (existingStoreId && session.storeIds.includes(existingStoreId)) {
        return existingStoreId
      }

      return session.defaultStoreId ?? session.storeIds[0]
    })
    setLoading(false)
  }, [authLoading, session])

  const value = useMemo(
    () => ({
      currentStoreId,
      availableStoreIds: session?.storeIds ?? [],
      loading,
      tenantId: session?.tenantId ?? null,
      setCurrentStoreId,
    }),
    [currentStoreId, loading, session],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const context = useContext(StoreContext)

  if (!context) {
    throw new Error('useStore must be used within StoreProvider')
  }

  return context
}
