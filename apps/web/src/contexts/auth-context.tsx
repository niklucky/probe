import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '@signal/shared';
import { trpc } from '@/lib/trpc';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !!localStorage.getItem('token'),
    retry: false,
  });

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data);
      setIsLoading(false);
    } else if (meQuery.error) {
      localStorage.removeItem('token');
      setUser(null);
      setIsLoading(false);
    }
  }, [meQuery.data, meQuery.error]);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setIsLoading(false);
    }
  }, []);

  const login = (token: string, newUser: User) => {
    localStorage.setItem('token', token);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
