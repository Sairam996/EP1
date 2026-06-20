import { useEffect, useRef, useState } from "react";
import { loadToken } from "@/src/api";

type WSMessage = { type: "message"; message: any } | { type: "typing"; user_id: string; sender_name: string };

export function useChatWebSocket(bookingId: string | undefined, onEvent: (e: WSMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("closed");
  const reconnectRef = useRef<any>(null);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;

    const connect = async () => {
      const token = await loadToken();
      if (!token || cancelled) return;
      const base = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/^http/, "ws").replace(/\/$/, "");
      const url = `${base}/api/ws/chat/${bookingId}?token=${token}`;
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setStatus("open");
      ws.onmessage = (ev) => {
        try { onEvent(JSON.parse(ev.data)); } catch {}
      };
      ws.onclose = () => {
        setStatus("closed");
        if (!cancelled) reconnectRef.current = setTimeout(connect, 2500);
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    };
    connect();

    return () => {
      cancelled = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      try { wsRef.current?.close(); } catch {}
    };
  }, [bookingId]);

  const send = (text: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "message", text }));
  };
  const sendTyping = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "typing" }));
  };
  return { status, send, sendTyping };
}
