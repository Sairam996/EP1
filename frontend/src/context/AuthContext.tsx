import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setToken, loadToken } from "../api";

export type User = {
  id: string; name: string; email: string; phone: string;
  role: "customer" | "vendor"; city?: string; vendor_id?: string; avatar?: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (data: { name: string; email: string; phone: string; password: string; role: "customer" | "vendor"; city?: string }) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      if (t) {
        try {
          const u = await api.get("/auth/me");
          setUser(u);
        } catch {
          await setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const r = await api.post("/auth/login", { email, password }, { auth: false });
    await setToken(r.token);
    setUser(r.user);
    return r.user;
  };
  const signUp = async (data: any) => {
    const r = await api.post("/auth/register", data, { auth: false });
    await setToken(r.token);
    setUser(r.user);
    return r.user;
  };
  const signOut = async () => {
    await setToken(null);
    setUser(null);
  };
  const refresh = async () => {
    try { const u = await api.get("/auth/me"); setUser(u); } catch {}
  };

  return <Ctx.Provider value={{ user, loading, signIn, signUp, signOut, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
