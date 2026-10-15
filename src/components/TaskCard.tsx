import React, { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Calendar, User, Pencil, MessageSquare, Hash, Check, Paperclip } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import type { TaskWithAssignee } from '../types';
import { useKanbanStore } from '../store/useKanbanStore';
import { getTaskCode, getTaskShareUrl } from '../utils/taskId';
import { TaskDependencyMark, getTaskDependencyInfo } from './TaskDependencyMark';

interface TaskCardProps {
  task: TaskWithAssignee;
  index: number;
  onEdit?: (task: TaskWithAssignee) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, index, onEdit }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const storeComments = useKanbanStore((s) => s.comments[task.id]);
  const columns = useKanbanStore((s) => s.columns);
  const allComments = storeComments ?? task.comments ?? [];
  const commentCount = allComments.length;
  const attachmentCount = allComments.reduce((acc, c) => acc + (c.attachments?.length || 0), 0);
  const taskCode = getTaskCode(task);

  // Dependency information
  const depInfo = getTaskDependencyInfo(task, columns);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getTaskShareUrl(task);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    }
  };

  // Format deadline date cleanly
  const formatDeadline = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Get user avatar initials
  const getInitials = (name?: string | null) => {
    if (!name) return null;
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formattedDeadline = formatDeadline(task.deadline);
  const initials = getInitials(task.assignee?.full_name);

  // Map priority to badge variant
  const priorityVariant = (task.priority?.toLowerCase() || 'medium') as 'low' | 'medium' | 'high';

  // Accent class for the left border to immediately distinguish task dependency state
  const borderAccentClass = depInfo.hasDependencies
    ? depInfo.isBlocked
      ? 'border-l-4 border-l-amber-500'
      : 'border-l-4 border-l-emerald-500'
    : 'border-l-4 border-l-zinc-300 dark:border-l-zinc-700';

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-2.5 focus:outline-none"
        >
          <Card
            onClick={() => onEdit?.(task)}
            className={`group relative border border-zinc-200/90 dark:border-zinc-800 ${borderAccentClass} bg-white dark:bg-zinc-900 p-3.5 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-zinc-950/60 cursor-grab active:cursor-grabbing ${
              snapshot.isDragging ? 'shadow-xl ring-2 ring-zinc-900/10 dark:ring-zinc-100/20 rotate-1' : ''
            }`}
          >
            {/* Top Bar: Task ID Badge, Priority Badge, Dependency Mark, and Actions */}
            <div className="flex items-center justify-between gap-1.5 mb-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                {/* Unique Task ID with Hash Copy Tooltip */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 transition-colors"
                  title={`Task ID: ${taskCode} - Click to copy hash link (#${taskCode})`}
                >
                  <Hash className="h-2.5 w-2.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                  <span>{taskCode}</span>
                  {copiedLink && <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 ml-0.5 shrink-0" />}
                </button>

                <Badge variant={priorityVariant} className="capitalize text-[10px] px-1.5 py-0.2 shrink-0">
                  {task.priority || 'Medium'}
                </Badge>

                {/* Mark for task with dependency vs without dependency */}
                <TaskDependencyMark
                  task={task}
                  columns={columns}
                  variant="compact"
                />
              </div>

              <button
                type="button"
                className="opacity-70 group-hover:opacity-100 transition-opacity p-1 -mr-1 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Edit task details"
                title="Edit task details & discussion"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(task);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Task Title */}
            <h4
              title={task.title}
              className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2 select-none mb-1.5 group-hover:text-zinc-950 dark:group-hover:text-white"
            >
              {task.title}
            </h4>

            {/* Optional Task Description Preview */}
            {task.description && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-3 select-none">
                {task.description}
              </p>
            )}

            {/* Card Footer: Metadata & Assignee */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {/* Deadline & Comments Indicator */}
              <div className="flex items-center gap-2">
                {formattedDeadline && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium bg-zinc-50 dark:bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-700"
                    title={`Deadline: ${task.deadline}`}
                  >
                    <Calendar className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                    {formattedDeadline}
                  </span>
                )}

                {/* Comments Count Indicator */}
                {commentCount > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-300 font-medium bg-zinc-100/80 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md border border-zinc-200/60 dark:border-zinc-700 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 transition-colors"
                    title={`${commentCount} comment${commentCount === 1 ? '' : 's'}`}
                  >
                    <MessageSquare className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                    {commentCount}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(task);
                    }}
                    className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-opacity"
                    title="Add comment"
                  >
                    <MessageSquare className="h-3 w-3" />
                  </button>
                )}

                {/* Attachments Count Indicator */}
                {attachmentCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-300 font-medium bg-zinc-100/80 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md border border-zinc-200/60 dark:border-zinc-700 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 transition-colors"
                    title={`${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`}
                  >
                    <Paperclip className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                    {attachmentCount}
                  </span>
                )}

                {/* Mark for Task With Dependency vs Task Without Dependency (Independent) */}
                <TaskDependencyMark
                  task={task}
                  columns={columns}
                  variant="badge"
                />
              </div>

              {/* Assignee Avatar */}
              <div className="flex items-center">
                <Avatar
                  className="h-6 w-6 border-zinc-200 dark:border-zinc-700"
                  title={task.assignee?.full_name || (task.assignee_id ? 'Assigned member' : 'Unassigned')}
                >
                  <AvatarFallback className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {initials || <User className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </Card>
        </div>
      )}
    </Draggable>
  );
};
