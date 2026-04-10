// src/hooks/useWebSocket.js
import { useEffect, useRef, useState, useCallback } from "react";

export function useWebSocket(url, options = {}) {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [lastMessage, setLastMessage] = useState(null);

  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const isConnectingRef = useRef(false);
  const mountedRef = useRef(true);
  const urlRef = useRef(url);

  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      socketRef.current.onmessage = null;
      socketRef.current.close(1000, "Manual disconnect");
      socketRef.current = null;
    }
    isConnectingRef.current = false;
  }, []);

  const connect = useCallback(() => {
    if (!urlRef.current || !mountedRef.current || isConnectingRef.current) return;

    // Check if already exceeded max attempts
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.log("⛔ Max reconnect attempts reached. Stopping.");
      setConnectionStatus("failed");
      return;
    }

    // Clean up existing
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      socketRef.current.onmessage = null;
      try { socketRef.current.close(); } catch (e) {}
      socketRef.current = null;
    }

    isConnectingRef.current = true;
    setConnectionStatus("connecting");

    try {
      console.log(`🔌 Connecting WebSocket: ${urlRef.current} (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
      const ws = new WebSocket(urlRef.current);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        console.log("✅ WebSocket Connected");
        setConnectionStatus("connected");
        reconnectAttemptsRef.current = 0; // Reset on success
        isConnectingRef.current = false;
        onOpen?.();
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        console.log(`🔌 WebSocket Closed: ${event.code}`);
        setConnectionStatus("disconnected");
        isConnectingRef.current = false;
        onClose?.(event);

        // Only reconnect if not clean close AND under max attempts
        if (event.code !== 1000 && mountedRef.current) {
          reconnectAttemptsRef.current += 1;

          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = reconnectInterval * Math.min(reconnectAttemptsRef.current, 5);
            console.log(`🔄 Reconnecting in ${delay}ms... Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);

            reconnectTimerRef.current = setTimeout(() => {
              if (mountedRef.current) connect();
            }, delay);
          } else {
            console.log("⛔ Max reconnect attempts reached. Giving up.");
            setConnectionStatus("failed");
          }
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        console.error("❌ WebSocket Error");
        isConnectingRef.current = false;
        onError?.();
        // Don't set status here - onclose will fire after onerror
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          onMessage?.(data);
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

    } catch (err) {
      console.error("WebSocket creation error:", err);
      setConnectionStatus("error");
      isConnectingRef.current = false;
    }
  }, [maxReconnectAttempts, reconnectInterval, onMessage, onOpen, onClose, onError]);

  const sendMessage = useCallback((data) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify(data));
        return true;
      } catch (err) {
        console.error("Send error:", err);
        return false;
      }
    }
    return false;
  }, []);

  const sendTyping = useCallback((isTyping) => {
    sendMessage({ type: "typing", is_typing: isTyping });
  }, [sendMessage]);

  // Connect/disconnect on URL change
  useEffect(() => {
    mountedRef.current = true;
    reconnectAttemptsRef.current = 0;

    if (url) {
      const timer = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 200);

      return () => {
        clearTimeout(timer);
        mountedRef.current = false;
        disconnect();
      };
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [url]);

  return {
    connectionStatus,
    lastMessage,
    sendMessage,
    sendTyping,
    connect,
    disconnect,
    isConnected: connectionStatus === "connected",
  };
}