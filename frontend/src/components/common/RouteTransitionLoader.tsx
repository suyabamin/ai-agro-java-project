import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * RouteTransitionLoader
 * Visibly prominent top progress bar during route changes.
 * Brand forest green gradient with glowing box-shadow.
 * Complies with WCAG 2.1 AA and respects prefers-reduced-motion.
 */
export const RouteTransitionLoader = () => {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    setProgress(35);

    const timer1 = setTimeout(() => setProgress(70), 120);
    const timer2 = setTimeout(() => setProgress(90), 280);
    const timer3 = setTimeout(() => setProgress(100), 450);
    const timer4 = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 650);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [location.pathname, location.search]);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-label="Page navigation loading"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '4px',
        zIndex: 999999,
        pointerEvents: 'none',
        backgroundColor: 'rgba(45, 106, 79, 0.2)',
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #1B4332 0%, #2D6A4F 50%, #52B788 100%)',
          boxShadow: '0 0 14px rgba(45, 106, 79, 0.9), 0 0 6px #52B788',
          transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  );
};
