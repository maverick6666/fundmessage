import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { BlockRenderer } from '../components/editor/BlockEditor';
import { reportService } from '../services/reportService';
import { columnService } from '../services/columnService';
import { useAuth } from '../hooks/useAuth';
import {
  formatCurrency,
  formatPercent,
  formatRelativeTime,
  getProfitLossClass
} from '../utils/formatters';

export function Reports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'columns'
  const [reports, setReports] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(null);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    } else {
      fetchColumns();
    }
  }, [activeTab]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await reportService.getReports({ limit: 50 });
      setReports(data.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchColumns = async () => {
    setLoading(true);
    try {
      const data = await columnService.getColumns({ limit: 50 });
      setColumns(data.columns || []);
    } catch (error) {
      console.error('Failed to fetch columns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditColumn = (column) => {
    navigate(`/columns/${column.id}/edit`);
  };

  const handleDeleteColumn = async (columnId) => {
    if (!confirm('정말 이 칼럼을 삭제하시겠습니까?')) return;

    try {
      await columnService.deleteColumn(columnId);
      fetchColumns();
      if (showViewModal && selectedColumn?.id === columnId) {
        setShowViewModal(false);
        setSelectedColumn(null);
      }
    } catch (error) {
      alert(error.response?.data?.detail || '삭제에 실패했습니다.');
    }
  };

  const handleViewColumn = async (column) => {
    try {
      const data = await columnService.getColumn(column.id);
      setSelectedColumn(data);
      setShowViewModal(true);
    } catch (error) {
      console.error('Failed to fetch column:', error);
    }
  };

  const tabs = [
    { id: 'reports', label: '보고서' },
    { id: 'columns', label: '칼럼' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          문서
        </h1>
        {activeTab === 'columns' && (
          <Button onClick={() => navigate('/columns/new')}>
            칼럼 작성
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div>
          {loading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              로딩중...
            </div>
          ) : reports.length === 0 ? (
            <Card>
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>아직 작성된 보고서가 없습니다.</p>
                <p className="text-sm mt-2">포지션 상세에서 AI 운용보고서를 생성하거나 의사결정 노트를 작성하면 여기에 표시됩니다.</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.map((report) => (
                <Link
                  key={report.position_id}
                  to={`/positions/${report.position_id}`}
                  className="block"
                >
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {report.name || report.ticker}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {report.ticker} · {report.market}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        report.status === 'open'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {report.status === 'open' ? '보유중' : '종료'}
                      </span>
                    </div>

                    {report.profit_rate != null && (
                      <div className={`text-lg font-bold mb-2 ${getProfitLossClass(report.profit_rate)}`}>
                        {report.profit_rate >= 0 ? '+' : ''}{formatPercent(report.profit_rate)}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        노트 {report.note_count}개
                      </span>
                      <span className="text-gray-400 dark:text-gray-500">
                        {formatRelativeTime(report.latest_note_at)}
                      </span>
                    </div>

                    {report.opener && (
                      <div className="mt-2 pt-2 border-t dark:border-gray-700">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          담당: {report.opener.full_name}
                        </span>
                      </div>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Columns Tab */}
      {activeTab === 'columns' && (
        <div>
          {loading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              로딩중...
            </div>
          ) : columns.length === 0 ? (
            <Card>
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>아직 작성된 칼럼이 없습니다.</p>
                <p className="text-sm mt-2">팀원 누구나 자유롭게 칼럼을 작성할 수 있습니다.</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {columns.map((column) => (
                <Card key={column.id} className="hover:shadow-md transition-shadow">
                  <div
                    className="cursor-pointer"
                    onClick={() => handleViewColumn(column)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 hover:text-primary-600">
                        {column.title}
                      </h3>
                      <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap ml-4">
                        {formatRelativeTime(column.created_at)}
                      </span>
                    </div>
                    {column.author && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {column.author.full_name}
                      </p>
                    )}
                  </div>

                  {(column.author_id === user?.id || user?.role === 'manager') && (
                    <div className="flex gap-2 mt-3 pt-3 border-t dark:border-gray-700">
                      {column.author_id === user?.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditColumn(column);
                          }}
                          className="text-sm text-primary-600 hover:text-primary-700"
                        >
                          수정
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteColumn(column.id);
                        }}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View Column Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedColumn(null);
        }}
        title={selectedColumn?.title || ''}
      >
        {selectedColumn && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-4 border-b dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selectedColumn.author?.full_name}
              </span>
              <span className="text-sm text-gray-400 dark:text-gray-500">
                {formatRelativeTime(selectedColumn.created_at)}
              </span>
            </div>
            <div className="prose dark:prose-invert max-w-none">
              {/* 블록 형식이면 BlockRenderer 사용, 아니면 레거시 렌더링 */}
              {selectedColumn.blocks && selectedColumn.blocks.length > 0 ? (
                <BlockRenderer blocks={selectedColumn.blocks} />
              ) : selectedColumn.content ? (
                selectedColumn.content.split('\n').map((line, i) => (
                  <p key={i} className="mb-2 text-gray-700 dark:text-gray-300">
                    {line || '\u00A0'}
                  </p>
                ))
              ) : null}
            </div>
            {(selectedColumn.author_id === user?.id || user?.role === 'manager') && (
              <div className="flex gap-3 mt-6 pt-4 border-t dark:border-gray-700">
                {selectedColumn.author_id === user?.id && (
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/columns/${selectedColumn.id}/edit`)}
                  >
                    수정
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={() => handleDeleteColumn(selectedColumn.id)}
                >
                  삭제
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
