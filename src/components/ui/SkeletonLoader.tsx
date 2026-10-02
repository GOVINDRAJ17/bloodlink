interface SkeletonLoaderProps {
  rows?: number;
  className?: string;
}

export function SkeletonLoader({ rows = 3, className = "" }: SkeletonLoaderProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-10 bg-gray-200 dark:bg-[#182233] animate-pulse rounded-lg border border-transparent dark:border-[#2A3547]"
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  );
}

export default SkeletonLoader;
