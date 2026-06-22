import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { authAPI, saveToken, clearToken } from '../services/api';
import useStore from '../store/useStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const { setUser, setToken, reset } = useStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const res = await authAPI.login(idToken);
          const { access_token, user } = res.data;
          await saveToken(access_token);
          setToken(access_token);
          setUser(user);
        } catch {
          // Profile not registered yet — handled in register screen
        }
      } else {
        await clearToken();
        reset();
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    await clearToken();
    reset();
  };

  return (
    <AuthContext.Provider value={{ loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
