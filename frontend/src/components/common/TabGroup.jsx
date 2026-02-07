/**
 * TabGroup - 탭 그룹 컴포넌트
 * 페이지 내 주요 뷰 전환에 사용
 */

export function TabGroup({
  tabs,
  activeTab,
  onChange,
  variant = 'primary', // primary | subtle
  size = 'md', // sm | md
  className = '',
}) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };

  const variantClasses = {
    primary: {
      active: 'bg-primary-600 text-white',
      inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
    },
    subtle: {
      active: 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-black/5 dark:ring-white/10',
      inactive: 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
    },
  };

  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const styles = variantClasses[variant];

        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`${sizeClasses[size]} rounded-lg font-medium transition-colors flex items-center gap-2 ${
              isActive ? styles.active : styles.inactive
            }`}
          >
            {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
            {tab.label}
            {typeof tab.count === 'number' && tab.count > 0 && (
              <span
                className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
