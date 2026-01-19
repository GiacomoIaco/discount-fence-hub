/**
 * Loading skeleton for the unified inbox
 * Shows placeholder items while data is loading
 */

export function InboxSkeleton() {
  return (
    <div className="bg-white">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-4 border-b border-gray-100 animate-pulse"
        >
          {/* Icon placeholder */}
          <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />

          {/* Content placeholder */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-200 rounded w-12" />
            </div>
            <div className="h-3 bg-gray-200 rounded w-full mb-1" />
            <div className="h-3 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default InboxSkeleton;
