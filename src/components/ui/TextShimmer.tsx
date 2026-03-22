import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface TextShimmerProps {
  children: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  duration?: number;
  spread?: number;
}

export function TextShimmer({
  children,
  as: Component = 'span',
  className = '',
  duration = 2.5,
  spread = 2,
}: TextShimmerProps) {
  const MotionComponent = motion(Component);
  const dynamicSpread = useMemo(() => children.length * spread, [children, spread]);

  return (
    <MotionComponent
      className={className}
      style={{
        display: 'inline-block',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        backgroundSize: '250% 100%, auto',
        backgroundRepeat: 'no-repeat, padding-box',
        backgroundImage: `linear-gradient(90deg, transparent calc(50% - ${dynamicSpread}px), rgba(255,255,255,0.95) 50%, transparent calc(50% + ${dynamicSpread}px)), linear-gradient(rgba(255,255,255,0.35), rgba(255,255,255,0.35))`,
      } as React.CSSProperties}
      initial={{ backgroundPosition: '100% center' }}
      animate={{ backgroundPosition: '0% center' }}
      transition={{ repeat: Infinity, duration, ease: 'linear' }}
    >
      {children}
    </MotionComponent>
  );
}

// Variant for colored text (purple-cyan gradient base)
export function TextShimmerGradient({
  children,
  className = '',
  duration = 3,
}: { children: string; className?: string; duration?: number }) {
  const spread = children.length * 3;
  return (
    <motion.span
      className={className}
      style={{
        display: 'inline-block',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        backgroundSize: '250% 100%, auto',
        backgroundRepeat: 'no-repeat, padding-box',
        backgroundImage: `linear-gradient(90deg, transparent calc(50% - ${spread}px), rgba(255,255,255,0.9) 50%, transparent calc(50% + ${spread}px)), linear-gradient(135deg, #A78BFA, #818CF8, #22D3EE)`,
      } as React.CSSProperties}
      initial={{ backgroundPosition: '100% center' }}
      animate={{ backgroundPosition: '0% center' }}
      transition={{ repeat: Infinity, duration, ease: 'linear' }}
    >
      {children}
    </motion.span>
  );
}
