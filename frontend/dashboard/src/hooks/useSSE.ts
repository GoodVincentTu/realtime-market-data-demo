import { useEffect, useRef } from "react";

/**
 * Subscribe to an SSE endpoint and JSON-parse messages when possible.
 * Uses `unknown` (not `any`) and lets the caller narrow.
 */
export function useSSE<T = unknown>(
  url: string | undefined,
  onMessage: (msg: T) => void
) {
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    if (!url) return;

    const es = new EventSource(url, { withCredentials: false });

    es.onmessage = (evt: MessageEvent<string>) => {
      let payload: unknown = evt.data;
      try {
        payload = JSON.parse(evt.data);
      } catch {
        // keep raw string if it isn't JSON
      }
      handler.current(payload as T);
    };

    es.onerror = () => {
      // browser will auto-reconnect; could expose a status callback if needed
    };

    return () => es.close();
  }, [url]);
}