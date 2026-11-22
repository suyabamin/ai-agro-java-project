export const PageSkeletonLoader = () => {
  return (
    <div
      role="status"
      aria-label="Loading page content"
      style={{
        padding: '32px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @keyframes agroPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        .agro-skeleton-pulse {
          animation: agroPulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .agro-skeleton-pulse {
            animation: none;
            opacity: 0.7;
          }
        }
      `}</style>

      {/* Header Skeleton */}
      <div style={{ marginBottom: '28px' }}>
        <div
          className="agro-skeleton-pulse"
          style={{
            height: '14px',
            width: '160px',
            backgroundColor: '#E5E7EB',
            borderRadius: '4px',
            marginBottom: '12px',
          }}
        />
        <div
          className="agro-skeleton-pulse"
          style={{
            height: '28px',
            width: '280px',
            backgroundColor: '#D1D5DB',
            borderRadius: '6px',
            marginBottom: '8px',
          }}
        />
        <div
          className="agro-skeleton-pulse"
          style={{
            height: '16px',
            width: '420px',
            backgroundColor: '#E5E7EB',
            borderRadius: '4px',
          }}
        />
      </div>

      {/* Grid of Content Cards Skeleton */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        {[1, 2, 3].map((cardId) => (
          <div
            key={cardId}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div
              className="agro-skeleton-pulse"
              style={{
                height: '20px',
                width: '60%',
                backgroundColor: '#E5E7EB',
                borderRadius: '4px',
                marginBottom: '16px',
              }}
            />
            <div
              className="agro-skeleton-pulse"
              style={{
                height: '48px',
                width: '100%',
                backgroundColor: '#F3F4F6',
                borderRadius: '6px',
                marginBottom: '12px',
              }}
            />
            <div
              className="agro-skeleton-pulse"
              style={{
                height: '14px',
                width: '80%',
                backgroundColor: '#E5E7EB',
                borderRadius: '4px',
              }}
            />
          </div>
        ))}
      </div>

      {/* Large Content Table/Section Skeleton */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E5E7EB',
          padding: '24px',
        }}
      >
        <div
          className="agro-skeleton-pulse"
          style={{
            height: '22px',
            width: '200px',
            backgroundColor: '#E5E7EB',
            borderRadius: '4px',
            marginBottom: '20px',
          }}
        />
        {[1, 2, 3, 4].map((rowId) => (
          <div
            key={rowId}
            className="agro-skeleton-pulse"
            style={{
              height: '38px',
              width: '100%',
              backgroundColor: rowId % 2 === 0 ? '#F9FAFB' : '#F3F4F6',
              borderRadius: '4px',
              marginBottom: '8px',
            }}
          />
        ))}
      </div>
    </div>
  );
};
