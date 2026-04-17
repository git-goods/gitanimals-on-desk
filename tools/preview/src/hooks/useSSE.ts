import { useEffect, useRef, useState } from "react";

export function useSSE(onThemeChanged: () => void) {
  const [connected, setConnected] = useState(false);
  const callbackRef = useRef(onThemeChanged);
  callbackRef.current = onThemeChanged;

  useEffect(() => {
    const es = new EventSource("/api/watch");

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      if (e.data === "connected") return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "theme-changed") {
          setTimeout(() => callbackRef.current(), 300);
        }
      } catch {}
    };

    return () => es.close();
  }, []);

  return connected;
}
