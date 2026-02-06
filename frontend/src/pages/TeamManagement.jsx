import { useState, useEffect } from 'react';
import { userService } from '../services/userService';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';

const ROLE_LABELS = {
  manager: '팀장',
  admin: '관리자',
  member: '팀원'
};

const ROLE_COLORS = {
  manager: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  member: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
};

export function TeamManagement() {
  const { adminMode, isManager, logout } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('members'); // 'members', 'pending'
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pendingData, allData] = await Promise.all([
        userService.getPendingUsers(),
        userService.getUsers({ is_active: true })
      ]);
      setPendingUsers(pendingData.users || []);
      setAllUsers(allData.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    setActionLoading(userId);
    try {
      await userService.approveUser(userId);
      await loadData();
      toast.success('사용자가 승인되었습니다.');
    } catch (error) {
      toast.error(error.response?.data?.detail || '승인에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (userId, userName) => {
    if (!confirm(`${userName}님의 계정을 비활성화하시겠습니까?`)) return;

    setActionLoading(userId);
    try {
      await userService.deactivateUser(userId);
      await loadData();
      toast.success('계정이 비활성화되었습니다.');
    } catch (error) {
      toast.error(error.response?.data?.detail || '비활성화에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setActionLoading(userId);
    try {
      await userService.updateUserRole(userId, newRole);
      await loadData();
      toast.success('역할이 변경되었습니다.');
    } catch (error) {
      toast.error(error.response?.data?.detail || '역할 변경에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTransferManager = async (userId, userName) => {
    if (!confirm(`${userName}님에게 팀장 권한을 이전하시겠습니까?\n\n현재 팀장(본인)은 팀원으로 변경됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;

    setActionLoading(userId);
    try {
      await userService.transferManager(userId);
      toast.success(`팀장 권한이 ${userName}님에게 이전되었습니다. 다시 로그인해주세요.`);
      logout();
    } catch (error) {
      toast.error(error.response?.data?.detail || '권한 이전에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`${userName}님의 계정을 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 관련된 알림과 메시지가 모두 삭제됩니다.`)) return;

    setActionLoading(userId);
    try {
      await userService.deleteUser(userId);
      await loadData();
      toast.success('계정이 삭제되었습니다.');
    } catch (error) {
      toast.error(error.response?.data?.detail || '삭제에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">팀 관리</h1>
        {pendingUsers.length > 0 && (
          <span className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-sm font-medium px-2.5 py-0.5 rounded-full">
            승인 대기 {pendingUsers.length}명
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('members')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'members'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            팀원 목록
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            승인 대기
            {pendingUsers.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingUsers.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {allUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              팀원이 없습니다.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">이메일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">사용자명</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">역할</th>
                  {adminMode && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">관리</th>}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {allUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{user.full_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      @{user.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.role === 'manager' ? (
                        <span className={`px-2 py-1 rounded text-xs ${ROLE_COLORS[user.role]}`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={actionLoading === user.id}
                          className="text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded px-2 py-1"
                        >
                          <option value="member">팀원</option>
                          <option value="admin">관리자</option>
                        </select>
                      )}
                    </td>
                    {adminMode && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.role !== 'manager' ? (
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDeactivate(user.id, user.full_name)}
                              loading={actionLoading === user.id}
                            >
                              비활성화
                            </Button>
                            {isManager() && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleTransferManager(user.id, user.full_name)}
                                loading={actionLoading === user.id}
                              >
                                팀장 위임
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => handleDeleteUser(user.id, user.full_name)}
                              loading={actionLoading === user.id}
                            >
                              삭제
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pending Users Tab */}
      {activeTab === 'pending' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {pendingUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              승인 대기 중인 사용자가 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {pendingUsers.map((user) => (
                <li key={user.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{user.full_name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      @{user.username} - 희망 역할:{' '}
                      <span className={`px-2 py-0.5 rounded text-xs ${ROLE_COLORS[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(user.id)}
                      loading={actionLoading === user.id}
                    >
                      승인
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDeactivate(user.id, user.full_name)}
                      loading={actionLoading === user.id}
                    >
                      거부
                    </Button>
                    {adminMode && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteUser(user.id, user.full_name)}
                        loading={actionLoading === user.id}
                      >
                        삭제
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
