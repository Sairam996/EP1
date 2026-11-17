/**
 * Thara checkout payment-method catalog + Razorpay Standard Checkout config.
 * The app only collects the *choice* of method; card numbers, UPI PINs and bank logins are
 * entered inside Razorpay's secure checkout (PCI-DSS), never in Thara.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type PayMethod = "upi" | "card" | "netbanking" | "wallet" | "paylater";
export type SavedCard = { network: string; last4: string; issuer?: string; type?: string };

export type PaySelection =
  | { method: "upi"; app?: string; vpa?: string }
  | { method: "card"; saved?: SavedCard }
  | { method: "netbanking"; bank?: string }
  | { method: "wallet"; wallet: string }
  | { method: "paylater"; provider: string };

type Option = { code: string; label: string; mark: string; short?: string };

/** UPI intent apps — `code` is Razorpay's app id for `config.display` instruments. */
export const UPI_APPS: Option[] = [
  { code: "google_pay", label: "Google Pay", mark: "G" },
  { code: "phonepe", label: "PhonePe", mark: "Pe" },
  { code: "paytm", label: "Paytm", mark: "P" },
  { code: "bhim", label: "BHIM", mark: "B" },
];

/** Net banking — Razorpay bank codes. */
export const POPULAR_BANKS: Option[] = [
  { code: "SBIN", label: "State Bank of India", mark: "SBI", short: "SBI" },
  { code: "HDFC", label: "HDFC Bank", mark: "H", short: "HDFC" },
  { code: "ICIC", label: "ICICI Bank", mark: "I", short: "ICICI" },
  { code: "UTIB", label: "Axis Bank", mark: "A", short: "Axis" },
  { code: "KKBK", label: "Kotak Mahindra Bank", mark: "K", short: "Kotak" },
];

export const WALLETS: Option[] = [
  { code: "amazonpay", label: "Amazon Pay", mark: "a" },
  { code: "mobikwik", label: "MobiKwik", mark: "M" },
  { code: "freecharge", label: "Freecharge", mark: "F" },
];

export const PAY_LATER: Option[] = [
  { code: "getsimpl", label: "Simpl", mark: "S" },
  { code: "lazypay", label: "LazyPay", mark: "L" },
  { code: "icic", label: "ICICI PayLater", mark: "I" },
];

const VPA_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/;
export const isValidVpa = (v: string) => VPA_RE.test(v.trim());

const find = (list: Option[], code?: string) => list.find((o) => o.code === code);

export function selectionLabel(sel: PaySelection | null): string {
  if (!sel) return "Choose a payment method";
  switch (sel.method) {
    case "upi":
      if (sel.vpa) return `UPI · ${sel.vpa}`;
      return find(UPI_APPS, sel.app)?.label || "UPI";
    case "card":
      return sel.saved ? `${sel.saved.network} •••• ${sel.saved.last4}` : "Credit or debit card";
    case "netbanking":
      return find(POPULAR_BANKS, sel.bank)?.label || "Net banking";
    case "wallet":
      return find(WALLETS, sel.wallet)?.label || "Wallet";
    case "paylater":
      return find(PAY_LATER, sel.provider)?.label || "Pay Later";
  }
}

export function selectionKey(sel: PaySelection | null): string {
  if (!sel) return "";
  switch (sel.method) {
    case "upi": return sel.vpa ? "upi:vpa" : `upi:${sel.app || ""}`;
    case "card": return sel.saved ? `card:${sel.saved.network}:${sel.saved.last4}` : "card:new";
    case "netbanking": return `nb:${sel.bank || "all"}`;
    case "wallet": return `wallet:${sel.wallet}`;
    case "paylater": return `pl:${sel.provider}`;
  }
}

/**
 * Razorpay Standard Checkout options that open straight on the chosen method.
 * `config.display` with `show_default_blocks: false` restricts Checkout to that instrument.
 */
export function buildRazorpayConfig(sel: PaySelection): { prefill: Record<string, string>; config: object } {
  const only = (name: string, instruments: object[]) => ({
    display: {
      blocks: { thara: { name, instruments } },
      sequence: ["block.thara"],
      preferences: { show_default_blocks: false },
    },
  });
  switch (sel.method) {
    case "upi":
      if (sel.vpa) return { prefill: { method: "upi", vpa: sel.vpa.trim() }, config: only("Pay with UPI ID", [{ method: "upi", flows: ["collect"] }]) };
      if (sel.app) return { prefill: { method: "upi" }, config: only(`Pay with ${selectionLabel(sel)}`, [{ method: "upi", flows: ["intent"], apps: [sel.app] }]) };
      return { prefill: { method: "upi" }, config: only("Pay with UPI", [{ method: "upi" }]) };
    case "card":
      return { prefill: { method: "card" }, config: only(sel.saved ? "Saved cards" : "Pay by card", [{ method: "card" }]) };
    case "netbanking":
      return sel.bank
        ? { prefill: { method: "netbanking", bank: sel.bank }, config: only(selectionLabel(sel), [{ method: "netbanking", banks: [sel.bank] }]) }
        : { prefill: { method: "netbanking" }, config: only("Net banking", [{ method: "netbanking" }]) };
    case "wallet":
      return { prefill: { method: "wallet", wallet: sel.wallet }, config: only(selectionLabel(sel), [{ method: "wallet", wallets: [sel.wallet] }]) };
    case "paylater":
      return { prefill: { method: "paylater" }, config: only(selectionLabel(sel), [{ method: "paylater", providers: [sel.provider] }]) };
  }
}

const LAST_KEY = "thara.checkout.lastMethod";

export async function loadLastSelection(): Promise<PaySelection | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_KEY);
    const sel = raw ? (JSON.parse(raw) as PaySelection) : null;
    return sel && typeof sel === "object" && "method" in sel ? sel : null;
  } catch {
    return null;
  }
}

export async function saveLastSelection(sel: PaySelection) {
  try { await AsyncStorage.setItem(LAST_KEY, JSON.stringify(sel)); } catch { /* best effort */ }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2027-01-01" → "1 Jan 2027" (lining numerals come from NumText). */
export function prettyDate(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return iso || "";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}
