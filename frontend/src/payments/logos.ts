/**
 * Official payment brand marks, bundled locally (assets/payments) so they load offline in Expo Go.
 * Sources: Razorpay public CDN (UPI apps, banks, wallets, Pay Later) and Wikimedia Commons
 * (UPI, Visa, Mastercard, RuPay, American Express, Amazon Pay). Rendered unaltered onto white chips.
 * Sizes (@3x): circle marks 144×144, row chips 132×90, bank chips 192×120 — all transparent PNG.
 */
import type { ImageSourcePropType } from "react-native";
import upiGpay from "@/assets/payments/upi-gpay.png";
import upiPhonepe from "@/assets/payments/upi-phonepe.png";
import upiPaytm from "@/assets/payments/upi-paytm.png";
import upiBhim from "@/assets/payments/upi-bhim.png";
import upi from "@/assets/payments/upi.png";
import cardVisa from "@/assets/payments/card-visa.png";
import cardMastercard from "@/assets/payments/card-mastercard.png";
import cardRupay from "@/assets/payments/card-rupay.png";
import cardAmex from "@/assets/payments/card-amex.png";
import bankSbin from "@/assets/payments/bank-sbin.png";
import bankHdfc from "@/assets/payments/bank-hdfc.png";
import bankIcic from "@/assets/payments/bank-icic.png";
import bankUtib from "@/assets/payments/bank-utib.png";
import bankKkbk from "@/assets/payments/bank-kkbk.png";
import walletAmazonpay from "@/assets/payments/wallet-amazonpay.png";
import walletMobikwik from "@/assets/payments/wallet-mobikwik.png";
import walletFreecharge from "@/assets/payments/wallet-freecharge.png";
import plSimpl from "@/assets/payments/pl-getsimpl.png";
import plLazypay from "@/assets/payments/pl-lazypay.png";
import plIcic from "@/assets/payments/pl-icic.png";

export const UPI_LOGO: ImageSourcePropType = upi;

export const UPI_APP_LOGOS: Record<string, ImageSourcePropType> = {
  google_pay: upiGpay, phonepe: upiPhonepe, paytm: upiPaytm, bhim: upiBhim,
};

export const BANK_LOGOS: Record<string, ImageSourcePropType> = {
  SBIN: bankSbin, HDFC: bankHdfc, ICIC: bankIcic, UTIB: bankUtib, KKBK: bankKkbk,
};

export const WALLET_LOGOS: Record<string, ImageSourcePropType> = {
  amazonpay: walletAmazonpay, mobikwik: walletMobikwik, freecharge: walletFreecharge,
};

export const PAY_LATER_LOGOS: Record<string, ImageSourcePropType> = {
  getsimpl: plSimpl, lazypay: plLazypay, icic: plIcic,
};

export const CARD_NETWORKS: { code: string; label: string; logo: ImageSourcePropType }[] = [
  { code: "visa", label: "Visa", logo: cardVisa },
  { code: "mastercard", label: "Mastercard", logo: cardMastercard },
  { code: "rupay", label: "RuPay", logo: cardRupay },
  { code: "amex", label: "American Express", logo: cardAmex },
];

/** Razorpay reports networks as "Visa", "MasterCard", "RuPay", "American Express"… */
export function cardNetworkLogo(network?: string): ImageSourcePropType | undefined {
  const n = (network || "").toLowerCase().replace(/\s+/g, "");
  if (n.includes("visa")) return cardVisa;
  if (n.includes("master")) return cardMastercard;
  if (n.includes("rupay")) return cardRupay;
  if (n.includes("amex") || n.includes("americanexpress")) return cardAmex;
  return undefined;
}
