import React, { useState } from 'react';
import { useKanbanStore, DEFAULT_WORKSPACE_1_ID } from '../store/useKanbanStore';
import { CreateBoardModal } from './CreateBoardModal';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';
import { InviteMemberModal } from './InviteMemberModal';
import { TaskDetailModal } from './TaskDetailModal';
import { TimelineManagementView } from './timeline/TimelineManagementView';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Kanban,
  Plus,
  Users,
  Search,
  ArrowRight,
  Trash2,
  Calendar,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  LayoutGrid,
  Shield,
  Layers,
  BarChart3,
  Filter,
  Menu,
  FileText,
} from 'lucide-react';
import type { Board, TaskWithAssignee } from '../types';

interface BoardManagementScreenProps {
  onOpenBoard: (boardId: string) => void;
  onBackToCurrentBoard: () => void;
  onOpenWeeklyReport?: () => void;
  onOpenMobileSidebar?: () => void;
  initialTab?: 'directory' | 'timeline';
}

export const BoardManagementScreen: React.FC<BoardManagementScreenProps> = ({
  onOpenBoard,
  onBackToCurrentBoard,
  onOpenWeeklyReport,
  onOpenMobileSidebar,
  initialTab = 'directory',
}) => {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    boards,
    board: activeBoard,
    boardMembers,
    documents,
    fetchBoard,
    deleteBoard,
  } = useKanbanStore();

  const [activeTab, setActiveTab] = useState<'directory' | 'timeline'>(initialTab);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<TaskWithAssignee | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkspaceFilter, setSelectedWorkspaceFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);
  const [selectedBoardForInvite, setSelectedBoardForInvite] = useState<Board | null>(null);
  const [deleteConfirmBoardId, setDeleteConfirmBoardId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter boards by workspace and search term
  const filteredBoards = boards.filter((b) => {
    const bWsId = b.workspace_id || DEFAULT_WORKSPACE_1_ID;
    if (selectedWorkspaceFilter !== 'all' && bWsId !== selectedWorkspaceFilter) {
      return false;
    }
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      b.name.toLowerCase().includes(query) ||
      (b.description && b.description.toLowerCase().includes(query))
    );
  });

  // Calculate total unique members across all boards
  const totalUniqueMembers = React.useMemo(() => {
    const emailSet = new Set<string>();
    Object.values(boardMembers).forEach((memberList) => {
      memberList.forEach((m) => emailSet.add(m.email.toLowerCase()));
    });
    return emailSet.size;
  }, [boardMembers]);

  const handleSelectBoard = async (boardId: string) => {
    await fetchBoard(boardId);
    onOpenBoard(boardId);
  };

  const handleDelete = async (boardId: string) => {
    setErrorMessage(null);
    try {
      await deleteBoard(boardId);
      setDeleteConfirmBoardId(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not delete board.');
    }
  };

  const getInitials = (name: string) => {
    return (
      name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U'
    );
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-zinc-50/70 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Top Navigation Bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3.5 sm:px-6 sticky top-0 z-30 shadow-xs shrink-0 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {onOpenMobileSidebar && (
              <button
                type="button"
                onClick={onOpenMobileSidebar}
                className="p-1.5 -ml-1 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
                title="Open Workspaces & Boards"
                aria-label="Open Workspaces & Boards"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            <button
              type="button"
              onClick={onBackToCurrentBoard}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title="Return to Active Board view"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Board</span>
            </button>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs">
                {activeTab === 'timeline' ? (
                  <Calendar className="h-4 w-4" />
                ) : (
                  <LayoutGrid className="h-4 w-4" />
                )}
              </div>
              <div>
                <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-none">
                  {activeTab === 'timeline' ? 'Timeline Management' : 'Workspace Boards Directory'}
                </h1>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {activeTab === 'timeline'
                    ? 'Schedule tasks with start & end dates and visualize timeline bars'
                    : 'Manage multiple team boards and isolate member assignee pools'}
                </p>
              </div>
            </div>
          </div>

          {/* Center Tabs: Boards Directory vs Timeline Management */}
          <div className="order-3 sm:order-2 flex items-center bg-zinc-100 dark:bg-zinc-800/90 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'directory'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Boards Directory</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'timeline'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Timeline</span>
              <span className="text-[9px] bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-bold px-1.5 py-0.2 rounded-full border border-sky-200 dark:border-sky-800">
                Advanced
              </span>
            </button>
          </div>

          <div className="order-2 sm:order-3 flex items-center gap-2.5">
            {/* Top Right Theme Toggle */}
            <ThemeToggle size="sm" showLabel={true} />

            {workspaces.length < 3 && activeTab === 'directory' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateWorkspaceModalOpen(true)}
                className="text-xs font-semibold gap-1.5 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                title="Create a new workspace (up to 3)"
              >
                <Layers className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                <span>New Workspace</span>
              </Button>
            )}

            {onOpenWeeklyReport && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenWeeklyReport}
                className="text-xs font-semibold gap-1.5 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <BarChart3 className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                <span>Weekly Report</span>
              </Button>
            )}

            {activeTab === 'directory' ? (
              <Button
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="text-xs font-semibold gap-1.5 shadow-xs bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create New Board</span>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => onOpenBoard(activeBoard?.id || boards[0]?.id || '')}
                className="text-xs font-semibold gap-1.5 shadow-xs bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Kanban className="h-3.5 w-3.5" />
                <span>View on Board</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === 'timeline' ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TimelineManagementView
            boardId={activeBoard?.id}
            onNavigateToBoard={onOpenBoard}
            onEditTask={(task) => {
              setSelectedTaskForEdit(task);
              setIsEditModalOpen(true);
            }}
            showBoardSelector={true}
          />
        </div>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 sm:py-8 space-y-6">
        {/* Workspace Summary Metric Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between transition-colors">
            <div>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Workspaces (MVP)
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{workspaces.length} / 3</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
              <Layers className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between transition-colors">
            <div>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Total Project Boards
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{boards.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
              <Kanban className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between transition-colors">
            <div>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Active Project
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1 truncate max-w-[200px]">
                {activeBoard?.name || 'None selected'}
              </p>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded font-medium inline-block mt-0.5">
                Current Session
              </span>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex items-center justify-between transition-colors">
            <div>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Invited Collaborators
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{totalUniqueMembers}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-700 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Feature Directive Note */}
        <div className="flex items-start gap-3 p-3.5 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/60 rounded-xl text-xs text-blue-950 dark:text-blue-200">
          <Shield className="h-4 w-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">Workspace Hierarchy & Assignee Isolation Enforced</p>
            <p className="text-blue-800 dark:text-blue-300 text-[11px] leading-relaxed">
              Workspaces are the parent level of project boards (up to 3 workspaces per user, and maximum 5 boards per workspace). When assigning tasks, only members invited to that specific board will appear in the assignee selection menu.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-xs font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Workspace Filter Tabs & Search Bar */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-100/80 dark:bg-zinc-900 rounded-xl border border-zinc-200/70 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setSelectedWorkspaceFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedWorkspaceFilter === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              All Workspaces ({boards.length})
            </button>

            {workspaces.map((ws) => {
              const wsBoardCount = boards.filter(
                (b) => (b.workspace_id || DEFAULT_WORKSPACE_1_ID) === ws.id
              ).length;
              const isSelected = selectedWorkspaceFilter === ws.id;

              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => setSelectedWorkspaceFilter(ws.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: ws.color || '#0284c7' }}
                  />
                  <span>{ws.name}</span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">({wsBoardCount}/5)</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
              <Input
                type="text"
                placeholder="Search boards by title or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Showing <strong className="text-zinc-700 dark:text-zinc-200">{filteredBoards.length}</strong> of {boards.length} boards
              </span>
            </div>
          </div>
        </div>

        {/* Boards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBoards.map((b) => {
            const isActive = activeBoard?.id === b.id;
            const members = boardMembers[b.id] || [];
            const ws =
              workspaces.find((w) => w.id === (b.workspace_id || DEFAULT_WORKSPACE_1_ID)) ||
              workspaces[0];

            return (
              <div
                key={b.id}
                className={`flex flex-col bg-white dark:bg-zinc-900 rounded-xl border transition-all duration-150 overflow-hidden shadow-xs hover:shadow-md ${
                  isActive
                    ? 'border-zinc-900 dark:border-zinc-400 ring-1 ring-zinc-900/10 dark:ring-zinc-400/20'
                    : 'border-zinc-200/90 dark:border-zinc-800 dark:hover:border-zinc-700'
                }`}
              >
                {/* Card Top Banner */}
                <div className="p-5 pb-4 flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      {/* Workspace & Document Pills */}
                      <div className="flex items-center gap-1.5 pb-0.5 flex-wrap">
                        {ws && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: `${ws.color || '#0284c7'}15`,
                              color: ws.color || '#0284c7',
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: ws.color || '#0284c7' }}
                            />
                            {ws.name}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
                          <FileText className="h-2.5 w-2.5 text-zinc-400" />
                          <span>{(documents[b.id] || []).length} Docs</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                          {b.name}
                        </h2>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {b.description || 'General task management and agile sprint workflow board.'}
                      </p>
                    </div>

                    {isActive && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </span>
                    )}
                  </div>

                  {/* Board Members & Assignee Pool preview */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                        <Users className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                        <span>Invited Members ({members.length})</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedBoardForInvite(b)}
                        className="text-[11px] font-medium text-zinc-900 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-100 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Invite</span>
                      </button>
                    </div>

                    {/* Member Avatars Stack */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center -space-x-1.5 overflow-hidden py-1">
                        {members.length === 0 ? (
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">No members yet</span>
                        ) : (
                          members.slice(0, 5).map((m) => (
                            <div
                              key={m.id}
                              title={`${m.name} (${m.role}) - ${m.email}`}
                              className="h-7 w-7 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold shadow-xs cursor-default"
                            >
                              {getInitials(m.name)}
                            </div>
                          ))
                        )}
                        {members.length > 5 && (
                          <div className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold shadow-xs">
                            +{members.length - 5}
                          </div>
                        )}
                      </div>

                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        {members.length} {members.length === 1 ? 'assignee' : 'assignees'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 px-5 bg-zinc-50 dark:bg-zinc-950/60 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleSelectBoard(b.id)}
                      className="h-8 px-3 text-xs font-semibold gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      <span>Open Board</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedBoardForInvite(b)}
                      className="h-8 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800"
                    >
                      <span>Manage Members</span>
                    </Button>
                  </div>

                  {boards.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmBoardId(b.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                      title="Delete board"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty Search Result */}
        {filteredBoards.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 space-y-3">
            <Kanban className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No boards match your search</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              We could not find any boards matching "{searchQuery}". Try a different keyword or create
              a new board.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSearchQuery('')}
              className="text-xs border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Clear Search Filter
            </Button>
          </div>
        )}
      </main>
      )}

      {/* Task Details Modal (from Timeline click) */}
      <TaskDetailModal
        task={selectedTaskForEdit}
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open);
          if (!open) setSelectedTaskForEdit(null);
        }}
      />

      {/* Create Board Modal */}
      <CreateBoardModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onBoardCreated={(newBoardId) => {
          onOpenBoard(newBoardId);
        }}
      />

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        open={isCreateWorkspaceModalOpen}
        onOpenChange={setIsCreateWorkspaceModalOpen}
        onWorkspaceCreated={(newWsId) => {
          setSelectedWorkspaceFilter(newWsId);
        }}
      />

      {/* Invite Member Modal */}
      {selectedBoardForInvite && (
        <InviteMemberModal
          open={Boolean(selectedBoardForInvite)}
          onOpenChange={(open) => {
            if (!open) setSelectedBoardForInvite(null);
          }}
          boardId={selectedBoardForInvite.id}
          boardName={selectedBoardForInvite.name}
        />
      )}

      {/* Delete Confirmation Alert Modal */}
      {deleteConfirmBoardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Delete Project Board?</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Are you sure you want to delete this board? All column workflows and member invitations
              associated with it will be removed.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeleteConfirmBoardId(null)}
                className="text-xs border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(deleteConfirmBoardId)}
                className="text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
