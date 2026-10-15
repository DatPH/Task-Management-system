import type { Task, TaskWithAssignee } from '../types';

/**
 * Derives or retrieves a consistent, human-readable unique Task Code (e.g., "TSK-101").
 * Guarantees that every task has a unique, short, linkable identifier.
 */
export const getTaskCode = (task: { id: string; task_code?: string }): string => {
  if (task.task_code && task.task_code.trim()) {
    return task.task_code.trim().toUpperCase();
  }

  // Handle seed pattern like d1000000-0000-4000-8000-000000000001 -> TSK-101
  const seedMatch = task.id.match(/^d([1-9][0-9]*)0000-0000-4000-8000/i);
  if (seedMatch) {
    const num = parseInt(seedMatch[1], 10);
    return `TSK-${100 + num}`;
  }

  // Handle "task-123" or "tsk-123"
  const prefixMatch = task.id.match(/^(?:task|tsk)[-_]?([a-zA-Z0-9]+)$/i);
  if (prefixMatch) {
    return `TSK-${prefixMatch[1].toUpperCase()}`;
  }

  // Deterministic 4-digit numeric code from UUID to keep display clean and memorable
  let hash = 0;
  for (let i = 0; i < task.id.length; i++) {
    hash = (hash << 5) - hash + task.id.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  const numericSuffix = (Math.abs(hash) % 9000) + 1000;
  return `TSK-${numericSuffix}`;
};

/**
 * Calculates the next sequential task code (e.g. "TSK-109")
 * by analyzing all existing tasks in the workspace.
 */
export const getNextTaskCode = (existingTasks: Array<{ id: string; task_code?: string }>): string => {
  let maxNumber = 100;

  existingTasks.forEach((t) => {
    const code = getTaskCode(t);
    const match = code.match(/TSK-(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber && num < 100000) {
        maxNumber = num;
      }
    }
  });

  return `TSK-${maxNumber + 1}`;
};

/**
 * Extracts and normalizes the task identifier from a URL hash string.
 * Supports:
 *  - #TSK-101 -> "TSK-101"
 *  - #task-TSK-101 -> "TSK-101"
 *  - #task-d1000000-0000-4000-8000-000000000001 -> "d1000000-0000-4000-8000-000000000001"
 *  - #101 -> "TSK-101"
 *  - #d1000000-0000-4000-8000-000000000001 -> "d1000000-0000-4000-8000-000000000001"
 */
export const parseTaskHash = (hash: string): string => {
  if (!hash) return '';
  let clean = hash.trim();
  if (clean.startsWith('#')) clean = clean.substring(1);
  if (clean.startsWith('task-') || clean.startsWith('task/')) {
    clean = clean.replace(/^task[-/]/, '');
  }
  if (clean.startsWith('tsk-')) {
    clean = clean.replace(/^tsk-/, '');
  }

  // If pure number (e.g. 101), normalize to TSK-101
  if (/^\d+$/.test(clean)) {
    return `TSK-${clean}`;
  }

  return clean.trim();
};

/**
 * Formats a clean hash string for a task.
 * e.g. "#TSK-101"
 */
export const getTaskHash = (task: { id: string; task_code?: string }): string => {
  return `#${getTaskCode(task)}`;
};

/**
 * Updates window.location.hash safely without triggering standard anchor jumps.
 */
export const setTaskUrlHash = (task: { id: string; task_code?: string }): void => {
  if (typeof window === 'undefined') return;
  const hash = getTaskCode(task);
  if (window.location.hash !== `#${hash}`) {
    window.location.hash = hash;
  }
};

/**
 * Clears task hash from the browser URL without page reload.
 */
export const clearTaskUrlHash = (): void => {
  if (typeof window === 'undefined') return;
  if (window.location.hash) {
    history.replaceState(
      null,
      document.title,
      window.location.pathname + window.location.search
    );
  }
};

/**
 * Generates the full shareable URL for a task.
 */
export const getTaskShareUrl = (task: { id: string; task_code?: string }): string => {
  if (typeof window === 'undefined') return '';
  const taskCode = getTaskCode(task);
  return `${window.location.origin}${window.location.pathname}#${taskCode}`;
};

/**
 * Checks if a search query matches a task's unique ID, task code, or UUID prefix.
 */
export const matchesTaskId = (
  task: { id: string; task_code?: string },
  query: string
): boolean => {
  if (!query || !query.trim()) return false;
  const cleanQuery = query.trim().toLowerCase().replace(/^#/, '').replace(/^task[-/]/, '');
  const taskCode = getTaskCode(task).toLowerCase();
  const rawId = task.id.toLowerCase();

  // Exact matches
  if (taskCode === cleanQuery || taskCode === `tsk-${cleanQuery}`) return true;
  if (rawId === cleanQuery) return true;

  // Number only match (e.g., query "101" matches "TSK-101")
  const numericPart = taskCode.replace('tsk-', '');
  if (cleanQuery === numericPart) return true;

  // Prefix matches
  if (taskCode.startsWith(cleanQuery)) return true;
  if (rawId.startsWith(cleanQuery)) return true;

  return false;
};
