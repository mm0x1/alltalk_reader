import React from 'react';

interface ProgressBarIndicatorProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  className?: string;
  height?: string;
  colorClass?: string;
}

export default function ProgressBarIndicator({
  progress,
  label,
  showPercentage = true,
  className = '',
  height = 'h-4',
  colorClass = 'bg-blue-500'
}: ProgressBarIndicatorProps) {
  // Ensure progress is between 0 and 100
  const validProgress = Math.max(0, Math.min(100, progress));
  
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium">{label}</span>
          {showPercentage && (
            <span className="text-sm font-medium">{Math.round(validProgress)}%</span>
          )}
        </div>
      )}
      
      <div className={`w-full ${height} bg-gray-200 rounded-full overflow-hidden`}>
        <div 
          className={`${height} ${colorClass} transition-all duration-300 ease-in-out`}
          style={{ width: `${validProgress}%` }}
          role="progressbar"
          aria-valuenow={validProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {!label && showPercentage && validProgress > 10 && (
            <div className="h-full flex items-center justify-center text-xs font-medium text-white">
              {Math.round(validProgress)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
