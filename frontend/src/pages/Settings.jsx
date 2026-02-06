import { useState } from 'react';
import { useTheme, THEMES } from '../context/ThemeContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';

export function Settings() {
  const { appTheme, setAppTheme, themes } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState(appTheme);

  const handleThemeChange = (themeId) => {
    setSelectedTheme(themeId);
    setAppTheme(themeId);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          설정
        </h1>
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          앱의 모양과 동작을 사용자 지정하세요
        </p>
      </div>

      {/* 테마 설정 섹션 */}
      <section>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          테마
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          원하는 앱 테마를 선택하세요. 테마는 앱 전체에 즉시 적용됩니다.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(THEMES).map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isSelected={selectedTheme === theme.id}
              onSelect={() => handleThemeChange(theme.id)}
            />
          ))}
        </div>
      </section>

      {/* 현재 테마 미리보기 */}
      <section>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          현재 테마 미리보기
        </h2>
        <Card>
          <ThemePreview theme={THEMES[selectedTheme]} />
        </Card>
      </section>
    </div>
  );
}

function ThemeCard({ theme, isSelected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`
        relative text-left p-4 rounded-xl border-2 transition-all duration-200
        ${isSelected
          ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] ring-opacity-30'
          : 'border-[var(--color-border)] hover:border-[var(--color-accent)] hover:border-opacity-50'
        }
      `}
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
      }}
    >
      {/* 선택 표시 */}
      {isSelected && (
        <div
          className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* 테마 프리뷰 */}
      <div className={`h-20 rounded-lg mb-3 ${theme.preview}`} />

      {/* 테마 정보 */}
      <div>
        <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {theme.name}
        </h3>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {theme.description}
        </p>
        {theme.isDark && (
          <span className="inline-flex items-center gap-1 mt-2 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            다크 모드
          </span>
        )}
      </div>
    </button>
  );
}

function ThemePreview({ theme }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {theme.name} 테마
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {theme.description}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-lg ${theme.preview}`} />
      </div>

      {/* 버튼 미리보기 */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          버튼
        </p>
        <div className="flex flex-wrap gap-2">
          <Button>기본 버튼</Button>
          <Button variant="secondary">보조 버튼</Button>
          <Button variant="danger">위험 버튼</Button>
          <Button variant="success">성공 버튼</Button>
        </div>
      </div>

      {/* 뱃지 미리보기 */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          뱃지
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="badge badge-pending">대기중</span>
          <span className="badge badge-approved">승인</span>
          <span className="badge badge-rejected">거부</span>
          <span className="badge badge-discussion">토론중</span>
          <span className="badge badge-open">오픈</span>
          <span className="badge badge-closed">종료</span>
        </div>
      </div>

      {/* 카드 미리보기 */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          카드
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="card">
            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              수익률
            </div>
            <div className="text-xl font-bold text-green-500">
              +12.5%
            </div>
          </div>
          <div className="card">
            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              손실률
            </div>
            <div className="text-xl font-bold text-red-500">
              -3.2%
            </div>
          </div>
        </div>
      </div>

      {/* 입력 필드 미리보기 */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          입력 필드
        </p>
        <input
          type="text"
          className="input"
          placeholder="텍스트를 입력하세요..."
          readOnly
        />
      </div>

      {/* 텍스트 미리보기 */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          텍스트 스타일
        </p>
        <div className="space-y-1">
          <p style={{ color: 'var(--color-text-primary)' }}>주요 텍스트 (Primary)</p>
          <p style={{ color: 'var(--color-text-secondary)' }}>보조 텍스트 (Secondary)</p>
          <p style={{ color: 'var(--color-text-muted)' }}>흐린 텍스트 (Muted)</p>
        </div>
      </div>
    </div>
  );
}
