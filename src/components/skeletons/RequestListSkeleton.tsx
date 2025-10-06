import Skeleton from './Skeleton';

interface RequestListSkeletonProps {
  count?: number;
}

export default function RequestListSkeleton({ count = 5 }: RequestListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <Skeleton width="60%" height={20} className="mb-2" />
              <Skeleton width="40%" height={16} />
            </div>
            <Skeleton variant="rectangular" width={80} height={24} className="ml-4" />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <Skeleton width="50%" height={14} className="mb-1" />
              <Skeleton width="80%" height={16} />
            </div>
            <div>
              <Skeleton width="50%" height={14} className="mb-1" />
              <Skeleton width="70%" height={16} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Skeleton variant="circular" width={32} height={32} />
              <Skeleton width={100} height={16} />
            </div>
            <Skeleton width={120} height={16} />
          </div>
        </div>
      ))}
    </div>
  );
}
