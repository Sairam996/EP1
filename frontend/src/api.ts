import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Token storage: Keychain/Keystore via expo-secure-store on native; AsyncStorage only on web.
const TOKEN_KEY = "ep_token";
const tokenStore = {
  get: async () => Platform.OS === "web" ? AsyncStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY),
  set: async (t: string) => Platform.OS === "web" ? AsyncStorage.setItem(TOKEN_KEY, t) : SecureStore.setItemAsync(TOKEN_KEY, t),
  del: async () => {
    if (Platform.OS !== "web") { await SecureStore.deleteItemAsync(TOKEN_KEY); }
    await AsyncStorage.removeItem(TOKEN_KEY); // also clear any legacy copy
  },
};


// In dev on a phone, a localhost backend URL is unreachable. Fall back to the
// Metro host (Expo tunnel / LAN), which proxies /api/* to the backend (metro.config.js).
function resolveBackend(): string {
  const env = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
  const isLocal = !env || /\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(env);
  if (__DEV__ && Platform.OS !== "web" && isLocal) {
    const hostUri = Constants.expoConfig?.hostUri || "";
    if (hostUri) {
      const host = hostUri.split("/")[0];
      const isLan = /^(\d+\.){3}\d+(:\d+)?$/.test(host) || host.startsWith("localhost");
      return `${isLan ? "http" : "https"}://${host.replace(/:80$/, "")}`;
    }
  }
  return env;
}
export const BACKEND_BASE = resolveBackend();
const BASE = BACKEND_BASE + "/api";

let memToken: string | null = null;
export async function setToken(t: string | null) {
  memToken = t;
  if (t) await tokenStore.set(t);
  else await tokenStore.del();
}
export async function loadToken(): Promise<string | null> {
  if (memToken) return memToken;
  memToken = await tokenStore.get();
  if (!memToken && Platform.OS !== "web") {
    // One-time migration from the old AsyncStorage location.
    const legacy = await AsyncStorage.getItem(TOKEN_KEY);
    if (legacy) { await tokenStore.set(legacy); await AsyncStorage.removeItem(TOKEN_KEY); memToken = legacy; }
  }
  return memToken;
}

async function req(method: string, path: string, body?: any, opts: { auth?: boolean } = { auth: true }) {
  const headers: any = { "Content-Type": "application/json" };
  if (opts.auth !== false) {
    const t = await loadToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e: any) {
    throw new Error(e?.name === "AbortError" ? "Request timed out" : `Network request failed: ${e?.message || e}`);
  } finally {
    clearTimeout(timer);
  }
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

/** Root of the backend (no /api suffix). */
export const BACKEND_ROOT = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

/** Resolve relative upload paths (e.g. "/api/media/x.jpg") so <Image> can load them. */
export function resolveImg(u?: string | null): string {
  if (!u) return "";
  if (/^(https?:|data:|blob:|file:)/i.test(u)) return u;
  return `${BACKEND_ROOT}${u.startsWith("/") ? "" : "/"}${u}`;
}

export type LocalImage = { uri: string; mimeType?: string | null; fileName?: string | null };

/** Upload one picked image to POST /api/uploads. Reports 0..1 progress. Returns the public URL. */
export async function uploadImage(img: LocalImage, onProgress?: (p: number) => void): Promise<string> {
  const token = await loadToken();
  const type = img.mimeType || (img.uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
  const name = img.fileName || `photo.${type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1]}`;
  const form = new FormData();
  if (img.uri.startsWith("blob:") || img.uri.startsWith("data:")) {
    // Web: picker gives blob/data URIs — convert to a real Blob.
    const blob = await (await fetch(img.uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri: img.uri, name, type } as any);
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/uploads`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let data: any = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && data?.url) { onProgress?.(1); resolve(data.url); }
      else reject(new Error(data?.detail || `Upload failed (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.send(form);
  });
}
