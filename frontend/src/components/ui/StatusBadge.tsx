import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'primary';

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  className = '',
}) => {
  const normalized = status.toUpperCase();

  let autoVariant: BadgeVariant = 'neutral';
  if (['ACTIVE', 'COMPLETED', 'APPROVED', 'SHORTLISTED', 'PUBLISHED', 'ONLINE', 'OPTIMAL', 'VALID', 'SUCCESS'].includes(normalized)) {
    autoVariant = 'success';
  } else if (['PENDING', 'PROCESSING', 'IN_REVIEW', 'PAUSED', 'WARNING', 'OUT_OF_RANGE'].includes(normalized)) {
    autoVariant = 'warning';
  } else if (['REJECTED', 'CLOSED', 'ARCHIVED', 'REVERSED', 'SUSPENDED', 'FAILED', 'ERROR', 'MODEL_UNAVAILABLE'].includes(normalized)) {
    autoVariant = 'danger';
  } else if (['RECORDED', 'SUBMITTED', 'DRAFT', 'LOW'].includes(normalized)) {
    autoVariant = 'info';
  }

  const finalVariant = variant || autoVariant;

  const variantClasses: Record<BadgeVariant, string> = {
    success: 'bg-primary-fixed/40 text-primary border-primary/20',
    warning: 'bg-amber-100 text-amber-900 border-amber-300',
    danger: 'bg-error-container text-error border-error/20',
    info: 'bg-secondary-container text-on-secondary-container border-secondary/20',
    neutral: 'bg-surface-container-high text-on-surface-variant border-outline-variant/50',
    primary: 'bg-primary text-on-primary border-primary',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border uppercase ${variantClasses[finalVariant]} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {status.replace(/_/g, ' ')}
    </span>
  );
};
