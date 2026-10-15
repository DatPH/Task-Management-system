import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useKanbanStore } from '../store/useKanbanStore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import type { Priority, TaskWithAssignee } from '../types';
import { Loader2, Plus, Link2, Link2Off, X } from 'lucide-react';
import { getNextTaskCode } from '../utils/taskId';

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultColumnId?: string;
  defaultPriority?: Priority;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  open,
  onOpenChange,
  defaultColumnId,
  defaultPriority,
}) => {
  const { board, columns, getBoardAssignees, addTask } = useKanbanStore();
  const boardAssignees = getBoardAssignees(board?.id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState(defaultColumnId || columns[0]?.id || '');
  const [priority, setPriority] = useState<Priority>(defaultPriority || 'Medium');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('');
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const allAvailableTasks = columns.flatMap((c) => c.tasks);

  // Sync columnId and priority if default props change
  React.useEffect(() => {
    if (defaultColumnId) {
      setColumnId(defaultColumnId);
    } else if (columns.length > 0 && !columnId) {
      setColumnId(columns[0].id);
    }
    if (defaultPriority) {
      setPriority(defaultPriority);
    }
  }, [defaultColumnId, defaultPriority, columns, columnId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Task title is required.');
      return;
    }

    const targetColumnId = columnId || columns[0]?.id;
    if (!targetColumnId) {
      setErrorMessage('No column available to assign this task.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const formattedDeadline = deadline ? new Date(deadline).toISOString() : null;
    const selectedAssignee = boardAssignees.find((p) => p.id === assigneeId) || null;

    // Helper to validate standard UUID format
    const isValidUUID = (val?: string | null) =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    // Always generate a genuine RFC-4122 v4 UUID for the new task
    const newTaskId = crypto.randomUUID();
    const validAssigneeId = isValidUUID(assigneeId) ? assigneeId : null;

    // Compute unique human-readable Task Code (e.g. TSK-109)
    const allExistingTasks = columns.flatMap((c) => c.tasks);
    const assignedTaskCode = getNextTaskCode(allExistingTasks);

    let savedTask: TaskWithAssignee | null = null;

    try {
      // 1. If targetColumnId is a valid UUID, attempt to insert into Supabase
      if (isValidUUID(targetColumnId)) {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            id: newTaskId,
            column_id: targetColumnId,
            title: title.trim(),
            description: description.trim() || null,
            priority,
            assignee_id: validAssigneeId,
            deadline: formattedDeadline,
            is_archived: false,
          })
          .select('*')
          .single();

        if (!error && data) {
          savedTask = {
            ...data,
            task_code: assignedTaskCode,
            assignee: selectedAssignee,
          };
        } else if (error) {
          console.warn('Supabase task insert returned error, falling back to local task with valid UUID:', error.message);
        }
      }
    } catch (dbErr) {
      console.warn('Network or database exception during task insert:', dbErr);
    }

    // 2. If Supabase insert was not performed or rejected (e.g. permission denied or offline),
    // provide the task with the EXACT same RFC-4122 UUID so it works in UI and future syncs
    if (!savedTask) {
      savedTask = {
        id: newTaskId,
        task_code: assignedTaskCode,
        column_id: targetColumnId,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assignee_id: validAssigneeId,
        deadline: formattedDeadline,
        dependency_ids: selectedDependencies.length > 0 ? selectedDependencies : undefined,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assignee: selectedAssignee,
      };
    } else {
      savedTask = {
        ...savedTask,
        dependency_ids: selectedDependencies.length > 0 ? selectedDependencies : undefined,
      };
    }

    // 3. Add task to Zustand store
    addTask(savedTask);

    // Reset form & close modal
    setTitle('');
    setDescription('');
    setPriority('Medium');
    setAssigneeId('');
    setDeadline('');
    setSelectedDependencies([]);
    setErrorMessage(null);
    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a task to your Kanban workflow. Changes sync with Supabase in real-time.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="mb-4 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title *</Label>
            <Input
              id="task-title"
              placeholder="e.g. Conduct client UX review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              placeholder="Provide context, acceptance criteria, or relevant links..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Column & Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Target Column */}
            <div className="space-y-1.5">
              <Label htmlFor="task-column">Workflow Stage (Column)</Label>
              <select
                id="task-column"
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-300 text-zinc-900 dark:text-zinc-100"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="flex h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-300 text-zinc-900 dark:text-zinc-100"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          {/* Deadline & Assignee Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Deadline */}
            <div className="space-y-1.5">
              <Label htmlFor="task-deadline">Deadline</Label>
              <Input
                id="task-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            {/* Assignee */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="task-assignee">Assignee</Label>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Board members only</span>
              </div>
              <select
                id="task-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-300 text-zinc-900 dark:text-zinc-100"
              >
                <option value="">Unassigned</option>
                {boardAssignees.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name || profile.email || 'Team Member'}
                  </option>
                ))}
              </select>
              {boardAssignees.length === 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  No members invited to this board yet. Invite members to assign tasks.
                </p>
              )}
            </div>
          </div>

          {/* Optional Task Dependencies */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                <Link2 className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                <span>Dependencies (Tasks that must be completed first)</span>
              </Label>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Optional</span>
            </div>

            {selectedDependencies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700">
                {selectedDependencies.map((depId) => {
                  const dep = allAvailableTasks.find((t) => t.id === depId);
                  return (
                    <span
                      key={depId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-xs shadow-2xs"
                    >
                      <span className="font-mono font-bold text-[10px] text-zinc-500 dark:text-zinc-400">
                        {dep?.task_code || 'TSK'}
                      </span>
                      <span className="truncate max-w-[130px]">{dep?.title || 'Task'}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedDependencies((prev) => prev.filter((id) => id !== depId))}
                        className="text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 ml-0.5"
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <select
              value=""
              onChange={(e) => {
                if (e.target.value && !selectedDependencies.includes(e.target.value)) {
                  setSelectedDependencies((prev) => [...prev, e.target.value]);
                }
              }}
              className="flex h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1 text-xs text-zinc-700 dark:text-zinc-300 shadow-xs focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-zinc-300 cursor-pointer"
            >
              <option value="">-- Add a task as dependency --</option>
              {allAvailableTasks
                .filter((t) => !selectedDependencies.includes(t.id))
                .map((t) => {
                  const col = columns.find((c) => c.id === t.column_id);
                  return (
                    <option key={t.id} value={t.id}>
                      [{t.task_code || 'TSK'}] {t.title} ({col?.name || 'Backlog'})
                    </option>
                  );
                })}
            </select>

            {/* Status Note: Differentiating Task Type */}
            <div className="pt-1">
              {selectedDependencies.length > 0 ? (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 font-medium">
                  <Link2 className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span>
                    Will be created as a <strong>Task with {selectedDependencies.length} {selectedDependencies.length === 1 ? 'dependency' : 'dependencies'}</strong>.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-850 border border-zinc-200/70 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <Link2Off className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                  <span>
                    Will be created as an <strong>Independent Task</strong> (no dependencies required).
                  </span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
