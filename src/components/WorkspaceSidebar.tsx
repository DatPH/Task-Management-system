import React, { useState } from 'react';
import { useKanbanStore, DEFAULT_WORKSPACE_1_ID } from '../store/useKanbanStore';
import {
  Layers,
  Plus,
  Kanban,
  BarChart3,
  Calendar,
  FolderKanban,
  ChevronRight,
  LogOut,
  Sparkles,
  Info,
  Check,
  PanelLeftClose,
  PanelLeft,
  FileText,
} from 'lucide-react';
import { Button } from './ui/button';

interface WorkspaceSidebarProps {
  activeScreen: 'board' | 'boards-management' | 'timeline' | 'weekly-report' | 'documents';
  onNavigateScreen: (screen: 'board' | 'boards-management' | 'timeline' | 'weekly-report' | 'documents') => void;
  onOpenCreateWorkspace: () => void;
  onOpenCreateBoard: () => void;
  userEmail?: string | null;
  onSignOut?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  activeScreen,
  onNavigateScreen,
  onOpenCreateWorkspace,
  onOpenCreateBoard,
  userEmail,
  onSignOut,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    boards,
    board: activeBoard,
    fetchBoard,
  } = useKanbanStore();

  const [isCollapsed, setIsCollapsed] = useState(false);

  // Active workspace object
  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  // Filter boards for the active workspace
  const activeWorkspaceBoards = boards.filter(
    (b) => (b.workspace_id || DEFAULT_WORKSPACE_1_ID) === (activeWorkspace?.id || DEFAULT_WORKSPACE_1_ID)
  );

  const canCreateWorkspace = workspaces.length < 3;
  const canCreateBoard = activeWorkspaceBoards.length < 5;

  const handleSelectWorkspace = async (workspaceId: string) => {
    if (workspaceId !== activeWorkspaceId) {
      await setActiveWorkspaceId(workspaceId);
    }
    if (activeScreen === 'boards-management' || activeScreen === 'weekly-report') {
      // Keep on current reporting/management view or jump to board view
    }
  };

  const handleSelectBoard = async (boardId: string) => {
    await fetchBoard(boardId);
    onNavigateScreen('board');
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-all duration-200 ease-in-out md:static ${
          isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-16' : 'md:w-64'} shrink-0`}
      >
        {/* Top Header: App Brand + Collapse Toggle */}
        <div className="h-14 px-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shrink-0 shadow-xs">
              <Layers className="h-4 w-4 text-zinc-100 dark:text-zinc-900" />
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight block truncate">
                  WORKSPACE OS
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium block truncate">
                  Kanban & Sprint Matrix
                </span>
              </div>
            )}
          </div>

          {/* Desktop/Tablet Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 space-y-4">
          {/* SECTION 1: WORKSPACE SELECTOR & QUOTA */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              {!isCollapsed ? (
                <>
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                    Workspaces
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                      workspaces.length >= 3
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                    }`}
                    title="MVP Quota: Up to 3 workspaces per user"
                  >
                    {workspaces.length}/3
                  </span>
                </>
              ) : (
                <div className="w-full text-center">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                    {workspaces.length}/3
                  </span>
                </div>
              )}
            </div>

            {/* Workspaces List */}
            <div className="space-y-1">
              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                const wsBoardCount = boards.filter(
                  (b) => (b.workspace_id || DEFAULT_WORKSPACE_1_ID) === ws.id
                ).length;

                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => handleSelectWorkspace(ws.id)}
                    title={`${ws.name} (${wsBoardCount}/5 boards)`}
                    className={`w-full text-left rounded-lg transition-all flex items-center gap-2.5 ${
                      isCollapsed ? 'p-2 justify-center' : 'p-2'
                    } ${
                      isActive
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium shadow-xs ring-1 ring-zinc-900 dark:ring-zinc-100'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/90 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {/* Workspace Avatar Icon */}
                    <div
                      className={`h-6 w-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 text-white shadow-2xs ${
                        isActive ? 'ring-2 ring-white/40 dark:ring-zinc-900/40' : ''
                      }`}
                      style={{ backgroundColor: ws.color || '#0284c7' }}
                    >
                      {ws.name.charAt(0).toUpperCase()}
                    </div>

                    {!isCollapsed && (
                      <div className="flex-1 truncate">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs truncate block">{ws.name}</span>
                          {isActive && <Check className="h-3 w-3 text-emerald-400 shrink-0" />}
                        </div>
                        <span
                          className={`text-[10px] block truncate ${
                            isActive ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'
                          }`}
                        >
                          {wsBoardCount}/5 boards
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Create Workspace Button (MVP Max 3) */}
            <div className="mt-1.5">
              {canCreateWorkspace ? (
                <button
                  type="button"
                  onClick={onOpenCreateWorkspace}
                  className={`w-full text-left rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 ${
                    isCollapsed ? 'p-2 justify-center' : 'px-2.5 py-1.5'
                  }`}
                  title="Create New Workspace (up to 3)"
                >
                  <Plus className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  {!isCollapsed && (
                    <span className="text-xs font-medium truncate">New Workspace</span>
                  )}
                </button>
              ) : (
                !isCollapsed && (
                  <div className="px-2 py-1 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800 rounded-md text-[10px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Info className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="truncate">Max 3 workspaces reached</span>
                  </div>
                )
              )}
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          {/* SECTION 2: BOARDS IN ACTIVE WORKSPACE */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              {!isCollapsed ? (
                <>
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 dark:text-zinc-500 truncate">
                    Boards ({activeWorkspace?.name || 'Current'})
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                      activeWorkspaceBoards.length >= 5
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                    }`}
                    title="MVP Quota: Up to 5 boards per workspace"
                  >
                    {activeWorkspaceBoards.length}/5
                  </span>
                </>
              ) : (
                <div className="w-full text-center">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                    {activeWorkspaceBoards.length}/5
                  </span>
                </div>
              )}
            </div>

            {/* Boards List */}
            <div className="space-y-0.5">
              {activeWorkspaceBoards.map((b) => {
                const isCurrentBoard = activeBoard?.id === b.id && activeScreen === 'board';

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelectBoard(b.id)}
                    title={b.name}
                    className={`w-full text-left rounded-md transition-colors flex items-center gap-2 ${
                      isCollapsed ? 'p-2 justify-center' : 'px-2 py-1.5'
                    } ${
                      isCurrentBoard
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold border-l-2 border-zinc-900 dark:border-zinc-100'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <Kanban
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isCurrentBoard ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="text-xs truncate flex-1">{b.name}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Add Board in Workspace Button (MVP Max 5) */}
            <div className="mt-1.5">
              {canCreateBoard ? (
                <button
                  type="button"
                  onClick={onOpenCreateBoard}
                  className={`w-full text-left rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 ${
                    isCollapsed ? 'p-2 justify-center' : 'px-2.5 py-1.5'
                  }`}
                  title={`Add Board to ${activeWorkspace?.name || 'Workspace'} (up to 5)`}
                >
                  <Plus className="h-3 w-3 text-zinc-500 shrink-0" />
                  {!isCollapsed && (
                    <span className="text-xs font-medium truncate">New Board</span>
                  )}
                </button>
              ) : (
                !isCollapsed && (
                  <div className="px-2 py-1 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800 rounded-md text-[10px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Info className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="truncate">Max 5 boards reached</span>
                  </div>
                )
              )}
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          {/* SECTION 3: NAVIGATION VIEWS */}
          <div>
            {!isCollapsed && (
              <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 dark:text-zinc-500 px-2 block mb-1">
                Views & Analytics
              </span>
            )}
            <div className="space-y-0.5">
              {/* Active Board */}
              <button
                type="button"
                onClick={() => {
                  onNavigateScreen('board');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full text-left rounded-md transition-colors flex items-center gap-2 ${
                  isCollapsed ? 'p-2 justify-center' : 'px-2 py-1.5'
                } ${
                  activeScreen === 'board'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}
                title="Active Board View"
              >
                <Kanban className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                {!isCollapsed && <span className="text-xs">Kanban Board</span>}
              </button>

              {/* Boards Hub Directory */}
              <button
                type="button"
                onClick={() => {
                  onNavigateScreen('boards-management');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full text-left rounded-md transition-colors flex items-center gap-2 ${
                  isCollapsed ? 'p-2 justify-center' : 'px-2 py-1.5'
                } ${
                  activeScreen === 'boards-management'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}
                title="Boards Hub Directory"
              >
                <FolderKanban className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                {!isCollapsed && <span className="text-xs">Boards Hub</span>}
              </button>

              {/* Timeline Management */}
              <button
                type="button"
                onClick={() => {
                  onNavigateScreen('timeline');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full text-left rounded-md transition-colors flex items-center gap-2 ${
                  isCollapsed ? 'p-2 justify-center' : 'px-2 py-1.5'
                } ${
                  activeScreen === 'timeline'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}
                title="Timeline Management & Gantt Bars"
              >
                <Calendar className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1">
                    <span className="text-xs">Timeline</span>
                    <span className="text-[9px] bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-1.5 py-0.2 rounded font-medium border border-sky-200 dark:border-sky-800">
                      New
                    </span>
                  </div>
                )}
              </button>

              {/* Weekly Report */}
              <button
                type="button"
                onClick={() => {
                  onNavigateScreen('weekly-report');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full text-left rounded-md transition-colors flex items-center gap-2 ${
                  isCollapsed ? 'p-2 justify-center' : 'px-2 py-1.5'
                } ${
                  activeScreen === 'weekly-report'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}
                title="Weekly Checkpoint Report"
              >
                <BarChart3 className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1">
                    <span className="text-xs">Weekly Report</span>
                    <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-medium border border-emerald-200 dark:border-emerald-800">
                      Live
                    </span>
                  </div>
                )}
              </button>

              {/* Board Documents */}
              <button
                type="button"
                onClick={() => {
                  onNavigateScreen('documents');
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full text-left rounded-md transition-colors flex items-center gap-2 ${
                  isCollapsed ? 'p-2 justify-center' : 'px-2 py-1.5'
                } ${
                  activeScreen === 'documents'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}
                title="Board Documents & Shareable Specs"
              >
                <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1">
                    <span className="text-xs">Documents</span>
                    <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded font-medium border border-indigo-200 dark:border-indigo-800">
                      Docs
                    </span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 4: FOOTER QUOTA & USER INFO */}
        <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2">
          {!isCollapsed && (
            <div className="rounded-md bg-white dark:bg-zinc-800 p-2 border border-zinc-200/70 dark:border-zinc-700 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span className="flex items-center gap-1 font-medium">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  <span>MVP Tier</span>
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Limits Enforced</span>
              </div>
              <div className="space-y-1 pt-0.5">
                <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span>Workspaces:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{workspaces.length} / 3</span>
                </div>
                <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full"
                    style={{ width: `${(workspaces.length / 3) * 100}%` }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400 pt-0.5">
                  <span>Boards in active:</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {activeWorkspaceBoards.length} / 5
                  </span>
                </div>
                <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-600 rounded-full"
                    style={{ width: `${(activeWorkspaceBoards.length / 5) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* User Sign Out */}
          <div className="flex items-center justify-between pt-1">
            {!isCollapsed ? (
              <div className="truncate flex-1 pr-2">
                <span className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 block truncate">
                  {userEmail || 'Demo User'}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block truncate">
                  {activeWorkspace?.name}
                </span>
              </div>
            ) : null}

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="p-1.5 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
