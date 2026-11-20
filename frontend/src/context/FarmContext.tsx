import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { farmService } from '../services/farmService';
import type {
  Farm,
  CreateFarmPayload,
  UpdateFarmPayload,
  UpdateFarmVisibilityPayload,
} from '../types/farm';

interface FarmContextType {
  farms: Farm[];
  activeFarm: Farm | null;
  loading: boolean;
  error: string | null;
  setActiveFarmId: (farmId: string) => void;
  refreshFarms: () => Promise<void>;
  createFarm: (payload: CreateFarmPayload) => Promise<Farm>;
  updateFarm: (farmId: string, payload: UpdateFarmPayload) => Promise<Farm>;
  updateVisibility: (farmId: string, payload: UpdateFarmVisibilityPayload) => Promise<Farm>;
  archiveFarm: (farmId: string, expectedVersion?: number) => Promise<void>;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [activeFarmId, setActiveFarmIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const setActiveFarmId = useCallback((farmId: string) => {
    setActiveFarmIdState(farmId);
    if (user?.uid) {
      localStorage.setItem(`agroai_active_farm_${user.uid}`, farmId);
    }
  }, [user?.uid]);

  const refreshFarms = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setFarms([]);
      setActiveFarmIdState(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const resp = await farmService.fetchMyFarms();
      const loadedFarms = resp.data || [];
      setFarms(loadedFarms);

      // Restore active farm or select first active farm
      if (loadedFarms.length > 0) {
        setActiveFarmIdState((prev) => {
          const exists = loadedFarms.some((f) => f.farmId === prev && f.status === 'ACTIVE');
          if (exists && prev) {
            return prev;
          }
          const savedKey = `agroai_active_farm_${user.uid}`;
          const savedId = localStorage.getItem(savedKey);
          const savedExists = loadedFarms.some((f) => f.farmId === savedId && f.status === 'ACTIVE');
          const chosenId = savedExists && savedId ? savedId : (loadedFarms.find((f) => f.status === 'ACTIVE') || loadedFarms[0]).farmId;
          localStorage.setItem(savedKey, chosenId);
          return chosenId;
        });
      } else {
        setActiveFarmIdState(null);
        if (user?.uid) {
          localStorage.removeItem(`agroai_active_farm_${user.uid}`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load farms';
      setError(msg);
      console.error('Error fetching user farms:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user?.uid) {
      const savedKey = `agroai_active_farm_${user.uid}`;
      const savedId = localStorage.getItem(savedKey);
      setActiveFarmIdState(savedId);
      refreshFarms();
    } else {
      setFarms([]);
      setActiveFarmIdState(null);
    }
  }, [isAuthenticated, user?.uid, refreshFarms]);

  const activeFarm = farms.find((f) => f.farmId === activeFarmId) || null;

  const handleCreateFarm = async (payload: CreateFarmPayload): Promise<Farm> => {
    const resp = await farmService.createFarm(payload);
    if (!resp.data) {
      throw new Error(resp.message || 'Failed to create farm');
    }
    const newFarm = resp.data;
    await refreshFarms();
    setActiveFarmId(newFarm.farmId);
    return newFarm;
  };

  const handleUpdateFarm = async (farmId: string, payload: UpdateFarmPayload): Promise<Farm> => {
    const resp = await farmService.updateFarm(farmId, payload);
    if (!resp.data) {
      throw new Error(resp.message || 'Failed to update farm');
    }
    const updated = resp.data;
    setFarms((prev) => prev.map((f) => (f.farmId === farmId ? updated : f)));
    return updated;
  };

  const handleUpdateVisibility = async (
    farmId: string,
    payload: UpdateFarmVisibilityPayload
  ): Promise<Farm> => {
    const resp = await farmService.updateFarmVisibility(farmId, payload);
    if (!resp.data) {
      throw new Error(resp.message || 'Failed to update visibility');
    }
    const updated = resp.data;
    setFarms((prev) => prev.map((f) => (f.farmId === farmId ? updated : f)));
    return updated;
  };

  const handleArchiveFarm = async (farmId: string, expectedVersion?: number): Promise<void> => {
    await farmService.archiveFarm(farmId, expectedVersion);
    await refreshFarms();
  };

  return (
    <FarmContext.Provider
      value={{
        farms,
        activeFarm,
        loading,
        error,
        setActiveFarmId,
        refreshFarms,
        createFarm: handleCreateFarm,
        updateFarm: handleUpdateFarm,
        updateVisibility: handleUpdateVisibility,
        archiveFarm: handleArchiveFarm,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
};

export const useFarm = (): FarmContextType => {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error('useFarm must be used within a FarmProvider');
  }
  return context;
};
