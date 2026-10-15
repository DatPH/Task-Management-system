import React from 'react';
import { Link2, Link2Off, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { TaskWithAssignee, ColumnWithTasks } from '../types';

export interface TaskDependencyInfo {
  hasDependencies: boolean;
  depCount: number;
  unresolvedCount: number;
  isBlocked: boolean;
  isReady: boolean;
  statusType: 'dependent-blocked' | 'dependent-ready' | 'independent';
  label: string;
  shortLabel: string;
  tooltip: string;
}

/**
 * Calculates dependency relationship status for a task given the board columns
 */
export function getTaskDependencyInfo(
  task: TaskWithAssignee,
  columns: ColumnWithTasks[] = []
): TaskDependencyInfo {
  const dependencyIds = task.dependency_ids || [];
  const depCount = dependencyIds.length;
  const hasDependencies = depCount > 0;

  if (!hasDependencies) {
    return {
      hasDependencies: false,
      depCount: 0,
      unresolvedCount: 0,
      isBlocked: false,
      isReady: true,
      statusType: 'independent',
      label: 'Independent (No deps)',
      shortLabel: 'Independent',
      tooltip: 'Independent task: No prerequisites or dependencies (can proceed immediately)',
    };
  }

  const allTasks = columns.flatMap((c) => c.tasks);
  const unresolvedCount = dependencyIds.filter((id) => {
    const depTask = allTasks.find((t) => t.id === id);
    if (!depTask) return false;
    const col = columns.find((c) => c.id === depTask.column_id);
    const colName = (col?.name || '').toLowerCase();
    return !(colName.includes('complet') || colName.includes('done'));
  }).length;

  const isBlocked = unresolvedCount > 0;
  const isReady = !isBlocked;

  return {
    hasDependencies: true,
    depCount,
    unresolvedCount,
    isBlocked,
    isReady,
    statusType: isBlocked ? 'dependent-blocked' : 'dependent-ready',
    label: isBlocked
      ? `${depCount} ${depCount === 1 ? 'dep' : 'deps'} • Blocked`
      : `${depCount} ${depCount === 1 ? 'dep' : 'deps'} • Ready`,
    shortLabel: isBlocked ? `${depCount} dep${depCount > 1 ? 's' : ''}` : `${depCount} dep${depCount > 1 ? 's' : ''}`,
    tooltip: isBlocked
      ? `Task with dependencies: Blocked by ${unresolvedCount} of ${depCount} incomplete prerequisite(s)`
      : `Task with dependencies: All ${depCount} prerequisite(s) completed - Ready to work`,
  };
}

interface TaskDependencyMarkProps {
  task: TaskWithAssignee;
  columns?: ColumnWithTasks[];
  variant?: 'badge' | 'compact' | 'pill' | 'tag' | 'full';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export const TaskDependencyMark: React.FC<TaskDependencyMarkProps> = ({
  task,
  columns = [],
  variant = 'badge',
  className = '',
  onClick,
}) => {
  const info = getTaskDependencyInfo(task, columns);

  // Common wrapper click handler if interactive
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick(e);
    }
  };

  // 1. Task WITH Dependencies (Blocked State)
  if (info.hasDependencies && info.isBlocked) {
    if (variant === 'compact') {
      return (
        <span
          onClick={handleClick}
          title={info.tooltip}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300/90 dark:border-amber-800/80 shadow-2xs ${className}`}
        >
          <Link2 className="h-2.5 w-2.5 text-amber-700 dark:text-amber-400 shrink-0" />
          <span>{info.shortLabel}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
        </span>
      );
    }

    if (variant === 'pill') {
      return (
        <span
          onClick={handleClick}
          title={info.tooltip}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 shadow-2xs ${className}`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <Link2 className="h-3 w-3 text-amber-700 dark:text-amber-400 shrink-0" />
          <span>{info.label}</span>
        </span>
      );
    }

    // Default badge / full
    return (
      <span
        onClick={handleClick}
        title={info.tooltip}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 shadow-2xs transition-colors hover:bg-amber-100/70 dark:hover:bg-amber-900/40 ${className}`}
      >
        <Link2 className="h-3 w-3 text-amber-700 dark:text-amber-400 shrink-0" />
        <span>{variant === 'full' ? info.label : `${info.depCount} deps • Blocked`}</span>
        <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
      </span>
    );
  }

  // 2. Task WITH Dependencies (All Ready / Resolved State)
  if (info.hasDependencies && info.isReady) {
    if (variant === 'compact') {
      return (
        <span
          onClick={handleClick}
          title={info.tooltip}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300/90 dark:border-emerald-800/80 shadow-2xs ${className}`}
        >
          <Link2 className="h-2.5 w-2.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>{info.shortLabel}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
        </span>
      );
    }

    if (variant === 'pill') {
      return (
        <span
          onClick={handleClick}
          title={info.tooltip}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 shadow-2xs ${className}`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <Link2 className="h-3 w-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>{info.label}</span>
        </span>
      );
    }

    // Default badge / full
    return (
      <span
        onClick={handleClick}
        title={info.tooltip}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 shadow-2xs transition-colors hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 ${className}`}
      >
        <Link2 className="h-3 w-3 text-emerald-700 dark:text-emerald-400 shrink-0" />
        <span>{variant === 'full' ? info.label : `${info.depCount} deps • Ready`}</span>
        <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
      </span>
    );
  }

  // 3. Task WITHOUT Dependencies (Independent State)
  if (variant === 'compact') {
    return (
      <span
        onClick={handleClick}
        title={info.tooltip}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/90 dark:border-zinc-700 shadow-2xs ${className}`}
      >
        <Link2Off className="h-2.5 w-2.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
        <span>Independent</span>
      </span>
    );
  }

  if (variant === 'pill') {
    return (
      <span
        onClick={handleClick}
        title={info.tooltip}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shadow-2xs ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 shrink-0" />
        <Link2Off className="h-3 w-3 text-zinc-400 dark:text-zinc-500 shrink-0" />
        <span>Independent</span>
      </span>
    );
  }

  // Default badge / full
  return (
    <span
      onClick={handleClick}
      title={info.tooltip}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/90 dark:border-zinc-700 shadow-2xs transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-750 ${className}`}
    >
      <Link2Off className="h-3 w-3 text-zinc-400 dark:text-zinc-500 shrink-0" />
      <span>{variant === 'full' ? 'Independent (No Dependencies)' : 'Independent'}</span>
    </span>
  );
};
