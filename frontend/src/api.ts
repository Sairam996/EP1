import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "") + "/api";

let memToken: string | null = null;
export async function setToken(t: string | null) {
  memToken = t;
  if (t) await AsyncStorage.setItem("ep_token", t);
  else await AsyncStorage.removeItem("ep_token");
}
export async function loadToken(): Promise<string | null> {
  if (memToken) return memToken;
  memToken = await AsyncStorage.getItem("ep_token");
  return memToken;
}

async function req(method: string, path: string, body?: any, opts: { auth?: boolean } = { auth: true }) {
  const headers: any = { "Content-Type": "application/json" };
  if (opts.auth !== false) {
    const t = await loadToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("json") ? await res.json() : await res.text();
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    if (typeof data === "string") msg = data || msg;
    else if (data && typeof data === "object") {
      const d = (data as any).detail;
      if (typeof d === "string") msg = d;
      else if (Array.isArray(d)) msg = d.map((x: any) => x?.msg || JSON.stringify(x)).join(", ");
      else if (d) msg = JSON.stringify(d);
      else msg = JSON.stringify(data);
    }
    throw new Error(msg);
  }
  return data;
}

export const api = {
  get: (p: string, opts?: any) => req("GET", p, undefined, opts),
  post: (p: string, b?: any, opts?: any) => req("POST", p, b, opts),
  patch: (p: string, b?: any, opts?: any) => req("PATCH", p, b, opts),
  del: (p: string, opts?: any) => req("DELETE", p, undefined, opts),
};
