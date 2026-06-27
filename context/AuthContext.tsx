"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { gisvizApi } from "../services/api";

export interface UserProfile {
  user_id: string;
  user_handle: string;
  email_address: string;
  avatar_path?: string | null;
  title?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  follower_count: number;
  following_count: number;
  post_count?: number;
  role_name?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loginSession: (token: string, handle: string) => void;
  logoutSession: () => void;
  refreshProfile: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Safely clears local storage and context
  const logoutSession = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("gisviz_token");
      localStorage.removeItem("gisviz_handle");
    }
    setToken(null);
    setUser(null);
  }, []);

  // Fetches DB profile and logs out if token is expired/invalid
  const fetchProfile = useCallback(async () => {
    try {
      const data = await gisvizApi.fetchMe();
      setUser(data);
    } catch (error: any) {
      console.error("Failed to fetch user profile", error);
      if (error.response?.status === 401) {
        logoutSession();
      }
    }
  }, [logoutSession]);

  // Initial mount hydration
  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = typeof window !== "undefined" ? localStorage.getItem("gisviz_token") : null;
      if (savedToken) {
        setToken(savedToken);
        await fetchProfile();
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, [fetchProfile]);

  // Login handler
  const loginSession = async (newToken: string, handle: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gisviz_token", newToken);
      localStorage.setItem("gisviz_handle", handle);
    }
    setToken(newToken);
    try {
      const data = await gisvizApi.fetchMe();
      setUser(data);
    } catch (e) {
      console.error("Failed fetching user immediately after login", e);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loginSession, 
      logoutSession, 
      refreshProfile: fetchProfile,
      isAuthenticated: !!token, 
      isLoading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth strictly bound to AuthProvider");
  return context;
};