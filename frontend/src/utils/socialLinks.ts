import { Linking } from "react-native";

export type SocialKind = "instagram" | "facebook" | "website";
export type SocialIcon = "logo-instagram" | "logo-facebook" | "globe-outline";

export type SocialFields = {
  instagram_url?: string | null;
  facebook_url?: string | null;
  website_url?: string | null;
};

export type SocialItem = {
  kind: SocialKind;
  url: string;
  label: string;
  icon: SocialIcon;
  subtitle: string;
};

const META: Record<SocialKind, { field: keyof SocialFields; label: string; icon: SocialIcon }> = {
  instagram: { field: "instagram_url", label: "Instagram", icon: "logo-instagram" },
  facebook: { field: "facebook_url", label: "Facebook", icon: "logo-facebook" },
  website: { field: "website_url", label: "Website", icon: "globe-outline" },
};

/** Merge service-level links over vendor-level links; omit empty ones. */
export function pickSocialLinks(primary?: SocialFields | null, fallback?: SocialFields | null): SocialItem[] {
  const out: SocialItem[] = [];
  (Object.keys(META) as SocialKind[]).forEach((kind) => {
    const field = META[kind].field;
    const url = String((primary?.[field] || fallback?.[field] || "")).trim();
    if (!url) return;
    out.push({
      kind,
      url,
      label: META[kind].label,
      icon: META[kind].icon,
      subtitle: displaySocial(kind, url),
    });
  });
  return out;
}

export function hasSocialLinks(primary?: SocialFields | null, fallback?: SocialFields | null): boolean {
  return pickSocialLinks(primary, fallback).length > 0;
}

export function displaySocial(kind: SocialKind, url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    if (kind === "instagram") {
      const handle = path.split("/").filter(Boolean)[0];
      return handle ? `@${handle}` : "Instagram";
    }
    if (kind === "facebook") {
      const segs = path.split("/").filter(Boolean);
      if (u.searchParams.get("id")) return "facebook.com/profile";
      if (segs.length) return `facebook.com/${segs[segs.length - 1]}`;
      return u.host.replace(/^www\./, "");
    }
    return (u.host.replace(/^www\./, "") + path).replace(/\/$/, "") || url;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}

function instagramHandle(url: string): string | null {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean);
    if (!path.length || ["p", "reel", "reels", "stories"].includes(path[0].toLowerCase())) return null;
    return path[0];
  } catch {
    return null;
  }
}

function appDeepLink(kind: SocialKind, url: string): string | null {
  if (kind === "instagram") {
    const handle = instagramHandle(url);
    return handle ? `instagram://user?username=${encodeURIComponent(handle)}` : null;
  }
  if (kind === "facebook") return `fb://facewebmodal/f?href=${encodeURIComponent(url)}`;
  return null;
}

/** Prefer the native app when installed; fall back to the https URL. */
export async function openSocialLink(kind: SocialKind, url: string): Promise<void> {
  const app = appDeepLink(kind, url);
  if (app) {
    try {
      await Linking.openURL(app);
      return;
    } catch {
      // App scheme rejected (not installed, or Expo Go) — use https.
    }
  }
  await Linking.openURL(url);
}
