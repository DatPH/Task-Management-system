import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Hash,
  ArrowRight,
  Sparkles,
  Check,
  Calendar,
  Layers,
  Zap,
} from 'lucide-react';
import type { ColumnWithTasks, TaskWithAssignee, Board } from '../types';
import { getTaskCode, setTaskUrlHash } from '../utils/taskId';
import {
  TaskSearchIndex,
  type TaskSearchItem,
  type TaskSearchResult,
  highlightMatchedText,
} from '../utils/taskSearchIndex';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';

interface TaskQuickSearchProps {
  columns: ColumnWithTasks[];
  currentBoard?: Board | null;
  allBoardsColumns?: Record<string, ColumnWithTasks[]>;
  onSelectTask: (task: TaskWithAssignee) => void;
  onAddBenchmarkTasks?: (count: number) => void;
}

export const TaskQuickSearch: React.FC<TaskQuickSearchProps> = ({
  columns,
  currentBoard,
  allBoardsColumns,
  onSelectTask,
  onAddBenchmarkTasks,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [lastSearchTimeMs, setLastSearchTimeMs] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Dedicated search index instance
  const searchIndex = useMemo(() => new TaskSearchIndex(), []);

  // Prepare searchable items from all accessible board columns
  const indexedItems = useMemo(() => {
    const items: TaskSearchItem[] = [];

    // Current board columns
    columns.forEach((col) => {
      col.tasks.forEach((task) => {
        items.push({
          id: task.id,
          taskCode: getTaskCode(task),
          title: task.title,
          description: task.description,
          columnId: col.id,
          columnName: col.name,
          boardId: currentBoard?.id || col.board_id,
          boardName: currentBoard?.name || 'Current Board',
          priority: task.priority,
          assigneeName: task.assignee?.full_name,
          assigneeId: task.assignee_id,
          deadline: task.deadline,
          task,
        });
      });
    });

    // Other boards if available
    if (allBoardsColumns) {
      Object.entries(allBoardsColumns).forEach(([boardId, boardCols]) => {
        if (currentBoard && boardId === currentBoard.id) return;
        const columnsList = (boardCols || []) as ColumnWithTasks[];
        columnsList.forEach((col) => {
          (col.tasks || []).forEach((task) => {
            // Avoid duplicates
            if (!items.some((i) => i.id === task.id)) {
              items.push({
                id: task.id,
                taskCode: getTaskCode(task),
                title: task.title,
                description: task.description,
                columnId: col.id,
                columnName: col.name,
                boardId,
                boardName: 'Other Board',
                priority: task.priority,
                assigneeName: task.assignee?.full_name,
                assigneeId: task.assignee_id,
                deadline: task.deadline,
                task,
              });
            }
          });
        });
      });
    }

    return items;
  }, [columns, currentBoard, allBoardsColumns]);

  // Re-index whenever items change
  useEffect(() => {
    searchIndex.index(indexedItems);
  }, [searchIndex, indexedItems]);

  // Perform search with performance timing measurement
  const searchResults: TaskSearchResult[] = useMemo(() => {
    if (!query.trim()) return [];
    const t0 = performance.now();
    const results = searchIndex.search(query, { limit: 40 });
    const elapsed = Math.round((performance.now() - t0) * 100) / 100;
    setLastSearchTimeMs(elapsed);
    return results;
  }, [query, searchIndex]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard shortcut: Cmd+K or Ctrl+K or '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Keyboard navigation within search results
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % searchResults.length);
      scrollItemIntoView((selectedIndex + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      scrollItemIntoView((selectedIndex - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = searchResults[selectedIndex];
      if (target) {
        handleSelect(target.item.task);
      }
    }
  };

  const scrollItemIntoView = (index: number) => {
    if (listRef.current) {
      const children = listRef.current.children;
      if (children[index]) {
        (children[index] as HTMLElement).scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  };

  const handleSelect = (task: TaskWithAssignee) => {
    setIsOpen(false);
    setQuery('');
    setTaskUrlHash(task);
    onSelectTask(task);
  };

  const handleSimulateLargeDataset = () => {
    if (onAddBenchmarkTasks) {
      setBenchmarkLoading(true);
      setTimeout(() => {
        onAddBenchmarkTasks(1000);
        setBenchmarkLoading(false);
      }, 50);
    }
  };

  const priorityVariant = (priority: string) => {
    const p = priority.toLowerCase();
    if (p === 'high') return 'high';
    if (p === 'low') return 'low';
    return 'medium';
  };

  return (
    <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md" ref={dropdownRef}>
      {/* Search Input Trigger Bar */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-zinc-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder="Search ID (TSK-101) or any title word... (⌘K)"
          className="w-full h-8 sm:h-9 pl-9 pr-14 text-xs bg-zinc-100/90 dark:bg-zinc-800/90 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 border border-zinc-200/90 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:focus:ring-zinc-100/20 focus:border-zinc-400 dark:focus:border-zinc-500 transition-all"
        />

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex absolute right-2.5 items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 rounded shadow-2xs pointer-events-none">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Instant Dropdown Search Results Overlay */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 overflow-hidden text-xs animate-in fade-in-50 zoom-in-95 max-h-[80vh] flex flex-col">
          {/* Header Info Bar */}
          <div className="px-3.5 py-2 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Quick Task Finder</span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <span className="text-zinc-500 dark:text-zinc-400">
                Indexed {indexedItems.length.toLocaleString()} tasks
              </span>
            </div>

            {lastSearchTimeMs !== null && query && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800">
                <Zap className="h-3 w-3" />
                {lastSearchTimeMs} ms
              </span>
            )}
          </div>

          {/* Results List or Empty State */}
          <div ref={listRef} className="overflow-y-auto max-h-[420px] p-1.5 space-y-1">
            {!query.trim() ? (
              <div className="p-5 text-center">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 mb-2">
                  <Search className="h-4 w-4" />
                </div>
                <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs mb-1">
                  Instant Task Search by ID or Words
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed mb-3">
                  Type any task code (e.g. <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">TSK-101</span>, <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">101</span>) or any words in the task title.
                </p>

                {onAddBenchmarkTasks && indexedItems.length < 500 && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={handleSimulateLargeDataset}
                      disabled={benchmarkLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                      title="Add 1,000 simulated tasks to test search speed"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      <span>{benchmarkLoading ? 'Generating...' : 'Load 1,000 Tasks Benchmark'}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                <p className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">No tasks matched &ldquo;{query}&rdquo;</p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  Try searching by task number (e.g. <span className="font-mono">101</span>) or individual title keywords.
                </p>
              </div>
            ) : (
              searchResults.map((res, index) => {
                const { item, matchType, matchedWords } = res;
                const isSelected = index === selectedIndex;
                const highlighted = highlightMatchedText(item.title, query);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.task)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full text-left p-2.5 rounded-xl transition-colors flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-zinc-900 dark:bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    {/* Task ID Pill */}
                    <div
                      className={`shrink-0 inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                        isSelected
                          ? 'bg-zinc-800 dark:bg-zinc-700 text-amber-300 border-zinc-700 dark:border-zinc-600'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                      }`}
                      title={`Task ID: ${item.taskCode}`}
                    >
                      <Hash className="h-2.5 w-2.5 opacity-70" />
                      {item.taskCode}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`font-medium text-xs leading-snug line-clamp-1 ${
                            isSelected ? 'text-white' : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {highlighted.map((chunk, i) =>
                            chunk.isMatch ? (
                              <mark
                                key={i}
                                className={`rounded-xs px-0.5 font-bold ${
                                  isSelected
                                    ? 'bg-amber-400 text-zinc-950'
                                    : 'bg-amber-100 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200'
                                }`}
                              >
                                {chunk.text}
                              </mark>
                            ) : (
                              <span key={i}>{chunk.text}</span>
                            )
                          )}
                        </span>
                      </div>

                      {/* Meta row: Status stage, priority, match highlight */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span
                          className={`px-1.5 py-0.2 rounded font-medium ${
                            isSelected ? 'bg-zinc-800 dark:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {item.columnName}
                        </span>

                        <Badge
                          variant={priorityVariant(item.priority)}
                          className="text-[9px] px-1.5 py-0 capitalize"
                        >
                          {item.priority}
                        </Badge>

                        {matchType === 'id' && (
                          <span className="text-[10px] font-medium text-emerald-400">
                            Exact ID match
                          </span>
                        )}

                        {matchType === 'word' && matchedWords.length > 0 && (
                          <span
                            className={`text-[10px] truncate max-w-[140px] text-zinc-400`}
                          >
                            Matches word: {matchedWords.slice(0, 2).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Open arrow icon */}
                    <div className="shrink-0 self-center opacity-60">
                      <ArrowRight
                        className={`h-3.5 w-3.5 ${isSelected ? 'text-white' : 'text-zinc-400 dark:text-zinc-500'}`}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer with keyboard navigation hint */}
          <div className="px-3.5 py-2 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="font-mono bg-white dark:bg-zinc-800 px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">↑↓</kbd>{' '}
                Navigate
              </span>
              <span>
                <kbd className="font-mono bg-white dark:bg-zinc-800 px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Enter</kbd>{' '}
                Open Task & Hash URL
              </span>
              <span>
                <kbd className="font-mono bg-white dark:bg-zinc-800 px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Esc</kbd>{' '}
                Close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
