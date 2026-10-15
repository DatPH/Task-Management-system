import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useKanbanStore, DEFAULT_BOARD_ID, DEFAULT_WORKSPACE_1_ID } from '../../store/useKanbanStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Filter,
  Search,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Kanban,
  User,
  Info,
  Maximize2,
  RefreshCw,
  SlidersHorizontal,
  Link2,
  Link2Off,
} from 'lucide-react';
import type { TaskWithAssignee, Priority, TimelineTaskInput, ColumnWithTasks, Board } from '../../types';
import { TaskDependencyMark, getTaskDependencyInfo } from '../TaskDependencyMark';
import { ThemeToggle } from '../ThemeToggle';

interface TimelineManagementViewProps {
  boardId?: string;
  onEditTask?: (task: TaskWithAssignee) => void;
  onNavigateToBoard?: (boardId: string) => void;
  className?: string;
  showBoardSelector?: boolean;
}

interface FormTaskRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  priority: Priority;
  assignee_id: string;
  description?: string;
}

// Format date helpers
const formatDateISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDays = (d: Date, days: number): Date => {
  const res = new Date(d);
  res.setDate(res.getDate() + days);
  return res;
};

const parseDateSafe = (dateStr?: string | null): Date => {
  if (!dateStr) return new Date();
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatDisplayDate = (d: Date): string => {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export const TimelineManagementView: React.FC<TimelineManagementViewProps> = ({
  boardId: propBoardId,
  onEditTask,
  onNavigateToBoard,
  className = '',
  showBoardSelector = true,
}) => {
  const {
    boards,
    board: activeBoard,
    columns: activeColumns,
    profiles,
    boardMembers,
    getAllBoardsColumns,
    fetchBoard,
    addTimelineTasks,
  } = useKanbanStore();

  // Selected board for timeline
  const [selectedBoardId, setSelectedBoardId] = useState<string>(
    propBoardId || activeBoard?.id || boards[0]?.id || DEFAULT_BOARD_ID
  );

  // Sync if propBoardId changes
  useEffect(() => {
    if (propBoardId) {
      setSelectedBoardId(propBoardId);
    }
  }, [propBoardId]);

  // Target board object
  const currentBoard = useMemo(() => {
    return boards.find((b) => b.id === selectedBoardId) || activeBoard || boards[0];
  }, [boards, selectedBoardId, activeBoard]);

  // Target board columns & members
  const allBoardsCols = getAllBoardsColumns();
  const currentColumns: ColumnWithTasks[] = useMemo(() => {
    if (activeBoard && activeBoard.id === selectedBoardId && activeColumns.length > 0) {
      return activeColumns;
    }
    if (allBoardsCols[selectedBoardId] && allBoardsCols[selectedBoardId].length > 0) {
      return allBoardsCols[selectedBoardId];
    }
    return activeColumns;
  }, [activeBoard, selectedBoardId, activeColumns, allBoardsCols]);

  const targetBoardMembers = boardMembers[selectedBoardId] || [];

  // Available assignee pool
  const availableAssignees = useMemo(() => {
    if (targetBoardMembers.length > 0) {
      return targetBoardMembers.map((m) => {
        const found = profiles.find((p) => p.email?.toLowerCase() === m.email.toLowerCase());
        return {
          id: found ? found.id : m.id,
          name: m.name,
          email: m.email,
        };
      });
    }
    return profiles.map((p) => ({
      id: p.id,
      name: p.full_name || p.email || 'Team Member',
      email: p.email || '',
    }));
  }, [targetBoardMembers, profiles]);

  // Default dates for new form rows
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateISO(today), [today]);

  // FORM STATE: List of tasks to input
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [formRows, setFormRows] = useState<FormTaskRow[]>([
    {
      id: 'row-1',
      title: 'Infrastructure & Database Migration',
      start_date: todayStr,
      end_date: formatDateISO(addDays(today, 4)),
      status: currentColumns[0]?.id || 'Backlog',
      priority: 'High',
      assignee_id: availableAssignees[0]?.id || '',
    },
    {
      id: 'row-2',
      title: 'OAuth PKCE Client & Session Refresh',
      start_date: formatDateISO(addDays(today, 2)),
      end_date: formatDateISO(addDays(today, 8)),
      status: currentColumns[1]?.id || 'In Progress',
      priority: 'Medium',
      assignee_id: availableAssignees[1]?.id || '',
    },
    {
      id: 'row-3',
      title: 'SOC 2 Type II Security Review',
      start_date: formatDateISO(addDays(today, 6)),
      end_date: formatDateISO(addDays(today, 13)),
      status: currentColumns[2]?.id || 'In Review',
      priority: 'High',
      assignee_id: '',
    },
  ]);

  const [formFeedback, setFormFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    transferredCount?: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // TIMELINE VISUALIZATION FILTER & ZOOM STATE
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [zoomMode, setZoomMode] = useState<'days' | 'weeks' | 'compact'>('days');
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  // Ref to timeline scroll container
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // Add row to form
  const handleAddFormRow = () => {
    const newId = `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const lastRow = formRows[formRows.length - 1];
    const newStartDate = lastRow?.end_date || todayStr;
    const newEndDate = formatDateISO(addDays(parseDateSafe(newStartDate), 4));

    setFormRows((prev) => [
      ...prev,
      {
        id: newId,
        title: '',
        start_date: newStartDate,
        end_date: newEndDate,
        status: currentColumns[0]?.id || 'Backlog',
        priority: 'Medium',
        assignee_id: '',
      },
    ]);
  };

  // Remove row from form
  const handleRemoveFormRow = (id: string) => {
    if (formRows.length <= 1) {
      // Clear instead of removing last row
      setFormRows([
        {
          id: 'row-1',
          title: '',
          start_date: todayStr,
          end_date: formatDateISO(addDays(today, 3)),
          status: currentColumns[0]?.id || 'Backlog',
          priority: 'Medium',
          assignee_id: '',
        },
      ]);
      return;
    }
    setFormRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Update specific row field
  const handleUpdateRow = (id: string, field: keyof FormTaskRow, value: any) => {
    setFormRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        // Auto-adjust end date if start date moves ahead of end date
        if (field === 'start_date' && updated.end_date < value) {
          updated.end_date = formatDateISO(addDays(parseDateSafe(value), 3));
        }
        return updated;
      })
    );
  };

  // Quick preset loader
  const handleLoadSprintPresets = () => {
    setFormRows([
      {
        id: `preset-1-${Date.now()}`,
        title: 'High-Throughput Redis Cache Invalidation',
        start_date: todayStr,
        end_date: formatDateISO(addDays(today, 3)),
        status: currentColumns[1]?.id || 'In Progress',
        priority: 'High',
        assignee_id: availableAssignees[0]?.id || '',
      },
      {
        id: `preset-2-${Date.now()}`,
        title: 'Microservices Circuit Breaker & Health Probes',
        start_date: formatDateISO(addDays(today, 2)),
        end_date: formatDateISO(addDays(today, 7)),
        status: currentColumns[0]?.id || 'Backlog',
        priority: 'Medium',
        assignee_id: availableAssignees[1]?.id || '',
      },
      {
        id: `preset-3-${Date.now()}`,
        title: 'GDPR Compliance Data Retention Job',
        start_date: formatDateISO(addDays(today, 5)),
        end_date: formatDateISO(addDays(today, 11)),
        status: currentColumns[2]?.id || 'In Review',
        priority: 'High',
        assignee_id: '',
      },
      {
        id: `preset-4-${Date.now()}`,
        title: 'Stripe Tiered Invoicing & Webhook Sync',
        start_date: formatDateISO(addDays(today, 8)),
        end_date: formatDateISO(addDays(today, 15)),
        status: currentColumns[3]?.id || 'Completed',
        priority: 'Low',
        assignee_id: availableAssignees[0]?.id || '',
      },
    ]);
    setFormFeedback(null);
  };

  // SUBMIT FORM: Transfer tasks to board & output timeline bar visualization
  const handleFinishForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);

    // Validate rows
    const validRows = formRows.filter((r) => r.title.trim().length > 0);
    if (validRows.length === 0) {
      setFormFeedback({
        type: 'error',
        message: 'Please provide at least one task with a title, start date, and end date.',
      });
      return;
    }

    // Check invalid date bounds
    for (const r of validRows) {
      if (!r.start_date || !r.end_date) {
        setFormFeedback({
          type: 'error',
          message: `Task "${r.title}" requires both a start date and an end date.`,
        });
        return;
      }
      if (new Date(r.end_date).getTime() < new Date(r.start_date).getTime()) {
        setFormFeedback({
          type: 'error',
          message: `Task "${r.title}" has an end date earlier than its start date.`,
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const inputs: TimelineTaskInput[] = validRows.map((r) => ({
        id: crypto.randomUUID(),
        title: r.title.trim(),
        start_date: r.start_date,
        end_date: r.end_date,
        status: r.status,
        priority: r.priority,
        assignee_id: r.assignee_id || null,
        description: `Scheduled timeline task (${r.start_date} to ${r.end_date}) transferred to board.`,
      }));

      const created = await addTimelineTasks(inputs, selectedBoardId);

      // Ensure active board is loaded with newest tasks
      if (activeBoard?.id === selectedBoardId) {
        await fetchBoard(selectedBoardId);
      }

      setFormFeedback({
        type: 'success',
        message: `Successfully transferred ${created.length} task${
          created.length === 1 ? '' : 's'
        } directly into "${currentBoard?.name || 'Board'}" mapped by statuses!`,
        transferredCount: created.length,
      });

      // Clear or prepare empty rows for next entry
      setFormRows([
        {
          id: `row-${Date.now()}`,
          title: '',
          start_date: todayStr,
          end_date: formatDateISO(addDays(today, 3)),
          status: currentColumns[0]?.id || 'Backlog',
          priority: 'Medium',
          assignee_id: '',
        },
      ]);

      // Scroll timeline to "Today"
      setTimeout(() => {
        if (timelineScrollRef.current) {
          timelineScrollRef.current.scrollLeft = 0;
        }
      }, 100);
    } catch (err) {
      setFormFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to transfer tasks to board.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Switch target board
  const handleSelectBoard = async (newBoardId: string) => {
    setSelectedBoardId(newBoardId);
    setFormFeedback(null);
    if (activeBoard?.id !== newBoardId) {
      await fetchBoard(newBoardId);
    }
  };

  // PREPARE TIMELINE BAR DATA
  // Collect all tasks across all columns for this board
  const allBoardTasks = useMemo(() => {
    const list: Array<TaskWithAssignee & { colName: string; colId: string }> = [];
    currentColumns.forEach((col) => {
      col.tasks.forEach((t) => {
        list.push({
          ...t,
          colName: col.name,
          colId: col.id,
        });
      });
    });
    return list;
  }, [currentColumns]);

  // Filter tasks based on search & status filter
  const filteredTasks = useMemo(() => {
    return allBoardTasks.filter((t) => {
      if (statusFilter !== 'all') {
        const matchesCol = t.colId === statusFilter || t.colName.toLowerCase() === statusFilter.toLowerCase();
        if (!matchesCol) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesCode = (t.task_code || '').toLowerCase().includes(q);
        const matchesAssignee = (t.assignee?.full_name || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode && !matchesAssignee) return false;
      }
      return true;
    });
  }, [allBoardTasks, statusFilter, searchQuery]);

  // Compute timeline boundaries
  const { minDate, maxDate, totalDays, dayTicks } = useMemo(() => {
    const dates: number[] = [today.getTime()];

    filteredTasks.forEach((t) => {
      if (t.start_date) dates.push(parseDateSafe(t.start_date).getTime());
      if (t.deadline || t.end_date) dates.push(parseDateSafe(t.deadline || t.end_date).getTime());
      if (t.created_at) dates.push(parseDateSafe(t.created_at).getTime());
    });

    const rawMin = new Date(Math.min(...dates));
    const rawMax = new Date(Math.max(...dates));

    // Pad 4 days before min and 6 days after max
    const start = new Date(rawMin.getFullYear(), rawMin.getMonth(), rawMin.getDate() - 3);
    const end = new Date(rawMax.getFullYear(), rawMax.getMonth(), rawMax.getDate() + 6);

    // Minimum span: at least 21 days
    const diffMs = end.getTime() - start.getTime();
    const spanDays = Math.max(21, Math.round(diffMs / 86400000));
    const finalEnd = new Date(start.getTime() + spanDays * 86400000);

    const ticks: Date[] = [];
    for (let i = 0; i <= spanDays; i++) {
      ticks.push(new Date(start.getTime() + i * 86400000));
    }

    return {
      minDate: start,
      maxDate: finalEnd,
      totalDays: spanDays,
      dayTicks: ticks,
    };
  }, [filteredTasks, today]);

  // Status visual color tokens
  const getStatusColorConfig = (colName: string) => {
    const name = colName.toLowerCase();
    if (name.includes('backlog') || name.includes('to do')) {
      return {
        bg: 'bg-zinc-100 hover:bg-zinc-200/90 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-700',
        badge: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
        dot: 'bg-zinc-400 dark:bg-zinc-500',
        border: 'border-zinc-300 dark:border-zinc-700',
      };
    }
    if (name.includes('progress') || name.includes('doing') || name.includes('dev')) {
      return {
        bg: 'bg-sky-500 hover:bg-sky-600 text-white border-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500 dark:border-sky-500 shadow-2xs',
        badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-800',
        dot: 'bg-sky-500 dark:bg-sky-400',
        border: 'border-sky-500 dark:border-sky-600',
      };
    }
    if (name.includes('review') || name.includes('test') || name.includes('qa')) {
      return {
        bg: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 dark:border-amber-500 shadow-2xs',
        badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
        dot: 'bg-amber-500 dark:bg-amber-400',
        border: 'border-amber-500 dark:border-amber-600',
      };
    }
    // Completed / Done
    return {
      bg: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:border-emerald-500 shadow-2xs',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
      dot: 'bg-emerald-500 dark:bg-emerald-400',
      border: 'border-emerald-600 dark:border-emerald-700',
    };
  };

  const getPriorityBadge = (p: Priority) => {
    switch (p) {
      case 'High':
        return <span className="text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/70 border border-rose-200/80 dark:border-rose-900 px-1.5 py-0.2 rounded">High</span>;
      case 'Medium':
        return <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 border border-amber-200/80 dark:border-amber-900 px-1.5 py-0.2 rounded">Med</span>;
      default:
        return <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.2 rounded">Low</span>;
    }
  };

  // Day width in px based on zoom
  const dayColWidth = zoomMode === 'compact' ? 34 : zoomMode === 'weeks' ? 44 : 52;
  const timelineContentWidth = totalDays * dayColWidth;

  // Calculate today offset percent
  const todayOffsetDays = (today.getTime() - minDate.getTime()) / 86400000;
  const todayLeftPx = Math.max(0, todayOffsetDays * dayColWidth);

  return (
    <div className={`flex flex-col h-full overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors ${className}`}>
      {/* Top Header & Controls */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3.5 sm:px-6 shrink-0 space-y-3 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Board Selector */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shrink-0 shadow-xs">
              <Calendar className="h-4 w-4 text-zinc-100 dark:text-zinc-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">
                  Timeline Management Bar
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                  Sprint Schedule
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Batch configure task schedules with start & end dates and synchronize directly with board statuses.
              </p>
            </div>
          </div>

          {/* Action buttons & Board Selector dropdown */}
          <div className="flex items-center flex-wrap gap-2.5">
            {showBoardSelector && boards.length > 0 && (
              <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium text-[11px]">Board:</span>
                <select
                  value={selectedBoardId}
                  onChange={(e) => handleSelectBoard(e.target.value)}
                  className="bg-transparent font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
                  title="Select project board"
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id} className="dark:bg-zinc-900 dark:text-zinc-100">
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Dark Mode Toggle */}
            <ThemeToggle size="sm" showLabel={true} />

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="text-xs font-semibold gap-1.5 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Plus className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>{isFormOpen ? 'Hide Input Form' : 'Add Tasks via Form'}</span>
            </Button>

            {onNavigateToBoard && (
              <Button
                size="sm"
                onClick={() => onNavigateToBoard(selectedBoardId)}
                className="text-xs font-semibold gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-xs"
                title="Go to active Kanban Board view"
              >
                <Kanban className="h-3.5 w-3.5" />
                <span>Open Kanban Board</span>
              </Button>
            )}
          </div>
        </div>

        {/* Global Feedback Alert */}
        {formFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-in fade-in-50 duration-200 ${
              formFeedback.type === 'success'
                ? 'bg-emerald-50/90 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {formFeedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span className="font-medium">{formFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFormFeedback(null)}
              className="text-xs font-semibold hover:underline px-1 text-zinc-600 dark:text-zinc-300"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Main Body: Scrollable Container with Form (Top) and Timeline Bar Visualization (Bottom) */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-6 bg-zinc-50/40 dark:bg-zinc-950">
        {/* SECTION 1: TIMELINE TASK INPUT FORM */}
        {isFormOpen && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs overflow-hidden transition-all duration-200">
            {/* Form Card Header */}
            <div className="px-5 py-3.5 bg-zinc-50/80 dark:bg-zinc-850/80 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                    <span>Timeline Task Input Form</span>
                  </h2>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                    (Target: <strong className="text-zinc-800 dark:text-zinc-200">{currentBoard?.name}</strong>)
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Input task names, start date, end date, and select matching status. Upon submission, tasks are instantly transferred to board columns.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadSprintPresets}
                  className="h-7 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 gap-1"
                  title="Populate with sample sprint milestone tasks"
                >
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  <span>Load Sample Sprint Presets</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddFormRow}
                  className="h-7 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 gap-1"
                >
                  <Plus className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                  <span>Add Another Task</span>
                </Button>
              </div>
            </div>

            {/* Form Rows Table / Grid */}
            <form onSubmit={handleFinishForm} className="p-4 sm:p-5 space-y-4">
              <div className="space-y-2.5">
                {formRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="p-3 sm:p-3.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition-colors grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                  >
                    {/* Index Indicator */}
                    <div className="sm:col-span-1 flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500 font-mono text-[11px] font-bold">
                      <span className="h-5 w-5 rounded-full bg-zinc-200/80 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-[10px]">
                        {index + 1}
                      </span>
                    </div>

                    {/* Task Title Input */}
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1 sm:hidden">
                        Task Name
                      </label>
                      <Input
                        type="text"
                        placeholder="Task name or milestone..."
                        value={row.title}
                        onChange={(e) => handleUpdateRow(row.id, 'title', e.target.value)}
                        className="h-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium"
                        required
                      />
                    </div>

                    {/* Start Date */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1 sm:hidden">
                        Start Date
                      </label>
                      <Input
                        type="date"
                        value={row.start_date}
                        onChange={(e) => handleUpdateRow(row.id, 'start_date', e.target.value)}
                        className="h-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 tabular-nums"
                        required
                      />
                    </div>

                    {/* End Date */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1 sm:hidden">
                        End Date
                      </label>
                      <Input
                        type="date"
                        value={row.end_date}
                        min={row.start_date}
                        onChange={(e) => handleUpdateRow(row.id, 'end_date', e.target.value)}
                        className="h-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 tabular-nums"
                        required
                      />
                    </div>

                    {/* Status Dropdown */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1 sm:hidden">
                        Status
                      </label>
                      <select
                        value={row.status}
                        onChange={(e) => handleUpdateRow(row.id, 'status', e.target.value)}
                        className="w-full h-8 px-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 font-medium focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-400 cursor-pointer"
                        title="Column status on board"
                      >
                        {currentColumns.map((col) => (
                          <option key={col.id} value={col.id} className="dark:bg-zinc-900 dark:text-zinc-100">
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Priority & Delete Row Action */}
                    <div className="sm:col-span-1 flex items-center justify-between sm:justify-end gap-2">
                      <select
                        value={row.priority}
                        onChange={(e) => handleUpdateRow(row.id, 'priority', e.target.value as Priority)}
                        className="h-8 px-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[11px] text-zinc-700 dark:text-zinc-200 font-medium focus:outline-hidden"
                        title="Priority level"
                      >
                        <option value="Low" className="dark:bg-zinc-900 dark:text-zinc-100">Low</option>
                        <option value="Medium" className="dark:bg-zinc-900 dark:text-zinc-100">Med</option>
                        <option value="High" className="dark:bg-zinc-900 dark:text-zinc-100">High</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemoveFormRow(row.id)}
                        disabled={formRows.length <= 1}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors disabled:opacity-30 disabled:hover:text-zinc-400 disabled:hover:bg-transparent"
                        title="Remove task row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Form Actions Footer */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddFormRow}
                    className="text-xs text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span>Add Task Row</span>
                  </Button>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formRows.filter((r) => r.title.trim()).length} task(s) ready to transfer
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="text-xs font-semibold gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-xs px-4"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5" />
                    )}
                    <span>Transfer to Board & Update Timeline</span>
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* SECTION 2: TIMELINE BAR VISUALIZATION */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/90 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col transition-colors">
          {/* Timeline Bar Section Toolbar */}
          <div className="px-5 py-3.5 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <span>Timeline Bar Visualization</span>
                  <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                    ({filteredTasks.length} Scheduled Tasks)
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Visual Gantt management bars formatted with consistent text font, padding, and alignment.
                </p>
              </div>
            </div>

            {/* Filter and Zoom Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search filter */}
              <div className="relative w-44 sm:w-56">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                <Input
                  type="text"
                  placeholder="Filter timeline tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-7.5 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                />
              </div>

              {/* Status filter dropdown */}
              <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs">
                <Filter className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs text-zinc-700 dark:text-zinc-300 font-medium focus:outline-hidden cursor-pointer"
                  title="Filter by task status"
                >
                  <option value="all" className="dark:bg-zinc-900 dark:text-zinc-100">All Statuses ({allBoardTasks.length})</option>
                  {currentColumns.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-zinc-900 dark:text-zinc-100">
                      {c.name} ({c.tasks.length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Zoom scale mode */}
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700 text-[11px]">
                <button
                  type="button"
                  onClick={() => setZoomMode('days')}
                  className={`px-2 py-1 rounded-md font-medium transition-all ${
                    zoomMode === 'days'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                  title="Daily detailed view"
                >
                  Days
                </button>
                <button
                  type="button"
                  onClick={() => setZoomMode('weeks')}
                  className={`px-2 py-1 rounded-md font-medium transition-all ${
                    zoomMode === 'weeks'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                  title="Weekly grouped view"
                >
                  Weeks
                </button>
                <button
                  type="button"
                  onClick={() => setZoomMode('compact')}
                  className={`px-2 py-1 rounded-md font-medium transition-all ${
                    zoomMode === 'compact'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                  title="Compact overview"
                >
                  Compact
                </button>
              </div>
            </div>
          </div>

          {/* Timeline Visual Canvas Container */}
          <div className="flex flex-col flex-1 min-h-[420px] overflow-hidden">
            {filteredTasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-zinc-900 space-y-3">
                <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                  <Calendar className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No scheduled tasks on this timeline</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                  Use the form above to input tasks with start and end dates. They will immediately generate visual timeline bars and transfer to the board.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLoadSprintPresets}
                  className="text-xs gap-1.5 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Load Sample Sprint Presets</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-zinc-200 dark:divide-zinc-800">
                {/* LEFT COLUMN: TASK DIRECTORY & METRICS (Fixed width, synchronized row height) */}
                <div className="w-[300px] sm:w-[340px] shrink-0 bg-white dark:bg-zinc-900 flex flex-col overflow-y-auto">
                  {/* Left Column Header */}
                  <div className="h-14 px-4 bg-zinc-50/90 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Task & Assigned Status
                    </span>
                    <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                      Schedule Duration
                    </span>
                  </div>

                  {/* Left Column Rows */}
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 flex-1">
                    {filteredTasks.map((task) => {
                      const statusColor = getStatusColorConfig(task.colName);
                      const isHovered = hoveredTaskId === task.id;

                      const startDate = parseDateSafe(task.start_date || task.created_at);
                      const endDate = parseDateSafe(task.deadline || task.end_date || task.start_date);
                      const durationDays = Math.max(
                        1,
                        Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
                      );

                      return (
                        <div
                          key={task.id}
                          onMouseEnter={() => setHoveredTaskId(task.id)}
                          onMouseLeave={() => setHoveredTaskId(null)}
                          onClick={() => onEditTask && onEditTask(task)}
                          className={`h-14 px-4 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            isHovered
                              ? 'bg-zinc-100/70 dark:bg-zinc-800/70'
                              : 'hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40'
                          }`}
                          title={`Click to inspect details: ${task.title}`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 rounded shrink-0">
                                {task.task_code || 'TSK'}
                              </span>
                              <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {task.title}
                              </h4>
                            </div>

                            <div className="flex items-center gap-2 text-[10px]">
                              {/* Status indicator */}
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-medium border text-[10px] ${statusColor.badge}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${statusColor.dot}`} />
                                <span className="truncate max-w-[80px]">{task.colName}</span>
                              </span>

                              {getPriorityBadge(task.priority)}

                              {/* Mark for task with dependency vs without dependency */}
                              <TaskDependencyMark
                                task={task}
                                columns={currentColumns}
                                variant="compact"
                              />

                              {task.assignee && (
                                <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-[90px]">
                                  {task.assignee.full_name || task.assignee.email}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Duration Tag */}
                          <div className="text-right shrink-0">
                            <span className="text-[11px] font-mono font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">
                              {durationDays}d
                            </span>
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block tabular-nums">
                              {formatDisplayDate(startDate)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT COLUMN: GANTT TIMELINE BAR VISUALIZATION TRACK */}
                <div
                  ref={timelineScrollRef}
                  className="flex-1 overflow-x-auto overflow-y-auto bg-zinc-50/30 dark:bg-zinc-950/40 relative"
                >
                  <div style={{ width: `${timelineContentWidth}px` }} className="relative min-h-full">
                    {/* TIMELINE TIME SCALE HEADER (Dates, Days of Week) */}
                    <div className="h-14 bg-zinc-50/90 dark:bg-zinc-800/90 border-b border-zinc-200 dark:border-zinc-800 flex sticky top-0 z-20 select-none">
                      {dayTicks.map((tick, i) => {
                        const isToday =
                          tick.getDate() === today.getDate() &&
                          tick.getMonth() === today.getMonth() &&
                          tick.getFullYear() === today.getFullYear();
                        const isWeekend = tick.getDay() === 0 || tick.getDay() === 6;
                        const dayNum = tick.getDate();
                        const dayName = tick.toLocaleDateString('en-US', { weekday: 'narrow' });
                        const isFirstOfMonth = dayNum === 1 || i === 0;

                        return (
                          <div
                            key={i}
                            style={{ width: `${dayColWidth}px` }}
                            className={`h-full border-r border-zinc-200/70 dark:border-zinc-800 flex flex-col justify-between py-1.5 px-1 shrink-0 text-center ${
                              isWeekend ? 'bg-zinc-100/40 dark:bg-zinc-900/50' : ''
                            } ${isToday ? 'bg-rose-50/50 dark:bg-rose-950/30' : ''}`}
                          >
                            <span
                              className={`text-[9px] font-bold uppercase truncate ${
                                isFirstOfMonth
                                  ? 'text-zinc-900 dark:text-zinc-100 font-extrabold'
                                  : 'text-zinc-400 dark:text-zinc-500'
                              }`}
                            >
                              {isFirstOfMonth
                                ? tick.toLocaleDateString('en-US', { month: 'short' })
                                : dayName}
                            </span>

                            <div className="flex items-center justify-center">
                              <span
                                className={`text-[11px] font-mono tabular-nums leading-none ${
                                  isToday
                                    ? 'h-5 w-5 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center'
                                    : 'font-semibold text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                {dayNum}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* TODAY VERTICAL INDICATOR LINE */}
                    <div
                      style={{ left: `${todayLeftPx + dayColWidth / 2}px` }}
                      className="absolute top-0 bottom-0 z-15 pointer-events-none border-l-2 border-dashed border-rose-500"
                    >
                      <div className="sticky top-14 -ml-6 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                        TODAY
                      </div>
                    </div>

                    {/* TIMELINE ROWS & MANAGEMENT BARS */}
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 relative">
                      {filteredTasks.map((task) => {
                        const statusColor = getStatusColorConfig(task.colName);
                        const isHovered = hoveredTaskId === task.id;

                        const startDate = parseDateSafe(task.start_date || task.created_at);
                        const endDate = parseDateSafe(task.deadline || task.end_date || task.start_date);

                        // Horizontal positioning calculations
                        const startOffsetDays = (startDate.getTime() - minDate.getTime()) / 86400000;
                        const durationDays = Math.max(
                          1,
                          Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
                        );

                        const barLeft = Math.max(0, startOffsetDays * dayColWidth);
                        const barWidth = Math.max(dayColWidth * 0.9, durationDays * dayColWidth - 4);

                        return (
                          <div
                            key={task.id}
                            onMouseEnter={() => setHoveredTaskId(task.id)}
                            onMouseLeave={() => setHoveredTaskId(null)}
                            className={`h-14 relative flex items-center transition-colors ${
                              isHovered ? 'bg-zinc-100/50 dark:bg-zinc-800/40' : ''
                            }`}
                          >
                            {/* Background Column Grid Guides */}
                            <div className="absolute inset-0 flex pointer-events-none">
                              {dayTicks.map((tick, i) => {
                                const isWeekend = tick.getDay() === 0 || tick.getDay() === 6;
                                return (
                                  <div
                                    key={i}
                                    style={{ width: `${dayColWidth}px` }}
                                    className={`h-full border-r border-zinc-100/80 dark:border-zinc-800/60 shrink-0 ${
                                      isWeekend ? 'bg-zinc-100/20 dark:bg-zinc-900/30' : ''
                                    }`}
                                  />
                                );
                              })}
                            </div>

                            {/* TIMELINE MANAGEMENT BAR (Consistent Font, Alignment, Padding) */}
                            <div
                              onClick={() => onEditTask && onEditTask(task)}
                              style={{
                                left: `${barLeft}px`,
                                width: `${barWidth}px`,
                              }}
                              className={`absolute h-8.5 rounded-lg border px-3 py-1 flex items-center justify-between gap-2 shadow-xs cursor-pointer select-none transition-all duration-150 z-10 ${statusColor.bg} ${
                                isHovered ? 'ring-2 ring-zinc-900/30 dark:ring-zinc-100/40 scale-[1.01]' : ''
                              }`}
                              title={`${task.task_code || 'Task'}: ${task.title} (${durationDays} days: ${formatDisplayDate(
                                startDate
                              )} - ${formatDisplayDate(endDate)}) • Status: ${task.colName}`}
                            >
                              {/* Left Text inside Bar: Task Code, Dependency Mark, & Title */}
                              <div className="flex items-center gap-1.5 min-w-0 truncate">
                                <span className="text-[10px] font-mono font-bold shrink-0 opacity-80">
                                  {task.task_code || 'TSK'}
                                </span>
                                {task.dependency_ids && task.dependency_ids.length > 0 ? (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/25 border border-amber-500/40 shrink-0"
                                    title={`Task with ${task.dependency_ids.length} dependencies`}
                                  >
                                    <Link2 className="h-2.5 w-2.5 shrink-0" />
                                    <span>{task.dependency_ids.length}</span>
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center px-1 py-0.2 rounded text-[9px] font-medium bg-black/10 shrink-0 opacity-70"
                                    title="Independent task: No dependencies"
                                  >
                                    <Link2Off className="h-2.5 w-2.5 shrink-0" />
                                  </span>
                                )}
                                <span className="text-xs font-semibold truncate leading-tight">
                                  {task.title}
                                </span>
                              </div>

                              {/* Right Metrics inside Bar: Duration / Date Range */}
                              <div className="shrink-0 flex items-center gap-1.5">
                                <span className="text-[10px] font-mono font-bold tabular-nums opacity-90 px-1 py-0.2 rounded bg-black/10">
                                  {durationDays}d
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Timeline Bar Footer Legend & Status Statistics */}
          <div className="px-5 py-2.5 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs transition-colors">
            <div className="flex items-center gap-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Status Legend:
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-zinc-300 dark:bg-zinc-600 border border-zinc-400 dark:border-zinc-500" />
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">Backlog</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">In Progress</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">In Review</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">Completed</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>
                Total Visible: <strong className="text-zinc-800 dark:text-zinc-200">{filteredTasks.length}</strong>
              </span>
              <span>•</span>
              <span>
                Span Range: <strong className="text-zinc-800 dark:text-zinc-200">{formatDisplayDate(minDate)}</strong> –{' '}
                <strong className="text-zinc-800 dark:text-zinc-200">{formatDisplayDate(maxDate)}</strong> ({totalDays} days)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
