import { useRef } from "react";
import { Modal, View, ActivityIndicator, Platform, Linking } from "react-native";
import { WebView } from "react-native-webview";
import { useColors } from "@/src/theme";

export type RazorpayOrder = {
  order_id: string;
  amount: number;
  currency: string;
  razorpay_key_id: string;
  name?: string;
  description?: string;
  customer_id?: string | null;
  kind?: "advance" | "balance";
  prefill?: { email?: string; contact?: string; name?: string };
};

export type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayFailure = { reason: string; code?: string };

const WEB_SCHEMES = ["http:", "https:", "about:", "data:", "blob:", "javascript:"];

/**
 * Razorpay Standard Checkout (checkout.js) inside a WebView — works in Expo Go.
 * The native react-native-razorpay SDK needs a dev client, so it is not used.
 * UPI intent links (upi://, tez://, phonepe://, paytmmp://…) are handed to the OS so the UPI app opens.
 */
export function RazorpayCheckoutModal({
  order,
  visible,
  config,
  prefill,
  onSuccess,
  onFailure,
  onDismiss,
  onPending,
}: {
  order: RazorpayOrder | null;
  visible: boolean;
  config?: object;
  prefill?: Record<string, string>;
  onSuccess: (r: RazorpaySuccess) => void;
  onFailure: (f: RazorpayFailure) => void;
  onDismiss: () => void;
  /** Called when the user closes Checkout after an external UPI app was opened — the payment may still complete. */
  onPending?: () => void;
}) {
  const colors = useColors();
  const leftForApp = useRef(false);
  if (!visible || !order) return null;

  const options = {
    key: order.razorpay_key_id,
    amount: order.amount,
    currency: order.currency || "INR",
    name: order.name || "Thara",
    description: order.description || "Booking payment",
    order_id: order.order_id,
    prefill: { ...(order.prefill || {}), ...(prefill || {}) },
    ...(order.customer_id ? { customer_id: order.customer_id, remember_customer: true } : {}),
    ...(config ? { config } : {}),
    retry: { enabled: false },
    theme: { color: "#D9B25F", backdrop_color: "#000000" },
  };

  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<style>html,body{margin:0;background:#000;height:100%;display:flex;align-items:center;justify-content:center;color:#E2BE6E;font-family:Georgia,serif;letter-spacing:.5px}</style>
</head><body>
<p>Opening secure checkout…</p>
<script>
  function post(payload){ try { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch (e) {} }
  var done = false;
  var options = ${JSON.stringify(options)};
  options.handler = function (response) { done = true; post({ type: "success", ...response }); };
  options.modal = { ondismiss: function () { if (!done) post({ type: "dismiss" }); }, confirm_close: true };
  try {
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      done = true;
      var err = (resp && resp.error) || {};
      post({ type: "failed", reason: err.description || 'Payment failed', code: err.code || err.reason || '' });
    });
    rzp.open();
  } catch (e) {
    post({ type: "failed", reason: 'Could not open checkout: ' + String(e) });
  }
</script>
</body></html>`;

  if (Platform.OS === "web") {
    // Product target is iOS/Android (Expo Go). Checkout.js in a WebView is not available on web.
    onFailure({ reason: "Online payment is available in the Thara app on iOS and Android." });
    return null;
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <WebView
          originWhitelist={["*"]}
          source={{ html, baseUrl: "https://api.razorpay.com" }}
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(req) => {
            const scheme = (req.url.split(":")[0] || "").toLowerCase() + ":";
            if (WEB_SCHEMES.includes(scheme)) return true;
            // upi:// tez:// phonepe:// paytmmp:// intent:// — open the UPI app.
            leftForApp.current = true;
            Linking.openURL(req.url).catch(() => {
              leftForApp.current = false;
              onFailure({ reason: "That UPI app isn't installed on this phone. Try another app or your UPI ID." });
            });
            return false;
          }}
          onMessage={(e) => {
            let data: any = null;
            try { data = JSON.parse(e.nativeEvent.data); } catch { /* ignore */ }
            if (data?.type === "success" && data.razorpay_payment_id && data.razorpay_signature) {
              onSuccess({
                razorpay_order_id: data.razorpay_order_id || order.order_id,
                razorpay_payment_id: data.razorpay_payment_id,
                razorpay_signature: data.razorpay_signature,
              });
            } else if (data?.type === "failed") {
              onFailure({ reason: data.reason || "Payment failed", code: data.code });
            } else if (leftForApp.current && onPending) {
              onPending();
            } else {
              onDismiss();
            }
          }}
          startInLoadingState
          renderLoading={() => (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
              <ActivityIndicator color={colors.brand} />
            </View>
          )}
        />
      </View>
    </Modal>
  );
}
