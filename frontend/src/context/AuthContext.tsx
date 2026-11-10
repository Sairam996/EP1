import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { api, setToken, loadToken, isNetworkError } from "../api";
import { onReconnect } from "../connectivity";

export type User = {
  id: string; name: string; email: string; phone: string;
  role: "customer" | "vendor"; city?: string; vendor_id?: string; avatar?: string;
  profile_complete?: boolean;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signIn: (identifier: { email?: string; phone?: string }, password: string) => Promise<User>;
  signUp: (data: { name: string; email: string; phone: string; password: string; role: "customer" | "vendor"; city?: string }) => Promise<User>;
  sendOtp: (phone: string) => Promise<{ phone: string; expires_in: number; dev_otp?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<User>;
  completeProfile: (data: {
    name: string; email?: string; city?: string; role?: "customer" | "vendor"; avatar?: string;
  }) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const hydrate = async () => {
      if (!alive) return;
      const t = await loadToken();
      if (t) {
        try {
          const u = await api.get("/auth/me");
          if (!alive) return;
          setUser(u);
        } catch (e) {
          // Offline / server down: keep the session and the boot screen (the offline
          // page shows on top) and retry when connectivity returns. Only a real auth
          // rejection signs the user out.
          if (isNetworkError(e)) {
            clearTimeout(retryTimer);
            retryTimer = setTimeout(hydrate, 5000);
            return;
          }
          await setToken(null);
        }
      }
      unsub();
      if (alive) setLoading(false);
    };
    const unsub = onReconnect(() => { clearTimeout(retryTimer); hydrate(); });
    hydrate();
    return () => { alive = false; clearTimeout(retryTimer); unsub(); };
  }, []);

  const registerPush = async (userId: string) => {
    if (Platform.OS === "web") return;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;
      const tokenResp = await Notifications.getDevicePushTokenAsync();
      await api.post("/register-push", {
        user_id: userId, platform: Platform.OS, device_token: tokenResp.data,
      }, { auth: false });
    } catch (e) { console.warn("push register failed", e); }
  };

  const signIn = async (identifier: { email?: string; phone?: string }, password: string) => {
    const r = await api.post("/auth/login", { ...identifier, password }, { auth: false });
    await setToken(r.token);
    setUser(r.user);
    registerPush(r.user.id);
    return r.user;
  };
  const signUp = async (data: any) => {
    const r = await api.post("/auth/register", data, { auth: false });
    await setToken(r.token);
    setUser(r.user);
    registerPush(r.user.id);
    return r.user;
  };
  const sendOtp = async (phone: string) => {
    return api.post("/auth/otp/send", { phone }, { auth: false });
  };
  const verifyOtp = async (phone: string, otp: string) => {
    const r = await api.post("/auth/otp/verify", { phone, otp }, { auth: false });
    await setToken(r.token);
    setUser(r.user);
    registerPush(r.user.id);
    return r.user as User;
  };
  const completeProfile = async (data: {
    name: string; email?: string; city?: string; role?: "customer" | "vendor"; avatar?: string;
  }) => {
    const u = await api.post("/auth/complete-profile", data);
    setUser(u);
    return u as User;
  };
  const signOut = async () => {
    await setToken(null);
    setUser(null);
  };
  const refresh = async () => {
    try { const u = await api.get("/auth/me"); setUser(u); } catch {}
  };

  return (
    <Ctx.Provider value={{
      user, loading, signIn, signUp, sendOtp, verifyOtp, completeProfile, signOut, refresh,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
