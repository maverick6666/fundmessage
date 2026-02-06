import { useState } from 'react';

/**
 * 빠른 숫자 입력 버튼이 있는 입력 컴포넌트
 *
 * @param {string} value - 현재 값
 * @param {function} onChange - 값 변경 핸들러
 * @param {string} label - 레이블
 * @param {string} placeholder - 플레이스홀더
 * @param {number[]} quickValues - 빠른 입력 버튼 값들
 * @param {boolean} showUnitButtons - 단위 버튼 표시 여부
 * @param {string} inputClassName - 입력 필드 추가 클래스
 */
export function NumberInputWithQuickButtons({
  value,
  onChange,
  label,
  placeholder = '',
  quickValues = [5, 10, 50, 100, 500, 1000],
  showUnitButtons = true,
  inputClassName = '',
  ...props
}) {
  // 단위 배수 (1, 1000(천), 10000(만))
  const [unitMultiplier, setUnitMultiplier] = useState(1);

  const handleQuickAdd = (num) => {
    const currentValue = parseFloat(value) || 0;
    const newValue = currentValue + (num * unitMultiplier);
    onChange(String(newValue));
  };

  const handleClear = () => {
    onChange('');
    setUnitMultiplier(1);
  };

  const getUnitLabel = () => {
    if (unitMultiplier === 1000) return '천';
    if (unitMultiplier === 10000) return '만';
    return '';
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      <div className="flex gap-2">
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm ${inputClassName}`}
          {...props}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="px-2 py-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="초기화"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 빠른 입력 버튼 */}
      <div className="flex flex-wrap gap-1">
        {quickValues.map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleQuickAdd(num)}
            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            +{num}{getUnitLabel()}
          </button>
        ))}
      </div>

      {/* 단위 버튼 */}
      {showUnitButtons && (
        <div className="flex gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-1 self-center">단위:</span>
          <button
            type="button"
            onClick={() => setUnitMultiplier(1)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              unitMultiplier === 1
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            1
          </button>
          <button
            type="button"
            onClick={() => setUnitMultiplier(1000)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              unitMultiplier === 1000
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            천
          </button>
          <button
            type="button"
            onClick={() => setUnitMultiplier(10000)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              unitMultiplier === 10000
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            만
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 간단한 빠른 버튼 (인라인용)
 * 숫자 선택 후 천/만 클릭하면 곱해서 추가
 * 예: 100 클릭 → 만 클릭 → 1,000,000 추가
 */
export function QuickNumberButtons({
  onAdd,
  quickValues = [1, 5, 10, 50, 100],
  showUnits = true,
  className = ''
}) {
  // 선택된 숫자 (천/만 클릭 대기 중)
  const [selectedNum, setSelectedNum] = useState(null);

  const handleNumberClick = (num) => {
    if (selectedNum === num) {
      // 같은 숫자 다시 클릭 → 그냥 추가하고 선택 해제
      onAdd(num);
      setSelectedNum(null);
    } else if (selectedNum !== null) {
      // 다른 숫자 클릭 → 이전 숫자 추가하고 새 숫자 선택
      onAdd(selectedNum);
      setSelectedNum(num);
    } else {
      // 첫 클릭 → 선택 (천/만 대기)
      setSelectedNum(num);
    }
  };

  const handleUnitClick = (multiplier) => {
    if (selectedNum !== null) {
      // 선택된 숫자 × 단위 추가
      onAdd(selectedNum * multiplier);
      setSelectedNum(null);
    }
  };

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {/* 숫자 버튼들 */}
      {quickValues.map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => handleNumberClick(num)}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            selectedNum === num
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          +{num}
        </button>
      ))}

      {/* 단위 버튼 (천, 만) */}
      {showUnits && (
        <>
          <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
          {[
            { label: '천', value: 1000 },
            { label: '만', value: 10000 },
          ].map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleUnitClick(value)}
              disabled={selectedNum === null}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedNum !== null
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/40'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              {label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
