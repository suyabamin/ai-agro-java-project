import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  badgeText?: string;
  badgePositive?: boolean;
  accentColor?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  badgeText,
  badgePositive = true,
  accentColor = 'primary',
  className = '',
}) => {
  return (
    <div
      className={`bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30 relative overflow-hidden flex flex-col justify-between group hover:shadow-md transition-shadow ${className}`}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 bg-${accentColor}`} />
      
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          {title}
        </span>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-surface-container-low text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
          {value}
        </div>
        {badgeText && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              badgePositive
                ? 'bg-secondary-container text-on-secondary-container'
                : 'bg-error-container text-error'
            }`}
          >
            {badgeText}
          </span>
        )}
      </div>

      {subtitle && (
        <div className="mt-2 text-xs text-on-surface-variant flex items-center gap-1">
          {subtitle}
        </div>
      )}
    </div>
  );
};
