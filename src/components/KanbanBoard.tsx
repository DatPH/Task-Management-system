import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { KanbanColumn } from './KanbanColumn';
import { CreateTaskModal } from './CreateTaskModal';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskListView } from './views/TaskListView';
import { PriorityMatrixView } from './views/PriorityMatrixView';
import { BoardManagementScreen } from './BoardManagementScreen';
import { WeeklyReportScreen } from './WeeklyReportScreen';
import { TimelineManagementView } from './timeline/TimelineManagementView';
import { InviteMemberModal } from './InviteMemberModal';
import { CreateBoardModal } from './CreateBoardModal';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { TaskQuickSearch } from './TaskQuickSearch';
import { ThemeToggle } from './ThemeToggle';
import { parseTaskHash, matchesTaskId, setTaskUrlHash, clearTaskUrlHash } from '../utils/taskId';
import { useKanbanStore, DEFAULT_WORKSPACE_1_ID, DEFAULT_BOARD_ID } from '../store/useKanbanStore';
import {
  AlertCircle,
  RefreshCw,
  Kanban,
  Layers,
  Plus,
  LogOut,
  List,
  LayoutGrid,
  ChevronDown,
  UserPlus,
  Users,
  Check,
  BarChart3,
  Calendar,
  Menu,
  Link2,
  Link2Off,
  FileText,
} from 'lucide-react';
import { Button } from './ui/button';
import type { TaskWithAssignee, Priority } from '../types';
import { BoardDocumentsView } from './documents/BoardDocumentsView';

export type BoardViewMode = 'kanban' | 'list' | 'matrix' | 'timeline' | 'documents';

interface KanbanBoardProps {
  boardId?: string;
  onSignOut?: () => void;
  userEmail?: string | null;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  boardId: initialBoardId = 'default-board-id',
  onSignOut,
  userEmail,
}) => {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    board,
    boards,
    boardMembers,
    columns,
    documents,
    isLoading,
    error,
    fetchBoard,
    fetchProfiles,
    moveTask,
    clearError,
    addBenchmarkTasks,
    getAllBoardsColumns,
  } = useKanbanStore();

  // Screen State: 'board' | 'boards-management' | 'timeline' | 'weekly-report' | 'documents'
  const [activeScreen, setActiveScreen] = useState<'board' | 'boards-management' | 'timeline' | 'weekly-report' | 'documents'>('board');

  // Mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // View Layout state: 'kanban' | 'list' | 'matrix'
  const [viewMode, setViewMode] = useState<BoardViewMode>('kanban');

  // Board Selector dropdown state
  const [isBoardDropdownOpen, setIsBoardDropdownOpen] = useState(false);
  const boardDropdownRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | undefined>(undefined);
  const [selectedDefaultPriority, setSelectedDefaultPriority] = useState<Priority | undefined>(
    undefined
  );

  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<TaskWithAssignee | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);
  const [dependencyFilter, setDependencyFilter] = useState<'ALL' | 'WITH_DEPS' | 'INDEPENDENT'>('ALL');

  // Task dependency statistics across all columns
  const allTasksCount = useMemo(() => columns.reduce((acc, c) => acc + c.tasks.length, 0), [columns]);
  const tasksWithDepsCount = useMemo(
    () =>
      columns.reduce(
        (acc, c) =>
          acc + c.tasks.filter((t) => t.dependency_ids && t.dependency_ids.length > 0).length,
        0
      ),
    [columns]
  );
  const tasksWithoutDepsCount = allTasksCount - tasksWithDepsCount;

  // Filter columns based on selected dependency type
  const filteredColumns = useMemo(() => {
    if (dependencyFilter === 'ALL') return columns;
    return columns.map((col) => ({
      ...col,
      tasks: col.tasks.filter((t) => {
        const hasDeps = Boolean(t.dependency_ids && t.dependency_ids.length > 0);
        return dependencyFilter === 'WITH_DEPS' ? hasDeps : !hasDeps;
      }),
    }));
  }, [columns, dependencyFilter]);

  // Active workspace object & its boards
  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const activeWorkspaceBoards = boards.filter(
    (b) => (b.workspace_id || DEFAULT_WORKSPACE_1_ID) === (activeWorkspace?.id || DEFAULT_WORKSPACE_1_ID)
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        boardDropdownRef.current &&
        !boardDropdownRef.current.contains(event.target as Node)
      ) {
        setIsBoardDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load board data and member profiles on mount
  useEffect(() => {
    if (initialBoardId) {
      fetchBoard(initialBoardId);
    }
    fetchProfiles();
  }, [initialBoardId, fetchBoard, fetchProfiles]);

  const handleOpenCreateModal = (columnId?: string, priority?: Priority) => {
    setSelectedColumnId(columnId || columns[0]?.id);
    setSelectedDefaultPriority(priority);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (task: TaskWithAssignee) => {
    setSelectedTaskForEdit(task);
    setIsEditModalOpen(true);
    setTaskUrlHash(task);
  };

  const handleCloseEditModal = (open: boolean) => {
    setIsEditModalOpen(open);
    if (!open) {
      clearTaskUrlHash();
      setSelectedTaskForEdit(null);
    }
  };

  // Deep link handling: Open task detail when URL hash matches a task ID (e.g. #TSK-101)
  const checkAndOpenTaskFromHash = useCallback(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash || hash === '#') return;

    const lookupKey = parseTaskHash(hash);
    if (!lookupKey) return;

    // 1. Search inside current board columns
    for (const col of columns) {
      const match = col.tasks.find((t) => matchesTaskId(t, lookupKey));
      if (match) {
        setSelectedTaskForEdit(match);
        setIsEditModalOpen(true);
        return;
      }
    }

    // 2. Search across other boards if not found in current board
    const allBoardCols = getAllBoardsColumns();
    for (const [otherBoardId, bCols] of Object.entries(allBoardCols)) {
      for (const col of bCols) {
        const match = col.tasks.find((t) => matchesTaskId(t, lookupKey));
        if (match) {
          if (board?.id !== otherBoardId) {
            fetchBoard(otherBoardId);
          }
          setSelectedTaskForEdit(match);
          setIsEditModalOpen(true);
          return;
        }
      }
    }
  }, [columns, board, getAllBoardsColumns, fetchBoard]);

  useEffect(() => {
    if (columns.length > 0) {
      checkAndOpenTaskFromHash();
    }
    window.addEventListener('hashchange', checkAndOpenTaskFromHash);
    return () => {
      window.removeEventListener('hashchange', checkAndOpenTaskFromHash);
    };
  }, [columns, checkAndOpenTaskFromHash]);

  const handleSelectBoard = async (targetBoardId: string) => {
    setIsBoardDropdownOpen(false);
    await fetchBoard(targetBoardId);
  };

  const currentBoardMembers = board ? boardMembers[board.id] || [] : [];

  const getInitials = (fullName: string) => {
    return (
      fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U'
    );
  };

  /**
   * Handle drag-and-drop conclusion
   */
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;

      if (!destination) {
        return;
      }

      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      const cleanTaskId = draggableId.startsWith('task-')
        ? draggableId.replace(/^task-/, '')
        : draggableId;

      moveTask(
        cleanTaskId,
        source.droppableId,
        destination.droppableId,
        destination.index
      );
    },
    [moveTask]
  );

  // If user navigated to another screen
  const renderScreenContent = () => {
    if (activeScreen === 'boards-management' || activeScreen === 'timeline') {
      return (
        <BoardManagementScreen
          onOpenBoard={(id) => {
            setActiveScreen('board');
            fetchBoard(id);
          }}
          onBackToCurrentBoard={() => setActiveScreen('board')}
          onOpenWeeklyReport={() => setActiveScreen('weekly-report')}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          initialTab={activeScreen === 'timeline' ? 'timeline' : 'directory'}
        />
      );
    }

    if (activeScreen === 'weekly-report') {
      return (
        <WeeklyReportScreen
          onBackToBoard={() => setActiveScreen('board')}
          currentUserEmail={userEmail}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />
      );
    }

    if (activeScreen === 'documents') {
      return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <BoardDocumentsView
            boardId={board?.id || DEFAULT_BOARD_ID}
            boardName={board?.name || 'Project Board'}
            boardMembers={currentBoardMembers}
            currentUserEmail={userEmail}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* Board Top Navigation & Controls Header */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 sm:px-6 sticky top-0 z-30 shadow-xs shrink-0 transition-colors">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Mobile Menu + Board Selector Dropdown & Switcher */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile Sidebar Hamburger */}
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-1.5 -ml-1 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
                title="Open Workspaces & Boards"
                aria-label="Open Workspaces & Boards"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="relative" ref={boardDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsBoardDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 p-1.5 -ml-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left group"
                  title="Switch or manage boards"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                    <Kanban className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: activeWorkspace?.color || '#0284c7' }}
                      />
                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 truncate max-w-[90px] sm:max-w-[130px]">
                        {activeWorkspace?.name || 'Workspace'}
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-700 text-xs">/</span>
                      <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none truncate max-w-[120px] sm:max-w-[200px]">
                        {board?.name || 'Project Kanban'}
                      </h1>
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 transition-transform duration-150 shrink-0 ${
                          isBoardDropdownOpen ? 'rotate-180 text-zinc-800 dark:text-zinc-200' : ''
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {activeWorkspaceBoards.length} of 5 boards in this workspace • Click to switch
                    </p>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isBoardDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-76 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-xl p-1.5 z-50 text-xs animate-in fade-in-50 zoom-in-95">
                    <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: activeWorkspace?.color || '#0284c7' }}
                        />
                        <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]">
                          {activeWorkspace?.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                        {activeWorkspaceBoards.length}/5 boards
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-0.5">
                      {activeWorkspaceBoards.map((b) => {
                        const isCurrent = board?.id === b.id;
                        const memberCount = (boardMembers[b.id] || []).length;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleSelectBoard(b.id)}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                              isCurrent
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <span className="truncate block">{b.name}</span>
                              <span
                                className={`text-[10px] truncate block ${
                                  isCurrent ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'
                                }`}
                              >
                                {memberCount} {memberCount === 1 ? 'member' : 'members'}
                              </span>
                            </div>
                            {isCurrent && <Check className="h-3.5 w-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-1 pt-1 border-t border-zinc-100 dark:border-zinc-800 space-y-0.5">
                      <button
                        type="button"
                        disabled={activeWorkspaceBoards.length >= 5}
                        onClick={() => {
                          setIsBoardDropdownOpen(false);
                          setIsCreateBoardModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium text-left disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5 text-zinc-500" />
                        <span>Create New Board in this Workspace...</span>
                      </button>

                      {workspaces.length < 3 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsBoardDropdownOpen(false);
                            setIsCreateWorkspaceModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium text-left"
                        >
                          <Layers className="h-3.5 w-3.5 text-zinc-500" />
                          <span>Create New Workspace ({workspaces.length}/3)...</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsBoardDropdownOpen(false);
                          setActiveScreen('weekly-report');
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium text-left"
                      >
                        <BarChart3 className="h-3.5 w-3.5 text-zinc-500" />
                        <span>Weekly Checkpoint Report...</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsBoardDropdownOpen(false);
                          setActiveScreen('boards-management');
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-medium text-left"
                      >
                        <LayoutGrid className="h-3.5 w-3.5 text-zinc-500" />
                        <span>Manage All Workspaces & Boards...</span>
                      </button>
                    </div>
                  </div>
                )}
            </div>

            {/* Quick Link to Board Management Hub */}
            <button
              type="button"
              onClick={() => setActiveScreen('boards-management')}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              title="Open full Boards Management screen"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Boards Hub</span>
              <span className="px-1.5 py-0.2 text-[10px] bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-full font-bold">
                {boards.length}
              </span>
            </button>

            {/* Quick Link to Weekly Checkpoint Report */}
            <button
              type="button"
              onClick={() => setActiveScreen('weekly-report')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-200/60 dark:border-zinc-700 shadow-2xs"
              title="Open Weekly Checkpoint Report"
            >
              <BarChart3 className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
              <span>Weekly Report</span>
            </button>
          </div>

          {/* Center: Optimized Task Quick Search (by ID, Hash, or Title Words) */}
          <div className="order-3 sm:order-2 flex-1 max-w-xs sm:max-w-sm lg:max-w-md min-w-[200px]">
            <TaskQuickSearch
              columns={columns}
              onSelectTask={handleOpenEditModal}
              onAddBenchmarkTasks={addBenchmarkTasks}
            />
          </div>

          {/* Invited Board Members & Quick Invite Action */}
          <div className="order-4 sm:order-3 flex items-center gap-2 bg-zinc-50/80 dark:bg-zinc-800/80 px-2.5 py-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hidden md:inline">
              Assignees:
            </span>
            <div className="flex items-center -space-x-1.5">
              {currentBoardMembers.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  title={`${m.name} (${m.role}) - ${m.email}`}
                  className="h-6 w-6 rounded-full bg-zinc-900 text-white border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[9px] font-bold shadow-2xs"
                >
                  {getInitials(m.name)}
                </div>
              ))}
              {currentBoardMembers.length > 3 && (
                <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[9px] font-bold shadow-2xs">
                  +{currentBoardMembers.length - 3}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
              className="h-7 px-2 text-[11px] font-medium gap-1 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200"
              title="Invite members to this board"
            >
              <UserPlus className="h-3 w-3 text-zinc-600 dark:text-zinc-400" />
              <span>Invite</span>
            </Button>
          </div>

          {/* Layout View Switcher */}
          <div className="order-5 sm:order-4 flex items-center bg-zinc-100 dark:bg-zinc-800/90 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Kanban Board View (Kanban columns & Drag and Drop)"
            >
              <Kanban className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Table / List View (Filter & Search)"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden md:inline">List View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Priority Matrix View (Urgency tiers)"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Matrix View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                viewMode === 'timeline'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Timeline Management View (Gantt schedule & timeline bars)"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Timeline</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('documents')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                viewMode === 'documents'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
              title="Board Documents & Shareable Specs"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Docs</span>
              <span className="px-1.5 py-0.2 text-[9px] bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-full font-bold">
                {(documents[board?.id || ''] || []).length}
              </span>
            </button>
          </div>

          {/* Right: Actions & Dark Mode Toggle */}
          <div className="order-2 sm:order-5 flex items-center gap-2">
            {/* Top Right Dark Mode Toggle Button */}
            <ThemeToggle showLabel={true} />

            <Button
              onClick={() => handleOpenCreateModal()}
              size="sm"
              className="gap-1.5 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>New Task</span>
            </Button>

            <button
              type="button"
              onClick={() => board && fetchBoard(board.id)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh board data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Error Alert Banner */}
      {error && (
        <div className="mx-4 mt-3 sm:mx-6 flex items-center justify-between gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="text-xs font-medium hover:underline text-rose-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Board Canvas */}
      <main className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto">
        {isLoading && columns.length === 0 ? (
          <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-zinc-400 gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-zinc-400" />
            <span className="text-sm font-medium text-zinc-500">Loading board columns...</span>
          </div>
        ) : columns.length === 0 ? (
          <div className="h-full min-h-[380px] flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-2xl p-8 text-center bg-white">
            <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900">No columns yet</h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1">
              Initialize columns in your Supabase database or add your first workflow stage to get started.
            </p>
          </div>
        ) : (
          <>
            {/* View Option 1: Classic Kanban Board (with drag-and-drop) */}
            {viewMode === 'kanban' && (
              <div className="flex flex-col min-h-full">
                {/* Dependency Sub-toolbar & Type Differentiation Legend */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-white/80 dark:bg-zinc-900/90 backdrop-blur-xs p-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
                  {/* Left: Filter Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1 mr-1 hidden sm:inline">
                      Filter:
                    </span>
                    <button
                      type="button"
                      onClick={() => setDependencyFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        dependencyFilter === 'ALL'
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      All Tasks ({allTasksCount})
                    </button>

                    <button
                      type="button"
                      onClick={() => setDependencyFilter('WITH_DEPS')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        dependencyFilter === 'WITH_DEPS'
                          ? 'bg-amber-600 dark:bg-amber-500 text-white dark:text-zinc-950 font-semibold shadow-xs'
                          : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60'
                      }`}
                      title="Show only tasks that have dependencies / prerequisites"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      <span>With Dependencies ({tasksWithDepsCount})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDependencyFilter('INDEPENDENT')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        dependencyFilter === 'INDEPENDENT'
                          ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold shadow-xs'
                          : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'
                      }`}
                      title="Show only independent tasks with no dependencies"
                    >
                      <Link2Off className="h-3.5 w-3.5 text-zinc-500" />
                      <span>Without Dependencies ({tasksWithoutDepsCount})</span>
                    </button>
                  </div>

                  {/* Right: Visual Marks Legend */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="hidden md:flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-200/80 dark:border-zinc-700">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">Marks:</span>
                      <span className="inline-flex items-center gap-1" title="Has dependencies and at least 1 prerequisite is incomplete">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <Link2 className="h-2.5 w-2.5 text-amber-700 dark:text-amber-400" />
                        <span>With Dep (Blocked)</span>
                      </span>
                      <span className="inline-flex items-center gap-1" title="Has dependencies and all prerequisites are finished">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <Link2 className="h-2.5 w-2.5 text-emerald-700 dark:text-emerald-400" />
                        <span>With Dep (Ready)</span>
                      </span>
                      <span className="inline-flex items-center gap-1" title="No dependencies: Independent task">
                        <span className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                        <Link2Off className="h-2.5 w-2.5 text-zinc-500 dark:text-zinc-400" />
                        <span>Without Dep (Independent)</span>
                      </span>
                    </div>
                  </div>
                </div>

                <DragDropContext onDragEnd={handleDragEnd}>
                  <div className="min-h-full flex overflow-x-auto snap-x pb-12 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:overflow-x-visible items-start">
                    {filteredColumns.map((column) => (
                      <div key={column.id} className="snap-start shrink-0 w-[290px] sm:w-auto">
                        <KanbanColumn
                          column={column}
                          onAddTask={(colId) => handleOpenCreateModal(colId)}
                          onEditTask={handleOpenEditModal}
                        />
                      </div>
                    ))}
                  </div>
                </DragDropContext>
              </div>
            )}

            {/* View Option 2: Searchable & Filterable Table / List View */}
            {viewMode === 'list' && (
              <div className="h-full min-h-[520px] pb-8">
                <TaskListView
                  columns={columns}
                  onEditTask={handleOpenEditModal}
                  onAddTask={() => handleOpenCreateModal()}
                />
              </div>
            )}

            {/* View Option 3: Priority Matrix View (High / Medium / Low urgency lanes) */}
            {viewMode === 'matrix' && (
              <div className="h-full min-h-[520px] pb-8">
                <PriorityMatrixView
                  columns={columns}
                  onEditTask={handleOpenEditModal}
                  onAddTask={(priority) => handleOpenCreateModal(undefined, priority)}
                />
              </div>
            )}

            {/* View Option 4: Timeline Management View (Gantt schedule, bars & task creation) */}
            {viewMode === 'timeline' && (
              <div className="h-full min-h-[520px] pb-8">
                <TimelineManagementView
                  boardId={board?.id}
                  onEditTask={handleOpenEditModal}
                  showBoardSelector={false}
                />
              </div>
            )}

            {/* View Option 5: Board Documents & Shareable Specs */}
            {viewMode === 'documents' && board && (
              <div className="h-full min-h-[520px] -m-4 sm:-m-6 flex flex-col">
                <BoardDocumentsView
                  boardId={board.id}
                  boardName={board.name}
                  boardMembers={currentBoardMembers}
                  currentUserEmail={userEmail}
                />
              </div>
            )}
          </>
        )}
      </main>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-100/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Workspace Navigation & Creation Sidebar designated on the left */}
      <WorkspaceSidebar
        activeScreen={activeScreen}
        onNavigateScreen={setActiveScreen}
        onOpenCreateWorkspace={() => setIsCreateWorkspaceModalOpen(true)}
        onOpenCreateBoard={() => setIsCreateBoardModalOpen(true)}
        userEmail={userEmail}
        onSignOut={onSignOut}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Dynamic Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {renderScreenContent()}
      </div>

      {/* Create Task Modal */}
      <CreateTaskModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        defaultColumnId={selectedColumnId}
        defaultPriority={selectedDefaultPriority}
      />

      {/* Task Details & Edit Modal with Comments */}
      <TaskDetailModal
        task={selectedTaskForEdit}
        open={isEditModalOpen}
        onOpenChange={handleCloseEditModal}
        currentUserEmail={userEmail}
      />

      {/* Invite Member to Active Board Modal */}
      {board && (
        <InviteMemberModal
          open={isInviteModalOpen}
          onOpenChange={setIsInviteModalOpen}
          boardId={board.id}
          boardName={board.name}
        />
      )}

      {/* Create Board Modal */}
      <CreateBoardModal
        open={isCreateBoardModalOpen}
        onOpenChange={setIsCreateBoardModalOpen}
        onBoardCreated={(newBoardId) => {
          fetchBoard(newBoardId);
        }}
      />

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        open={isCreateWorkspaceModalOpen}
        onOpenChange={setIsCreateWorkspaceModalOpen}
        onWorkspaceCreated={() => {
          // New workspace is automatically activated
        }}
      />
    </div>
  );
};
