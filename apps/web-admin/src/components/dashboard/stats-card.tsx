'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  icon?: React.ReactNode;
  description?: string;
  loading?: boolean;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: {
    bg: 'bg-white',
    icon: 'bg-gray-100 text-gray-600',
    change: {
      increase: 'text-green-600',
      decrease: 'text-red-600',
    },
  },
  primary: {
    bg: 'bg-gradient-to-br from-admin-500 to-admin-700',
    icon: 'bg-white/20 text-white',
    change: {
      increase: 'text-green-300',
      decrease: 'text-red-300',
    },
  },
  success: {
    bg: 'bg-gradient-to-br from-green-500 to-green-700',
    icon: 'bg-white/20 text-white',
    change: {
      increase: 'text-green-200',
      decrease: 'text-red-300',
    },
  },
  warning: {
    bg: 'bg-gradient-to-br from-amber-500 to-amber-700',
    icon: 'bg-white/20 text-white',
    change: {
      increase: 'text-green-200',
      decrease: 'text-red-300',
    },
  },
  danger: {
    bg: 'bg-gradient-to-br from-red-500 to-red-700',
    icon: 'bg-white/20 text-white',
    change: {
      increase: 'text-green-200',
      decrease: 'text-red-200',
    },
  },
};

export function StatsCard({
  title,
  value,
  change,
  icon,
  description,
  loading = false,
  variant = 'default',
}: StatsCardProps) {
  const styles = variantStyles[variant];
  const isColored = variant !== 'default';

  if (loading) {
    return (
      <div className={clsx('rounded-xl p-6 shadow-sm', styles.bg)}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('rounded-xl p-6 shadow-sm', styles.bg)}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p
            className={clsx(
              'text-sm font-medium',
              isColored ? 'text-white/80' : 'text-gray-500'
            )}
          >
            {title}
          </p>
          <p
            className={clsx(
              'mt-2 text-3xl font-bold tracking-tight',
              isColored ? 'text-white' : 'text-gray-900'
            )}
          >
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={clsx(
              'flex h-12 w-12 items-center justify-center rounded-lg',
              styles.icon
            )}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        {change && (
          <div className="flex items-center text-sm">
            {change.type === 'increase' ? (
              <svg
                className={clsx('h-4 w-4', styles.change.increase)}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
                />
              </svg>
            ) : (
              <svg
                className={clsx('h-4 w-4', styles.change.decrease)}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181"
                />
              </svg>
            )}
            <span
              className={clsx(
                'ml-1 font-medium',
                change.type === 'increase' ? styles.change.increase : styles.change.decrease
              )}
            >
              {change.value}%
            </span>
            <span className={clsx('ml-1', isColored ? 'text-white/60' : 'text-gray-500')}>
              vs last period
            </span>
          </div>
        )}

        {description && (
          <p className={clsx('text-sm', isColored ? 'text-white/60' : 'text-gray-500')}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export default StatsCard;
