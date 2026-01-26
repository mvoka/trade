'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAlertsStore, getAlertColor, getAlertPriority } from '@/lib/stores/alerts-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatDistanceToNow } from '@/lib/utils';

export function OperatorHeader() {
  const { user } = useAuthStore();
  const { alerts, unreadCount, dismissAlert, dismissAllAlerts } = useAlertsStore();
  const [showAlerts, setShowAlerts] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const alertsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Sort alerts by priority and time
  const sortedAlerts = [...alerts]
    .sort((a, b) => {
      const priorityDiff = getAlertPriority(a.type) - getAlertPriority(b.type);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 20);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setShowAlerts(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">OP</span>
          </div>
          <span className="text-lg font-semibold text-gray-900">Operator Console</span>
        </Link>

        <div className="hidden md:flex items-center space-x-1 ml-8">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
            Live
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Alerts Bell */}
        <div className="relative" ref={alertsRef}>
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showAlerts && (
            <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Alerts</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={dismissAllAlerts}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    Dismiss all
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {sortedAlerts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No alerts</div>
                ) : (
                  sortedAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 border-b border-gray-100 last:border-0 ${
                        alert.dismissed ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${getAlertColor(
                              alert.type
                            )}`}
                          >
                            {alert.type.replace('_', ' ')}
                          </span>
                          <p className="mt-1 text-sm text-gray-700">{alert.message}</p>
                          <div className="mt-1 flex items-center space-x-2">
                            <Link
                              href={`/jobs/${alert.jobId}`}
                              className="text-xs text-primary-600 hover:underline"
                              onClick={() => setShowAlerts(false)}
                            >
                              View job
                            </Link>
                            <span className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(alert.createdAt))}
                            </span>
                          </div>
                        </div>
                        {!alert.dismissed && (
                          <button
                            onClick={() => dismissAlert(alert.id)}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-700 font-medium text-sm">
                {user?.name?.charAt(0).toUpperCase() || 'O'}
              </span>
            </div>
            <span className="hidden md:block text-sm font-medium text-gray-700">
              {user?.name || 'Operator'}
            </span>
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="p-3 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded">
                  {user?.role}
                </span>
              </div>
              <div className="py-1">
                <Link
                  href="/settings"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowUserMenu(false)}
                >
                  Settings
                </Link>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    useAuthStore.getState().logout();
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
