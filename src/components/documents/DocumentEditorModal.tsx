import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Eye,
  Edit2,
  Columns,
  Star,
  Copy,
  Trash2,
  Share2,
  Check,
  Tag,
  Folder,
  User,
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table as TableIcon,
  Minus,
  Sparkles,
  Maximize2,
  Minimize2,
  Clock,
} from 'lucide-react';
import { Button } from '../ui/button';
import { MarkdownPreview } from './MarkdownPreview';
import { DocumentFooter } from './DocumentFooter';
import { useKanbanStore } from '../../store/useKanbanStore';
import type {
  BoardDocument,
  BoardDocumentStatus,
  BoardMember,
  DocumentActivityType,
} from '../../types';

interface DocumentEditorModalProps {
  document: BoardDocument | null;
  boardId: string;
  boardName: string;
  boardMembers: BoardMember[];
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string | null;
}

const CATEGORIES = [
  'General',
  'Architecture',
  'Specs',
  'Planning',
  'Meeting Notes',
  'Guidelines',
  'Research',
];

const STATUS_OPTIONS: Array<{ value: BoardDocumentStatus; label: string; color: string }> = [
  { value: 'draft', label: 'Draft', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' },
  { value: 'in_review', label: 'In Review', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  { value: 'published', label: 'Published', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  { value: 'archived', label: 'Archived', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
];

export const DocumentEditorModal: React.FC<DocumentEditorModalProps> = ({
  document: initialDoc,
  boardId,
  boardName,
  boardMembers,
  isOpen,
  onClose,
  currentUserEmail,
}) => {
  const { updateDocument, deleteDocument, toggleStarDocument, duplicateDocument } =
    useKanbanStore();

  // Local state for editing
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [status, setStatus] = useState<BoardDocumentStatus>('draft');
  const [isStarred, setIsStarred] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Selected acting collaborator (defaults to matching member or first board member)
  const defaultMember =
    boardMembers.find((m) => m.email === currentUserEmail) ||
    boardMembers[0] || {
      name: 'Alex Rivera',
      email: 'alex@company.com',
      avatar_url: undefined,
    };
  const [actingMember, setActingMember] = useState<{
    name: string;
    email: string;
    avatar_url?: string;
  }>(defaultMember);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when initialDoc changes
  useEffect(() => {
    if (initialDoc) {
      setTitle(initialDoc.title);
      setContent(initialDoc.content);
      setCategory(initialDoc.category || 'General');
      setTags(initialDoc.tags || []);
      setStatus(initialDoc.status || 'draft');
      setIsStarred(Boolean(initialDoc.is_starred));
      setHasUnsavedChanges(false);
    }
  }, [initialDoc]);

  if (!isOpen || !initialDoc) return null;

  // Insert markdown helpers
  const insertMarkdownSyntax = (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end) || defaultPlaceholder;
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    setHasUnsavedChanges(true);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  const handleSave = async (specificAction?: { type: DocumentActivityType; description: string; details?: string }) => {
    if (!initialDoc) return;

    await updateDocument(
      boardId,
      initialDoc.id,
      {
        title: title.trim() || 'Untitled Document',
        content,
        category,
        tags,
        status,
        is_starred: isStarred,
      },
      specificAction,
      actingMember
    );

    setHasUnsavedChanges(false);
  };

  const handleTitleBlur = () => {
    if (title !== initialDoc.title && title.trim()) {
      handleSave({
        type: 'renamed',
        description: `Renamed to "${title.trim()}" by ${actingMember.name}`,
        details: `Previous title: "${initialDoc.title}"`,
      });
    }
  };

  const handleStatusChange = (newStatus: BoardDocumentStatus) => {
    setStatus(newStatus);
    handleSave({
      type: 'status_changed',
      description: `Status changed to ${newStatus.toUpperCase()} by ${actingMember.name}`,
    });
  };

  const handleAddTag = () => {
    const cleanTag = newTagInput.trim();
    if (cleanTag && !tags.includes(cleanTag)) {
      const nextTags = [...tags, cleanTag];
      setTags(nextTags);
      setNewTagInput('');
      setHasUnsavedChanges(true);
      handleSave({
        type: 'tagged',
        description: `Added tag "${cleanTag}" by ${actingMember.name}`,
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const nextTags = tags.filter((t) => t !== tagToRemove);
    setTags(nextTags);
    setHasUnsavedChanges(true);
    handleSave({
      type: 'tagged',
      description: `Removed tag "${tagToRemove}" by ${actingMember.name}`,
    });
  };

  const handleToggleStar = async () => {
    setIsStarred((prev) => !prev);
    await toggleStarDocument(boardId, initialDoc.id);
  };

  const handleDuplicate = async () => {
    await duplicateDocument(boardId, initialDoc.id, actingMember);
    onClose();
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${initialDoc.title}"?`)) {
      setIsDeleting(true);
      await deleteDocument(boardId, initialDoc.id);
      setIsDeleting(false);
      onClose();
    }
  };

  const handleCopyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#doc=${initialDoc.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave({
        type: 'edited_content',
        description: `Edited document content by ${actingMember.name}`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in-50">
      <div
        className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen
            ? 'w-full h-full rounded-none'
            : 'w-full max-w-6xl max-h-[92vh] h-[850px]'
        }`}
      >
        {/* Top Header Bar */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 sm:px-6 bg-zinc-50/70 dark:bg-zinc-900/80 shrink-0 flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumbs & Title Input */}
          <div className="flex-1 min-w-[260px] space-y-1">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="font-medium truncate max-w-[150px]">{boardName}</span>
              <span>/</span>
              <span>Documents</span>
              <span>/</span>
              <span className="text-zinc-700 dark:text-zinc-300 font-semibold truncate">
                {category}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                onBlur={handleTitleBlur}
                placeholder="Untitled Document..."
                className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50 bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-hidden px-1 py-0.5 rounded transition-all w-full max-w-xl"
              />
              <button
                type="button"
                onClick={handleToggleStar}
                className={`p-1.5 rounded-lg transition-colors ${
                  isStarred
                    ? 'text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/40'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                }`}
                title={isStarred ? 'Unstar document' : 'Star document'}
              >
                <Star className={`h-4 w-4 ${isStarred ? 'fill-amber-500' : ''}`} />
              </button>
            </div>
          </div>

          {/* Collaborator / Acting As Switcher & Document Status */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Acting Collaborator Member Switcher */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs shadow-2xs"
              title="Select which board member is modifying this document (captures user activity)"
            >
              <User className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
              <span className="text-zinc-500 dark:text-zinc-400 text-[11px] font-medium hidden sm:inline">
                Acting As:
              </span>
              <select
                value={actingMember.email}
                onChange={(e) => {
                  const selected = boardMembers.find((m) => m.email === e.target.value);
                  if (selected) {
                    setActingMember({
                      name: selected.name,
                      email: selected.email,
                      avatar_url: selected.avatar_url || undefined,
                    });
                  }
                }}
                className="bg-transparent font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer text-xs"
              >
                {boardMembers.map((m) => (
                  <option key={m.id} value={m.email} className="dark:bg-zinc-900 dark:text-zinc-100">
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 rounded-lg text-xs">
              <Folder className="h-3 w-3 text-zinc-500" />
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="bg-transparent text-zinc-800 dark:text-zinc-200 font-medium focus:outline-hidden cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="dark:bg-zinc-900">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Dropdown */}
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as BoardDocumentStatus)}
              className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-hidden cursor-pointer"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="dark:bg-zinc-900">
                  {opt.label}
                </option>
              ))}
            </select>

            {/* View Mode Switcher */}
            <div className="hidden sm:flex items-center bg-zinc-200/70 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'edit'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
                title="Edit source"
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'split'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
                title="Side-by-side split view"
              >
                <Columns className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
                title="Rendered preview"
              >
                <Eye className="h-3 w-3" />
              </button>
            </div>

            {/* Save Button */}
            <Button
              size="sm"
              onClick={() =>
                handleSave({
                  type: 'edited_content',
                  description: `Edited document content by ${actingMember.name}`,
                })
              }
              className={`h-8 gap-1.5 ${
                hasUnsavedChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                  : ''
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              <span>{hasUnsavedChanges ? 'Save Changes' : 'Saved'}</span>
            </Button>

            {/* Actions Menu */}
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
              title="Copy link to document"
            >
              {copiedLink ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={handleDuplicate}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
              title="Duplicate document"
            >
              <Copy className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors"
              title="Delete document"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors hidden sm:inline-flex"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Tags Bar & Markdown Toolbar */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 sm:px-6 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Tags Chips */}
          <div className="flex items-center flex-wrap gap-1.5">
            <Tag className="h-3 w-3 text-zinc-400 shrink-0" />
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-[11px]"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-rose-500 text-zinc-400"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="+ tag"
                className="bg-transparent border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 focus:border-zinc-600 dark:focus:border-zinc-400 px-2 py-0.5 rounded text-[11px] focus:outline-hidden w-20"
              />
            </div>
          </div>

          {/* Quick Markdown Formatting Toolbar */}
          {viewMode !== 'preview' && (
            <div className="flex items-center flex-wrap gap-1 border-l border-zinc-200 dark:border-zinc-800 pl-3">
              <button
                type="button"
                onClick={() => insertMarkdownSyntax('**', '**', 'bold text')}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                title="Bold (**text**)"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSyntax('*', '*', 'italic text')}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                title="Italic (*text*)"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSyntax('~~', '~~', 'strikethrough')}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                title="Strikethrough (~~text~~)"
              >
                <Strikethrough className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSyntax('`', '`', 'code')}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                title="Inline Code (`code`)"
              >
                <Code className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSyntax('- ', '', 'List item')}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                title="Bullet List (- item)"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSyntax('1. ', '', 'Numbered item')}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                title="Numbered List (1. item)"
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSyntax('- [ ] ', '', 'Task to complete')}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                title="Task Checklist (- [ ] task)"
              >
                <CheckSquare className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSyntax('> ', '', 'Quoted thought')}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                title="Quote (> quote)"
              >
                <Quote className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  insertMarkdownSyntax(
                    '\n| Feature | Status | Lead |\n| :--- | :--- | :--- |\n| Core API | Complete | Alex |\n| Frontend | In Review | Jordan |\n',
                    ''
                  )
                }
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                title="Insert Table"
              >
                <TableIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdownSyntax('\n---\n', '')}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                title="Horizontal Divider"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Editor Body Area: Split or Full */}
        <div className="flex-1 min-h-0 flex overflow-hidden bg-white dark:bg-zinc-950">
          {/* Source Textarea */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div
              className={`flex-1 min-h-0 flex flex-col ${
                viewMode === 'split' ? 'border-r border-zinc-200 dark:border-zinc-800' : ''
              }`}
            >
              <div className="px-4 py-1.5 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>Markdown Editor (Ctrl+S to save)</span>
                <span>{content.length} characters • {content.split(/\s+/).filter(Boolean).length} words</span>
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Write your document in Markdown..."
                className="flex-1 w-full p-4 sm:p-6 bg-transparent font-mono text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 resize-none focus:outline-hidden leading-relaxed"
                spellCheck={false}
              />
            </div>
          )}

          {/* Rendered Markdown Preview */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className="flex-1 min-h-0 flex flex-col bg-zinc-50/30 dark:bg-zinc-900/40">
              <div className="px-4 py-1.5 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>Rendered Preview</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  Live View
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <MarkdownPreview content={content} />
              </div>
            </div>
          )}
        </div>

        {/* DOCUMENT FOOTER: Captures and displays the last activity of this document */}
        <DocumentFooter
          document={{
            ...initialDoc,
            title,
            content,
            category,
            tags,
            status,
            is_starred: isStarred,
          }}
          boardName={boardName}
          boardMembers={boardMembers}
          className="shrink-0"
        />
      </div>
    </div>
  );
};
