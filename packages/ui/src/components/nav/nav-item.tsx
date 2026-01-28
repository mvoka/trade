'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

export interface NavItemProps {
  href: string;
  label: string;
  icon?: React.ReactNode;
  isActive?: boolean;
  badge?: string | number;
  onClick?: () => void;
}

export function NavItem({
  href,
  label,
  icon,
  isActive,
  badge,
  onClick,
}: NavItemProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {icon && <span className="w-5 h-5">{icon}</span>}
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span
          className={cn(
            'px-2 py-0.5 text-xs rounded-full',
            isActive
              ? 'bg-primary-foreground/20 text-primary-foreground'
              : 'bg-muted-foreground/20 text-muted-foreground'
          )}
        >
          {badge}
        </span>
      )}
    </a>
  );
}
