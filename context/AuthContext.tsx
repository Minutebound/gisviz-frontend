"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

interface AuthContextType {
  userHandle: string | null;
  token: string | null;
  loginSession: (token: string, handle: string) => void;
  logoutSession: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [userHandle, setUserHandle] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); 

  useEffect(() => {
    const savedToken = localStorage.getItem("gisviz_token");
    const savedHandle = localStorage.getItem("gisviz_handle");
    if (savedToken && savedHandle) {
      setToken(savedToken);
      setUserHandle(savedHandle);
    }
    setIsLoading(false); 
  }, []);

  const loginSession = (newToken: string, handle: string) => {
    localStorage.setItem("gisviz_token", newToken);
    localStorage.setItem("gisviz_handle", handle);
    setToken(newToken);
    setUserHandle(handle);
  };

  const logoutSession = () => {
    localStorage.removeItem("gisviz_token");
    localStorage.removeItem("gisviz_handle");
    setToken(null);
    setUserHandle(null);
  };

  return (
    <AuthContext.Provider value={{ userHandle, token, loginSession, logoutSession, isAuthenticated: !!token, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth strictly bound to AuthProvider");
  return context;
};