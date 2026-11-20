import React from 'react';

interface LoadingSkeletonProps {
  count?: number;
  type?: 'card' | 'row' | 'dashboard';
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  count = 3,
  type = 'card',
  className = '',
}) => {
  if (type === 'dashboard') {
    return (
      <div className={`space-y-6 animate-pulse ${className}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-surface-container-high/60" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 rounded-xl bg-surface-container-high/60" />
          <div className="h-80 rounded-xl bg-surface-container-high/60" />
        </div>
      </div>
    );
  }

  if (type === 'row') {
    return (
      <div className={`space-y-3 animate-pulse ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="h-16 w-full rounded-xl bg-surface-container-high/60 border border-outline-variant/30"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-64 rounded-xl bg-surface-container-high/60 border border-outline-variant/30"
        />
      ))}
    </div>
  );
};
