/**
 * SegmentControl - 세그먼트 컨트롤 컴포넌트
 * iOS 스타일의 세그먼트 선택 UI
 */

export function SegmentControl({
  options,
  value,
  onChange,
  size = 'sm', // sm | md
  className = '',
}) {
  const containerClasses = {
    sm: 'p-0.5 gap-0.5',
    md: 'p-1 gap-1',
  };

  const buttonClasses = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-4 py-1.5 text-sm',
  };

  return (
    <div
      className={`inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg ${containerClasses[size]} ${className}`}
    >
      {options.map((option) => {
        const isActive = value === option.key;

        return (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            className={`${buttonClasses[size]} font-medium rounded-md transition-all ${
              isActive
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
