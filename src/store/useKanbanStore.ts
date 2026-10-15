import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type {
  Board,
  BoardMember,
  BoardWithDetails,
  Column,
  ColumnWithTasks,
  Profile,
  Priority,
  CommentAttachment,
  TaskComment,
  TaskWithAssignee,
  TimelineTaskInput,
  Workspace,
  BoardDocument,
  BoardDocumentStatus,
  DocumentActivity,
  DocumentActivityType,
} from '../types';

interface KanbanState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  boards: Board[];
  board: BoardWithDetails | null;
  columns: ColumnWithTasks[];
  profiles: Profile[];
  boardMembers: Record<string, BoardMember[]>; // boardId -> BoardMember[]
  comments: Record<string, TaskComment[]>;
  documents: Record<string, BoardDocument[]>; // boardId -> BoardDocument[]
  isLoading: boolean;
  error: string | null;

  // Workspace management actions (MVP limit: up to 3 workspaces)
  fetchWorkspaces: () => Workspace[];
  setActiveWorkspaceId: (workspaceId: string) => Promise<void>;
  createWorkspace: (name: string, description?: string, color?: string) => Promise<string>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;

  // Board management actions (MVP limit: up to 5 boards per workspace)
  fetchBoards: () => Promise<Board[]>;
  fetchBoard: (boardId: string) => Promise<void>;
  createBoard: (
    name: string,
    description?: string,
    initialMembers?: Array<{ name: string; email: string; role?: 'Owner' | 'Admin' | 'Member'; profile_id?: string }>,
    targetWorkspaceId?: string
  ) => Promise<string>;
  deleteBoard: (boardId: string) => Promise<void>;

  // Member invitation actions
  inviteMemberToBoard: (
    boardId: string,
    member: { name: string; email: string; role?: 'Owner' | 'Admin' | 'Member'; profile_id?: string }
  ) => Promise<BoardMember>;
  removeMemberFromBoard: (boardId: string, memberId: string) => Promise<void>;
  getBoardAssignees: (boardId?: string) => Profile[];
  getAllBoardsColumns: () => Record<string, ColumnWithTasks[]>;

  // Board Documents & Activity actions
  fetchBoardDocuments: (boardId: string) => BoardDocument[];
  createDocument: (
    boardId: string,
    doc: {
      title: string;
      content: string;
      category?: string;
      tags?: string[];
      icon?: string;
      status?: BoardDocumentStatus;
    },
    actingUser?: { name: string; email: string; avatar_url?: string }
  ) => Promise<BoardDocument>;
  updateDocument: (
    boardId: string,
    docId: string,
    updates: Partial<BoardDocument>,
    activityAction?: {
      type: DocumentActivityType;
      description: string;
      details?: string;
    },
    actingUser?: { name: string; email: string; avatar_url?: string }
  ) => Promise<void>;
  deleteDocument: (boardId: string, docId: string) => Promise<void>;
  toggleStarDocument: (boardId: string, docId: string) => Promise<void>;
  duplicateDocument: (
    boardId: string,
    docId: string,
    actingUser?: { name: string; email: string; avatar_url?: string }
  ) => Promise<BoardDocument>;

  // Task & Column actions
  fetchProfiles: () => Promise<void>;
  moveTask: (
    taskId: string,
    sourceColumnId: string,
    destinationColumnId: string,
    destinationIndex?: number
  ) => Promise<void>;
  addTask: (task: TaskWithAssignee) => void;
  addTaskDependency: (taskId: string, dependencyTaskId: string) => Promise<void>;
  removeTaskDependency: (taskId: string, dependencyTaskId: string) => Promise<void>;
  addTimelineTasks: (
    tasks: TimelineTaskInput[],
    targetBoardId?: string
  ) => Promise<TaskWithAssignee[]>;
  addBenchmarkTasks: (count?: number) => void;
  updateTask: (task: TaskWithAssignee) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  addComment: (
    taskId: string,
    content: string,
    authorName?: string,
    authorEmail?: string,
    attachments?: CommentAttachment[]
  ) => Promise<TaskComment>;
  deleteCommentAttachment: (
    taskId: string,
    commentId: string,
    attachmentId: string
  ) => Promise<void>;
  deleteComment: (taskId: string, commentId: string) => Promise<void>;
  setColumns: (columns: ColumnWithTasks[]) => void;
  clearError: () => void;
}

// Fixed standard UUID constants for default starter workspaces, boards & profiles
export const DEFAULT_WORKSPACE_1_ID = 'w1000000-0000-4000-8000-000000000001';
export const DEFAULT_WORKSPACE_2_ID = 'w2000000-0000-4000-8000-000000000002';

export const DEFAULT_BOARD_ID = 'b1000000-0000-4000-8000-000000000001';
export const DEFAULT_BOARD_MARKETING_ID = 'b2000000-0000-4000-8000-000000000002';

export const DEFAULT_COL_BACKLOG_ID = 'c1000000-0000-4000-8000-000000000001';
export const DEFAULT_COL_PROGRESS_ID = 'c2000000-0000-4000-8000-000000000002';
export const DEFAULT_COL_REVIEW_ID = 'c3000000-0000-4000-8000-000000000003';
export const DEFAULT_COL_DONE_ID = 'c4000000-0000-4000-8000-000000000004';

export const DEFAULT_PROFILE_ALEX_ID = 'a1000000-0000-4000-8000-000000000001';
export const DEFAULT_PROFILE_JORDAN_ID = 'a2000000-0000-4000-8000-000000000002';
export const DEFAULT_PROFILE_TAYLOR_ID = 'a3000000-0000-4000-8000-000000000003';
export const DEFAULT_PROFILE_SARAH_ID = 'a4000000-0000-4000-8000-000000000004';
export const DEFAULT_PROFILE_ELENA_ID = 'a5000000-0000-4000-8000-000000000005';

// Storage keys for resilient local persistence across reloads
const WORKSPACES_STORAGE_KEY = 'kanban_workspaces_v1';
const ACTIVE_WORKSPACE_STORAGE_KEY = 'kanban_active_workspace_v1';
const BOARDS_STORAGE_KEY = 'kanban_multi_boards_v3';
const BOARD_MEMBERS_STORAGE_KEY = 'kanban_board_members_v3';
const BOARD_COLUMNS_STORAGE_KEY = 'kanban_board_columns_v3';
const COMMENTS_STORAGE_KEY = 'kanban_task_comments_v2';
const DOCUMENTS_STORAGE_KEY = 'kanban_board_documents_v1';

// Initial Starter Workspaces (MVP limit: up to 3 workspaces per user)
const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: DEFAULT_WORKSPACE_1_ID,
    name: 'Acme Operations',
    description: 'Core organizational workspace for engineering, DevOps, and business ops',
    color: '#0284c7', // Sky blue
    created_at: '2026-01-01T08:00:00.000Z',
    owner_email: 'dat.phan93@gmail.com',
  },
  {
    id: DEFAULT_WORKSPACE_2_ID,
    name: 'Growth & Marketing',
    description: 'Growth initiatives, campaigns, customer outreach, and conversion funnels',
    color: '#8b5cf6', // Purple
    created_at: '2026-02-01T08:00:00.000Z',
    owner_email: 'dat.phan93@gmail.com',
  },
];

// Standard Global Profile Pool
const INITIAL_GLOBAL_PROFILES: Profile[] = [
  {
    id: DEFAULT_PROFILE_ALEX_ID,
    full_name: 'Alex Rivera',
    email: 'alex@company.com',
    created_at: '2026-01-10T08:00:00.000Z',
  },
  {
    id: DEFAULT_PROFILE_JORDAN_ID,
    full_name: 'Jordan Lee',
    email: 'jordan@company.com',
    created_at: '2026-01-10T08:00:00.000Z',
  },
  {
    id: DEFAULT_PROFILE_TAYLOR_ID,
    full_name: 'Taylor Chen',
    email: 'taylor@company.com',
    created_at: '2026-02-01T09:00:00.000Z',
  },
  {
    id: DEFAULT_PROFILE_SARAH_ID,
    full_name: 'Sarah Connor',
    email: 'sarah@company.com',
    created_at: '2026-02-15T10:00:00.000Z',
  },
  {
    id: DEFAULT_PROFILE_ELENA_ID,
    full_name: 'Elena Rostova',
    email: 'elena@company.com',
    created_at: '2026-03-01T11:00:00.000Z',
  },
];

// Initial Starter Boards linked to Workspaces
const INITIAL_BOARDS: Board[] = [
  {
    id: DEFAULT_BOARD_ID,
    workspace_id: DEFAULT_WORKSPACE_1_ID,
    name: 'SME Core Operations',
    description: 'Daily operational workflows, infrastructure maintenance, and compliance audits',
    created_by: null,
    created_at: '2026-01-15T09:00:00.000Z',
  },
  {
    id: DEFAULT_BOARD_MARKETING_ID,
    workspace_id: DEFAULT_WORKSPACE_2_ID,
    name: 'Product & Marketing Launch',
    description: 'Go-to-market campaign assets, customer webinar coordination, and conversion funnels',
    created_by: null,
    created_at: '2026-02-20T10:00:00.000Z',
  },
];

// Initial Invited Members per Board (Board 1 only has Alex & Jordan; Board 2 only has Taylor & Sarah)
const INITIAL_BOARD_MEMBERS: Record<string, BoardMember[]> = {
  [DEFAULT_BOARD_ID]: [
    {
      id: 'bm-1',
      board_id: DEFAULT_BOARD_ID,
      profile_id: DEFAULT_PROFILE_ALEX_ID,
      name: 'Alex Rivera',
      email: 'alex@company.com',
      role: 'Admin',
      joined_at: '2026-01-15T09:30:00.000Z',
    },
    {
      id: 'bm-2',
      board_id: DEFAULT_BOARD_ID,
      profile_id: DEFAULT_PROFILE_JORDAN_ID,
      name: 'Jordan Lee',
      email: 'jordan@company.com',
      role: 'Member',
      joined_at: '2026-01-15T09:35:00.000Z',
    },
  ],
  [DEFAULT_BOARD_MARKETING_ID]: [
    {
      id: 'bm-3',
      board_id: DEFAULT_BOARD_MARKETING_ID,
      profile_id: DEFAULT_PROFILE_TAYLOR_ID,
      name: 'Taylor Chen',
      email: 'taylor@company.com',
      role: 'Owner',
      joined_at: '2026-02-20T10:15:00.000Z',
    },
    {
      id: 'bm-4',
      board_id: DEFAULT_BOARD_MARKETING_ID,
      profile_id: DEFAULT_PROFILE_SARAH_ID,
      name: 'Sarah Connor',
      email: 'sarah@company.com',
      role: 'Member',
      joined_at: '2026-02-20T10:20:00.000Z',
    },
  ],
};

const INITIAL_BOARD_1_COLUMNS: ColumnWithTasks[] = [
  {
    id: DEFAULT_COL_BACKLOG_ID,
    board_id: DEFAULT_BOARD_ID,
    name: 'Backlog',
    order_index: 0,
    created_at: '2026-01-15T09:00:00.000Z',
    tasks: [
      {
        id: 'd1000000-0000-4000-8000-000000000001',
        column_id: DEFAULT_COL_BACKLOG_ID,
        title: 'Review Q3 operational budget & tooling expenses',
        description: 'Analyze SaaS subscriptions for redundancies across team operations.',
        assignee_id: DEFAULT_PROFILE_ALEX_ID,
        deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
        priority: 'Medium',
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assignee: {
          id: DEFAULT_PROFILE_ALEX_ID,
          full_name: 'Alex Rivera',
          email: 'alex@company.com',
          created_at: new Date().toISOString(),
        },
      },
      {
        id: 'd2000000-0000-4000-8000-000000000002',
        column_id: DEFAULT_COL_BACKLOG_ID,
        title: 'Audit customer data privacy & GDPR retention policies',
        description: null,
        assignee_id: null,
        deadline: new Date(Date.now() + 86400000 * 12).toISOString(),
        priority: 'Low',
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: DEFAULT_COL_PROGRESS_ID,
    board_id: DEFAULT_BOARD_ID,
    name: 'In Progress',
    order_index: 1,
    created_at: '2026-01-15T09:00:00.000Z',
    tasks: [
      {
        id: 'd3000000-0000-4000-8000-000000000003',
        column_id: DEFAULT_COL_PROGRESS_ID,
        title: 'Implement optimistic drag-and-drop state updates',
        description: 'Integrate @hello-pangea/dnd with Supabase sync and Zustand rollback.',
        assignee_id: DEFAULT_PROFILE_JORDAN_ID,
        deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
        priority: 'High',
        dependency_ids: ['d1000000-0000-4000-8000-000000000001'],
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assignee: {
          id: DEFAULT_PROFILE_JORDAN_ID,
          full_name: 'Jordan Lee',
          email: 'jordan@company.com',
          created_at: new Date().toISOString(),
        },
      },
    ],
  },
  {
    id: DEFAULT_COL_REVIEW_ID,
    board_id: DEFAULT_BOARD_ID,
    name: 'In Review',
    order_index: 2,
    created_at: '2026-01-15T09:00:00.000Z',
    tasks: [
      {
        id: 'd4000000-0000-4000-8000-000000000004',
        column_id: DEFAULT_COL_REVIEW_ID,
        title: 'Client onboarding contract template update',
        description: 'Awaiting final legal review before publishing to the sales portal.',
        assignee_id: DEFAULT_PROFILE_ALEX_ID,
        deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
        priority: 'Medium',
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assignee: {
          id: DEFAULT_PROFILE_ALEX_ID,
          full_name: 'Alex Rivera',
          email: 'alex@company.com',
          created_at: new Date().toISOString(),
        },
      },
    ],
  },
  {
    id: DEFAULT_COL_DONE_ID,
    board_id: DEFAULT_BOARD_ID,
    name: 'Completed',
    order_index: 3,
    created_at: '2026-01-15T09:00:00.000Z',
    tasks: [
      {
        id: 'd5000000-0000-4000-8000-000000000005',
        column_id: DEFAULT_COL_DONE_ID,
        title: 'Provision zero-cost Supabase project & SQL schema',
        description: 'Setup tables for profiles, boards, columns, and tasks.',
        assignee_id: DEFAULT_PROFILE_JORDAN_ID,
        deadline: new Date(Date.now() - 86400000).toISOString(),
        priority: 'High',
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assignee: {
          id: DEFAULT_PROFILE_JORDAN_ID,
          full_name: 'Jordan Lee',
          email: 'jordan@company.com',
          created_at: new Date().toISOString(),
        },
      },
    ],
  },
];

const INITIAL_BOARD_2_COLUMNS: ColumnWithTasks[] = [
  {
    id: 'c2000000-0000-4000-8000-000000000011',
    board_id: DEFAULT_BOARD_MARKETING_ID,
    name: 'Backlog',
    order_index: 0,
    created_at: '2026-02-20T10:00:00.000Z',
    tasks: [
      {
        id: 'd6000000-0000-4000-8000-000000000006',
        column_id: 'c2000000-0000-4000-8000-000000000011',
        title: 'Design Q4 marketing landing page banner assets',
        description: 'Produce high-resolution vector assets for social platforms.',
        assignee_id: DEFAULT_PROFILE_TAYLOR_ID,
        deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
        priority: 'High',
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assignee: {
          id: DEFAULT_PROFILE_TAYLOR_ID,
          full_name: 'Taylor Chen',
          email: 'taylor@company.com',
          created_at: new Date().toISOString(),
        },
      },
    ],
  },
  {
    id: 'c2000000-0000-4000-8000-000000000012',
    board_id: DEFAULT_BOARD_MARKETING_ID,
    name: 'In Progress',
    order_index: 1,
    created_at: '2026-02-20T10:00:00.000Z',
    tasks: [
      {
        id: 'd7000000-0000-4000-8000-000000000007',
        column_id: 'c2000000-0000-4000-8000-000000000012',
        title: 'Coordinate partner invitation webinar outreach',
        description: 'Send personalized calendar invites to the top 50 partners.',
        assignee_id: DEFAULT_PROFILE_SARAH_ID,
        deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
        priority: 'Medium',
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assignee: {
          id: DEFAULT_PROFILE_SARAH_ID,
          full_name: 'Sarah Connor',
          email: 'sarah@company.com',
          created_at: new Date().toISOString(),
        },
      },
    ],
  },
  {
    id: 'c2000000-0000-4000-8000-000000000013',
    board_id: DEFAULT_BOARD_MARKETING_ID,
    name: 'In Review',
    order_index: 2,
    created_at: '2026-02-20T10:00:00.000Z',
    tasks: [],
  },
  {
    id: 'c2000000-0000-4000-8000-000000000014',
    board_id: DEFAULT_BOARD_MARKETING_ID,
    name: 'Completed',
    order_index: 3,
    created_at: '2026-02-20T10:00:00.000Z',
    tasks: [],
  },
];

const DEMO_AUDIT_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340"><rect width="100%" height="100%" fill="%2309090b"/><rect x="20" y="20" width="560" height="300" rx="8" fill="%2318181b" stroke="%2327272a" stroke-width="2"/><circle cx="80" cy="70" r="16" fill="%230284c7"/><text x="110" y="75" font-family="sans-serif" font-size="16" font-weight="bold" fill="%23ffffff">Stripe Subscription Audit - Q1 2026</text><rect x="40" y="110" width="520" height="36" rx="4" fill="%2327272a"/><text x="60" y="133" font-family="sans-serif" font-size="12" fill="%2338bdf8">Flagged Redundancy #1: Duplicate Analytics seats ($480/mo)</text><rect x="40" y="160" width="520" height="36" rx="4" fill="%2327272a"/><text x="60" y="183" font-family="sans-serif" font-size="12" fill="%2338bdf8">Flagged Redundancy #2: Inactive Staging Cluster ($1,150/mo)</text><rect x="40" y="210" width="520" height="36" rx="4" fill="%2327272a"/><text x="60" y="233" font-family="sans-serif" font-size="12" fill="%2338bdf8">Flagged Redundancy #3: Legacy Monitoring Agent ($320/mo)</text><text x="40" y="285" font-family="sans-serif" font-size="13" font-weight="bold" fill="%234ade80">Estimated Monthly Savings: $1,950 / month</text></svg>';

const INITIAL_DEMO_COMMENTS: Record<string, TaskComment[]> = {
  'd1000000-0000-4000-8000-000000000001': [
    {
      id: 'comm-1',
      task_id: 'd1000000-0000-4000-8000-000000000001',
      author_name: 'Alex Rivera',
      author_email: 'alex@company.com',
      content: 'I pulled the Stripe invoicing report and flagged 3 redundant subscriptions. See audit graphic attached.',
      attachments: [
        {
          id: 'att-demo-1',
          name: 'Stripe_Invoice_Audit_Q1.png',
          size: 184320, // 180 KB
          type: 'image/svg+xml',
          url: DEMO_AUDIT_IMAGE,
          created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
      ],
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: 'comm-2',
      task_id: 'd1000000-0000-4000-8000-000000000001',
      author_name: 'Jordan Lee',
      author_email: 'jordan@company.com',
      content: 'Great catch. Let us review the vendor terms before the 1st of next month.',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ],
  'd3000000-0000-4000-8000-000000000003': [
    {
      id: 'comm-3',
      task_id: 'd3000000-0000-4000-8000-000000000003',
      author_name: 'Jordan Lee',
      author_email: 'jordan@company.com',
      content: 'Optimistic state handlers are wired up with automatic rollback on network failure.',
      created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    },
  ],
};

// Safe LocalStorage helpers
const getStoredWorkspaces = (): Workspace[] => {
  if (typeof window === 'undefined') return INITIAL_WORKSPACES;
  try {
    const raw = localStorage.getItem(WORKSPACES_STORAGE_KEY);
    if (!raw) return INITIAL_WORKSPACES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_WORKSPACES;
  } catch {
    return INITIAL_WORKSPACES;
  }
};

const getStoredActiveWorkspaceId = (availableWorkspaces: Workspace[]): string => {
  if (typeof window === 'undefined') return availableWorkspaces[0]?.id || DEFAULT_WORKSPACE_1_ID;
  try {
    const raw = localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    if (raw && availableWorkspaces.some((w) => w.id === raw)) {
      return raw;
    }
    return availableWorkspaces[0]?.id || DEFAULT_WORKSPACE_1_ID;
  } catch {
    return availableWorkspaces[0]?.id || DEFAULT_WORKSPACE_1_ID;
  }
};

const getStoredBoards = (): Board[] => {
  if (typeof window === 'undefined') return INITIAL_BOARDS;
  try {
    const raw = localStorage.getItem(BOARDS_STORAGE_KEY);
    if (!raw) return INITIAL_BOARDS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure all boards have a valid workspace_id for seamless backward compatibility
      return parsed.map((b: Board) => ({
        ...b,
        workspace_id:
          b.workspace_id ||
          (b.id === DEFAULT_BOARD_MARKETING_ID
            ? DEFAULT_WORKSPACE_2_ID
            : DEFAULT_WORKSPACE_1_ID),
      }));
    }
    return INITIAL_BOARDS;
  } catch {
    return INITIAL_BOARDS;
  }
};

const getStoredBoardMembers = (): Record<string, BoardMember[]> => {
  if (typeof window === 'undefined') return INITIAL_BOARD_MEMBERS;
  try {
    const raw = localStorage.getItem(BOARD_MEMBERS_STORAGE_KEY);
    if (!raw) return INITIAL_BOARD_MEMBERS;
    const parsed = JSON.parse(raw);
    return { ...INITIAL_BOARD_MEMBERS, ...parsed };
  } catch {
    return INITIAL_BOARD_MEMBERS;
  }
};

const getStoredColumnsMap = (): Record<string, ColumnWithTasks[]> => {
  const initialMap: Record<string, ColumnWithTasks[]> = {
    [DEFAULT_BOARD_ID]: INITIAL_BOARD_1_COLUMNS,
    [DEFAULT_BOARD_MARKETING_ID]: INITIAL_BOARD_2_COLUMNS,
  };
  if (typeof window === 'undefined') return initialMap;
  try {
    const raw = localStorage.getItem(BOARD_COLUMNS_STORAGE_KEY);
    if (!raw) return initialMap;
    const parsed = JSON.parse(raw);
    return { ...initialMap, ...parsed };
  } catch {
    return initialMap;
  }
};

const getStoredComments = (): Record<string, TaskComment[]> => {
  if (typeof window === 'undefined') return INITIAL_DEMO_COMMENTS;
  try {
    const raw = localStorage.getItem(COMMENTS_STORAGE_KEY);
    if (!raw) return INITIAL_DEMO_COMMENTS;
    const parsed = JSON.parse(raw);
    return { ...INITIAL_DEMO_COMMENTS, ...parsed };
  } catch {
    return INITIAL_DEMO_COMMENTS;
  }
};

const INITIAL_BOARD_DOCUMENTS: Record<string, BoardDocument[]> = {
  [DEFAULT_BOARD_ID]: [
    {
      id: 'doc-1001',
      board_id: DEFAULT_BOARD_ID,
      title: 'Sprint 14 Operational Architecture & Runbook',
      content: `# Sprint 14 Operational Architecture & Runbook

## Overview
This document outlines the high-availability infrastructure layout, service level objectives (SLOs), and automated deployment procedures for the Core Operations cluster during Sprint 14.

---

### Core Objectives & Targets
- **System Uptime Target:** 99.95% availability across all operational zones.
- **Max P99 Latency:** < 180ms for all distributed read operations.
- **Failover Recovery RTO:** < 45 seconds using automated health-check rerouting.

---

### Architecture Components
1. **Edge Ingress & CDN:** Cloudflare Argo routing with TLS 1.3 termination.
2. **Application Tier:** Distributed stateless container services with horizontal pod autoscaling (min 3, max 12 replicas).
3. **Primary Storage:** High-performance PostgreSQL cluster with streaming asynchronous replicas in secondary region.
4. **Cache & Queues:** In-memory Redis cache cluster with pub/sub task dispatch.

---

### Emergency Rollback Runbook
If an anomalous error rate exceeding 1.5% occurs post-deployment:
- [x] Trigger instant canary traffic drain via edge routing
- [x] Check container health logs: \`kubectl logs -l app=core-ops --tail=100\`
- [x] Revert deployment revision: \`kubectl rollout undo deployment/core-ops-svc\`
- [ ] Notify incident response team on the operations dispatch channel

> **Notice:** All configuration variables and secrets must be updated through Secret Manager, never committed directly to repositories.`,
      icon: '📋',
      category: 'Architecture',
      tags: ['Infrastructure', 'SRE', 'Sprint-14', 'Runbook'],
      status: 'published',
      is_starred: true,
      created_by: {
        name: 'Alex Rivera',
        email: 'alex@company.com',
      },
      created_at: '2026-09-28T09:00:00.000Z',
      updated_at: '2026-10-06T06:15:00.000Z',
      last_activity: {
        id: 'act-101',
        document_id: 'doc-1001',
        user_name: 'Sarah Connor',
        user_email: 'sarah@company.com',
        action_type: 'edited_content',
        action_description: 'Updated emergency rollback runbook steps',
        timestamp: '2026-10-06T06:15:00.000Z',
        details: 'Updated checklist items and failover metrics',
      },
      activity_log: [
        {
          id: 'act-101',
          document_id: 'doc-1001',
          user_name: 'Sarah Connor',
          user_email: 'sarah@company.com',
          action_type: 'edited_content',
          action_description: 'Updated emergency rollback runbook steps',
          timestamp: '2026-10-06T06:15:00.000Z',
          details: 'Updated checklist items and failover metrics',
        },
        {
          id: 'act-100',
          document_id: 'doc-1001',
          user_name: 'Jordan Lee',
          user_email: 'jordan@company.com',
          action_type: 'status_changed',
          action_description: 'Changed status to Published',
          timestamp: '2026-10-04T14:30:00.000Z',
        },
        {
          id: 'act-099',
          document_id: 'doc-1001',
          user_name: 'Alex Rivera',
          user_email: 'alex@company.com',
          action_type: 'created',
          action_description: 'Document created by Alex Rivera',
          timestamp: '2026-09-28T09:00:00.000Z',
        },
      ],
    },
    {
      id: 'doc-1002',
      board_id: DEFAULT_BOARD_ID,
      title: 'Database Migration & Backup Retention Policy',
      content: `# Database Migration & Backup Retention Policy

## Compliance & Retention Requirements
This standard operating procedure defines our backup frequencies, snapshot retention schedules, and verification protocols for compliance audit readiness.

### Backup Schedule
| Tier | Frequency | Retention Window | Storage Location |
| :--- | :--- | :--- | :--- |
| **Transaction Logs (WAL)** | Continuous (every 5 min) | 14 Days | Multi-region bucket (Encrypted) |
| **Daily Full Snapshots** | Daily at 02:00 UTC | 30 Days | Cold storage archive |
| **Monthly Compliance** | 1st of each month | 12 Months | Immutable WORM bucket |

---

### Verification Protocol
- Automated restore rehearsals run every Sunday at 04:00 UTC.
- Checksums verified against master signature hashes.
- Discrepancy alerts dispatched directly to SRE on-call team.`,
      icon: '🛡️',
      category: 'Guidelines',
      tags: ['Database', 'Compliance', 'Security'],
      status: 'published',
      is_starred: false,
      created_by: {
        name: 'Jordan Lee',
        email: 'jordan@company.com',
      },
      created_at: '2026-10-01T10:00:00.000Z',
      updated_at: '2026-10-06T05:20:00.000Z',
      last_activity: {
        id: 'act-102',
        document_id: 'doc-1002',
        user_name: 'Alex Rivera',
        user_email: 'alex@company.com',
        action_type: 'tagged',
        action_description: 'Updated compliance security tags and verified WORM retention',
        timestamp: '2026-10-06T05:20:00.000Z',
        details: 'Added Compliance tag',
      },
      activity_log: [
        {
          id: 'act-102',
          document_id: 'doc-1002',
          user_name: 'Alex Rivera',
          user_email: 'alex@company.com',
          action_type: 'tagged',
          action_description: 'Updated compliance security tags and verified WORM retention',
          timestamp: '2026-10-06T05:20:00.000Z',
          details: 'Added Compliance tag',
        },
        {
          id: 'act-098',
          document_id: 'doc-1002',
          user_name: 'Jordan Lee',
          user_email: 'jordan@company.com',
          action_type: 'created',
          action_description: 'Document created by Jordan Lee',
          timestamp: '2026-10-01T10:00:00.000Z',
        },
      ],
    },
    {
      id: 'doc-1003',
      board_id: DEFAULT_BOARD_ID,
      title: 'Weekly Ops Sync & Incident Retrospective',
      content: `# Weekly Ops Sync & Incident Retrospective

## Meeting Details
- **Date:** October 6, 2026
- **Facilitator:** Elena Rostova
- **Attendees:** Alex Rivera, Jordan Lee, Sarah Connor, Elena Rostova

---

### What Went Well
- Zero unplanned outages during the database index maintenance window.
- Average sprint ticket turnaround time dropped from 3.2 days to 2.1 days.
- Automated dependency vulnerability scanner caught 2 outdated packages prior to staging.

### Areas for Improvement
- Alert noise on CPU spike warnings during midnight backup jobs.
- API documentation needs syncing with latest endpoint schema changes.

### Action Items
- [x] Adjust alerting threshold from 80% to 90% during scheduled backup window
- [ ] Create automated API spec export script for frontend client SDK
- [ ] Schedule Q4 capacity planning workshop with engineering leads`,
      icon: '📝',
      category: 'Meeting Notes',
      tags: ['Retrospective', 'Operations', 'Weekly'],
      status: 'in_review',
      is_starred: false,
      created_by: {
        name: 'Elena Rostova',
        email: 'elena@company.com',
      },
      created_at: '2026-10-03T11:00:00.000Z',
      updated_at: '2026-10-06T04:10:00.000Z',
      last_activity: {
        id: 'act-103',
        document_id: 'doc-1003',
        user_name: 'Elena Rostova',
        user_email: 'elena@company.com',
        action_type: 'edited_content',
        action_description: 'Added incident action items and updated attendee list',
        timestamp: '2026-10-06T04:10:00.000Z',
        details: 'Checked off completed action items',
      },
      activity_log: [
        {
          id: 'act-103',
          document_id: 'doc-1003',
          user_name: 'Elena Rostova',
          user_email: 'elena@company.com',
          action_type: 'edited_content',
          action_description: 'Added incident action items and updated attendee list',
          timestamp: '2026-10-06T04:10:00.000Z',
          details: 'Checked off completed action items',
        },
        {
          id: 'act-095',
          document_id: 'doc-1003',
          user_name: 'Elena Rostova',
          user_email: 'elena@company.com',
          action_type: 'created',
          action_description: 'Document created by Elena Rostova',
          timestamp: '2026-10-03T11:00:00.000Z',
        },
      ],
    },
  ],
  [DEFAULT_BOARD_MARKETING_ID]: [
    {
      id: 'doc-2001',
      board_id: DEFAULT_BOARD_MARKETING_ID,
      title: 'Q4 Product Launch PRD & GTM Checklist',
      content: `# Q4 Product Launch PRD & GTM Checklist

## Executive Summary
This PRD outlines the go-to-market strategy, positioning statements, and key milestones for the Q4 release of the dynamic sprint timeline and document collaboration engine.

---

### Target Audiences & Personas
1. **Engineering Managers:** Need visibility into sprint dependencies and velocity metrics.
2. **Product Leads:** Require shareable specs, roadmaps, and documented decisions.
3. **Cross-functional Teams:** Demand synchronous visibility without fragmented silos.

---

### GTM Launch Deliverables
- [x] Product demo video and interactive playground
- [x] Help center documentation and onboarding walkthrough
- [ ] Customer webinar registration page and email sequence
- [ ] Press release distribution to industry newsletters`,
      icon: '🚀',
      category: 'Specs',
      tags: ['GTM', 'Launch', 'PRD', 'Q4'],
      status: 'published',
      is_starred: true,
      created_by: {
        name: 'Taylor Chen',
        email: 'taylor@company.com',
      },
      created_at: '2026-10-02T14:00:00.000Z',
      updated_at: '2026-10-06T06:05:00.000Z',
      last_activity: {
        id: 'act-201',
        document_id: 'doc-2001',
        user_name: 'Sarah Connor',
        user_email: 'sarah@company.com',
        action_type: 'edited_content',
        action_description: 'Updated GTM launch deliverables and target personas',
        timestamp: '2026-10-06T06:05:00.000Z',
        details: 'Checked off interactive playground',
      },
      activity_log: [
        {
          id: 'act-201',
          document_id: 'doc-2001',
          user_name: 'Sarah Connor',
          user_email: 'sarah@company.com',
          action_type: 'edited_content',
          action_description: 'Updated GTM launch deliverables and target personas',
          timestamp: '2026-10-06T06:05:00.000Z',
        },
        {
          id: 'act-190',
          document_id: 'doc-2001',
          user_name: 'Taylor Chen',
          user_email: 'taylor@company.com',
          action_type: 'created',
          action_description: 'Document created by Taylor Chen',
          timestamp: '2026-10-02T14:00:00.000Z',
        },
      ],
    },
  ],
};

const getStoredDocumentsMap = (): Record<string, BoardDocument[]> => {
  if (typeof window === 'undefined') return INITIAL_BOARD_DOCUMENTS;
  try {
    const raw = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    if (!raw) return INITIAL_BOARD_DOCUMENTS;
    const parsed = JSON.parse(raw);
    return { ...INITIAL_BOARD_DOCUMENTS, ...parsed };
  } catch {
    return INITIAL_BOARD_DOCUMENTS;
  }
};

const initialWorkspaces = getStoredWorkspaces();
const initialActiveWorkspaceId = getStoredActiveWorkspaceId(initialWorkspaces);

export const useKanbanStore = create<KanbanState>((set, get) => ({
  workspaces: initialWorkspaces,
  activeWorkspaceId: initialActiveWorkspaceId,
  boards: getStoredBoards(),
  board: null,
  columns: [],
  profiles: INITIAL_GLOBAL_PROFILES,
  boardMembers: getStoredBoardMembers(),
  comments: getStoredComments(),
  documents: getStoredDocumentsMap(),
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  /**
   * Returns current workspaces list
   */
  fetchWorkspaces: (): Workspace[] => {
    return get().workspaces;
  },

  /**
   * Switch the active workspace and load its primary board
   */
  setActiveWorkspaceId: async (workspaceId: string) => {
    const ws = get().workspaces.find((w) => w.id === workspaceId);
    if (!ws) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
    }

    set({ activeWorkspaceId: workspaceId });

    // Find boards belonging to this workspace
    const workspaceBoards = get().boards.filter(
      (b) => (b.workspace_id || DEFAULT_WORKSPACE_1_ID) === workspaceId
    );

    if (workspaceBoards.length > 0) {
      // If current board is not in this workspace, load the first board of this workspace
      if (!get().board || (get().board?.workspace_id || DEFAULT_WORKSPACE_1_ID) !== workspaceId) {
        await get().fetchBoard(workspaceBoards[0].id);
      }
    } else {
      // If workspace has no boards, create a starter board for it so user never hits an empty crash
      const newBoardId = await get().createBoard(
        `${ws.name} General Board`,
        `Default project board for ${ws.name}`,
        undefined,
        workspaceId
      );
      await get().fetchBoard(newBoardId);
    }
  },

  /**
   * Create a new workspace (MVP limit: up to 3 workspaces per user)
   */
  createWorkspace: async (name: string, description?: string, color?: string): Promise<string> => {
    const currentWorkspaces = get().workspaces;
    if (currentWorkspaces.length >= 3) {
      throw new Error('Limit reached: Maximum 3 workspaces allowed per user in MVP version.');
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Workspace name is required.');
    }

    const newWorkspaceId = crypto.randomUUID();
    const newWorkspace: Workspace = {
      id: newWorkspaceId,
      name: trimmedName,
      description: description?.trim() || null,
      color: color || '#0284c7',
      created_at: new Date().toISOString(),
      owner_email: 'dat.phan93@gmail.com',
    };

    const updatedWorkspaces = [...currentWorkspaces, newWorkspace];

    // Persist workspaces
    if (typeof window !== 'undefined') {
      localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(updatedWorkspaces));
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, newWorkspaceId);
    }

    set({
      workspaces: updatedWorkspaces,
      activeWorkspaceId: newWorkspaceId,
    });

    // Create 1 initial starter board for this workspace so it is immediately usable
    const starterBoardId = await get().createBoard(
      `${trimmedName} Project Board`,
      `Primary deliverable workflow for ${trimmedName}`,
      undefined,
      newWorkspaceId
    );

    await get().fetchBoard(starterBoardId);
    return newWorkspaceId;
  },

  /**
   * Delete a workspace
   */
  deleteWorkspace: async (workspaceId: string): Promise<void> => {
    const currentWorkspaces = get().workspaces;
    if (currentWorkspaces.length <= 1) {
      throw new Error('At least one workspace must be retained.');
    }

    const updatedWorkspaces = currentWorkspaces.filter((w) => w.id !== workspaceId);

    // Also remove boards belonging to this workspace
    const remainingBoards = get().boards.filter(
      (b) => (b.workspace_id || DEFAULT_WORKSPACE_1_ID) !== workspaceId
    );

    if (typeof window !== 'undefined') {
      localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(updatedWorkspaces));
      localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(remainingBoards));
    }

    // Determine new active workspace
    const newActiveWsId = updatedWorkspaces[0].id;

    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, newActiveWsId);
    }

    set({
      workspaces: updatedWorkspaces,
      boards: remainingBoards,
      activeWorkspaceId: newActiveWsId,
    });

    // Switch to first board in new active workspace
    const nextWsBoards = remainingBoards.filter(
      (b) => (b.workspace_id || DEFAULT_WORKSPACE_1_ID) === newActiveWsId
    );
    if (nextWsBoards.length > 0) {
      await get().fetchBoard(nextWsBoards[0].id);
    }
  },

  /**
   * Returns assignees allowed for this board: ONLY the members invited to this board.
   */
  getBoardAssignees: (boardId?: string): Profile[] => {
    const activeBoardId = boardId || get().board?.id || DEFAULT_BOARD_ID;
    const members = get().boardMembers[activeBoardId] || [];
    const allProfiles = get().profiles;

    return members.map((m) => {
      // Find matching profile from global profiles if exists, or generate valid profile representation
      const matched = allProfiles.find((p) => p.id === m.profile_id || p.email === m.email);
      if (matched) {
        return matched;
      }
      return {
        id: m.profile_id || m.id,
        full_name: m.name,
        email: m.email,
        created_at: m.joined_at,
      };
    });
  },

  /**
   * Retrieves columns and tasks for all boards with active in-memory sync
   */
  getAllBoardsColumns: (): Record<string, ColumnWithTasks[]> => {
    const map = getStoredColumnsMap();
    const currentBoard = get().board;
    if (currentBoard && get().columns.length > 0) {
      map[currentBoard.id] = get().columns;
    }
    return map;
  },

  /**
   * Fetch all workspace boards from Supabase or local storage
   */
  fetchBoards: async () => {
    try {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        // Merge Supabase boards with default/locally created boards
        const localBoards = getStoredBoards();
        const mergedMap = new Map<string, Board>();
        localBoards.forEach((b) => mergedMap.set(b.id, b));
        (data as Board[]).forEach((b) => mergedMap.set(b.id, b));
        const mergedList = Array.from(mergedMap.values());

        set({ boards: mergedList });
        if (typeof window !== 'undefined') {
          localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(mergedList));
        }
        return mergedList;
      }
    } catch {
      // Fallback to local stored boards
    }

    const currentBoards = get().boards.length > 0 ? get().boards : getStoredBoards();
    set({ boards: currentBoards });
    return currentBoards;
  },

  /**
   * Fetch a single board, its workflow columns, tasks, and attached members
   */
  fetchBoard: async (boardId: string) => {
    set({ isLoading: true, error: null });

    try {
      const allBoards = get().boards.length > 0 ? get().boards : getStoredBoards();
      let activeBoardId = boardId;

      // Handle 'default-board-id' or missing ID
      if (!activeBoardId || activeBoardId === 'default-board-id') {
        activeBoardId = allBoards[0]?.id || DEFAULT_BOARD_ID;
      }

      // Find board metadata
      let targetBoard = allBoards.find((b) => b.id === activeBoardId);

      // If not in memory, query Supabase
      if (!targetBoard) {
        try {
          const { data: dbBoard } = await supabase
            .from('boards')
            .select('*')
            .eq('id', activeBoardId)
            .maybeSingle();

          if (dbBoard) {
            targetBoard = dbBoard as Board;
            set((state) => ({ boards: [...state.boards, targetBoard!] }));
          }
        } catch {
          // Ignore
        }
      }

      // If still not found, fallback to first available board
      if (!targetBoard) {
        targetBoard = allBoards[0] || INITIAL_BOARDS[0];
        activeBoardId = targetBoard.id;
      }

      // 1. Check local columns cache first
      const columnsMap = getStoredColumnsMap();
      let boardColumns: ColumnWithTasks[] = columnsMap[activeBoardId] || [];

      // 2. Try fetching from Supabase if table exists
      try {
        const { data: dbCols } = await supabase
          .from('columns')
          .select('*')
          .eq('board_id', activeBoardId)
          .order('order_index', { ascending: true });

        if (dbCols && dbCols.length > 0) {
          const colIds = dbCols.map((c) => c.id);
          const { data: dbTasks } = await supabase
            .from('tasks')
            .select('*, assignee:profiles(*)')
            .in('column_id', colIds)
            .eq('is_archived', false)
            .order('created_at', { ascending: true });

          const rawTasks = (dbTasks || []) as unknown as TaskWithAssignee[];
          const commentsMap = get().comments;

          boardColumns = (dbCols as Column[]).map((col) => ({
            ...col,
            tasks: rawTasks
              .filter((t) => t.column_id === col.id)
              .map((t) => ({
                ...t,
                comments: commentsMap[t.id] || [],
              })),
          }));
        }
      } catch {
        // Fall back to stored columns
      }

      // If no columns found for this board, initialize standard 4-stage Kanban columns
      if (!boardColumns || boardColumns.length === 0) {
        boardColumns = [
          {
            id: crypto.randomUUID(),
            board_id: activeBoardId,
            name: 'Backlog',
            order_index: 0,
            created_at: new Date().toISOString(),
            tasks: [],
          },
          {
            id: crypto.randomUUID(),
            board_id: activeBoardId,
            name: 'In Progress',
            order_index: 1,
            created_at: new Date().toISOString(),
            tasks: [],
          },
          {
            id: crypto.randomUUID(),
            board_id: activeBoardId,
            name: 'In Review',
            order_index: 2,
            created_at: new Date().toISOString(),
            tasks: [],
          },
          {
            id: crypto.randomUUID(),
            board_id: activeBoardId,
            name: 'Completed',
            order_index: 3,
            created_at: new Date().toISOString(),
            tasks: [],
          },
        ];

        // Save columns to local map
        columnsMap[activeBoardId] = boardColumns;
        if (typeof window !== 'undefined') {
          localStorage.setItem(BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnsMap));
        }
      }

      // Attach comments to tasks
      const commentsMap = get().comments;
      const columnsWithComments = boardColumns.map((col) => ({
        ...col,
        tasks: col.tasks.map((t) => ({
          ...t,
          comments: commentsMap[t.id] || t.comments || [],
        })),
      }));

      // Get invited members for this board
      const allMembersMap = get().boardMembers;
      const boardMembers = allMembersMap[activeBoardId] || [];

      const boardWithDetails: BoardWithDetails = {
        ...targetBoard,
        columns: columnsWithComments,
        members: boardMembers,
      };

      set({
        board: boardWithDetails,
        columns: columnsWithComments,
        isLoading: false,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred while fetching board';
      set({ error: errorMessage, isLoading: false });
    }
  },

  /**
   * Create a new board with standard columns and invited members (MVP limit: up to 5 boards per workspace)
   */
  createBoard: async (
    name: string,
    description?: string,
    initialMembers?: Array<{ name: string; email: string; role?: 'Owner' | 'Admin' | 'Member'; profile_id?: string }>,
    targetWorkspaceId?: string
  ) => {
    const targetWsId = targetWorkspaceId || get().activeWorkspaceId || DEFAULT_WORKSPACE_1_ID;

    // MVP Limit check: Maximum 5 boards per workspace
    const existingBoardsInWorkspace = get().boards.filter(
      (b) => (b.workspace_id || DEFAULT_WORKSPACE_1_ID) === targetWsId
    );

    if (existingBoardsInWorkspace.length >= 5) {
      throw new Error('Limit reached: Maximum 5 boards allowed per workspace in MVP version.');
    }

    const newBoardId = crypto.randomUUID();
    const newBoard: Board = {
      id: newBoardId,
      workspace_id: targetWsId,
      name: name.trim(),
      description: description?.trim() || null,
      created_by: null,
      created_at: new Date().toISOString(),
    };

    // Standard columns for new board
    const newColumns: ColumnWithTasks[] = [
      {
        id: crypto.randomUUID(),
        board_id: newBoardId,
        name: 'Backlog',
        order_index: 0,
        created_at: new Date().toISOString(),
        tasks: [],
      },
      {
        id: crypto.randomUUID(),
        board_id: newBoardId,
        name: 'In Progress',
        order_index: 1,
        created_at: new Date().toISOString(),
        tasks: [],
      },
      {
        id: crypto.randomUUID(),
        board_id: newBoardId,
        name: 'In Review',
        order_index: 2,
        created_at: new Date().toISOString(),
        tasks: [],
      },
      {
        id: crypto.randomUUID(),
        board_id: newBoardId,
        name: 'Completed',
        order_index: 3,
        created_at: new Date().toISOString(),
        tasks: [],
      },
    ];

    // Invited members setup
    const membersToInvite: BoardMember[] = (initialMembers && initialMembers.length > 0)
      ? initialMembers.map((m) => ({
          id: crypto.randomUUID(),
          board_id: newBoardId,
          profile_id: m.profile_id || crypto.randomUUID(),
          name: m.name,
          email: m.email,
          role: m.role || 'Member',
          joined_at: new Date().toISOString(),
        }))
      : [
          // Default to Alex Rivera if none specified
          {
            id: crypto.randomUUID(),
            board_id: newBoardId,
            profile_id: DEFAULT_PROFILE_ALEX_ID,
            name: 'Alex Rivera',
            email: 'alex@company.com',
            role: 'Owner',
            joined_at: new Date().toISOString(),
          },
        ];

    // Update boards list
    const updatedBoards = [newBoard, ...get().boards];
    const updatedMembersMap = {
      ...get().boardMembers,
      [newBoardId]: membersToInvite,
    };

    // Save columns
    const columnsMap = getStoredColumnsMap();
    columnsMap[newBoardId] = newColumns;

    // Persist locally
    if (typeof window !== 'undefined') {
      localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(updatedBoards));
      localStorage.setItem(BOARD_MEMBERS_STORAGE_KEY, JSON.stringify(updatedMembersMap));
      localStorage.setItem(BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnsMap));
    }

    // Try sync to Supabase
    try {
      await supabase.from('boards').insert({
        id: newBoard.id,
        name: newBoard.name,
        created_at: newBoard.created_at,
      });

      for (const col of newColumns) {
        await supabase.from('columns').insert({
          id: col.id,
          board_id: col.board_id,
          name: col.name,
          order_index: col.order_index,
        });
      }
    } catch {
      // Ignored for offline/demo
    }

    set({
      boards: updatedBoards,
      boardMembers: updatedMembersMap,
      board: {
        ...newBoard,
        columns: newColumns,
        members: membersToInvite,
      },
      columns: newColumns,
    });

    return newBoardId;
  },

  /**
   * Delete a board
   */
  deleteBoard: async (boardId: string) => {
    const previousBoards = get().boards;
    const boardToDelete = previousBoards.find((b) => b.id === boardId);
    const targetWsId =
      boardToDelete?.workspace_id || get().activeWorkspaceId || DEFAULT_WORKSPACE_1_ID;

    const workspaceBoards = previousBoards.filter(
      (b) => (b.workspace_id || DEFAULT_WORKSPACE_1_ID) === targetWsId
    );

    if (workspaceBoards.length <= 1) {
      throw new Error('Each workspace must retain at least one project board.');
    }

    const updatedBoards = previousBoards.filter((b) => b.id !== boardId);
    const updatedMembers = { ...get().boardMembers };
    delete updatedMembers[boardId];

    const columnsMap = getStoredColumnsMap();
    delete columnsMap[boardId];

    if (typeof window !== 'undefined') {
      localStorage.setItem(BOARDS_STORAGE_KEY, JSON.stringify(updatedBoards));
      localStorage.setItem(BOARD_MEMBERS_STORAGE_KEY, JSON.stringify(updatedMembers));
      localStorage.setItem(BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnsMap));
    }

    try {
      await supabase.from('boards').delete().eq('id', boardId);
    } catch {
      // Ignored
    }

    set({
      boards: updatedBoards,
      boardMembers: updatedMembers,
    });

    // If currently active board was deleted, switch to next available board in this workspace
    if (get().board?.id === boardId) {
      const remainingInWs = updatedBoards.filter(
        (b) => (b.workspace_id || DEFAULT_WORKSPACE_1_ID) === targetWsId
      );
      if (remainingInWs.length > 0) {
        await get().fetchBoard(remainingInWs[0].id);
      } else if (updatedBoards.length > 0) {
        await get().fetchBoard(updatedBoards[0].id);
      }
    }
  },

  /**
   * Invite member to a board
   */
  inviteMemberToBoard: async (boardId: string, memberData) => {
    const existing = get().boardMembers[boardId] || [];

    // Prevent duplicate emails on same board
    const alreadyInvited = existing.find(
      (m) => m.email.toLowerCase() === memberData.email.toLowerCase().trim()
    );
    if (alreadyInvited) {
      throw new Error(`${memberData.email} has already been invited to this board.`);
    }

    // Check if member matches an existing profile ID or create new one
    const matchingProfile = get().profiles.find(
      (p) => p.email?.toLowerCase() === memberData.email.toLowerCase().trim()
    );

    const profileId = matchingProfile?.id || memberData.profile_id || crypto.randomUUID();

    const newMember: BoardMember = {
      id: crypto.randomUUID(),
      board_id: boardId,
      profile_id: profileId,
      name: memberData.name.trim(),
      email: memberData.email.trim().toLowerCase(),
      role: memberData.role || 'Member',
      joined_at: new Date().toISOString(),
    };

    const updatedMembers = [...existing, newMember];
    const updatedMembersMap = {
      ...get().boardMembers,
      [boardId]: updatedMembers,
    };

    // If member not in global profiles pool, add them
    let updatedProfiles = get().profiles;
    if (!matchingProfile) {
      const newProfile: Profile = {
        id: profileId,
        full_name: memberData.name.trim(),
        email: memberData.email.trim().toLowerCase(),
        created_at: new Date().toISOString(),
      };
      updatedProfiles = [...updatedProfiles, newProfile];
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(BOARD_MEMBERS_STORAGE_KEY, JSON.stringify(updatedMembersMap));
    }

    set((state) => ({
      boardMembers: updatedMembersMap,
      profiles: updatedProfiles,
      board:
        state.board?.id === boardId
          ? { ...state.board, members: updatedMembers }
          : state.board,
    }));

    return newMember;
  },

  /**
   * Remove member from board
   */
  removeMemberFromBoard: async (boardId: string, memberId: string) => {
    const existing = get().boardMembers[boardId] || [];
    const updatedMembers = existing.filter((m) => m.id !== memberId && m.profile_id !== memberId);

    const updatedMembersMap = {
      ...get().boardMembers,
      [boardId]: updatedMembers,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(BOARD_MEMBERS_STORAGE_KEY, JSON.stringify(updatedMembersMap));
    }

    set((state) => ({
      boardMembers: updatedMembersMap,
      board:
        state.board?.id === boardId
          ? { ...state.board, members: updatedMembers }
          : state.board,
    }));
  },

  /**
   * Set columns directly
   */
  setColumns: (columns: ColumnWithTasks[]) => {
    const currentBoard = get().board;
    if (!currentBoard) return;

    const columnsMap = getStoredColumnsMap();
    columnsMap[currentBoard.id] = columns;

    if (typeof window !== 'undefined') {
      localStorage.setItem(BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnsMap));
    }

    set({
      columns,
      board: { ...currentBoard, columns },
    });
  },

  /**
   * Add a new task to board
   */
  addTask: (task: TaskWithAssignee) => {
    const currentColumns = get().columns;
    const currentBoard = get().board;

    let targetFound = false;
    const nextColumns = currentColumns.map((col) => {
      if (col.id === task.column_id) {
        targetFound = true;
        return {
          ...col,
          tasks: [task, ...col.tasks],
        };
      }
      return col;
    });

    if (!targetFound && nextColumns.length > 0) {
      nextColumns[0] = {
        ...nextColumns[0],
        tasks: [task, ...nextColumns[0].tasks],
      };
    }

    // Persist to local storage
    if (currentBoard) {
      const columnsMap = getStoredColumnsMap();
      columnsMap[currentBoard.id] = nextColumns;
      if (typeof window !== 'undefined') {
        localStorage.setItem(BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnsMap));
      }
    }

    set({
      columns: nextColumns,
      board: currentBoard ? { ...currentBoard, columns: nextColumns } : null,
    });
  },

  /**
   * Add a dependency relationship to a task
   */
  addTaskDependency: async (taskId: string, dependencyTaskId: string) => {
    if (taskId === dependencyTaskId) return;
    const currentColumns = get().columns;
    let targetTask: TaskWithAssignee | null = null;

    for (const col of currentColumns) {
      const found = col.tasks.find((t) => t.id === taskId);
      if (found) {
        targetTask = found;
        break;
      }
    }
    if (!targetTask) return;

    const existingDeps = targetTask.dependency_ids || [];
    if (existingDeps.includes(dependencyTaskId)) return;

    const updatedTask: TaskWithAssignee = {
      ...targetTask,
      dependency_ids: [...existingDeps, dependencyTaskId],
      updated_at: new Date().toISOString(),
    };

    await get().updateTask(updatedTask);
  },

  /**
   * Remove a dependency relationship from a task
   */
  removeTaskDependency: async (taskId: string, dependencyTaskId: string) => {
    const currentColumns = get().columns;
    let targetTask: TaskWithAssignee | null = null;

    for (const col of currentColumns) {
      const found = col.tasks.find((t) => t.id === taskId);
      if (found) {
        targetTask = found;
        break;
      }
    }
    if (!targetTask) return;

    const existingDeps = targetTask.dependency_ids || [];
    const updatedTask: TaskWithAssignee = {
      ...targetTask,
      dependency_ids: existingDeps.filter((id) => id !== dependencyTaskId),
      updated_at: new Date().toISOString(),
    };

    await get().updateTask(updatedTask);
  },

  /**
   * Batch create timeline tasks and transfer them directly to board matching by status
   */
  addTimelineTasks: async (
    tasksInput: TimelineTaskInput[],
    targetBoardId?: string
  ): Promise<TaskWithAssignee[]> => {
    const activeBoardId = targetBoardId || get().board?.id || get().boards[0]?.id || DEFAULT_BOARD_ID;
    const columnsMap = getStoredColumnsMap();
    let boardColumns = columnsMap[activeBoardId];

    // Fallback if target board is currently loaded in store
    if (get().board?.id === activeBoardId && get().columns.length > 0) {
      boardColumns = get().columns;
    }

    if (!boardColumns || boardColumns.length === 0) {
      boardColumns = [
        {
          id: crypto.randomUUID(),
          board_id: activeBoardId,
          name: 'Backlog',
          order_index: 0,
          created_at: new Date().toISOString(),
          tasks: [],
        },
        {
          id: crypto.randomUUID(),
          board_id: activeBoardId,
          name: 'In Progress',
          order_index: 1,
          created_at: new Date().toISOString(),
          tasks: [],
        },
        {
          id: crypto.randomUUID(),
          board_id: activeBoardId,
          name: 'In Review',
          order_index: 2,
          created_at: new Date().toISOString(),
          tasks: [],
        },
        {
          id: crypto.randomUUID(),
          board_id: activeBoardId,
          name: 'Completed',
          order_index: 3,
          created_at: new Date().toISOString(),
          tasks: [],
        },
      ];
    }

    // Determine starting task code sequential index
    let maxTaskNum = 100;
    Object.values(columnsMap).forEach((colList) => {
      colList.forEach((c) => {
        c.tasks.forEach((t) => {
          const match = (t.task_code || t.id).match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxTaskNum && num < 50000) maxTaskNum = num;
          }
        });
      });
    });

    const profiles = get().profiles;
    const createdTasks: TaskWithAssignee[] = [];
    const nextColumns = boardColumns.map((col) => ({
      ...col,
      tasks: [...col.tasks],
    }));

    for (const input of tasksInput) {
      maxTaskNum += 1;
      const taskCode = `TSK-${maxTaskNum}`;

      // Find matching column by status column ID, or column name (case-insensitive)
      const statusTrimmed = (input.status || '').trim().toLowerCase();
      let matchedColIndex = nextColumns.findIndex((c) => c.id === input.status);
      if (matchedColIndex === -1) {
        matchedColIndex = nextColumns.findIndex((c) => c.name.toLowerCase() === statusTrimmed);
      }
      if (matchedColIndex === -1) {
        // Semantic matches: e.g. "todo" -> "backlog", "done" -> "completed"
        if (statusTrimmed.includes('todo') || statusTrimmed.includes('backlog')) {
          matchedColIndex = nextColumns.findIndex((c) => c.name.toLowerCase().includes('backlog'));
        } else if (statusTrimmed.includes('progress') || statusTrimmed.includes('doing')) {
          matchedColIndex = nextColumns.findIndex((c) => c.name.toLowerCase().includes('progress'));
        } else if (statusTrimmed.includes('review')) {
          matchedColIndex = nextColumns.findIndex((c) => c.name.toLowerCase().includes('review'));
        } else if (statusTrimmed.includes('done') || statusTrimmed.includes('complete')) {
          matchedColIndex = nextColumns.findIndex((c) => c.name.toLowerCase().includes('complet'));
        }
      }
      if (matchedColIndex === -1) {
        // Partial match
        matchedColIndex = nextColumns.findIndex((c) =>
          c.name.toLowerCase().includes(statusTrimmed) || statusTrimmed.includes(c.name.toLowerCase())
        );
      }
      if (matchedColIndex === -1) {
        matchedColIndex = 0; // Default to first column
      }

      const matchedCol = nextColumns[matchedColIndex];
      const assignee = input.assignee_id
        ? profiles.find((p) => p.id === input.assignee_id) || null
        : null;

      const newTask: TaskWithAssignee = {
        id: input.id || crypto.randomUUID(),
        task_code: taskCode,
        column_id: matchedCol.id,
        title: input.title.trim(),
        description: input.description?.trim() || `Timeline Schedule: ${input.start_date} to ${input.end_date}`,
        assignee_id: input.assignee_id || null,
        start_date: input.start_date,
        deadline: input.end_date,
        end_date: input.end_date,
        priority: input.priority || 'Medium',
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assignee,
        comments: [],
      };

      matchedCol.tasks.unshift(newTask);
      createdTasks.push(newTask);
    }

    // Persist updated columns in localStorage
    columnsMap[activeBoardId] = nextColumns;
    if (typeof window !== 'undefined') {
      localStorage.setItem(BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnsMap));
    }

    // If active board matches the target, update Zustand state immediately
    if (get().board?.id === activeBoardId || !get().board) {
      set({
        columns: nextColumns,
        board: get().board ? { ...get().board!, columns: nextColumns } : null,
      });
    }

    // Background sync to Supabase if configured
    for (const t of createdTasks) {
      try {
        await supabase.from('tasks').insert({
          id: t.id,
          column_id: t.column_id,
          title: t.title,
          description: t.description,
          assignee_id: t.assignee_id,
          deadline: t.deadline,
          priority: t.priority,
          is_archived: false,
        });
      } catch {
        // Local retention
      }
    }

    return createdTasks;
  },

  /**
   * Generates benchmark simulated tasks to verify ultra-fast search performance across thousands of records.
   */
  addBenchmarkTasks: (count = 1000) => {
    const currentColumns = get().columns;
    const currentBoard = get().board;
    if (currentColumns.length === 0 || !currentBoard) return;

    const verbs = ['Refactor', 'Optimize', 'Migrate', 'Audit', 'Integrate', 'Deploy', 'Monitor', 'Benchmark', 'Configure', 'Implement', 'Upgrade', 'Sync', 'Review'];
    const domains = ['Stripe billing & recurring invoicing', 'Redis caching layer & invalidation', 'Docker container image clustering', 'Kubernetes pod autoscaling', 'OAuth 2.0 PKCE authentication flow', 'GraphQL query resolution & schema batching', 'Telemetry logging & metrics ingestion', 'Elasticsearch cluster inverted index', 'WebSocket real-time subscription push', 'GDPR privacy compliance & retention policy', 'Automated CI/CD deployment rollback pipeline', 'PostgreSQL connection pool & query planner', 'Frontend virtualized list rendering speed', 'Microservices service mesh & circuit breaker'];
    const priorities: Priority[] = ['High', 'Medium', 'Low'];
    const profiles = get().profiles;

    // Determine starting task code index
    let startIdx = 200;
    currentColumns.forEach((c) => {
      c.tasks.forEach((t) => {
        const match = (t.task_code || t.id).match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > startIdx && num < 50000) startIdx = num;
        }
      });
    });

    const newTasksPerColumn: Record<string, TaskWithAssignee[]> = {};
    currentColumns.forEach((col) => {
      newTasksPerColumn[col.id] = [];
    });

    for (let i = 0; i < count; i++) {
      const colIndex = i % currentColumns.length;
      const targetCol = currentColumns[colIndex];
      const taskNum = startIdx + 1 + i;
      const verb = verbs[i % verbs.length];
      const domain = domains[(i * 3 + 7) % domains.length];
      const priority = priorities[i % priorities.length];
      const assignee = profiles.length > 0 ? profiles[i % profiles.length] : null;

      const task: TaskWithAssignee = {
        id: crypto.randomUUID(),
        task_code: `TSK-${taskNum}`,
        column_id: targetCol.id,
        title: `${verb} ${domain} (#${taskNum})`,
        description: `Automated enterprise workflow task #${taskNum} for performance verification under large dataset volumes.`,
        priority,
        assignee_id: assignee ? assignee.id : null,
        deadline: new Date(Date.now() + (i % 30) * 86400000).toISOString(),
        is_archived: false,
        created_at: new Date(Date.now() - (i % 15) * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
        assignee,
      };

      newTasksPerColumn[targetCol.id].push(task);
    }

    const updatedColumns = currentColumns.map((col) => ({
      ...col,
      tasks: [...newTasksPerColumn[col.id], ...col.tasks],
    }));

    const columnsMap = getStoredColumnsMap();
    columnsMap[currentBoard.id] = updatedColumns;
    if (typeof window !== 'undefined') {
      localStorage.setItem(BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnsMap));
    }

    set({
      columns: updatedColumns,
      board: { ...currentBoard, columns: updatedColumns },
    });
  },

  /**
   * Fetch global profiles
   */
  fetchProfiles: async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (!error && data && data.length > 0) {
        const merged = [...INITIAL_GLOBAL_PROFILES];
        (data as Profile[]).forEach((p) => {
          if (!merged.some((m) => m.id === p.id || m.email === p.email)) {
            merged.push(p);
          }
        });
        set({ profiles: merged });
        return;
      }
    } catch {
      // Ignore
    }
    set({ profiles: INITIAL_GLOBAL_PROFILES });
  },

  /**
   * Move task between columns (Drag & Drop)
   */
  moveTask: async (
    taskId: string,
    sourceColumnId: string,
    destinationColumnId: string,
    destinationIndex?: number
  ) => {
    const previousColumns = get().columns;
    const previousBoard = get().board;

    const cleanTaskId = taskId.startsWith('task-') ? taskId.replace(/^task-/, '') : taskId;
    const sourceColIndex = previousColumns.findIndex((col) => col.id === sourceColumnId);
    const destColIndex = previousColumns.findIndex((col) => col.id === destinationColumnId);

    if (sourceColIndex === -1 || destColIndex === -1) {
      console.error('Source or destination column not found');
      return;
    }

    const sourceCol = previousColumns[sourceColIndex];
    const targetTask = sourceCol.tasks.find(
      (t) => t.id === cleanTaskId || t.id === taskId || t.id.replace(/^task-/, '') === cleanTaskId
    );

    if (!targetTask) {
      return;
    }

    const targetTaskId = targetTask.id;
    const updatedTask: TaskWithAssignee = {
      ...targetTask,
      column_id: destinationColumnId,
      updated_at: new Date().toISOString(),
    };

    const nextColumns = previousColumns.map((col) => ({
      ...col,
      tasks: [...col.tasks],
    }));

    if (sourceColumnId === destinationColumnId) {
      const tasksList = nextColumns[sourceColIndex].tasks;
      const currentIndex = tasksList.findIndex((t) => t.id === targetTaskId);
      if (currentIndex !== -1 && typeof destinationIndex === 'number') {
        const [removed] = tasksList.splice(currentIndex, 1);
        tasksList.splice(destinationIndex, 0, removed);
      }
    } else {
      nextColumns[sourceColIndex].tasks = nextColumns[sourceColIndex].tasks.filter(
        (t) => t.id !== targetTaskId
      );
      const destTasks = nextColumns[destColIndex].tasks;
      const insertAt =
        typeof destinationIndex === 'number'
          ? Math.max(0, Math.min(destinationIndex, destTasks.length))
          : destTasks.length;

      destTasks.splice(insertAt, 0, updatedTask);
    }

    if (previousBoard) {
      const columnsMap = getStoredColumnsMap();
      columnsMap[previousBoard.id] = nextColumns;
      if (typeof window !== 'undefined') {
        localStorage.setItem(BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnsMap));
      }
    }

    set({
      columns: nextColumns,
      board: previousBoard ? { ...previousBoard, columns: nextColumns } : null,
      error: null,
    });

    const isValidUUID = (str?: string | null) =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    if (isValidUUID(cleanTaskId) && isValidUUID(destinationColumnId)) {
      try {
        await supabase
          .from('tasks')
          .update({
            column_id: destinationColumnId,
            updated_at: updatedTask.updated_at,
          })
          .eq('id', cleanTaskId);
      } catch {
        // Retained locally
      }
    }
  },

  /**
   * Update task details
   */
  updateTask: async (updatedTask: TaskWithAssignee) => {
    const previousColumns = get().columns;
    const previousBoard = get().board;

    let sourceColIndex = -1;
    let taskIndex = -1;

    for (let i = 0; i < previousColumns.length; i++) {
      const idx = previousColumns[i].tasks.findIndex((t) => t.id === updatedTask.id);
      if (idx !== -1) {
        sourceColIndex = i;
        taskIndex = idx;
        break;
      }
    }

    const nextColumns = previousColumns.map((col) => ({
      ...col,
      tasks: [...col.tasks],
    }));

    if (sourceColIndex !== -1) {
      const targetColIndex = nextColumns.findIndex((col) => col.id === updatedTask.column_id);
      if (targetColIndex !== -1 && targetColIndex !== sourceColIndex) {
        nextColumns[sourceColIndex].tasks.splice(taskIndex, 1);
        nextColumns[targetColIndex].tasks.unshift(updatedTask);
      } else {
        nextColumns[sourceColIndex].tasks[taskIndex] = updatedTask;
      }
    } else {
      const targetCol = nextColumns.find((col) => col.id === updatedTask.column_id) || nextColumns[0];
      if (targetCol) {
        targetCol.tasks.unshift(updatedTask);
      }
    }

    if (previousBoard) {
      const columnsMap = getStoredColumnsMap();
      columnsMap[previousBoard.id] = nextColumns;
      if (typeof window !== 'undefined') {
        localStorage.setItem(BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnsMap));
      }
    }

    set({
      columns: nextColumns,
      board: previousBoard ? { ...previousBoard, columns: nextColumns } : null,
      error: null,
    });

    const isValidUUID = (str?: string | null) =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    if (isValidUUID(updatedTask.id)) {
      try {
        await supabase
          .from('tasks')
          .update({
            title: updatedTask.title,
            description: updatedTask.description,
            column_id: updatedTask.column_id,
            priority: updatedTask.priority,
            assignee_id: isValidUUID(updatedTask.assignee_id) ? updatedTask.assignee_id : null,
            deadline: updatedTask.deadline,
            updated_at: new Date().toISOString(),
          })
          .eq('id', updatedTask.id);
      } catch {
        // Retained locally
      }
    }
  },

  /**
   * Delete task
   */
  deleteTask: async (taskId: string) => {
    const previousColumns = get().columns;
    const previousBoard = get().board;

    const nextColumns = previousColumns.map((col) => ({
      ...col,
      tasks: col.tasks.filter((t) => t.id !== taskId),
    }));

    if (previousBoard) {
      const columnsMap = getStoredColumnsMap();
      columnsMap[previousBoard.id] = nextColumns;
      if (typeof window !== 'undefined') {
        localStorage.setItem(BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnsMap));
      }
    }

    set({
      columns: nextColumns,
      board: previousBoard ? { ...previousBoard, columns: nextColumns } : null,
    });

    const isValidUUID = (str?: string | null) =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    if (isValidUUID(taskId)) {
      try {
        await supabase.from('tasks').delete().eq('id', taskId);
      } catch {
        // Ignored
      }
    }
  },

  /**
   * Add comment to task with optional attachments
   */
  addComment: async (
    taskId: string,
    content: string,
    authorName?: string,
    authorEmail?: string,
    attachments?: CommentAttachment[]
  ) => {
    const newComment: TaskComment = {
      id: crypto.randomUUID(),
      task_id: taskId,
      author_name: authorName || 'Team Member',
      author_email: authorEmail || null,
      content: content.trim(),
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      created_at: new Date().toISOString(),
    };

    const currentComments = get().comments;
    const existing = currentComments[taskId] || [];
    const updatedTaskComments = [...existing, newComment];
    const updatedCommentsMap = { ...currentComments, [taskId]: updatedTaskComments };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(updatedCommentsMap));
      } catch {
        // Ignored
      }
    }

    const nextColumns = get().columns.map((col) => ({
      ...col,
      tasks: col.tasks.map((task) =>
        task.id === taskId ? { ...task, comments: updatedTaskComments } : task
      ),
    }));

    const currentBoard = get().board;
    if (currentBoard) {
      const columnsMap = getStoredColumnsMap();
      columnsMap[currentBoard.id] = nextColumns;
      if (typeof window !== 'undefined') {
        localStorage.setItem(BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnsMap));
      }
    }

    set({
      comments: updatedCommentsMap,
      columns: nextColumns,
      board: currentBoard ? { ...currentBoard, columns: nextColumns } : null,
    });

    // Optional Supabase DB sync if task_comments table is configured
    try {
      await supabase.from('task_comments').insert({
        id: newComment.id,
        task_id: taskId,
        author_name: newComment.author_name,
        author_email: newComment.author_email,
        content: newComment.content,
        attachments: newComment.attachments || null,
        created_at: newComment.created_at,
      });
    } catch {
      // Retained in local database
    }

    return newComment;
  },

  /**
   * Remove a specific attachment from a task comment
   * Synchronously removes it on UI, updates in-memory store, persists to localStorage database,
   * and updates Supabase database.
   */
  deleteCommentAttachment: async (
    taskId: string,
    commentId: string,
    attachmentId: string
  ) => {
    const currentComments = get().comments;
    const taskComments = currentComments[taskId] || [];

    const updatedTaskComments = taskComments.map((c) => {
      if (c.id === commentId) {
        const remaining = (c.attachments || []).filter((a) => a.id !== attachmentId);
        return {
          ...c,
          attachments: remaining.length > 0 ? remaining : undefined,
        };
      }
      return c;
    });

    const updatedCommentsMap = { ...currentComments, [taskId]: updatedTaskComments };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(updatedCommentsMap));
      } catch {
        // Ignored
      }
    }

    const nextColumns = get().columns.map((col) => ({
      ...col,
      tasks: col.tasks.map((task) =>
        task.id === taskId ? { ...task, comments: updatedTaskComments } : task
      ),
    }));

    const currentBoard = get().board;
    if (currentBoard) {
      const columnsMap = getStoredColumnsMap();
      columnsMap[currentBoard.id] = nextColumns;
      if (typeof window !== 'undefined') {
        localStorage.setItem(BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnsMap));
      }
    }

    set({
      comments: updatedCommentsMap,
      columns: nextColumns,
      board: currentBoard ? { ...currentBoard, columns: nextColumns } : null,
    });

    // Sync removal to Supabase database
    try {
      const targetComment = updatedTaskComments.find((c) => c.id === commentId);
      if (targetComment) {
        await supabase
          .from('task_comments')
          .update({
            attachments: targetComment.attachments || null,
          })
          .eq('id', commentId);
      }
    } catch {
      // Retained in local database
    }
  },

  /**
   * Delete an entire comment
   */
  deleteComment: async (taskId: string, commentId: string) => {
    const currentComments = get().comments;
    const taskComments = currentComments[taskId] || [];
    const updatedTaskComments = taskComments.filter((c) => c.id !== commentId);
    const updatedCommentsMap = { ...currentComments, [taskId]: updatedTaskComments };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(updatedCommentsMap));
      } catch {
        // Ignored
      }
    }

    const nextColumns = get().columns.map((col) => ({
      ...col,
      tasks: col.tasks.map((task) =>
        task.id === taskId ? { ...task, comments: updatedTaskComments } : task
      ),
    }));

    const currentBoard = get().board;
    if (currentBoard) {
      const columnsMap = getStoredColumnsMap();
      columnsMap[currentBoard.id] = nextColumns;
      if (typeof window !== 'undefined') {
        localStorage.setItem(BOARD_COLUMNS_STORAGE_KEY, JSON.stringify(columnsMap));
      }
    }

    set({
      comments: updatedCommentsMap,
      columns: nextColumns,
      board: currentBoard ? { ...currentBoard, columns: nextColumns } : null,
    });

    try {
      await supabase.from('task_comments').delete().eq('id', commentId);
    } catch {
      // Retained in local database
    }
  },

  /**
   * Fetch documents belonging to a board
   */
  fetchBoardDocuments: (boardId: string): BoardDocument[] => {
    const map = get().documents;
    return map[boardId] || [];
  },

  /**
   * Create a new document for a board
   */
  createDocument: async (
    boardId: string,
    docInput: {
      title: string;
      content: string;
      category?: string;
      tags?: string[];
      icon?: string;
      status?: BoardDocumentStatus;
    },
    actingUser?: { name: string; email: string; avatar_url?: string }
  ): Promise<BoardDocument> => {
    const user = actingUser || {
      name: 'Alex Rivera',
      email: 'alex@company.com',
    };
    const now = new Date().toISOString();
    const docId = `doc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const initialActivity: DocumentActivity = {
      id: `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      document_id: docId,
      user_name: user.name,
      user_email: user.email,
      user_avatar: user.avatar_url,
      action_type: 'created',
      action_description: `Document created by ${user.name}`,
      timestamp: now,
      details: `Initialized document with ${docInput.content ? docInput.content.length : 0} characters`,
    };

    const newDoc: BoardDocument = {
      id: docId,
      board_id: boardId,
      title: docInput.title.trim() || 'Untitled Document',
      content: docInput.content || '',
      category: docInput.category || 'General',
      tags: docInput.tags || [],
      icon: docInput.icon || '📄',
      status: docInput.status || 'draft',
      is_starred: false,
      created_by: {
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
      },
      created_at: now,
      updated_at: now,
      last_activity: initialActivity,
      activity_log: [initialActivity],
    };

    const currentMap = get().documents;
    const boardDocs = currentMap[boardId] || [];
    const nextMap = {
      ...currentMap,
      [boardId]: [newDoc, ...boardDocs],
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(nextMap));
      } catch (e) {
        console.error('Failed to persist documents to localStorage', e);
      }
    }

    set({ documents: nextMap });
    return newDoc;
  },

  /**
   * Update an existing document and capture the user activity
   */
  updateDocument: async (
    boardId: string,
    docId: string,
    updates: Partial<BoardDocument>,
    activityAction?: {
      type: DocumentActivityType;
      description: string;
      details?: string;
    },
    actingUser?: { name: string; email: string; avatar_url?: string }
  ): Promise<void> => {
    const user = actingUser || {
      name: 'Alex Rivera',
      email: 'alex@company.com',
    };
    const now = new Date().toISOString();

    const currentMap = get().documents;
    const boardDocs = currentMap[boardId] || [];
    const targetDoc = boardDocs.find((d) => d.id === docId);
    if (!targetDoc) return;

    let actionType: DocumentActivityType = activityAction?.type || 'edited_content';
    let actionDesc = activityAction?.description;

    if (!actionDesc) {
      if (updates.title && updates.title !== targetDoc.title) {
        actionType = 'renamed';
        actionDesc = `Renamed to "${updates.title}" by ${user.name}`;
      } else if (updates.status && updates.status !== targetDoc.status) {
        actionType = 'status_changed';
        actionDesc = `Status changed to ${updates.status.toUpperCase()} by ${user.name}`;
      } else if (updates.tags && JSON.stringify(updates.tags) !== JSON.stringify(targetDoc.tags)) {
        actionType = 'tagged';
        actionDesc = `Tags updated by ${user.name}`;
      } else {
        actionType = 'edited_content';
        actionDesc = `Edited document content by ${user.name}`;
      }
    }

    const newActivity: DocumentActivity = {
      id: `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      document_id: docId,
      user_name: user.name,
      user_email: user.email,
      user_avatar: user.avatar_url,
      action_type: actionType,
      action_description: actionDesc,
      timestamp: now,
      details:
        activityAction?.details ||
        (updates.content ? `Updated content (${updates.content.length} characters)` : undefined),
    };

    const updatedDoc: BoardDocument = {
      ...targetDoc,
      ...updates,
      updated_at: now,
      last_activity: newActivity,
      activity_log: [newActivity, ...(targetDoc.activity_log || [])].slice(0, 50),
    };

    const nextDocs = boardDocs.map((d) => (d.id === docId ? updatedDoc : d));
    const nextMap = {
      ...currentMap,
      [boardId]: nextDocs,
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(nextMap));
      } catch (e) {
        console.error('Failed to persist documents to localStorage', e);
      }
    }

    set({ documents: nextMap });
  },

  /**
   * Delete a document
   */
  deleteDocument: async (boardId: string, docId: string): Promise<void> => {
    const currentMap = get().documents;
    const boardDocs = currentMap[boardId] || [];
    const nextDocs = boardDocs.filter((d) => d.id !== docId);
    const nextMap = {
      ...currentMap,
      [boardId]: nextDocs,
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(nextMap));
      } catch (e) {
        console.error('Failed to persist documents to localStorage', e);
      }
    }

    set({ documents: nextMap });
  },

  /**
   * Toggle pinned/starred status for a document
   */
  toggleStarDocument: async (boardId: string, docId: string): Promise<void> => {
    const currentMap = get().documents;
    const boardDocs = currentMap[boardId] || [];
    const nextDocs = boardDocs.map((d) =>
      d.id === docId ? { ...d, is_starred: !d.is_starred } : d
    );
    const nextMap = {
      ...currentMap,
      [boardId]: nextDocs,
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(nextMap));
      } catch (e) {
        console.error('Failed to persist documents to localStorage', e);
      }
    }

    set({ documents: nextMap });
  },

  /**
   * Duplicate a document
   */
  duplicateDocument: async (
    boardId: string,
    docId: string,
    actingUser?: { name: string; email: string; avatar_url?: string }
  ): Promise<BoardDocument> => {
    const user = actingUser || {
      name: 'Alex Rivera',
      email: 'alex@company.com',
    };
    const currentMap = get().documents;
    const boardDocs = currentMap[boardId] || [];
    const sourceDoc = boardDocs.find((d) => d.id === docId);
    if (!sourceDoc) throw new Error('Document not found');

    const now = new Date().toISOString();
    const newDocId = `doc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const initialActivity: DocumentActivity = {
      id: `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      document_id: newDocId,
      user_name: user.name,
      user_email: user.email,
      user_avatar: user.avatar_url,
      action_type: 'duplicated',
      action_description: `Duplicated from "${sourceDoc.title}" by ${user.name}`,
      timestamp: now,
    };

    const duplicatedDoc: BoardDocument = {
      ...sourceDoc,
      id: newDocId,
      title: `${sourceDoc.title} (Copy)`,
      created_by: {
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
      },
      created_at: now,
      updated_at: now,
      is_starred: false,
      last_activity: initialActivity,
      activity_log: [initialActivity],
    };

    const nextMap = {
      ...currentMap,
      [boardId]: [duplicatedDoc, ...boardDocs],
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(nextMap));
      } catch (e) {
        console.error('Failed to persist documents to localStorage', e);
      }
    }

    set({ documents: nextMap });
    return duplicatedDoc;
  },
}));
