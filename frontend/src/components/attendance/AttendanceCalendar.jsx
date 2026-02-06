import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '../common/Card';
import { attendanceService } from '../../services/attendanceService';

export function AttendanceCalendar({ userId = null }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendances, setAttendances] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    fetchData();
  }, [year, month, userId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [attendanceData, statsData] = await Promise.all([
        userId
          ? attendanceService.getUserAttendance(userId, year, month)
          : attendanceService.getMyAttendance(year, month),
        !userId ? attendanceService.getMyStats() : null
      ]);

      setAttendances(attendanceData.attendances || []);
      if (statsData) {
        setStats(statsData);
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      await attendanceService.checkIn();
      fetchData();
    } catch (error) {
      console.error('Check-in failed:', error);
    }
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  // 해당 월의 날짜 배열 생성
  const getDaysInMonth = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];

    // 이전 달 빈 칸
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // 현재 달 날짜들
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const getAttendanceForDay = (day) => {
    if (!day) return null;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return attendances.find(a => a.date === dateStr);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return 'bg-green-500';
      case 'recovered':
        return 'bg-yellow-500';
      case 'absent':
        return 'bg-red-500';
      case 'pending_recovery':
        return 'bg-orange-400';
      default:
        return 'bg-gray-300 dark:bg-gray-600';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'present':
        return '출석';
      case 'recovered':
        return '복구됨';
      case 'absent':
        return '결석';
      case 'pending_recovery':
        return '복구 대기';
      default:
        return '';
    }
  };

  const days = getDaysInMonth();
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDate = today.getDate();

  // 오늘 출석 여부
  const todayAttendance = isCurrentMonth ? getAttendanceForDay(todayDate) : null;

  return (
    <div className="space-y-4">
      {/* 출석 통계 */}
      {stats && !userId && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-primary-600">{stats.streak}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">연속 출석</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">{stats.week_rate.toFixed(0)}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">이번 주</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.month_rate.toFixed(0)}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">이번 달</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-300">{stats.total_rate.toFixed(0)}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">전체</div>
          </div>
        </div>
      )}

      {/* 출석 체크 버튼 */}
      {!userId && isCurrentMonth && (
        <div className="flex justify-center">
          <button
            onClick={handleCheckIn}
            disabled={todayAttendance?.status === 'present'}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              todayAttendance?.status === 'present'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {todayAttendance?.status === 'present' ? '✓ 오늘 출석 완료!' : '출석 체크하기'}
          </button>
        </div>
      )}

      {/* 캘린더 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <CardTitle>{year}년 {month}월</CardTitle>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </CardHeader>

        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">로딩중...</div>
        ) : (
          <div>
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day, i) => (
                <div
                  key={day}
                  className={`text-center text-sm font-medium py-2 ${
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                const attendance = getAttendanceForDay(day);
                const isToday = isCurrentMonth && day === todayDate;

                return (
                  <div
                    key={i}
                    className={`aspect-square p-1 relative ${!day ? '' : 'cursor-default'}`}
                  >
                    {day && (
                      <div
                        className={`w-full h-full flex items-center justify-center rounded-lg text-sm relative ${
                          isToday
                            ? 'ring-2 ring-primary-500 font-bold'
                            : ''
                        }`}
                        title={attendance ? getStatusLabel(attendance.status) : ''}
                      >
                        <span className={`${
                          i % 7 === 0 ? 'text-red-500' : i % 7 === 6 ? 'text-blue-500' : ''
                        }`}>
                          {day}
                        </span>
                        {attendance && (
                          <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${getStatusColor(attendance.status)}`} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 범례 */}
            <div className="flex justify-center gap-4 mt-4 pt-4 border-t dark:border-gray-700">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>출석</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>복구됨</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>결석</span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
