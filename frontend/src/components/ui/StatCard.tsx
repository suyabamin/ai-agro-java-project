import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  badgeText?: string;
  badgePositive?: boolean;
  accentColor?: 'primary' | 'secondary' | 'tertiary' | 'amber' | 'blue' | 'purple' | string;
  className?: string;
}

const ACCENT_STYLES: Record<
  string,
  { iconBg: string; iconText: string; waveBg: string }
> = {
  primary: {
    iconBg: 'bg-emerald-500/15',
    iconText: 'text-emerald-700 dark:text-emerald-300',
    waveBg: 'from-emerald-500/10 via-emerald-400/5 to-transparent',
  },
  secondary: {
    iconBg: 'bg-amber-500/15',
    iconText: 'text-amber-700 dark:text-amber-300',
    waveBg: 'from-amber-500/10 via-amber-400/5 to-transparent',
  },
  tertiary: {
    iconBg: 'bg-violet-500/15',
    iconText: 'text-violet-700 dark:text-violet-300',
    waveBg: 'from-violet-500/10 via-violet-400/5 to-transparent',
  },
  blue: {
    iconBg: 'bg-sky-500/15',
    iconText: 'text-sky-700 dark:text-sky-300',
    waveBg: 'from-sky-500/10 via-sky-400/5 to-transparent',
  },
};

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
  const accent = ACCENT_STYLES[accentColor] || ACCENT_STYLES.primary;

  return (
    <div
      className={`bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 relative overflow-hidden flex flex-col justify-between group hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 ${className}`}
    >
      {/* Subtle Bottom Accent Wash */}
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t ${accent.waveBg} pointer-events-none`}
      />

      <div className="relative flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div
              className={`w-10 h-10 rounded-xl ${accent.iconBg} ${accent.iconText} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}
            >
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </div>
          )}
          <span className="text-xs font-bold text-on-surface-variant leading-snug">
            {title}
          </span>
        </div>

        {badgeText && (
          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
              badgePositive
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
            }`}
          >
            {badgeText}
          </span>
        )}
      </div>

      <div className="relative">
        <div className="text-2xl font-extrabold text-on-surface tracking-tight tabular-nums">
          {value}
        </div>
        {subtitle && (
          <div className="mt-1.5 text-xs text-on-surface-variant flex items-center gap-1">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};
