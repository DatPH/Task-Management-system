import React, { useMemo } from 'react';
import {
  Calendar,
  User,
  Pencil,
  MessageSquare,
  AlertTriangle,
  Clock,
  CheckCircle,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { ColumnWithTasks, TaskWithAssignee, Priority } from '../../types';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { useKanbanStore } from '../../store/useKanbanStore';
import { TaskDependencyMark, getTaskDependencyInfo } from '../TaskDependencyMark';

interface PriorityMatrixViewProps {
  columns: ColumnWithTasks[];
  onEditTask: (task: TaskWithAssignee) => void;
  onAddTask: (priority?: Priority) => void;
}

export const PriorityMatrixView: React.FC<PriorityMatrixViewProps> = ({
  columns,
  onEditTask,
  onAddTask,
}) => {
  const { updateTask, comments } = useKanbanStore();

  // Group all tasks by priority
  const { highTasks, mediumTasks, lowTasks } = useMemo(() => {
    const high: Array<TaskWithAssignee & { columnName: string }> = [];
    const medium: Array<TaskWithAssignee & { columnName: string }> = [];
    const low: Array<TaskWithAssignee & { columnName: string }> = [];

    columns.forEach((col) => {
      col.tasks.forEach((task) => {
        const item = { ...task, columnName: col.name };
        if (task.priority === 'High') high.push(item);
        else if (task.priority === 'Low') low.push(item);
        else medium.push(item);
      });
    });

    return { highTasks: high, mediumTasks: medium, lowTasks: low };
  }, [columns]);

  const formatDeadline = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      const isOverdue = d.getTime() < Date.now() && d.toDateString() !== new Date().toDateString();
      return {
        formatted: d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
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

  const handlePriorityShift = async (
    e: React.MouseEvent,
    task: TaskWithAssignee,
    newPriority: Priority
  ) => {
    e.stopPropagation();
    await updateTask({
      ...task,
      priority: newPriority,
      updated_at: new Date().toISOString(),
    });
  };

  const matrixSections = [
    {
      priority: 'High' as Priority,
      title: 'High Priority',
      subtitle: 'Critical, urgent, or blocking tasks requiring immediate focus',
      tasks: highTasks,
      borderClass: 'border-rose-200',
      headerBg: 'bg-rose-50/80',
      headerText: 'text-rose-900',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
      icon: <AlertTriangle className="h-4 w-4 text-rose-600" />,
    },
    {
      priority: 'Medium' as Priority,
      title: 'Medium Priority',
      subtitle: 'Important operational deliverables and active sprint milestones',
      tasks: mediumTasks,
      borderClass: 'border-amber-200',
      headerBg: 'bg-amber-50/80',
      headerText: 'text-amber-900',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: <Clock className="h-4 w-4 text-amber-600" />,
    },
    {
      priority: 'Low' as Priority,
      title: 'Low Priority',
      subtitle: 'Maintenance, routine backlogs, and non-blocking roadmap tasks',
      tasks: lowTasks,
      borderClass: 'border-emerald-200',
      headerBg: 'bg-emerald-50/80',
      headerText: 'text-emerald-900',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: <CheckCircle className="h-4 w-4 text-emerald-600" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full overflow-y-auto pb-4">
      {matrixSections.map((section) => (
        <div
          key={section.priority}
          className={`flex flex-col bg-white rounded-xl border ${section.borderClass} shadow-xs overflow-hidden h-full min-h-[500px]`}
        >
          {/* Section Header */}
          <div className={`p-3.5 border-b ${section.borderClass} ${section.headerBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {section.icon}
                <h3 className={`font-semibold text-sm ${section.headerText}`}>
                  {section.title}
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full border ${section.badgeClass}`}
                >
                  {section.tasks.length}
                </span>
                <button
                  type="button"
                  onClick={() => onAddTask(section.priority)}
                  className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-white/80 transition-colors"
                  title={`Add ${section.priority} priority task`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1 leading-tight">{section.subtitle}</p>
          </div>

          {/* Cards Container */}
          <div className="flex-1 p-3 space-y-2.5 overflow-y-auto bg-zinc-50/40">
            {section.tasks.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-zinc-200/80 rounded-xl my-4">
                <p className="text-xs font-medium text-zinc-500">No {section.priority.toLowerCase()} priority tasks</p>
                <button
                  type="button"
                  onClick={() => onAddTask(section.priority)}
                  className="mt-2 text-[11px] font-semibold text-zinc-900 hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Create one now
                </button>
              </div>
            ) : (
              section.tasks.map((task) => {
                const deadlineObj = formatDeadline(task.deadline);
                const initials = getInitials(task.assignee?.full_name);
                const taskComments = comments[task.id] || task.comments || [];
                const depInfo = getTaskDependencyInfo(task, columns);
                const borderAccentClass = depInfo.hasDependencies
                  ? depInfo.isBlocked
                    ? 'border-l-4 border-l-amber-500'
                    : 'border-l-4 border-l-emerald-500'
                  : 'border-l-4 border-l-zinc-300';

                return (
                  <Card
                    key={task.id}
                    onClick={() => onEditTask(task)}
                    className={`p-3 bg-white border border-zinc-200/90 ${borderAccentClass} rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer group hover:-translate-y-0.5`}
                  >
                    {/* Top Row: Workflow stage pill + Dependency Mark + Pencil Edit */}
                    <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-zinc-100 text-zinc-700 rounded-md border border-zinc-200">
                          {task.columnName}
                        </span>
                        <TaskDependencyMark
                          task={task}
                          columns={columns}
                          variant="compact"
                        />
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {/* Quick Priority Adjusters */}
                        {section.priority !== 'High' && (
                          <button
                            type="button"
                            onClick={(e) =>
                              handlePriorityShift(
                                e,
                                task,
                                section.priority === 'Low' ? 'Medium' : 'High'
                              )
                            }
                            className="p-1 text-zinc-400 hover:text-rose-600 rounded hover:bg-zinc-100 transition-colors"
                            title="Increase priority"
                          >
                            <ArrowUpRight className="h-3 w-3" />
                          </button>
                        )}
                        {section.priority !== 'Low' && (
                          <button
                            type="button"
                            onClick={(e) =>
                              handlePriorityShift(
                                e,
                                task,
                                section.priority === 'High' ? 'Medium' : 'Low'
                              )
                            }
                            className="p-1 text-zinc-400 hover:text-emerald-600 rounded hover:bg-zinc-100 transition-colors"
                            title="Decrease priority"
                          >
                            <ArrowDownRight className="h-3 w-3" />
                          </button>
                        )}

                        {/* Pencil Edit Icon */}
                        <button
                          type="button"
                          onClick={() => onEditTask(task)}
                          className="p-1 text-zinc-400 hover:text-zinc-900 rounded hover:bg-zinc-100 transition-colors"
                          title="Edit task details & comments"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Task Title */}
                    <h4 className="text-xs font-semibold text-zinc-900 line-clamp-2 leading-snug mb-1 group-hover:text-black">
                      {task.title}
                    </h4>

                    {/* Task Description */}
                    {task.description && (
                      <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed mb-2.5">
                        {task.description}
                      </p>
                    )}

                    {/* Card Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 mt-2 text-[11px] text-zinc-500">
                      {/* Due Date & Comments */}
                      <div className="flex items-center gap-2">
                        {deadlineObj && (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              deadlineObj.isOverdue
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-zinc-50 text-zinc-500 border border-zinc-200/60'
                            }`}
                          >
                            <Calendar className="h-2.5 w-2.5" />
                            {deadlineObj.formatted}
                          </span>
                        )}

                        {taskComments.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-600 font-medium bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200/70">
                            <MessageSquare className="h-2.5 w-2.5 text-zinc-500" />
                            {taskComments.length}
                          </span>
                        )}

                        <TaskDependencyMark
                          task={task}
                          columns={columns}
                          variant="badge"
                        />
                      </div>

                      {/* Assignee */}
                      <div className="flex items-center">
                        <Avatar className="h-5 w-5 border-zinc-200">
                          <AvatarFallback className="text-[9px] bg-zinc-100 text-zinc-700">
                            {initials || <User className="h-2.5 w-2.5 text-zinc-400" />}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
