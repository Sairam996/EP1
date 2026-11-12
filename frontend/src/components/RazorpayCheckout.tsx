import { Modal, View, ActivityIndicator, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { useColors } from "@/src/theme";

export type RazorpayOrder = {
  order_id: string;
  amount: number;
  currency: string;
  razorpay_key_id: string;
  name?: string;
  description?: string;
  prefill?: { email?: string; contact?: string; name?: string };
};

export type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

/** Checkout.js inside a WebView — works in Expo Go. Native react-native-razorpay needs a dev client. */
export function RazorpayCheckoutModal({
  order,
  visible,
  onSuccess,
  onDismiss,
}: {
  order: RazorpayOrder | null;
  visible: boolean;
  onSuccess: (r: RazorpaySuccess) => void;
  onDismiss: () => void;
}) {
  const colors = useColors();
  if (!visible || !order) return null;

  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<style>html,body{margin:0;background:#0B0C10;height:100%;display:flex;align-items:center;justify-content:center;color:#E2BE6E;font-family:-apple-system,sans-serif}</style>
</head><body>
<p>Opening secure checkout…</p>
<script>
  function post(payload){
    try { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); } catch (e) {}
  }
  var options = {
    key: ${JSON.stringify(order.razorpay_key_id)},
    amount: ${JSON.stringify(order.amount)},
    currency: ${JSON.stringify(order.currency || "INR")},
    name: ${JSON.stringify(order.name || "Thara")},
    description: ${JSON.stringify(order.description || "Booking payment")},
    order_id: ${JSON.stringify(order.order_id)},
    prefill: ${JSON.stringify(order.prefill || {})},
    theme: { color: "#D4AF37" },
    handler: function (response) {
      post({ ok: true, ...response });
    },
    modal: {
      ondismiss: function () { post({ ok: false, dismissed: true }); }
    }
  };
  try {
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      post({ ok: false, error: (resp && resp.error && resp.error.description) || 'Payment failed' });
    });
    rzp.open();
  } catch (e) {
    post({ ok: false, error: String(e) });
  }
</script>
</body></html>`;

  if (Platform.OS === "web") {
    // Expo Go / native is the product target. On web we cannot host Checkout.js reliably here.
    onDismiss();
    return null;
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onDismiss}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <WebView
          originWhitelist={["*"]}
          source={{ html, baseUrl: "https://api.razorpay.com" }}
          onMessage={(e) => {
            try {
              const data = JSON.parse(e.nativeEvent.data);
              if (data?.ok && data.razorpay_payment_id && data.razorpay_signature) {
                onSuccess({
                  razorpay_order_id: data.razorpay_order_id || order.order_id,
                  razorpay_payment_id: data.razorpay_payment_id,
                  razorpay_signature: data.razorpay_signature,
                });
              } else {
                onDismiss();
              }
            } catch {
              onDismiss();
            }
          }}
          startInLoadingState
          renderLoading={() => (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
              <ActivityIndicator color={colors.brand} />
            </View>
          )}
        />
      </View>
    </Modal>
  );
}
