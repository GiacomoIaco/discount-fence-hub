import Skeleton from './Skeleton';

export default function UserProfileSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center space-x-4 mb-6">
        <Skeleton variant="circular" width={80} height={80} />
        <div className="flex-1">
          <Skeleton width="60%" height={24} className="mb-2" />
          <Skeleton width="40%" height={16} />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Skeleton width="30%" height={14} className="mb-2" />
          <Skeleton width="100%" height={40} />
        </div>
        <div>
          <Skeleton width="30%" height={14} className="mb-2" />
          <Skeleton width="100%" height={40} />
        </div>
        <div>
          <Skeleton width="30%" height={14} className="mb-2" />
          <Skeleton width="100%" height={40} />
        </div>
      </div>
    </div>
  );
}
