import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'low' | 'medium' | 'high';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantStyles = {
    default: 'border-transparent bg-zinc-900 text-zinc-50',
    secondary: 'border-transparent bg-zinc-100 text-zinc-900',
    destructive: 'border-transparent bg-rose-500 text-white',
    outline: 'text-zinc-950 border-zinc-200',
    low: 'border-emerald-200 bg-emerald-50 text-emerald-700 font-medium',
    medium: 'border-amber-200 bg-amber-50 text-amber-700 font-medium',
    high: 'border-rose-200 bg-rose-50 text-rose-700 font-medium',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2',
        variantStyles[variant] || variantStyles.default,
        className
      )}
      {...props}
    />
  );
}

export { Badge };
