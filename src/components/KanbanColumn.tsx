import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { MoreHorizontal, Plus } from 'lucide-react';
import { TaskCard } from './TaskCard';
import type { ColumnWithTasks, TaskWithAssignee } from '../types';

interface KanbanColumnProps {
  column: ColumnWithTasks;
  onAddTask?: (columnId: string) => void;
  onEditTask?: (task: TaskWithAssignee) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, onAddTask, onEditTask }) => {
  const taskCount = column.tasks?.length || 0;

  return (
    <div className="flex flex-col w-full min-w-[260px] rounded-xl bg-zinc-50/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 p-3 shadow-xs transition-colors">
      {/* Column Header */}
      <div className="flex items-center justify-between px-1.5 py-2 mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 tracking-tight">
            {column.name}
          </h3>
          <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {taskCount}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Phase 2 Feature Placeholder: Quick Add Task in Column */}
          <button
            type="button"
            onClick={() => onAddTask?.(column.id)}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
            title="Add task"
            aria-label={`Add task to ${column.name}`}
          >
            <Plus className="h-4 w-4" />
          </button>

          {/* Phase 2 Feature Placeholder: Column Settings Menu */}
          {/* <!-- PHASE 2: Add Column Action Menu (Rename, Set WIP Limit, Delete Column) --> */}
          <button
            type="button"
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
            title="Column options"
            aria-label="Column options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Droppable Task Area */}
      <Droppable droppableId={column.id} type="TASK">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 flex flex-col min-h-[160px] p-1.5 rounded-lg transition-colors duration-150 ${
              snapshot.isDraggingOver
                ? 'bg-zinc-200/50 dark:bg-zinc-800/60 ring-2 ring-zinc-300/60 dark:ring-zinc-700 ring-dashed'
                : 'bg-transparent'
            }`}
          >
            {column.tasks && column.tasks.length > 0 ? (
              column.tasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  onEdit={onEditTask}
                />
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center p-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-400 dark:text-zinc-500 select-none">
                No tasks in this column
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Phase 2 Feature Placeholder: Quick Inline Add Task Footer */}
      {/* <!-- PHASE 2: Add Inline Task Composer Input Here --> */}
    </div>
  );
};
