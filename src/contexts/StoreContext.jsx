import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './AuthContext';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const { session } = useAuth();
  const [currentStoreId, setCurrentStoreId] = useState(null);

  useEffect(() => {
    if (!session?.storeIds?.length) {
      setCurrentStoreId(null);
      return;
    }

    setCurrentStoreId((existingStoreId) => {
      if (existingStoreId && session.storeIds.includes(existingStoreId)) {
        return existingStoreId;
      }

      return session.defaultStoreId ?? session.storeIds[0];
    });
  }, [session]);

  const value = useMemo(
    () => ({
      currentStoreId,
      availableStoreIds: session?.storeIds ?? [],
      tenantId: session?.tenantId ?? null,
      setCurrentStoreId,
    }),
    [currentStoreId, session],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }

  return context;
}
