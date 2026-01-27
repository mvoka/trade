'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  userId: string;
  userName: string;
  userRole: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

const actionColors: Record<string, { bg: string; text: string }> = {
  CREATE: { bg: 'bg-green-100', text: 'text-green-800' },
  UPDATE: { bg: 'bg-blue-100', text: 'text-blue-800' },
  DELETE: { bg: 'bg-red-100', text: 'text-red-800' },
  LOGIN: { bg: 'bg-purple-100', text: 'text-purple-800' },
  LOGOUT: { bg: 'bg-gray-100', text: 'text-gray-800' },
  APPROVE: { bg: 'bg-green-100', text: 'text-green-800' },
  REJECT: { bg: 'bg-red-100', text: 'text-red-800' },
  DISPATCH: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  ACCEPT: { bg: 'bg-green-100', text: 'text-green-800' },
  DECLINE: { bg: 'bg-orange-100', text: 'text-orange-800' },
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    resource: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '30' };
      if (filters.action) params.action = filters.action;
      if (filters.resource) params.resource = filters.resource;
      if (filters.userId) params.userId = filters.userId;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const response = await adminApi.getAuditLogs(params);
      const data = response.data;
      setLogs(data.data || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    return actionColors[action.toUpperCase()] || { bg: 'bg-gray-100', text: 'text-gray-800' };
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track all system actions and changes.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select
              value={filters.action}
              onChange={(e) => {
                setFilters({ ...filters, action: e.target.value });
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
            >
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="APPROVE">Approve</option>
              <option value="REJECT">Reject</option>
              <option value="DISPATCH">Dispatch</option>
              <option value="ACCEPT">Accept</option>
              <option value="DECLINE">Decline</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Resource</label>
            <select
              value={filters.resource}
              onChange={(e) => {
                setFilters({ ...filters, resource: e.target.value });
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
            >
              <option value="">All Resources</option>
              <option value="USER">User</option>
              <option value="JOB">Job</option>
              <option value="DISPATCH">Dispatch</option>
              <option value="BOOKING">Booking</option>
              <option value="VERIFICATION">Verification</option>
              <option value="FEATURE_FLAG">Feature Flag</option>
              <option value="POLICY">Policy</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => {
                setFilters({ ...filters, dateFrom: e.target.value });
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => {
                setFilters({ ...filters, dateTo: e.target.value });
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">User ID</label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              onBlur={() => setPage(1)}
              placeholder="Search user..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-500"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No audit logs found matching your filters.
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {logs.map((log) => {
                const colors = getActionColor(log.action);
                const isExpanded = expandedLog === log.id;

                return (
                  <div key={log.id}>
                    <div
                      className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}>
                            {log.action}
                          </span>
                          <span className="text-sm text-gray-500">{log.resource}</span>
                          <span className="text-sm font-medium text-gray-900">{log.resourceId.slice(0, 8)}...</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">{log.userName}</p>
                            <p className="text-xs text-gray-500">{log.userRole}</p>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500 mb-1">IP Address</p>
                            <p className="font-mono text-gray-900">{log.ipAddress || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">User Agent</p>
                            <p className="text-gray-900 truncate">{log.userAgent || 'N/A'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-gray-500 mb-1">Details</p>
                            <pre className="bg-gray-800 text-green-400 p-3 rounded-lg text-xs overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
