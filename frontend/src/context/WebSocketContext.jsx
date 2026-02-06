import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { authService } from '../services/authService';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const handlersRef = useRef({});
  const shouldReconnectRef = useRef(true);
  const currentTokenRef = useRef(null);

  const connect = useCallback(() => {
    const token = authService.getToken();
    if (!token) return;

    // 이미 같은 토큰으로 연결되어 있으면 스킵
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentTokenRef.current === token) {
      return;
    }

    // 기존 연결 종료
    if (wsRef.current) {
      shouldReconnectRef.current = false;
      wsRef.current.close();
    }

    shouldReconnectRef.current = true;
    currentTokenRef.current = token;

    const ws = new WebSocket(`${WS_URL}/ws?token=${token}`);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected with new token');
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
      // 의도적 종료가 아닌 경우에만 재연결
      if (shouldReconnectRef.current) {
        setTimeout(connect, 3000);
      }
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
    shouldReconnectRef.current = false;
    currentTokenRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // 토큰 변경 감지 및 재연결
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      shouldReconnectRef.current = true;
      connect();
    }, 100);
  }, [connect, disconnect]);

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

  // 토큰 변경 감지 (로그인/로그아웃 시 재연결)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        console.log('Token changed, reconnecting WebSocket...');
        if (e.newValue) {
          // 새 토큰으로 재연결
          reconnect();
        } else {
          // 로그아웃 시 연결 종료
          disconnect();
        }
      }
    };

    // storage 이벤트는 다른 탭에서 변경될 때만 발생
    // 같은 탭에서의 변경을 감지하기 위해 커스텀 이벤트 사용
    const handleAuthChange = () => {
      const token = authService.getToken();
      if (token && token !== currentTokenRef.current) {
        console.log('Auth changed, reconnecting WebSocket...');
        reconnect();
      } else if (!token && currentTokenRef.current) {
        disconnect();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-change', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, [reconnect, disconnect]);

  return (
    <WebSocketContext.Provider value={{
      isConnected,
      connect,
      disconnect,
      reconnect,
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
