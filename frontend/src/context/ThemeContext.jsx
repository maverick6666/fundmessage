import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

// 13가지 테마 정의
export const THEMES = {
  default: {
    id: 'default',
    name: '기본',
    description: '깔끔한 기본 테마',
    preview: 'bg-gradient-to-r from-indigo-500 to-purple-500',
    isDark: false,
  },
  'dark-premium': {
    id: 'dark-premium',
    name: '다크 프리미엄',
    description: '블룸버그 터미널',
    preview: 'bg-gradient-to-r from-gray-900 to-green-900',
    isDark: true,
  },
  'modern-finance': {
    id: 'modern-finance',
    name: '모던 파이낸스',
    description: '로빈후드 스타일',
    preview: 'bg-gradient-to-r from-emerald-400 to-cyan-400',
    isDark: false,
  },
  'minimal-luxury': {
    id: 'minimal-luxury',
    name: '미니멀 럭셔리',
    description: '프라이빗 뱅킹',
    preview: 'bg-gradient-to-r from-amber-200 to-stone-300',
    isDark: false,
  },
  'tech-enterprise': {
    id: 'tech-enterprise',
    name: '테크 엔터프라이즈',
    description: '스트라이프 스타일',
    preview: 'bg-gradient-to-r from-violet-600 to-indigo-600',
    isDark: true,
  },
  'ocean-depth': {
    id: 'ocean-depth',
    name: '오션 뎁스',
    description: '깊은 바다의 고요함',
    preview: 'bg-gradient-to-r from-slate-800 to-teal-700',
    isDark: true,
  },
  'neon-tokyo': {
    id: 'neon-tokyo',
    name: '네온 토쿄',
    description: '사이버펑크 나이트',
    preview: 'bg-gradient-to-r from-fuchsia-600 to-cyan-500',
    isDark: true,
  },
  'arctic-frost': {
    id: 'arctic-frost',
    name: '아틱 프로스트',
    description: '북유럽 미니멀리즘',
    preview: 'bg-gradient-to-r from-slate-200 to-sky-200',
    isDark: false,
  },
  'sunset-trading': {
    id: 'sunset-trading',
    name: '선셋 트레이딩',
    description: '석양의 에너지',
    preview: 'bg-gradient-to-r from-orange-500 to-rose-500',
    isDark: false,
  },
  'monochrome-pro': {
    id: 'monochrome-pro',
    name: '모노크롬 프로',
    description: '스위스 타이포그래피',
    preview: 'bg-gradient-to-r from-zinc-900 to-zinc-700',
    isDark: true,
  },
  'cherry-blossom': {
    id: 'cherry-blossom',
    name: '체리 블라썸',
    description: '벚꽃 시즌',
    preview: 'bg-gradient-to-r from-pink-300 to-rose-200',
    isDark: false,
  },
  'midnight-blue': {
    id: 'midnight-blue',
    name: '미드나잇 블루',
    description: '클래식 나이트',
    preview: 'bg-gradient-to-r from-blue-950 to-indigo-900',
    isDark: true,
  },
  'forest-green': {
    id: 'forest-green',
    name: '포레스트 그린',
    description: '자연의 평화',
    preview: 'bg-gradient-to-r from-emerald-800 to-green-700',
    isDark: true,
  },
};

export function ThemeProvider({ children }) {
  // 앱 테마 (로그인 후 적용)
  const [appTheme, setAppTheme] = useState(() => {
    return localStorage.getItem('appTheme') || 'default';
  });

  // 기존 다크모드 (로그인/회원가입 페이지용)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  // 현재 테마의 다크 여부
  const isCurrentThemeDark = THEMES[appTheme]?.isDark || false;

  useEffect(() => {
    const root = document.documentElement;

    // 모든 테마 클래스 제거
    Object.keys(THEMES).forEach(themeId => {
      root.classList.remove(`theme-${themeId}`);
    });
    root.classList.remove('dark');

    // 현재 테마 클래스 추가
    root.classList.add(`theme-${appTheme}`);

    // 다크 테마면 dark 클래스도 추가
    if (isCurrentThemeDark) {
      root.classList.add('dark');
    }

    localStorage.setItem('appTheme', appTheme);
  }, [appTheme, isCurrentThemeDark]);

  // 로그인 페이지용 다크모드 토글
  useEffect(() => {
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  const setTheme = (themeId) => {
    if (THEMES[themeId]) {
      setAppTheme(themeId);
    }
  };

  // 기존 toggleTheme 유지 (로그인/회원가입 페이지용)
  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  // theme는 기존 호환성을 위해 유지
  const theme = isDarkMode ? 'dark' : 'light';

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      toggleTheme,
      appTheme,
      setAppTheme: setTheme,
      isDarkMode,
      setIsDarkMode,
      isCurrentThemeDark,
      themes: THEMES,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
