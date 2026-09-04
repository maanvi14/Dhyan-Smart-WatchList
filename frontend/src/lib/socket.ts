import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"]
    });
  }
  return socket;
}

export function subscribeToSymbols(symbols: string[]) {
  const s = getSocket();
  s.emit("subscribe_symbols", symbols);
}
