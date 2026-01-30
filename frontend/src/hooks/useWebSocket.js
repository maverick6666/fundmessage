import { useWebSocket as useWebSocketContext } from '../context/WebSocketContext';

export function useWebSocket() {
  return useWebSocketContext();
}
