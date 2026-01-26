'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { clsx } from 'clsx';

// Color palette for charts
const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

interface ChartContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function ChartContainer({
  title,
  description,
  children,
  className,
  actions,
}: ChartContainerProps) {
  return (
    <div className={clsx('bg-white rounded-xl shadow-sm p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

// Jobs Over Time Chart
interface JobsChartData {
  date: string;
  dispatched: number;
  completed: number;
  cancelled: number;
}

interface JobsOverTimeChartProps {
  data: JobsChartData[];
  loading?: boolean;
}

export function JobsOverTimeChart({ data, loading }: JobsOverTimeChartProps) {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
        <span className="text-gray-400">Loading chart...</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="dispatched"
          stackId="1"
          stroke="#8b5cf6"
          fill="#8b5cf6"
          fillOpacity={0.6}
          name="Dispatched"
        />
        <Area
          type="monotone"
          dataKey="completed"
          stackId="2"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.6}
          name="Completed"
        />
        <Area
          type="monotone"
          dataKey="cancelled"
          stackId="3"
          stroke="#ef4444"
          fill="#ef4444"
          fillOpacity={0.6}
          name="Cancelled"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Pro Stats Chart
interface ProStatsData {
  name: string;
  value: number;
}

interface ProStatsChartProps {
  data: ProStatsData[];
  loading?: boolean;
}

export function ProStatsChart({ data, loading }: ProStatsChartProps) {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
        <span className="text-gray-400">Loading chart...</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={5}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Revenue Chart
interface RevenueData {
  month: string;
  revenue: number;
  transactions: number;
}

interface RevenueChartProps {
  data: RevenueData[];
  loading?: boolean;
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
        <span className="text-gray-400">Loading chart...</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
          tickFormatter={(value) => `$${value / 1000}k`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
          formatter={(value: number, name: string) => {
            if (name === 'revenue') return [`$${value.toLocaleString()}`, 'Revenue'];
            return [value, 'Transactions'];
          }}
        />
        <Legend />
        <Bar
          yAxisId="left"
          dataKey="revenue"
          fill="#8b5cf6"
          radius={[4, 4, 0, 0]}
          name="Revenue"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="transactions"
          stroke="#06b6d4"
          strokeWidth={2}
          name="Transactions"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Category Distribution Chart
interface CategoryData {
  category: string;
  jobs: number;
  pros: number;
}

interface CategoryChartProps {
  data: CategoryData[];
  loading?: boolean;
}

export function CategoryChart({ data, loading }: CategoryChartProps) {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
        <span className="text-gray-400">Loading chart...</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <YAxis dataKey="category" type="category" tick={{ fontSize: 12 }} stroke="#9ca3af" width={100} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
        />
        <Legend />
        <Bar dataKey="jobs" fill="#8b5cf6" name="Jobs" radius={[0, 4, 4, 0]} />
        <Bar dataKey="pros" fill="#06b6d4" name="Pros" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// SLA Performance Chart
interface SlaData {
  hour: string;
  acceptRate: number;
  responseTime: number;
}

interface SlaPerformanceChartProps {
  data: SlaData[];
  loading?: boolean;
}

export function SlaPerformanceChart({ data, loading }: SlaPerformanceChartProps) {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse">
        <span className="text-gray-400">Loading chart...</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="#9ca3af" />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
          tickFormatter={(value) => `${value}%`}
          domain={[0, 100]}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
          tickFormatter={(value) => `${value}m`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
          formatter={(value: number, name: string) => {
            if (name === 'Accept Rate') return [`${value}%`, name];
            return [`${value} min`, name];
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="acceptRate"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          name="Accept Rate"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="responseTime"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          name="Response Time"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default {
  ChartContainer,
  JobsOverTimeChart,
  ProStatsChart,
  RevenueChart,
  CategoryChart,
  SlaPerformanceChart,
};
