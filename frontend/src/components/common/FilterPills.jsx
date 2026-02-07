/**
 * FilterPills - 필터 필 컴포넌트
 * 상태 필터링에 사용하는 pill 버튼 그룹
 */

export function FilterPills({
  options,
  value,
  onChange,
  showCount = false,
  accentColor = 'primary', // primary | rose | amber | emerald
  size = 'sm', // sm | md
  className = '',
}) {
  const sizeClasses = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-4 py-1.5 text-sm',
  };

  const accentClasses = {
    primary: 'bg-primary-500 text-white',
    rose: 'bg-rose-500 text-white',
    amber: 'bg-amber-500 text-white',
    emerald: 'bg-emerald-500 text-white',
  };

  return (
    <div className={`flex gap-1 flex-wrap ${className}`}>
      {options.map((option) => {
        const isActive = value === option.key;
        const hasCount = showCount && typeof option.count === 'number' && option.count > 0;

        return (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            className={`${sizeClasses[size]} rounded-full font-medium transition-colors flex items-center gap-1.5 ${
              isActive
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {option.label}
            {hasCount && (
              <span
                className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : accentClasses[accentColor]
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
