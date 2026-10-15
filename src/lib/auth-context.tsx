"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "./types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function postAuthRequest(
  path: string,
  payload: Record<string, string>,
  failureMessage: string
) {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Cannot reach the PulseCheck server. Start it with `npm run dev` and try again."
      );
    }
    throw error;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || failureMessage);
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("pulsecheck_token");
    const savedUser = localStorage.getItem("pulsecheck_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await postAuthRequest(
      "/api/auth/login",
      { email, password },
      "Login failed"
    );
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("pulsecheck_token", data.token);
    localStorage.setItem("pulsecheck_user", JSON.stringify(data.user));
  };

  const register = async (email: string, password: string, name: string) => {
    const data = await postAuthRequest(
      "/api/auth/register",
      { email, password, name },
      "Registration failed"
    );
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("pulsecheck_token", data.token);
    localStorage.setItem("pulsecheck_user", JSON.stringify(data.user));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("pulsecheck_token");
    localStorage.removeItem("pulsecheck_user");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}