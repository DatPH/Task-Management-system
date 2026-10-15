import React, { useState, useMemo } from 'react';
import {
  Calendar,
  User,
  Pencil,
  MessageSquare,
  Search,
  ArrowUpDown,
  Filter,
  Plus,
  Clock,
  AlertCircle,
  Link2,
  Link2Off,
} from 'lucide-react';
import type { ColumnWithTasks, TaskWithAssignee, Priority } from '../../types';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useKanbanStore } from '../../store/useKanbanStore';
import { getTaskCode, matchesTaskId } from '../../utils/taskId';
import { tokenize } from '../../utils/taskSearchIndex';
import { TaskDependencyMark, getTaskDependencyInfo } from '../TaskDependencyMark';

interface TaskListViewProps {
  columns: ColumnWithTasks[];
  onEditTask: (task: TaskWithAssignee) => void;
  onAddTask: () => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  columns,
  onEditTask,
  onAddTask,
}) => {
  const { updateTask, comments } = useKanbanStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedColumnFilter, setSelectedColumnFilter] = useState<string>('ALL');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('ALL');
  const [selectedDependencyFilter, setSelectedDependencyFilter] = useState<
    'ALL' | 'WITH_DEPS' | 'INDEPENDENT' | 'BLOCKED'
  >('ALL');
  const [sortBy, setSortBy] = useState<'deadline' | 'priority' | 'stage' | 'created'>('stage');

  // Flatten all tasks across columns with column metadata
  const allTasks = useMemo(() => {
    const list: Array<TaskWithAssignee & { columnName: string; columnOrder: number }> = [];
    columns.forEach((col) => {
      col.tasks.forEach((task) => {
        list.push({
          ...task,
          columnName: col.name,
          columnOrder: col.order_index,
        });
      });
    });
    return list;
  }, [columns]);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();
    const searchTokens = tokenize(cleanSearch);

    return allTasks
      .filter((task) => {
        let matchesSearch = true;
        if (cleanSearch) {
          const isIdMatch = matchesTaskId(task, cleanSearch);
          const isTitleDirectMatch = task.title.toLowerCase().includes(cleanSearch);
          const isAnyWordMatch = searchTokens.some((tok) =>
            task.title.toLowerCase().includes(tok)
          );
          const isDescMatch = task.description
            ? task.description.toLowerCase().includes(cleanSearch)
            : false;
          const isAssigneeMatch = task.assignee?.full_name
            ? task.assignee.full_name.toLowerCase().includes(cleanSearch)
            : false;

          matchesSearch =
            isIdMatch || isTitleDirectMatch || isAnyWordMatch || isDescMatch || isAssigneeMatch;
        }

        const matchesCol =
          selectedColumnFilter === 'ALL' || task.column_id === selectedColumnFilter;

        const matchesPriority =
          selectedPriorityFilter === 'ALL' || task.priority === selectedPriorityFilter;

        const depInfo = getTaskDependencyInfo(task, columns);
        let matchesDep = true;
        if (selectedDependencyFilter === 'WITH_DEPS') {
          matchesDep = depInfo.hasDependencies;
        } else if (selectedDependencyFilter === 'INDEPENDENT') {
          matchesDep = !depInfo.hasDependencies;
        } else if (selectedDependencyFilter === 'BLOCKED') {
          matchesDep = depInfo.hasDependencies && depInfo.isBlocked;
        }

        return matchesSearch && matchesCol && matchesPriority && matchesDep;
      })
      .sort((a, b) => {
        if (sortBy === 'deadline') {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        if (sortBy === 'priority') {
          const priorityWeights: Record<Priority, number> = { High: 3, Medium: 2, Low: 1 };
          return (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
        }
        if (sortBy === 'stage') {
          return a.columnOrder - b.columnOrder;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [allTasks, searchTerm, selectedColumnFilter, selectedPriorityFilter, selectedDependencyFilter, sortBy, columns]);

  const formatDeadline = (dateStr: string | null) => {
    if (!dateStr) return { formatted: 'No date', isOverdue: false };
    try {
      const d = new Date(dateStr);
      const isOverdue = d.getTime() < Date.now() && d.toDateString() !== new Date().toDateString();
      return {
        formatted: d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        }),
        isOverdue,
      };
    } catch {
      return { formatted: dateStr, isOverdue: false };
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return null;
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleQuickStatusChange = async (task: TaskWithAssignee, newColId: string) => {
    if (newColId === task.column_id) return;
    await updateTask({
      ...task,
      column_id: newColId,
      updated_at: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
      {/* Top Filter Bar */}
      <div className="p-4 border-b border-zinc-200 bg-zinc-50/60 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search tasks, descriptions, members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-xs h-9 bg-white"
          />
        </div>

        {/* Filters and Sort */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Column Filter */}
          <select
            value={selectedColumnFilter}
            onChange={(e) => setSelectedColumnFilter(e.target.value)}
            className="h-9 px-2.5 text-xs font-medium bg-white border border-zinc-200 rounded-lg text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="ALL">All Stages ({allTasks.length})</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.tasks.length})
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriorityFilter}
            onChange={(e) => setSelectedPriorityFilter(e.target.value)}
            className="h-9 px-2.5 text-xs font-medium bg-white border border-zinc-200 rounded-lg text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="ALL">All Priorities</option>
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>

          {/* Dependency Type Filter */}
          <select
            value={selectedDependencyFilter}
            onChange={(e) => setSelectedDependencyFilter(e.target.value as any)}
            className="h-9 px-2.5 text-xs font-medium bg-white border border-zinc-200 rounded-lg text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="ALL">Dependencies: All Types</option>
            <option value="WITH_DEPS">With Dependencies</option>
            <option value="INDEPENDENT">Without Dependencies (Independent)</option>
            <option value="BLOCKED">Blocked Dependencies Only</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-9 px-2.5 text-xs font-medium bg-white border border-zinc-200 rounded-lg text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="stage">Sort: Workflow Stage</option>
            <option value="priority">Sort: Priority Level</option>
            <option value="deadline">Sort: Due Date</option>
            <option value="created">Sort: Recently Created</option>
          </select>

          <Button onClick={onAddTask} size="sm" className="h-9 text-xs gap-1.5 px-3">
            <Plus className="h-3.5 w-3.5" />
            <span>New Task</span>
          </Button>
        </div>
      </div>

      {/* Task List / Table Rows */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">
            <p className="text-sm font-medium text-zinc-600">No tasks match your filters</p>
            <p className="text-xs text-zinc-400 mt-1">
              Try adjusting your search criteria or create a new task.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/90 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-4/12">Task Title</th>
                <th className="py-3 px-3 w-1.5/12">Stage</th>
                <th className="py-3 px-3 w-1/12">Priority</th>
                <th className="py-3 px-3 w-2.5/12">Dependency Mark</th>
                <th className="py-3 px-3 w-1.5/12">Assignee</th>
                <th className="py-3 px-3 w-1/12">Due Date</th>
                <th className="py-3 px-4 w-0.5/12 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs text-zinc-700">
              {filteredTasks.map((task) => {
                const { formatted: deadlineFormatted, isOverdue } = formatDeadline(task.deadline);
                const initials = getInitials(task.assignee?.full_name);
                const taskComments = comments[task.id] || task.comments || [];
                const priorityVariant = (task.priority?.toLowerCase() || 'medium') as
                  | 'low'
                  | 'medium'
                  | 'high';

                return (
                  <tr
                    key={task.id}
                    onClick={() => onEditTask(task)}
                    className="hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Task Title & Description */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 border border-zinc-200/80 shrink-0">
                            {getTaskCode(task)}
                          </span>
                          <span className="font-semibold text-zinc-900 group-hover:text-black leading-snug">
                            {task.title}
                          </span>
                        </div>
                        {task.description && (
                          <span className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5 pl-0.5">
                            {task.description}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Stage Dropdown */}
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={task.column_id}
                        onChange={(e) => handleQuickStatusChange(task, e.target.value)}
                        className="text-xs font-medium px-2 py-1 bg-zinc-100/90 hover:bg-zinc-200/80 rounded-md border border-zinc-200 text-zinc-800 focus:outline-none cursor-pointer"
                      >
                        {columns.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Priority Badge */}
                    <td className="py-3 px-3">
                      <Badge variant={priorityVariant} className="text-[11px] px-2 py-0.5">
                        {task.priority || 'Medium'}
                      </Badge>
                    </td>

                    {/* Mark for Task With Dependency vs Without Dependency */}
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      <TaskDependencyMark
                        task={task}
                        columns={columns}
                        variant="badge"
                        onClick={() => onEditTask(task)}
                      />
                    </td>

                    {/* Assignee */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5 border-zinc-200">
                          <AvatarFallback className="text-[9px] bg-zinc-100 text-zinc-700">
                            {initials || <User className="h-2.5 w-2.5 text-zinc-400" />}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-zinc-700 truncate max-w-[120px]">
                          {task.assignee?.full_name || 'Unassigned'}
                        </span>
                      </div>
                    </td>

                    {/* Due Date */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${
                          isOverdue
                            ? 'text-rose-700 bg-rose-50 border border-rose-200/80'
                            : 'text-zinc-500 bg-zinc-50 border border-zinc-200/50'
                        }`}
                      >
                        <Calendar className="h-3 w-3" />
                        {deadlineFormatted}
                      </span>
                    </td>

                    {/* Actions: Comments & Pencil Edit */}
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Comment pill */}
                        <button
                          type="button"
                          onClick={() => onEditTask(task)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
                            taskComments.length > 0
                              ? 'bg-zinc-100 text-zinc-700 font-medium hover:bg-zinc-200'
                              : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                          }`}
                          title={`${taskComments.length} comment${
                            taskComments.length === 1 ? '' : 's'
                          }`}
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>{taskComments.length}</span>
                        </button>

                        {/* Pencil Edit Icon */}
                        <button
                          type="button"
                          onClick={() => onEditTask(task)}
                          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                          title="Edit task details"
                          aria-label="Edit task details"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Status */}
      <div className="px-4 py-2.5 bg-zinc-50 border-t border-zinc-200 text-xs text-zinc-500 flex items-center justify-between">
        <span>
          Showing {filteredTasks.length} of {allTasks.length} total tasks
        </span>
        <span className="text-[11px] text-zinc-400">Click any row to open details and edit</span>
      </div>
    </div>
  );
};
