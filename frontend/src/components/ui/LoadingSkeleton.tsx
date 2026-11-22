import React from 'react';

interface LoadingSkeletonProps {
  count?: number;
  type?: 'card' | 'row' | 'dashboard' | 'table';
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  count = 3,
  type = 'card',
  className = '',
}) => {
  if (type === 'dashboard') {
    return (
      <div className={`space-y-6 animate-pulse ${className}`} role="status" aria-label="Loading dashboard data">
        {/* Metric Cards Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-surface-container border border-outline-variant/40 p-4 flex flex-col justify-between shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 bg-outline-variant/40 rounded" />
                <div className="h-8 w-8 bg-outline-variant/30 rounded-xl" />
              </div>
              <div className="h-7 w-20 bg-outline-variant/50 rounded" />
              <div className="h-2.5 w-32 bg-outline-variant/30 rounded" />
            </div>
          ))}
        </div>

        {/* Content Section Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-88 rounded-2xl bg-surface-container border border-outline-variant/40 p-6 shadow-sm space-y-4">
            <div className="h-5 w-48 bg-outline-variant/50 rounded" />
            <div className="h-3.5 w-72 bg-outline-variant/30 rounded" />
            <div className="space-y-3 pt-4">
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="h-12 w-full bg-surface-container-low rounded-xl border border-outline-variant/30" />
              ))}
            </div>
          </div>
          <div className="h-88 rounded-2xl bg-surface-container border border-outline-variant/40 p-6 shadow-sm space-y-4">
            <div className="h-5 w-36 bg-outline-variant/50 rounded" />
            <div className="h-3.5 w-48 bg-outline-variant/30 rounded" />
            <div className="h-48 w-full bg-surface-container-low rounded-xl border border-outline-variant/30 mt-6" />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'row' || type === 'table') {
    return (
      <div className={`space-y-3 animate-pulse ${className}`} role="status" aria-label="Loading data records">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="h-16 w-full rounded-2xl bg-surface-container border border-outline-variant/40 px-6 py-3 flex items-center justify-between shadow-sm"
          >
            <div className="space-y-2">
              <div className="h-4 w-40 bg-outline-variant/50 rounded" />
              <div className="h-3 w-64 bg-outline-variant/30 rounded" />
            </div>
            <div className="h-8 w-24 bg-outline-variant/40 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse ${className}`} role="status" aria-label="Loading cards">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-64 rounded-2xl bg-surface-container border border-outline-variant/40 p-6 flex flex-col justify-between shadow-sm"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 bg-outline-variant/50 rounded" />
              <div className="h-6 w-16 bg-outline-variant/30 rounded-full" />
            </div>
            <div className="h-5 w-44 bg-outline-variant/60 rounded" />
            <div className="h-3.5 w-full bg-outline-variant/30 rounded" />
            <div className="h-3.5 w-3/4 bg-outline-variant/30 rounded" />
          </div>
          <div className="h-9 w-full bg-outline-variant/40 rounded-xl mt-4" />
        </div>
      ))}
    </div>
  );
};
