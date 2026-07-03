/**
 * Cross-platform map host:
 *  - Native (iOS/Android): uses react-native-webview
 *  - Web: uses a native <iframe srcdoc> element via React DOM (works via react-native-web)
 *
 * Exposes a ref with `injectJavaScript(code)` that behaves consistently on both platforms.
 * Emits messages via the `onMessage` callback with a single string payload.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Platform, StyleSheet, View, ViewStyle } from "react-native";

export type NavMapHostHandle = {
  injectJavaScript: (js: string) => void;
};

type Props = {
  html: string;
  onMessage: (data: string) => void;
  style?: ViewStyle;
  testID?: string;
};

// Native implementation (dynamic require so web bundle doesn't need it)
const NativeHost = forwardRef<NavMapHostHandle, Props>(function NativeHost(props, ref) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WebView } = require("react-native-webview");
  const wvRef = useRef<any>(null);
  useImperativeHandle(ref, () => ({
    injectJavaScript: (js: string) => { try { wvRef.current?.injectJavaScript(js); } catch {} },
  }), []);
  return (
    <WebView
      testID={props.testID}
      ref={wvRef}
      originWhitelist={["*"]}
      source={{ html: props.html }}
      onMessage={(e: any) => props.onMessage(e.nativeEvent.data)}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      setSupportMultipleWindows={false}
      androidLayerType="hardware"
      style={[{ flex: 1, backgroundColor: "transparent" }, props.style]}
      containerStyle={{ backgroundColor: "transparent" }}
    />
  );
});

// Web implementation using an iframe
const WebHost = forwardRef<NavMapHostHandle, Props>(function WebHost(props, ref) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useImperativeHandle(ref, () => ({
    injectJavaScript: (js: string) => {
      try {
        const w = iframeRef.current?.contentWindow;
        if (!w) return;
        // Prefer postMessage so the loaded document can handle it (as the HTML expects "message" events).
        // But injectJavaScript intent is to run arbitrary JS. Run inside iframe context via eval fallback.
        // Since the HTML we ship listens to both `document` and `window` 'message' events, prefer postMessage
        // whenever the payload dispatches a MessageEvent — otherwise use eval.
        if (/dispatchEvent\(new MessageEvent\('message',\s*\{\s*data:/.test(js)) {
          const match = js.match(/data:\s*(".*?")\s*\}\)\);/s) || js.match(/data:\s*('.*?')\s*\}\)\);/s);
          if (match) {
            const rawData = eval(match[1]);
            w.postMessage(rawData, "*");
            return;
          }
        }
        // Fallback: run in iframe. Cross-origin safe because we use srcDoc (same-origin).
        (w as any).eval(js);
      } catch {}
    },
  }), []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = typeof event.data === "string" ? event.data : JSON.stringify(event.data);
      props.onMessage(data);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [props]);

  // Bridge: The Leaflet HTML calls `window.ReactNativeWebView.postMessage`.
  // Inject a shim so those calls become window.parent.postMessage.
  const bridged = `<script>
  (function(){
    window.ReactNativeWebView = window.ReactNativeWebView || { postMessage: function(m){ try { window.parent.postMessage(m, '*'); } catch(e){} } };
  })();
  </script>` + props.html;

  return (
    <View style={[{ flex: 1 }, props.style]}>
      {React.createElement("iframe", {
        ref: iframeRef,
        srcDoc: bridged,
        style: { border: "0", width: "100%", height: "100%", backgroundColor: "transparent" },
        allow: "geolocation *; fullscreen",
        "data-testid": props.testID,
      })}
    </View>
  );
});

export const NavMapHost = forwardRef<NavMapHostHandle, Props>(function NavMapHost(props, ref) {
  if (Platform.OS === "web") return <WebHost {...props} ref={ref} />;
  return <NativeHost {...props} ref={ref} />;
});

export const navMapStyles = StyleSheet.create({
  container: { flex: 1 },
});
