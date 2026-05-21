import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { pileteroApi, PileteroProfile } from '../api/pileteroApi';

interface AuthContextType {
  profile: PileteroProfile | null;
  isLoading: boolean;
  login: (apiKey: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<PileteroProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Al arrancar, intentar recuperar la key guardada
  useEffect(() => {
    const tryRestore = async () => {
      try {
        const key = await SecureStore.getItemAsync('piletero_api_key');
        if (key) {
          const p = await pileteroApi.getProfile();
          setProfile(p);
        }
      } catch {
        // Key inválida o expirada — limpiar
        await SecureStore.deleteItemAsync('piletero_api_key');
      } finally {
        setIsLoading(false);
      }
    };
    tryRestore();
  }, []);

  const login = async (apiKey: string) => {
    await SecureStore.setItemAsync('piletero_api_key', apiKey.trim());
    try {
      const p = await pileteroApi.getProfile();
      setProfile(p);
    } catch (e) {
      await SecureStore.deleteItemAsync('piletero_api_key');
      throw e;
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('piletero_api_key');
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ profile, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
