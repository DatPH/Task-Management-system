import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  User,
  MessageSquare,
  Send,
  Trash2,
  CheckCircle2,
  Clock,
  Tag,
  AlertTriangle,
  Hash,
  Link2,
  Link2Off,
  Check,
  Plus,
} from 'lucide-react';
import { useKanbanStore } from '../store/useKanbanStore';
import type { TaskWithAssignee, Priority, CommentAttachment } from '../types';
import { CommentAttachmentViewer } from './CommentAttachmentViewer';
import { CommentAttachmentUploader } from './CommentAttachmentUploader';
import { TaskDependencyMark } from './TaskDependencyMark';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { getTaskCode, getTaskShareUrl, setTaskUrlHash, clearTaskUrlHash } from '../utils/taskId';

interface TaskDetailModalProps {
  task: TaskWithAssignee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserEmail?: string | null;
  onSelectTask?: (task: TaskWithAssignee) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  open,
  onOpenChange,
  currentUserEmail,
  onSelectTask,
}) => {
  const {
    board,
    columns,
    getBoardAssignees,
    profiles,
    updateTask,
    deleteTask,
    addComment,
    deleteCommentAttachment,
    deleteComment,
    comments,
  } = useKanbanStore();
  const boardAssignees = getBoardAssignees(board?.id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [dependencyIds, setDependencyIds] = useState<string[]>([]);
  const [selectedDepIdToAdd, setSelectedDepIdToAdd] = useState<string>('');

  const [newCommentText, setNewCommentText] = useState('');
  const [stagedAttachments, setStagedAttachments] = useState<CommentAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentToast, setAttachmentToast] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  // Sync and clean hash URL when modal opens or closes
  useEffect(() => {
    if (open && task) {
      setTaskUrlHash(task);
    }
    return () => {
      clearTaskUrlHash();
    };
  }, [open, task]);

  const handleClose = () => {
    clearTaskUrlHash();
    onOpenChange(false);
  };

  const handleCopyHashUrl = () => {
    if (!task) return;
    const url = getTaskShareUrl(task);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2000);
    }
  };

  // Sync form inputs when active task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setColumnId(task.column_id || (columns[0]?.id ?? ''));
      setPriority(task.priority || 'Medium');
      setAssigneeId(task.assignee_id || '');
      // Format deadline for input type="date"
      if (task.deadline) {
        try {
          const d = new Date(task.deadline);
          setDeadline(d.toISOString().split('T')[0]);
        } catch {
          setDeadline('');
        }
      } else {
        setDeadline('');
      }
      setDependencyIds(task.dependency_ids || []);
      setSelectedDepIdToAdd('');
      setError(null);
      setShowDeleteConfirm(false);
      setNewCommentText('');
      setStagedAttachments([]);
      setAttachmentError(null);
    }
  }, [task, columns]);

  if (!open || !task) return null;

  // Real-time comments for this task from store
  const taskComments = comments[task.id] || task.comments || [];

  // All tasks on board for dependency resolution
  const allBoardTasks = columns.flatMap((col) => col.tasks);

  // Helper to determine if a task is in a completed stage
  const isTaskCompleted = (t: TaskWithAssignee) => {
    const col = columns.find((c) => c.id === t.column_id);
    return col
      ? col.name.toLowerCase().includes('complet') || col.name.toLowerCase().includes('done')
      : false;
  };

  // Resolved dependency tasks (must be completed first)
  const dependencyTasks = dependencyIds
    .map((id) => allBoardTasks.find((t) => t.id === id))
    .filter(Boolean) as TaskWithAssignee[];

  const unresolvedDependencies = dependencyTasks.filter((t) => !isTaskCompleted(t));
  const isBlocked = unresolvedDependencies.length > 0;

  // Reverse dependencies: tasks that list this task as a dependency
  const tasksWaitingOnThis = allBoardTasks.filter((t) =>
    (t.dependency_ids || []).includes(task.id)
  );

  // Eligible tasks to add as dependency
  const availableCandidates = allBoardTasks.filter((t) => {
    if (t.id === task.id) return false;
    if (dependencyIds.includes(t.id)) return false;
    return true;
  });

  const handleAddDependency = (depIdToAdd?: string) => {
    const targetId = depIdToAdd || selectedDepIdToAdd;
    if (!targetId) return;
    if (dependencyIds.includes(targetId)) return;
    setDependencyIds((prev) => [...prev, targetId]);
    setSelectedDepIdToAdd('');
  };

  const handleRemoveDependency = (depIdToRemove: string) => {
    setDependencyIds((prev) => prev.filter((id) => id !== depIdToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title cannot be blank.');
      return;
    }

    setIsSaving(true);
    try {
      const selectedAssignee =
        boardAssignees.find((p) => p.id === assigneeId) ||
        profiles.find((p) => p.id === assigneeId) ||
        null;
      const formattedDeadline = deadline ? new Date(deadline).toISOString() : null;

      const updatedTask: TaskWithAssignee = {
        ...task,
        title: title.trim(),
        description: description.trim() || null,
        column_id: columnId,
        priority,
        assignee_id: assigneeId || null,
        deadline: formattedDeadline,
        dependency_ids: dependencyIds,
        assignee: selectedAssignee,
        updated_at: new Date().toISOString(),
      };

      await updateTask(updatedTask);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCommentText.trim();
    if (!trimmed && stagedAttachments.length === 0) return;

    setIsSubmittingComment(true);
    setAttachmentError(null);
    try {
      // Find current user's profile or default to email/guest
      const currentProfile = profiles.find((p) => p.email === currentUserEmail);
      const authorName = currentProfile?.full_name || currentUserEmail?.split('@')[0] || 'You';

      const commentContent =
        trimmed ||
        (stagedAttachments.length === 1
          ? `Attached: ${stagedAttachments[0].name}`
          : `Attached ${stagedAttachments.length} files`);

      await addComment(
        task.id,
        commentContent,
        authorName,
        currentUserEmail,
        stagedAttachments
      );
      setNewCommentText('');
      setStagedAttachments([]);
    } catch (err) {
      console.error('Failed to post comment', err);
      setAttachmentError('Failed to post comment with attachments. Please try again.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleRemoveCommentAttachment = async (commentId: string, attachmentId: string) => {
    try {
      await deleteCommentAttachment(task.id, commentId, attachmentId);
      setAttachmentToast('Attachment successfully removed from database');
      setTimeout(() => setAttachmentToast(null), 3000);
    } catch (err) {
      console.error('Failed to delete attachment', err);
      setAttachmentError('Failed to remove attachment from database.');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTask(task.id);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatCommentDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const currentColumn = columns.find((c) => c.id === (columnId || task.column_id));

  const taskCode = getTaskCode(task);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/50 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div className="relative z-50 w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-zinc-900 dark:text-zinc-100">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Task ID Pill */}
            <div
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 dark:bg-zinc-800 text-amber-300 font-mono text-xs font-bold shadow-2xs border border-zinc-800 dark:border-zinc-700"
              title={`Unique Task ID: ${taskCode}`}
            >
              <Hash className="h-3 w-3 text-amber-400" />
              <span>{taskCode}</span>
            </div>

            <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">/</span>

            <Badge variant="outline" className="text-xs font-medium bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700">
              {currentColumn?.name || 'Status'}
            </Badge>

            {/* Mark for task with dependency vs without dependency */}
            <TaskDependencyMark
              task={task}
              columns={columns}
              variant="pill"
            />

            {/* Share Hash URL Button */}
            <button
              type="button"
              onClick={handleCopyHashUrl}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors shadow-2xs"
              title={`Copy URL ending with #${taskCode}`}
            >
              {copiedShareLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Copied URL!</span>
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span className="hidden sm:inline">Copy Hash URL</span>
                  <span className="sm:hidden">Share</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors ml-auto"
            title="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body - Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Edit Form */}
          <form id="task-edit-form" onSubmit={handleSave} className="space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="task-title-input" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Task Title <span className="text-rose-500">*</span>
              </label>
              <Input
                id="task-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Audit customer data retention"
                className="text-sm font-medium focus:ring-zinc-900 dark:focus:ring-zinc-300"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="task-desc-input" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Description & Notes
              </label>
              <Textarea
                id="task-desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add context, subtasks, acceptance criteria, or external links..."
                rows={3}
                className="text-xs leading-relaxed resize-y"
              />
            </div>

            {/* Metadata Grid: Column/Stage, Priority, Assignee, Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {/* Column / Stage */}
              <div>
                <label htmlFor="task-column-select" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Workflow Stage
                </label>
                <select
                  id="task-column-select"
                  value={columnId}
                  onChange={(e) => setColumnId(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-300"
                >
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label htmlFor="task-priority-select" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Priority Level
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Low', 'Medium', 'High'] as Priority[]).map((p) => {
                    const isSelected = priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`h-9 px-2 text-xs font-medium rounded-lg border transition-all ${
                          isSelected
                            ? p === 'High'
                              ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-400 dark:border-rose-700 text-rose-800 dark:text-rose-200 font-semibold ring-1 ring-rose-400'
                              : p === 'Medium'
                              ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-200 font-semibold ring-1 ring-amber-400'
                              : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 font-semibold ring-1 ring-emerald-400'
                            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-750'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assignee */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="task-assignee-select" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Assignee
                  </label>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Board members only</span>
                </div>
                <div className="relative">
                  <select
                    id="task-assignee-select"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full h-9 pl-8 pr-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-300"
                  >
                    <option value="">Unassigned</option>
                    {boardAssignees.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name || profile.email || 'Team Member'}
                      </option>
                    ))}
                    {/* Fallback option if task already has an assignee who is not yet in boardAssignees */}
                    {task?.assignee &&
                      !boardAssignees.some((p) => p.id === task.assignee?.id) && (
                        <option value={task.assignee.id}>
                          {task.assignee.full_name || task.assignee.email} (Previous Assignee)
                        </option>
                      )}
                  </select>
                  <User className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
                </div>
                {boardAssignees.length === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    No members invited to this board yet.
                  </p>
                )}
              </div>

              {/* Due Date */}
              <div>
                <label htmlFor="task-deadline-input" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Due Date
                </label>
                <div className="relative">
                  <Input
                    id="task-deadline-input"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>
              </div>
            </div>

            {/* Task Dependencies Section */}
            <div className="pt-3.5 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Task Dependencies ({dependencyTasks.length})
                  </label>
                </div>
                {dependencyTasks.length > 0 && (
                  isBlocked ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                      Blocked ({unresolvedDependencies.length} incomplete)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      All dependencies completed
                    </span>
                  )
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Tasks that this task depends on (must be finished first before work can be completed).
              </p>

              {/* Independent Task Mark Callout when 0 dependencies */}
              {dependencyTasks.length === 0 && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/90 dark:border-zinc-700 text-xs">
                  <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0 border border-zinc-200 dark:border-zinc-700">
                    <Link2Off className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                      Independent Task (No Prerequisites)
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block leading-tight">
                      This task has no dependencies and can be started immediately. If it depends on prior work, link a task below.
                    </span>
                  </div>
                </div>
              )}

              {/* List of active dependencies */}
              {dependencyTasks.length > 0 && (
                <div className="space-y-1.5">
                  {dependencyTasks.map((dep) => {
                    const completed = isTaskCompleted(dep);
                    const depCol = columns.find((c) => c.id === dep.column_id);
                    return (
                      <div
                        key={dep.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-100/70 dark:hover:bg-zinc-800 transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {completed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" title="Dependency resolved" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-500 shrink-0" title="Dependency still pending" />
                          )}
                          <span className="text-[10px] font-mono font-bold bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 shrink-0">
                            {dep.task_code || 'TSK'}
                          </span>
                          <span
                            onClick={() => onSelectTask && onSelectTask(dep)}
                            className="font-medium text-zinc-800 dark:text-zinc-200 truncate cursor-pointer hover:underline"
                            title={`Click to view details: ${dep.title}`}
                          >
                            {dep.title}
                          </span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">
                            ({depCol?.name || 'In Progress'})
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDependency(dep.id)}
                          className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors ml-2"
                          title="Remove dependency"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Dependency Dropdown & Button */}
              <div className="flex items-center gap-2 pt-0.5">
                <select
                  value={selectedDepIdToAdd}
                  onChange={(e) => setSelectedDepIdToAdd(e.target.value)}
                  className="flex-1 h-8.5 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-300 cursor-pointer"
                >
                  <option value="">-- Select a task to link as dependency --</option>
                  {availableCandidates.map((cand) => {
                    const candCol = columns.find((c) => c.id === cand.column_id);
                    return (
                      <option key={cand.id} value={cand.id}>
                        [{cand.task_code || 'TSK'}] {cand.title} ({candCol?.name || 'Backlog'})
                      </option>
                    );
                  })}
                </select>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddDependency()}
                  disabled={!selectedDepIdToAdd}
                  className="h-8.5 text-xs font-semibold gap-1 shrink-0 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Dependency</span>
                </Button>
              </div>

              {/* Reverse Dependencies: Tasks blocked by this task */}
              {tasksWaitingOnThis.length > 0 && (
                <div className="pt-2 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1.5 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300">
                    <span>Blocking {tasksWaitingOnThis.length} other task{tasksWaitingOnThis.length === 1 ? '' : 's'}:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tasksWaitingOnThis.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTask && onSelectTask(t)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors text-[10px]"
                        title={`Click to view: ${t.title}`}
                      >
                        <span className="font-mono font-bold">{t.task_code || 'TSK'}</span>
                        <span className="truncate max-w-[140px]">{t.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </form>

          {/* Section Divider */}
          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Requirement 3: Comments & Team Discussion Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Comments & Activity ({taskComments.length})
                </h3>
              </div>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Direct card collaboration</span>
            </div>

            {/* Toast notification for attachment removal */}
            {attachmentToast && (
              <div className="flex items-center gap-2 p-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-medium">{attachmentToast}</span>
              </div>
            )}

            {/* Comment Thread */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {taskComments.length === 0 ? (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-850 border border-dashed border-zinc-200 dark:border-zinc-750 rounded-xl text-center text-xs text-zinc-400 dark:text-zinc-500">
                  No comments on this task yet. Start the conversation below!
                </div>
              ) : (
                taskComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3 bg-zinc-50/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 rounded-xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px] bg-zinc-800 text-white">
                            {getInitials(comment.author_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                          {comment.author_name}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatCommentDate(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap pl-7">
                      {comment.content}
                    </p>

                    {/* Comment Attachments with View & Remove functionality */}
                    {comment.attachments && comment.attachments.length > 0 && (
                      <CommentAttachmentViewer
                        attachments={comment.attachments}
                        onRemoveAttachment={(attachmentId) =>
                          handleRemoveCommentAttachment(comment.id, attachmentId)
                        }
                        canRemove={true}
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Post Comment Composer with Attachments Uploader */}
            <form onSubmit={handleAddComment} className="pt-2 space-y-2">
              <div className="relative rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus-within:border-zinc-900 dark:focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-900 dark:focus-within:ring-zinc-400 transition-all">
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment(e);
                    }
                  }}
                  placeholder={
                    stagedAttachments.length > 0
                      ? 'Add a note with your attachment(s)... (Press Enter to post)'
                      : 'Write a comment or attach files... (Press Enter to post)'
                  }
                  rows={2}
                  className="w-full p-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none resize-none bg-transparent"
                />

                {/* Staged attachments and upload buttons */}
                <div className="px-2.5 pb-2">
                  <CommentAttachmentUploader
                    stagedAttachments={stagedAttachments}
                    onAddAttachments={(newAtts) => {
                      setStagedAttachments((prev) => [...prev, ...newAtts]);
                    }}
                    onRemoveStagedAttachment={(attId) => {
                      setStagedAttachments((prev) => prev.filter((a) => a.id !== attId));
                    }}
                    error={attachmentError}
                    setError={setAttachmentError}
                    disabled={isSubmittingComment}
                  />
                </div>

                <div className="flex items-center justify-between px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-850 border-t border-zinc-100 dark:border-zinc-750 rounded-b-xl">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Shift + Enter for new line</span>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      (!newCommentText.trim() && stagedAttachments.length === 0) ||
                      isSubmittingComment
                    }
                    className="h-7 text-xs gap-1.5 px-3"
                  >
                    <Send className="h-3 w-3" />
                    <span>Post</span>
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Modal Footer: Cancel / Save Buttons (Requirement 1) */}
        <div className="px-6 py-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80 flex items-center justify-between gap-3">
          {/* Delete action */}
          <div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-600 font-medium">Confirm delete?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-2 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors"
                >
                  Yes, Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Delete this task"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Delete Task</span>
              </button>
            )}
          </div>

          {/* Cancel & Save Options */}
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="text-xs"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="task-edit-form"
              size="sm"
              disabled={isSaving}
              className="text-xs gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-medium shadow-xs"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
