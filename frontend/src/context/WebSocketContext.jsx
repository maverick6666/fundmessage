import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { authService } from '../services/authService';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const handlersRef = useRef({});

  const connect = useCallback(() => {
    const token = authService.getToken();
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}/ws?token=${token}`);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
      // Reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, data } = message;

        // Call registered handlers
        if (handlersRef.current[type]) {
          handlersRef.current[type].forEach(handler => handler(data));
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    wsRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((type, data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  const subscribe = useCallback((type, handler) => {
    if (!handlersRef.current[type]) {
      handlersRef.current[type] = [];
    }
    handlersRef.current[type].push(handler);

    // Return unsubscribe function
    return () => {
      handlersRef.current[type] = handlersRef.current[type].filter(h => h !== handler);
    };
  }, []);

  // Discussion methods
  const joinDiscussion = useCallback((discussionId) => {
    send('join_discussion', { discussion_id: discussionId });
  }, [send]);

  const leaveDiscussion = useCallback((discussionId) => {
    send('leave_discussion', { discussion_id: discussionId });
  }, [send]);

  const sendMessage = useCallback((discussionId, content, messageType = 'text', chartData = null) => {
    const payload = { discussion_id: discussionId, content };
    if (messageType !== 'text') {
      payload.message_type = messageType;
    }
    if (chartData) {
      payload.chart_data = chartData;
    }
    send('send_message', payload);
  }, [send]);

  // Price subscription methods
  const subscribePrice = useCallback((ticker, market = 'KRX') => {
    send('subscribe_price', { ticker, market });
  }, [send]);

  const unsubscribePrice = useCallback((ticker) => {
    send('unsubscribe_price', { ticker });
  }, [send]);

  return (
    <WebSocketContext.Provider value={{
      isConnected,
      connect,
      disconnect,
      send,
      subscribe,
      joinDiscussion,
      leaveDiscussion,
      sendMessage,
      subscribePrice,
      unsubscribePrice
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
