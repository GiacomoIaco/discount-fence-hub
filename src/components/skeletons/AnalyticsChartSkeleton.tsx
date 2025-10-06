import Skeleton from './Skeleton';

export default function AnalyticsChartSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="mb-4">
        <Skeleton width="40%" height={24} className="mb-2" />
        <Skeleton width="60%" height={16} />
      </div>

      {/* Chart bars simulation */}
      <div className="flex items-end justify-between h-48 gap-2">
        {[60, 85, 45, 90, 70, 55, 75].map((height, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            className="flex-1"
            height={`${height}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <div className="flex items-center gap-2">
          <Skeleton variant="rectangular" width={16} height={16} />
          <Skeleton width={80} height={14} />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton variant="rectangular" width={16} height={16} />
          <Skeleton width={80} height={14} />
        </div>
      </div>
    </div>
  );
}
