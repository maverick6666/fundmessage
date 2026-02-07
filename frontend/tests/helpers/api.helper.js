/**
 * API 헬퍼 - 백엔드 API 직접 호출
 *
 * 테스트에서 데이터 생성/조회/삭제를 빠르게 수행
 */

const API_URL = process.env.TEST_API_URL || 'http://localhost:8000/api/v1';

/**
 * API 요청 래퍼
 */
async function apiRequest(endpoint, options = {}) {
  const { method = 'GET', token, body } = options;

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * 로그인하여 토큰 획득
 */
export async function login(email, password) {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return data.data.access_token;
}

/**
 * 포지션 관련 API
 */
export const positions = {
  async list(token) {
    return apiRequest('/positions', { token });
  },

  async get(token, positionId) {
    return apiRequest(`/positions/${positionId}`, { token });
  },

  async create(token, data) {
    return apiRequest('/positions', {
      method: 'POST',
      token,
      body: data,
    });
  },

  async delete(token, positionId) {
    return apiRequest(`/positions/${positionId}`, {
      method: 'DELETE',
      token,
    });
  },
};

/**
 * 요청 관련 API
 */
export const requests = {
  async list(token) {
    return apiRequest('/requests', { token });
  },

  async createBuy(token, data) {
    return apiRequest('/requests/buy', {
      method: 'POST',
      token,
      body: data,
    });
  },

  async createSell(token, data) {
    return apiRequest('/requests/sell', {
      method: 'POST',
      token,
      body: data,
    });
  },

  async approve(token, requestId, data = {}) {
    return apiRequest(`/requests/${requestId}/approve`, {
      method: 'POST',
      token,
      body: data,
    });
  },

  async reject(token, requestId, reason) {
    return apiRequest(`/requests/${requestId}/reject`, {
      method: 'POST',
      token,
      body: { rejection_reason: reason },
    });
  },
};

/**
 * 통계 관련 API
 */
export const stats = {
  async getOverview(token) {
    return apiRequest('/stats/overview', { token });
  },

  async getTeamRanking(token) {
    return apiRequest('/stats/team-ranking', { token });
  },

  async getAssetHistory(token) {
    return apiRequest('/stats/asset-history', { token });
  },
};

/**
 * 알림 관련 API
 */
export const notifications = {
  async list(token) {
    return apiRequest('/notifications', { token });
  },

  async markRead(token, notificationId) {
    return apiRequest(`/notifications/${notificationId}/read`, {
      method: 'POST',
      token,
    });
  },

  async getUnreadCount(token) {
    const data = await apiRequest('/notifications/unread-count', { token });
    return data.data.count;
  },
};

/**
 * 사용자 관련 API
 */
export const users = {
  async me(token) {
    return apiRequest('/users/me', { token });
  },

  async list(token) {
    return apiRequest('/users', { token });
  },
};
