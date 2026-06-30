const Skeleton = ({ className = '', count = 1 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-bg rounded ${className}`}
        />
      ))}
    </div>
  );
};

export const ChatListSkeleton = () => (
  <div className="space-y-0">
    {[1, 2, 3].map(i => (
      <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <div className="w-10 h-10 bg-bg rounded-full animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-bg rounded w-1/3 animate-pulse" />
          <div className="h-3 bg-bg rounded w-2/3 animate-pulse" />
        </div>
      </div>
    ))}
  </div>
);

export const ChatBubbleSkeleton = ({ isOwn = false }) => (
  <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-4 py-1`}>
    <div
      className={`h-10 rounded-[20px] animate-pulse ${
        isOwn ? 'w-48 bg-primary/20' : 'w-56 bg-bg'
      }`}
    />
  </div>
);

export const TableSkeleton = ({ rows = 5, cols = 4 }) => (
  <div className="space-y-3 p-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        {Array.from({ length: cols }).map((_, j) => (
          <div
            key={j}
            className="h-4 bg-bg rounded animate-pulse flex-1"
          />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton = () => (
  <div className="bg-surface rounded-lg shadow-card p-4 space-y-3">
    <div className="h-6 bg-bg rounded w-1/3 animate-pulse" />
    <div className="h-4 bg-bg rounded w-2/3 animate-pulse" />
    <div className="h-8 bg-bg rounded w-1/4 animate-pulse" />
  </div>
);

export default Skeleton;
