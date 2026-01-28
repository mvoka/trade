'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { NavItem } from './nav-item';
import { UserMenu } from './user-menu';
import { Button } from '../button';
import { Separator } from '../separator';

export interface NavItemConfig {
  href: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface DashboardNavProps {
  /** App name/title */
  title: string;
  /** Logo element */
  logo?: React.ReactNode;
  /** Navigation items */
  items: NavItemConfig[];
  /** Current active path */
  activePath?: string;
  /** User info for the menu */
  user?: {
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
  /** Logout handler */
  onLogout?: () => void;
  /** Profile click handler */
  onProfile?: () => void;
  /** Settings click handler */
  onSettings?: () => void;
  /** Additional class names */
  className?: string;
  /** Children for sidebar content */
  children?: React.ReactNode;
}

export function DashboardNav({
  title,
  logo,
  items,
  activePath,
  user,
  onLogout,
  onProfile,
  onSettings,
  className,
  children,
}: DashboardNavProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r bg-card',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 h-16 px-6 border-b">
          {logo}
          <span className="font-semibold text-lg">{title}</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              badge={item.badge}
              isActive={activePath === item.href}
            />
          ))}
        </nav>

        {/* User section */}
        {user && onLogout && (
          <div className="p-4 border-t">
            <div className="flex items-center gap-3">
              <UserMenu
                user={user}
                onLogout={onLogout}
                onProfile={onProfile}
                onSettings={onSettings}
              />
              <div className="flex-1 min-w-0">
                {user.name && (
                  <p className="text-sm font-medium truncate">{user.name}</p>
                )}
                {user.email && (
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b bg-card z-50">
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex items-center gap-2">
            {logo}
            <span className="font-semibold">{title}</span>
          </div>

          <div className="flex items-center gap-2">
            {user && onLogout && (
              <UserMenu
                user={user}
                onLogout={onLogout}
                onProfile={onProfile}
                onSettings={onSettings}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <nav className="lg:hidden fixed top-16 left-0 right-0 bottom-0 bg-card z-40 overflow-y-auto">
            <div className="px-4 py-4 space-y-1">
              {items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  badge={item.badge}
                  isActive={activePath === item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              ))}
            </div>
          </nav>
        </>
      )}

      {/* Main Content Area */}
      <main className="lg:pl-64 pt-16 lg:pt-0 min-h-screen">
        {children}
      </main>
    </>
  );
}
