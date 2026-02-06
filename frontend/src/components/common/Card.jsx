export function Card({ children, className = '', ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }) {
  return (
    <div
      className={`pb-3 mb-4 ${className}`}
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3
      className={`text-lg font-semibold ${className}`}
      style={{ color: 'var(--color-text-primary)' }}
    >
      {children}
    </h3>
  );
}
