import { env } from "@/config/env";

export type WsClient = {
  close: () => void;
};

export function connectWs(options: {
  token: string;
  onMessage: (raw: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
}): WsClient {
  const url = new URL(env.NEXT_PUBLIC_WS_URL);
  url.searchParams.set("token", options.token);

  const ws = new WebSocket(url.toString());

  ws.addEventListener("open", () => options.onOpen?.());
  ws.addEventListener("close", () => options.onClose?.());
  ws.addEventListener("error", () => options.onError?.());
  ws.addEventListener("message", (event) => {
    const raw = typeof event.data === "string" ? event.data : "";
    if (!raw) return;
    options.onMessage(raw);
  });

  return {
    close: () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    },
  };
}
