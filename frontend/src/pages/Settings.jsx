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

        {/* 컴팩트 테마 선택 그리드 */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
          {Object.values(THEMES).map((theme) => (
            <ThemeChip
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

function ThemeChip({ theme, isSelected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`
        relative group flex flex-col items-center p-2 rounded-lg border-2 transition-all duration-200
        ${isSelected
          ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] ring-opacity-30 scale-105'
          : 'border-transparent hover:border-[var(--color-border)] hover:scale-102'
        }
      `}
      style={{
        backgroundColor: isSelected ? 'var(--color-bg-tertiary)' : 'transparent',
      }}
      title={theme.description}
    >
      {/* 테마 프리뷰 색상 칩 */}
      <div
        className={`w-full aspect-[2/1] rounded-md ${theme.preview} transition-transform group-hover:scale-105`}
        style={{ minHeight: '28px' }}
      />

      {/* 테마명 */}
      <span
        className={`mt-1.5 text-xs font-medium truncate w-full text-center transition-colors ${
          isSelected ? '' : 'opacity-70 group-hover:opacity-100'
        }`}
        style={{ color: 'var(--color-text-primary)' }}
      >
        {theme.name}
      </span>

      {/* 다크 모드 인디케이터 */}
      {theme.isDark && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-gray-800 rounded-full flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        </span>
      )}

      {/* 선택 체크마크 */}
      {isSelected && (
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
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
