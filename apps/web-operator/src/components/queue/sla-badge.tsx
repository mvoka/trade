'use client';

interface SlaBadgeProps {
  percentage: number;
  deadline?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function SlaBadge({ percentage, deadline, showLabel = true, size = 'md' }: SlaBadgeProps) {
  const getColor = () => {
    if (percentage >= 100) return 'red';
    if (percentage >= 80) return 'red';
    if (percentage >= 50) return 'yellow';
    return 'green';
  };

  const color = getColor();

  const colorClasses = {
    green: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      ring: 'ring-green-500',
      bar: 'bg-green-500',
    },
    yellow: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      ring: 'ring-yellow-500',
      bar: 'bg-yellow-500',
    },
    red: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      ring: 'ring-red-500',
      bar: 'bg-red-500',
    },
  };

  const sizeClasses = {
    sm: {
      wrapper: 'px-1.5 py-0.5 text-xs',
      bar: 'h-1',
      width: 'w-12',
    },
    md: {
      wrapper: 'px-2 py-1 text-sm',
      bar: 'h-1.5',
      width: 'w-16',
    },
    lg: {
      wrapper: 'px-3 py-1.5 text-base',
      bar: 'h-2',
      width: 'w-20',
    },
  };

  const colors = colorClasses[color];
  const sizes = sizeClasses[size];

  const formatTimeRemaining = () => {
    if (!deadline) return null;

    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate.getTime() - now.getTime();

    if (diff <= 0) return 'Overdue';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  };

  const timeRemaining = formatTimeRemaining();

  return (
    <div className="flex flex-col items-start space-y-1">
      <div
        className={`inline-flex items-center space-x-2 rounded-full font-medium ${colors.bg} ${colors.text} ${sizes.wrapper}`}
      >
        {/* Progress bar */}
        <div className={`${sizes.width} bg-gray-200 rounded-full overflow-hidden ${sizes.bar}`}>
          <div
            className={`h-full ${colors.bar} transition-all duration-300`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>

        {/* Percentage */}
        <span className="font-semibold">{Math.round(percentage)}%</span>

        {/* Breached indicator */}
        {percentage >= 100 && (
          <span className="animate-pulse">!</span>
        )}
      </div>

      {/* Time remaining label */}
      {showLabel && timeRemaining && (
        <span className={`text-xs ${percentage >= 100 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
          {timeRemaining}
        </span>
      )}
    </div>
  );
}

// Compact version for tables
export function SlaBadgeCompact({ percentage }: { percentage: number }) {
  const getColor = () => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-red-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="w-12 bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <span
        className={`text-xs font-medium ${
          percentage >= 80 ? 'text-red-600' : percentage >= 50 ? 'text-yellow-600' : 'text-green-600'
        }`}
      >
        {Math.round(percentage)}%
      </span>
    </div>
  );
}

// SLA status dot
export function SlaStatusDot({ percentage }: { percentage: number }) {
  const getColor = () => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-red-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${getColor()} ${
        percentage >= 80 ? 'animate-pulse' : ''
      }`}
    />
  );
}
