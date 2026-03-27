import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { login as apiLogin, register as apiRegister } from '../lib/api';

const AuthContext = createContext(null);

function loadStoredAuth() {
  try {
    const stored = localStorage.getItem('auth');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    localStorage.removeItem('auth');
  }
  return null;
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(loadStoredAuth);

  const login = useCallback(async (email, password) => {
    const data = await apiLogin(email, password);
    const state = { user: data.user, token: data.token };
    localStorage.setItem('auth', JSON.stringify(state));
    setAuthState(state);
    return data;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const data = await apiRegister(email, password, name);
    const state = { user: data.user, token: data.token };
    localStorage.setItem('auth', JSON.stringify(state));
    setAuthState(state);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth');
    setAuthState(null);
  }, []);

  const value = useMemo(
    () => ({
      user: authState?.user || null,
      token: authState?.token || null,
      isAuthenticated: !!authState?.token,
      login,
      register,
      logout,
    }),
    [authState, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
