import React, { useState, useMemo } from 'react';
import { useKanbanStore } from '../store/useKanbanStore';
import { generateWeeklyReport, formatFullDate } from '../utils/reportUtils';
import { exportWeeklyReportToPdf } from '../utils/exportReportPdf';
import { TaskDetailModal } from './TaskDetailModal';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './ui/button';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Kanban,
  TrendingUp,
  TrendingDown,
  Calendar,
  Copy,
  Check,
  ChevronRight,
  User,
  Clock,
  Layers,
  Sparkles,
  BarChart3,
  Filter,
  Menu,
  Loader2,
  FileDown,
} from 'lucide-react';
import type { TaskWithAssignee } from '../types';

interface WeeklyReportScreenProps {
  onBackToBoard: () => void;
  currentUserEmail?: string | null;
  onOpenMobileSidebar?: () => void;
}

export const WeeklyReportScreen: React.FC<WeeklyReportScreenProps> = ({
  onBackToBoard,
  currentUserEmail,
  onOpenMobileSidebar,
}) => {
  const { boards, board: activeBoard, getAllBoardsColumns } = useKanbanStore();

  const [weekOffset, setWeekOffset] = useState<number>(0); // 0 = current week, -1 = last week
  const [selectedBoardFilter, setSelectedBoardFilter] = useState<string>('all');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<TaskWithAssignee | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfExportSuccess, setPdfExportSuccess] = useState<string | null>(null);
  const [pdfExportError, setPdfExportError] = useState<string | null>(null);

  // Compute all columns across boards
  const allColumnsMap = useMemo(() => getAllBoardsColumns(), [getAllBoardsColumns]);

  // Generate weekly checkpoint report
  const report = useMemo(() => {
    return generateWeeklyReport(boards, allColumnsMap, weekOffset);
  }, [boards, allColumnsMap, weekOffset]);

  // Filtered boards metrics if a specific board tab is selected
  const displayedMetrics = useMemo(() => {
    if (selectedBoardFilter === 'all') {
      return report.boardMetrics;
    }
    return report.boardMetrics.filter((m) => m.boardId === selectedBoardFilter);
  }, [report.boardMetrics, selectedBoardFilter]);

  // Aggregated totals for the selected board filter
  const aggregatedStats = useMemo(() => {
    let completedThisWeek = 0;
    let completedPrevWeek = 0;
    let delayedThisWeek = 0;
    let delayedPrevWeek = 0;
    let highPriorityThisWeek = 0;
    let highPriorityPrevWeek = 0;
    let totalTasks = 0;

    displayedMetrics.forEach((m) => {
      completedThisWeek += m.completedThisWeek;
      completedPrevWeek += m.completedPreviousWeek;
      delayedThisWeek += m.delayedTasks;
      delayedPrevWeek += m.delayedTasksPreviousWeek;
      highPriorityThisWeek += m.highPriorityRemaining;
      highPriorityPrevWeek += m.highPriorityRemainingPreviousWeek;
      totalTasks += m.totalTasks;
    });

    const completionRate =
      totalTasks > 0 ? Math.round((completedThisWeek / totalTasks) * 100) : 0;

    return {
      completedThisWeek,
      completedPrevWeek,
      completedDelta: completedThisWeek - completedPrevWeek,
      delayedThisWeek,
      delayedPrevWeek,
      delayedDelta: delayedThisWeek - delayedPrevWeek,
      highPriorityThisWeek,
      highPriorityPrevWeek,
      highPriorityDelta: highPriorityThisWeek - highPriorityPrevWeek,
      totalTasks,
      completionRate,
    };
  }, [displayedMetrics]);

  // Consolidate all critical tasks (delayed or high priority remaining)
  const criticalTasks = useMemo(() => {
    const list: Array<{ task: TaskWithAssignee; boardName: string; isDelayed: boolean }> = [];
    const now = Date.now();

    displayedMetrics.forEach((m) => {
      m.criticalTasks.forEach((t) => {
        const isDelayed = Boolean(t.deadline && new Date(t.deadline).getTime() < now);
        // Avoid duplicates
        if (!list.some((item) => item.task.id === t.id)) {
          list.push({ task: t, boardName: m.boardName, isDelayed });
        }
      });
    });

    // Sort: delayed first, then high priority
    return list.sort((a, b) => {
      if (a.isDelayed && !b.isDelayed) return -1;
      if (!a.isDelayed && b.isDelayed) return 1;
      return 0;
    });
  }, [displayedMetrics]);

  // Copy Executive Checkpoint Summary to clipboard
  const handleCopySummary = () => {
    const lines = [
      `📊 WEEKLY CHECKPOINT REPORT: ${report.weekRange}`,
      `Generated on: ${formatFullDate(new Date())}`,
      `----------------------------------------------------`,
      `📈 Executive Status Overview:`,
      `• Completed This Week: ${aggregatedStats.completedThisWeek} tasks (${aggregatedStats.completedDelta >= 0 ? '+' : ''}${aggregatedStats.completedDelta} vs prev week)`,
      `• Delayed / Overdue Tasks: ${aggregatedStats.delayedThisWeek} tasks (${aggregatedStats.delayedDelta <= 0 ? '' : '+'}${aggregatedStats.delayedDelta} vs prev week)`,
      `• High Priority Tasks Remaining: ${aggregatedStats.highPriorityThisWeek} tasks (${aggregatedStats.highPriorityDelta <= 0 ? '' : '+'}${aggregatedStats.highPriorityDelta} vs prev week)`,
      `• Overall Deliverable Completion: ${aggregatedStats.completionRate}%`,
      ``,
      `📋 Active Boards Breakdown:`,
      ...report.boardMetrics.map(
        (b) =>
          `• ${b.boardName}: ${b.completedThisWeek} completed | ${b.delayedTasks} delayed | ${b.highPriorityRemaining} high-priority remaining (${b.completionRate}% completed)`
      ),
      ``,
      `⚠️ Action Items Requiring Attention:`,
      ...criticalTasks.slice(0, 5).map(
        (ct) =>
          `• [${ct.isDelayed ? 'DELAYED' : 'HIGH PRIORITY'}] ${ct.task.title} (Board: ${ct.boardName}, Assignee: ${ct.task.assignee?.full_name || 'Unassigned'})`
      ),
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      setPdfExportError(null);
      setPdfExportSuccess(null);

      const filename = await exportWeeklyReportToPdf({
        report,
        displayedMetrics,
        criticalTasks,
        aggregatedStats,
        currentUserEmail,
        selectedBoardFilter,
      });

      setPdfExportSuccess(filename);
      setTimeout(() => setPdfExportSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      setPdfExportError('Failed to generate PDF. Please try again.');
      setTimeout(() => setPdfExportError(null), 4000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-zinc-50/70 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Top Header & Navigation Bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3.5 sm:px-6 sticky top-0 z-30 shadow-xs shrink-0 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {onOpenMobileSidebar && (
              <button
                type="button"
                onClick={onOpenMobileSidebar}
                className="p-1.5 -ml-1 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden print:hidden"
                title="Open Workspaces & Boards"
                aria-label="Open Workspaces & Boards"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            <button
              type="button"
              onClick={onBackToBoard}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors print:hidden"
              title="Return to Active Kanban Board"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Board</span>
            </button>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 hidden sm:block print:hidden" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none">
                  Weekly Checkpoint Report
                </h1>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Tasks status, deliverable velocity, and week-over-week comparisons
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            {/* Top Right Dark Mode Toggle */}
            <ThemeToggle size="sm" showLabel={true} />

            {/* Week Offset Selector */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  weekOffset === 0
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Current Week
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset(-1)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                  weekOffset === -1
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Previous Week
              </button>
            </div>

            {/* Copy Summary Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySummary}
              className="text-xs h-8 gap-1.5 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              title="Copy formatted markdown checkpoint brief to clipboard"
            >
              {copiedNotification ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Copy Summary</span>
                </>
              )}
            </Button>

            {/* Primary Action: Export PDF Button (Generates and downloads a real formatted PDF document) */}
            <Button
              variant="default"
              size="sm"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="text-xs h-8 gap-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-xs transition-all"
              title="Export and download Weekly Checkpoint Report as a PDF file"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-300" />
                  <span>Generating PDF...</span>
                </>
              ) : pdfExportSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">PDF Downloaded!</span>
                </>
              ) : (
                <>
                  <FileDown className="h-3.5 w-3.5 text-zinc-300" />
                  <span>Export PDF</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* PDF Export Success/Error Notification Banner */}
      {pdfExportSuccess && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-800 flex items-center justify-between print:hidden">
          <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                <strong>PDF exported successfully!</strong> File downloaded as{' '}
                <code className="bg-emerald-100/80 px-1.5 py-0.5 rounded font-mono text-[11px] text-emerald-900 font-semibold">
                  {pdfExportSuccess}
                </code>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPdfExportSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {pdfExportError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-800 flex items-center justify-between print:hidden">
          <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{pdfExportError}</span>
            </div>
            <button
              type="button"
              onClick={() => setPdfExportError(null)}
              className="text-rose-700 hover:text-rose-900 text-xs font-semibold ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Report Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 sm:py-8 space-y-6">
        {/* Checkpoint Header Banner */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                <Calendar className="h-3.5 w-3.5" />
                <span>{report.weekRange}</span>
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                vs Previous Week ({report.previousWeekRange})
              </span>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Active Boards Weekly Checkpoint Summary
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
              Consolidated sprint status tracking deliverable velocity across {boards.length} active
              project boards. Comparisons show net changes against the previous checkpoint period.
            </p>
          </div>

          {/* Quick Board Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700 print:hidden">
            <button
              type="button"
              onClick={() => setSelectedBoardFilter('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                selectedBoardFilter === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              All Boards ({boards.length})
            </button>
            {boards.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBoardFilter(b.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all truncate max-w-[130px] ${
                  selectedBoardFilter === b.id
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
                title={b.name}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Key Executive Performance Indicator (KPI) Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Completed Tasks */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs flex flex-col justify-between space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Tasks Completed
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                  {aggregatedStats.completedThisWeek}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">tasks</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                {aggregatedStats.completedDelta >= 0 ? (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                    <TrendingUp className="h-3 w-3" />
                    <span>+{aggregatedStats.completedDelta}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded">
                    <TrendingDown className="h-3 w-3" />
                    <span>{aggregatedStats.completedDelta}</span>
                  </span>
                )}
                <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                  vs prev week ({aggregatedStats.completedPrevWeek})
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Delayed Tasks */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs flex flex-col justify-between space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Delayed Tasks
              </span>
              <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                  {aggregatedStats.delayedThisWeek}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">overdue</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                {aggregatedStats.delayedDelta <= 0 ? (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                    <TrendingDown className="h-3 w-3" />
                    <span>
                      {aggregatedStats.delayedDelta === 0 ? '0 (steady)' : aggregatedStats.delayedDelta}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded">
                    <TrendingUp className="h-3 w-3" />
                    <span>+{aggregatedStats.delayedDelta}</span>
                  </span>
                )}
                <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                  vs prev week ({aggregatedStats.delayedPrevWeek})
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: High Priority Tasks Remaining */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs flex flex-col justify-between space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                High Priority Remaining
              </span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Flame className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                  {aggregatedStats.highPriorityThisWeek}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">active urgent</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                {aggregatedStats.highPriorityDelta <= 0 ? (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                    <TrendingDown className="h-3 w-3" />
                    <span>
                      {aggregatedStats.highPriorityDelta === 0
                        ? '0 (steady)'
                        : aggregatedStats.highPriorityDelta}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                    <TrendingUp className="h-3 w-3" />
                    <span>+{aggregatedStats.highPriorityDelta}</span>
                  </span>
                )}
                <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                  vs prev week ({aggregatedStats.highPriorityPrevWeek})
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Overall Velocity & Completion Rate */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs flex flex-col justify-between space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Deliverable Completion Rate
              </span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
                  {aggregatedStats.completionRate}%
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">of total scope</span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                <span>{aggregatedStats.totalTasks} total tasks logged across boards</span>
              </div>
            </div>
          </div>
        </div>

        {/* Visualizations Section (Charts & Graphs attached with figures) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Weekly Checkpoint Comparison Bar Chart */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Weekly Board Checkpoint Comparison
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Completed & Delayed figures: This Week vs Previous Week
                </p>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.chartDataComparison}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#71717a25" vertical={false} />
                  <XAxis
                    dataKey="boardName"
                    tick={{ fontSize: 11, fill: '#a1a1aa' }}
                    axisLine={{ stroke: '#71717a30' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#a1a1aa' }}
                    allowDecimals={false}
                    axisLine={{ stroke: '#71717a30' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      backgroundColor: 'var(--tooltip-bg, #18181b)',
                      borderColor: '#3f3f46',
                      color: '#f4f4f5',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.2)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar
                    dataKey="completedThisWeek"
                    name="Completed (This Week)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="completedPrevWeek"
                    name="Completed (Prev Week)"
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="delayedThisWeek"
                    name="Delayed (This Week)"
                    fill="#f43f5e"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="delayedPrevWeek"
                    name="Delayed (Prev Week)"
                    fill="#71717a"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Daily Completion & Incident Velocity Trend */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs space-y-3 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Daily Velocity & Checkpoint Pacing
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Daily closed deliverables vs delayed alerts during checkpoint week
                </p>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={report.dailyVelocityTrend}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorDelayed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#71717a25" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: '#a1a1aa' }}
                    axisLine={{ stroke: '#71717a30' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#a1a1aa' }}
                    allowDecimals={false}
                    axisLine={{ stroke: '#71717a30' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      backgroundColor: 'var(--tooltip-bg, #18181b)',
                      borderColor: '#3f3f46',
                      color: '#f4f4f5',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    name="Tasks Completed"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCompleted)"
                  />
                  <Area
                    type="monotone"
                    dataKey="delayed"
                    name="Delayed Alerts"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorDelayed)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Board-by-Board Status Details Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Active Boards Breakdown
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Showing {displayedMetrics.length} active {displayedMetrics.length === 1 ? 'board' : 'boards'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedMetrics.map((m) => {
              return (
                <div
                  key={m.boardId}
                  className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{m.boardName}</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {m.totalTasks} total tasks in workflow
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {m.completionRate}% Done
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(5, m.completionRate))}%` }}
                    />
                  </div>

                  {/* Figures Table */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center divide-x divide-zinc-100 dark:divide-zinc-800">
                    <div>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-semibold block">
                        Completed
                      </span>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 block">
                        {m.completedThisWeek}
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">
                        {m.weeklyVelocityDelta >= 0 ? `+${m.weeklyVelocityDelta}` : m.weeklyVelocityDelta} vs prev
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-semibold block">
                        Delayed
                      </span>
                      <span className="text-lg font-bold text-rose-600 dark:text-rose-400 block">
                        {m.delayedTasks}
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">
                        {m.delayedDelta <= 0 ? m.delayedDelta : `+${m.delayedDelta}`} vs prev
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-semibold block">
                        High Priority
                      </span>
                      <span className="text-lg font-bold text-amber-600 dark:text-amber-400 block">
                        {m.highPriorityRemaining}
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">
                        {m.highPriorityDelta <= 0 ? m.highPriorityDelta : `+${m.highPriorityDelta}`} vs prev
                      </span>
                    </div>
                  </div>

                  {/* Workflow Pipeline stages snapshot */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span>Backlog: {m.backlogCount}</span>
                    <span>In Progress: {m.inProgressCount}</span>
                    <span>Review: {m.reviewCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actionable Checkpoint Tasks Table (Delayed & High Priority Remaining) */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-xs transition-colors">
          <div className="p-4 sm:p-5 border-b border-zinc-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>Critical Checkpoint Action Items</span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300">
                  {criticalTasks.length}
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Tasks currently delayed past deadline or marked High Priority needing attention
              </p>
            </div>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">Click any task to view/edit details</span>
          </div>

          {criticalTasks.length === 0 ? (
            <div className="p-8 text-center text-zinc-400 dark:text-zinc-500 text-xs">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-zinc-700 dark:text-zinc-200 text-sm">All deliverables on track!</p>
              <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                No tasks are currently delayed or blocked with high priority.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50/80 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold">
                    <th className="py-3 px-4">Status & Urgency</th>
                    <th className="py-3 px-4">Task Deliverable</th>
                    <th className="py-3 px-4">Board Workflow</th>
                    <th className="py-3 px-4">Assignee</th>
                    <th className="py-3 px-4">Deadline</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {criticalTasks.map(({ task, boardName, isDelayed }) => (
                    <tr
                      key={task.id}
                      onClick={() => {
                        setSelectedTaskForEdit(task);
                        setIsEditModalOpen(true);
                      }}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4">
                        {isDelayed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                            <AlertTriangle className="h-3 w-3" />
                            <span>DELAYED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                            <Flame className="h-3 w-3" />
                            <span>HIGH PRIORITY</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100 block group-hover:text-zinc-950 dark:group-hover:text-white">
                          {task.title}
                        </span>
                        {task.description && (
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate block max-w-sm">
                            {task.description}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300 font-medium">
                          <Layers className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                          <span>{boardName}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {task.assignee ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-[9px] font-bold flex items-center justify-center">
                              {(task.assignee.full_name || task.assignee.email || 'U')[0].toUpperCase()}
                            </div>
                            <span className="text-zinc-800 dark:text-zinc-200">
                              {task.assignee.full_name || task.assignee.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {task.deadline ? (
                          <span
                            className={`inline-flex items-center gap-1 ${
                              isDelayed ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            <Clock className="h-3 w-3" />
                            <span>{new Date(task.deadline).toLocaleDateString()}</span>
                          </span>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500">None</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors p-1"
                          title="Open task details"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Task Details Modal (Requirement 1 & 3 integration) */}
      <TaskDetailModal
        task={selectedTaskForEdit}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        currentUserEmail={currentUserEmail}
      />
    </div>
  );
};
