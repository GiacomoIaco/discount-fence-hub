import Skeleton from './Skeleton';

interface PhotoGallerySkeletonProps {
  count?: number;
}

export default function PhotoGallerySkeleton({ count = 12 }: PhotoGallerySkeletonProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg overflow-hidden shadow-sm">
          <Skeleton variant="rectangular" height={200} className="w-full" />
          <div className="p-3">
            <Skeleton width="70%" height={16} className="mb-2" />
            <Skeleton width="50%" height={14} />
          </div>
        </div>
      ))}
    </div>
  );
}
