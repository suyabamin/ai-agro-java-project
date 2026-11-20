import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`bg-surface-container-lowest rounded-xl p-8 sm:p-12 text-center flex flex-col items-center justify-center border border-dashed border-outline-variant/60 shadow-sm ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-surface-container-low text-primary flex items-center justify-center mb-4 shadow-inner">
        <span className="material-symbols-outlined text-[32px]">{icon}</span>
      </div>
      <h3 className="text-lg font-bold text-on-surface mb-1 tracking-tight">
        {title}
      </h3>
      <p className="text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">
        {description}
      </p>
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="h-10 px-5 rounded-lg bg-primary hover:bg-secondary text-on-primary font-semibold text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>{actionText}</span>
        </button>
      )}
    </div>
  );
};
