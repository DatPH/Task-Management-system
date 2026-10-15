import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Star,
  Clock,
  Users,
  Share2,
  MoreVertical,
  Edit3,
  Copy,
  Trash2,
  Folder,
  Tag,
  CheckCircle2,
  AlertCircle,
  FileCode,
  LayoutGrid,
  List as ListIcon,
  Sparkles,
  BookOpen,
  ShieldCheck,
  Calendar,
  Check,
  User,
} from 'lucide-react';
import { Button } from '../ui/button';
import { DocumentEditorModal } from './DocumentEditorModal';
import { useKanbanStore } from '../../store/useKanbanStore';
import type {
  BoardDocument,
  BoardDocumentStatus,
  BoardMember,
  DocumentActivityType,
} from '../../types';

interface BoardDocumentsViewProps {
  boardId: string;
  boardName: string;
  boardMembers: BoardMember[];
  currentUserEmail?: string | null;
  className?: string;
}

const TEMPLATES: Array<{
  id: string;
  title: string;
  category: string;
  icon: string;
  tags: string[];
  description: string;
  content: string;
}> = [
  {
    id: 'blank',
    title: 'Blank Document',
    category: 'General',
    icon: '📄',
    tags: ['Doc'],
    description: 'Start fresh with a clean slate for notes or brainstorming.',
    content: `# Document Title\n\nWrite your thoughts, guidelines, or decisions here...`,
  },
  {
    id: 'sprint-plan',
    title: 'Sprint Planning & Milestone Goals',
    category: 'Planning',
    icon: '🎯',
    tags: ['Sprint', 'Planning', 'Milestones'],
    description: 'Define sprint commitments, high-level objectives, and capacity.',
    content: `# Sprint Planning & Milestone Goals\n\n## Sprint Overview\n- **Sprint Number:** Sprint 15\n- **Duration:** 2 Weeks\n- **Sprint Goal:** Deliver key milestones with zero regressions.\n\n---\n\n### Core Commitments\n- [ ] Finalize distributed task dependency scheduler\n- [ ] Complete document sharing permissions audit\n- [ ] Optimize database indexing for sprint analytics\n\n### Team Capacity & Allocation\n| Member | Focus Area | Allocated Points |\n| :--- | :--- | :--- |\n| Alex Rivera | Infrastructure & SRE | 13 |\n| Jordan Lee | Database & Backend | 13 |\n| Sarah Connor | UI Architecture & Docs | 13 |\n\n> **Notice:** Daily standup sync occurs at 09:30 AM.`,
  },
  {
    id: 'prd',
    title: 'Product Requirement Document (PRD)',
    category: 'Specs',
    icon: '📋',
    tags: ['PRD', 'Specs', 'Roadmap'],
    description: 'Specify user problems, proposed solutions, and success metrics.',
    content: `# Product Requirement Document (PRD)\n\n## 1. Problem Statement\nTeams require synchronous documentation scoped to their project boards to eliminate context switching between external wiki tools.\n\n---\n\n## 2. Proposed Solution\nEmbed board-scoped document management with real-time markdown editing, collaborator access, and last-activity footers.\n\n### Success Metrics\n- **Document Adoption:** > 80% of active boards have at least 2 team specs.\n- **Collaborator Engagement:** Multiple team members actively editing documentation.\n\n---\n\n## 3. User Stories & Acceptance Criteria\n- [x] Board members can create and format rich markdown documents\n- [x] Documents capture the acting user's last modification\n- [x] Document footer highlights the latest user activity\n- [ ] Full text search across all board documents`,
  },
  {
    id: 'tech-spec',
    title: 'Technical Architecture & RFC',
    category: 'Architecture',
    icon: '⚡',
    tags: ['Architecture', 'RFC', 'Tech-Spec'],
    description: 'Detail system topology, database schemas, and API contracts.',
    content: `# Technical Architecture & RFC\n\n## Context & Architecture RFC\nProposing an integrated document persistence engine for workspace boards.\n\n### System Architecture\n\`\`\`text\n+-------------------------------------------------------------+\n|                      Board Workspace UI                     |\n|  +--------------------+             +--------------------+  |\n|  |   Kanban Board     |             |  Board Documents   |  |\n|  +---------+----------+             +---------+----------+  |\n+------------|----------------------------------|-------------+\n             |                                  |\n             v                                  v\n    Board Columns & Tasks              Board Document State\n             |                                  |\n             +----------------+-----------------+\n                              v\n                  Local & Cloud Persistence\n\`\`\`\n\n---\n\n### Security & Access Model\nAll documents inherit the parent board's access roster. Only verified board members can modify documents.`,
  },
  {
    id: 'meeting-notes',
    title: 'Weekly Operations Sync & Meeting Notes',
    category: 'Meeting Notes',
    icon: '📝',
    tags: ['Meeting', 'Weekly', 'Notes'],
    description: 'Document agendas, discussions, decisions, and action items.',
    content: `# Weekly Operations Sync & Meeting Notes\n\n## Meeting Details\n- **Date:** October 6, 2026\n- **Facilitator:** Alex Rivera\n- **Attendees:** Board Members\n\n---\n\n### Agenda & Discussion Topics\n1. Review sprint progress and velocity trends.\n2. Review open blockers and dependencies.\n3. Approve RFC for document collaboration.\n\n### Decisions Made\n- Standardize on Markdown format for all project specs.\n- Enforce document footer activity logging for accountability.\n\n### Action Items\n- [ ] Alex: Deploy sprint build to preview environment\n- [ ] Jordan: Complete database migration checklist\n- [ ] Sarah: Finalize design review for document hub`,
  },
];

export const BoardDocumentsView: React.FC<BoardDocumentsViewProps> = ({
  boardId,
  boardName,
  boardMembers,
  currentUserEmail,
  className = '',
}) => {
  const {
    documents: allDocumentsMap,
    createDocument,
    deleteDocument,
    toggleStarDocument,
    duplicateDocument,
  } = useKanbanStore();

  const boardDocs = allDocumentsMap[boardId] || [];

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'recent' | 'created' | 'title'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modal state
  const [selectedDocForEdit, setSelectedDocForEdit] = useState<BoardDocument | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Acting user state
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

  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);

  // Available categories from actual docs
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    boardDocs.forEach((d) => {
      if (d.category) cats.add(d.category);
    });
    return Array.from(cats);
  }, [boardDocs]);

  // Filtered and sorted documents
  const filteredDocs = useMemo(() => {
    return boardDocs
      .filter((doc) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = doc.title.toLowerCase().includes(q);
          const matchesContent = doc.content.toLowerCase().includes(q);
          const matchesTags = doc.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchesTitle && !matchesContent && !matchesTags) return false;
        }

        // Category
        if (selectedCategory !== 'ALL' && doc.category !== selectedCategory) {
          return false;
        }

        // Status
        if (selectedStatus !== 'ALL' && doc.status !== selectedStatus) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Pinned/starred first
        if (Boolean(a.is_starred) !== Boolean(b.is_starred)) {
          return a.is_starred ? -1 : 1;
        }

        if (sortBy === 'recent') {
          const aTime = a.last_activity?.timestamp || a.updated_at || a.created_at;
          const bTime = b.last_activity?.timestamp || b.updated_at || b.created_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        }

        if (sortBy === 'created') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }

        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }

        return 0;
      });
  }, [boardDocs, searchQuery, selectedCategory, selectedStatus, sortBy]);

  // Statistics
  const totalCount = boardDocs.length;
  const publishedCount = boardDocs.filter((d) => d.status === 'published').length;
  const inReviewCount = boardDocs.filter((d) => d.status === 'in_review').length;
  const draftCount = boardDocs.filter((d) => d.status === 'draft').length;
  const starredCount = boardDocs.filter((d) => d.is_starred).length;

  const handleOpenDoc = (doc: BoardDocument) => {
    setSelectedDocForEdit(doc);
    setIsEditorOpen(true);
  };

  const handleCreateNew = async (templateId?: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];

    const newDoc = await createDocument(
      boardId,
      {
        title: template.title,
        content: template.content,
        category: template.category,
        tags: template.tags,
        icon: template.icon,
        status: 'draft',
      },
      actingMember
    );

    setIsTemplateModalOpen(false);
    setSelectedDocForEdit(newDoc);
    setIsEditorOpen(true);
  };

  const handleCopyLink = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}#doc=${docId}`;
    navigator.clipboard.writeText(url);
    setCopiedDocId(docId);
    setTimeout(() => setCopiedDocId(null), 2000);
  };

  const formatRelativeTime = (isoString?: string): string => {
    if (!isoString) return 'Recently';
    try {
      const now = Date.now();
      const past = new Date(isoString).getTime();
      const diffMs = Math.max(0, now - past);
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  };

  const getInitials = (name: string): string => {
    return (
      name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U'
    );
  };

  const getStatusBadge = (status: BoardDocumentStatus) => {
    switch (status) {
      case 'published':
        return {
          label: 'Published',
          color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        };
      case 'in_review':
        return {
          label: 'In Review',
          color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        };
      case 'archived':
        return {
          label: 'Archived',
          color: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        };
      default:
        return {
          label: 'Draft',
          color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
        };
    }
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 ${className}`}>
      {/* Top Banner & Board Access Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3.5 sm:px-6 shrink-0 space-y-3 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Board Sharing Context */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shrink-0 shadow-xs">
              <FileText className="h-4 w-4 text-zinc-100 dark:text-zinc-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">
                  {boardName} Documents
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                  Shared Docs
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Shareable documents & specifications accessible to all members of this board.
              </p>
            </div>
          </div>

          {/* Action buttons & Member selector */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Board Members Collaborator Access Indicator */}
            <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs">
              <Users className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <span className="text-zinc-600 dark:text-zinc-300 text-[11px] font-medium hidden md:inline">
                Access:
              </span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">
                {boardMembers.length} Members
              </span>

              {/* Stacked Member Avatars */}
              <div className="flex items-center -space-x-1 ml-1">
                {boardMembers.slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    title={`${m.name} (${m.role}) - ${m.email}`}
                    className="h-4.5 w-4.5 rounded-full bg-zinc-900 text-white text-[8px] font-bold flex items-center justify-center border border-white dark:border-zinc-850 shadow-2xs"
                  >
                    {getInitials(m.name)}
                  </div>
                ))}
              </div>
            </div>

            {/* Acting Collaborator Switcher Dropdown */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs"
              title="Acting member making edits or creating documents"
            >
              <User className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
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

            {/* New Document Button */}
            <Button
              size="sm"
              onClick={() => setIsTemplateModalOpen(true)}
              className="gap-1.5 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>New Document</span>
            </Button>
          </div>
        </div>

        {/* Quick KPI Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="bg-zinc-50 dark:bg-zinc-850/80 rounded-lg p-2.5 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                Total Documents
              </span>
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {totalCount}
              </span>
            </div>
            <BookOpen className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-850/80 rounded-lg p-2.5 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                Published & Active
              </span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {publishedCount}
              </span>
            </div>
            <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-850/80 rounded-lg p-2.5 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                Drafts & Review
              </span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                {draftCount + inReviewCount}
              </span>
            </div>
            <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-850/80 rounded-lg p-2.5 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                Starred / Pinned
              </span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                {starredCount}
              </span>
            </div>
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          </div>
        </div>
      </div>

      {/* Main Content Area: Search, Filters, and Documents Grid/List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Filters and Controls Toolbar */}
        <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left: Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by title, tags, or content..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-400 transition-all"
            />
          </div>

          {/* Center: Category Pills */}
          <div className="flex items-center flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedCategory === 'ALL'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-2xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              All Categories
            </button>
            {categoriesList.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-2xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Right: Status filter, Sort & View Mode Toggle */}
          <div className="flex items-center flex-wrap gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="published">Published</option>
              <option value="in_review">In Review</option>
              <option value="draft">Drafts</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-hidden cursor-pointer"
            >
              <option value="recent">Sort: Last Activity</option>
              <option value="created">Sort: Created Date</option>
              <option value="title">Sort: Title A-Z</option>
            </select>

            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
                title="Grid cards"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1 rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
                title="List view"
              >
                <ListIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Documents Directory: Grid or List */}
        {filteredDocs.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-4">
            <div className="h-12 w-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex items-center justify-center mx-auto">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {searchQuery ? 'No documents match your search' : 'No documents in this board yet'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mt-1">
                {searchQuery
                  ? 'Try clearing the search query or category filters to view all documents.'
                  : 'Create your first shareable specification, sprint notes, or architecture runbook for all board members.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="sm" onClick={() => setIsTemplateModalOpen(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span>Create Document</span>
              </Button>
              {searchQuery && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL');
                    setSelectedStatus('ALL');
                  }}
                >
                  Reset Filters
                </Button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => {
              const statusBadge = getStatusBadge(doc.status);
              const lastAct = doc.last_activity || {
                user_name: doc.created_by.name,
                action_description: `Created by ${doc.created_by.name}`,
                timestamp: doc.created_at,
                action_type: 'created' as DocumentActivityType,
              };

              // First 120 chars preview of content
              const snippet = doc.content
                .replace(/^#+\s+/gm, '')
                .replace(/[*_`#>-]/g, '')
                .trim()
                .slice(0, 110);

              return (
                <div
                  key={doc.id}
                  onClick={() => handleOpenDoc(doc)}
                  className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xs hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer flex flex-col group overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-4 pb-3 space-y-2.5 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg leading-none shrink-0" role="img" aria-label="Icon">
                          {doc.icon || '📄'}
                        </span>
                        <div className="min-w-0">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block truncate">
                            {doc.category || 'General'}
                          </span>
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors line-clamp-1">
                            {doc.title}
                          </h3>
                        </div>
                      </div>

                      {/* Top Right: Star & Actions */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleStarDocument(boardId, doc.id)}
                          className={`p-1 rounded-md transition-colors ${
                            doc.is_starred
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'text-zinc-300 dark:text-zinc-600 hover:text-zinc-500'
                          }`}
                          title={doc.is_starred ? 'Unstar' : 'Star'}
                        >
                          <Star className={`h-3.5 w-3.5 ${doc.is_starred ? 'fill-amber-500' : ''}`} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleCopyLink(doc.id, e)}
                          className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                          title="Copy share link"
                        >
                          {copiedDocId === doc.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Share2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Content snippet preview */}
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {snippet || 'No written content yet. Click to start editing.'}
                    </p>

                    {/* Tags and Status Chips */}
                    <div className="flex items-center flex-wrap gap-1.5 pt-1">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${statusBadge.color}`}
                      >
                        {statusBadge.label}
                      </span>
                      {doc.tags?.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60"
                        >
                          #{t}
                        </span>
                      ))}
                      {(doc.tags?.length || 0) > 3 && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                          +{doc.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* DOCUMENT CARD FOOTER: Captures the last activity of this doc by user activity */}
                  <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-850/60 px-4 py-2.5 flex items-center justify-between gap-2 text-xs transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Avatar of last active user */}
                      <div
                        className="h-6 w-6 rounded-full bg-zinc-800 text-white flex items-center justify-center text-[9px] font-bold shrink-0 shadow-2xs border border-white dark:border-zinc-700"
                        title={`Last active user: ${lastAct.user_name}`}
                      >
                        {getInitials(lastAct.user_name)}
                      </div>

                      {/* Last Activity text */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px] truncate">
                            {lastAct.user_name}
                          </span>
                          <span className="text-zinc-400 text-[10px]">•</span>
                          <span
                            className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate"
                            title={lastAct.timestamp}
                          >
                            {formatRelativeTime(lastAct.timestamp)}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                          {lastAct.action_description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-[10px] text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 font-medium">
                      Open →
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View Table */
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Document Title</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Tags</th>
                    <th className="px-4 py-3 font-semibold">Last Activity (User & Time)</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800">
                  {filteredDocs.map((doc) => {
                    const statusBadge = getStatusBadge(doc.status);
                    const lastAct = doc.last_activity || {
                      user_name: doc.created_by.name,
                      action_description: `Created by ${doc.created_by.name}`,
                      timestamp: doc.created_at,
                    };

                    return (
                      <tr
                        key={doc.id}
                        onClick={() => handleOpenDoc(doc)}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-850/60 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base leading-none">{doc.icon || '📄'}</span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-zinc-900 dark:text-zinc-100 hover:text-sky-600 dark:hover:text-sky-400">
                                  {doc.title}
                                </span>
                                {doc.is_starred && (
                                  <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-medium">
                          {doc.category || 'General'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-md border ${statusBadge.color}`}
                          >
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {doc.tags?.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        </td>
                        {/* LAST ACTIVITY FOOTER COLUMN */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-zinc-800 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                              {getInitials(lastAct.user_name)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200 block text-[11px] truncate">
                                {lastAct.action_description}
                              </span>
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                                {lastAct.user_name} • {formatRelativeTime(lastAct.timestamp)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleCopyLink(doc.id, e)}
                              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700"
                              title="Copy link"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDoc(doc)}
                              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                              title="Edit document"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Template Selector Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-500" />
                  <span>Create New Board Document</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Choose a collaboration template to get started, or build with a clean slate.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleCreateNew(tpl.id)}
                  className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-850/50 hover:bg-white dark:hover:bg-zinc-850 transition-all cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">{tpl.icon}</span>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
                        {tpl.category}
                      </span>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {tpl.title}
                      </h4>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Document Full Editor & Viewer Modal with Sticky DocumentFooter */}
      <DocumentEditorModal
        document={selectedDocForEdit}
        boardId={boardId}
        boardName={boardName}
        boardMembers={boardMembers}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedDocForEdit(null);
        }}
        currentUserEmail={currentUserEmail}
      />
    </div>
  );
};
