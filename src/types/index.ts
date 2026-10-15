export type Priority = 'Low' | 'Medium' | 'High';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string | null;
  color?: string;
  created_at: string;
  owner_email?: string | null;
}

export interface Board {
  id: string;
  workspace_id?: string;
  name: string;
  description?: string | null;
  created_by: string | null;
  created_at: string;
}

export interface BoardMember {
  id: string;
  board_id: string;
  profile_id?: string | null;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Member';
  avatar_url?: string | null;
  joined_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  order_index: number;
  created_at: string;
}

export interface Task {
  id: string;
  task_code?: string;
  column_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  start_date?: string | null;
  deadline: string | null;
  end_date?: string | null;
  priority: Priority;
  dependency_ids?: string[]; // IDs of tasks this task depends on
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimelineTaskInput {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string; // column id or column name
  priority?: Priority;
  assignee_id?: string | null;
  description?: string;
  dependency_ids?: string[];
}

// Relationships & Composite Types
export interface CommentAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string; // Data URL (Base64) or remote URL
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id?: string | null;
  author_name: string;
  author_email?: string | null;
  content: string;
  attachments?: CommentAttachment[];
  created_at: string;
}

export interface TaskWithAssignee extends Task {
  assignee?: Profile | null;
  comments?: TaskComment[];
  dependencies?: TaskWithAssignee[];
}

export interface ColumnWithTasks extends Column {
  tasks: TaskWithAssignee[];
}

export interface BoardWithDetails extends Board {
  columns: ColumnWithTasks[];
  creator?: Profile | null;
  members?: BoardMember[];
}

// Board Document & Activity Tracking Types
export type DocumentActivityType =
  | 'created'
  | 'edited_content'
  | 'renamed'
  | 'status_changed'
  | 'tagged'
  | 'duplicated'
  | 'commented';

export interface DocumentActivity {
  id: string;
  document_id: string;
  user_name: string;
  user_email: string;
  user_avatar?: string;
  action_type: DocumentActivityType;
  action_description: string;
  timestamp: string;
  details?: string;
}

export type BoardDocumentStatus = 'draft' | 'in_review' | 'published' | 'archived';

export interface BoardDocument {
  id: string;
  board_id: string;
  title: string;
  content: string;
  icon?: string;
  category: string;
  tags: string[];
  status: BoardDocumentStatus;
  is_starred?: boolean;
  created_by: {
    name: string;
    email: string;
    avatar_url?: string;
  };
  created_at: string;
  updated_at: string;
  last_activity: DocumentActivity;
  activity_log: DocumentActivity[];
}

// Weekly Checkpoint Report Types
export interface BoardWeeklyMetrics {
  boardId: string;
  boardName: string;
  totalTasks: number;
  completedThisWeek: number;
  completedPreviousWeek: number;
  delayedTasks: number;
  delayedTasksPreviousWeek: number;
  highPriorityRemaining: number;
  highPriorityRemainingPreviousWeek: number;
  inProgressCount: number;
  reviewCount: number;
  backlogCount: number;
  completionRate: number; // percentage
  weeklyVelocityDelta: number; // completedThisWeek - completedPreviousWeek
  delayedDelta: number; // delayedTasks - delayedTasksPreviousWeek
  highPriorityDelta: number; // highPriorityRemaining - highPriorityRemainingPreviousWeek
  criticalTasks: TaskWithAssignee[];
}

export interface WeeklyCheckpointReport {
  weekLabel: string;
  weekRange: string;
  previousWeekLabel: string;
  previousWeekRange: string;
  totalCompletedThisWeek: number;
  totalCompletedPreviousWeek: number;
  totalDelayedThisWeek: number;
  totalDelayedPreviousWeek: number;
  totalHighPriorityRemaining: number;
  totalHighPriorityRemainingPreviousWeek: number;
  boardMetrics: BoardWeeklyMetrics[];
  chartDataComparison: Array<{
    boardName: string;
    completedThisWeek: number;
    completedPrevWeek: number;
    delayedThisWeek: number;
    delayedPrevWeek: number;
    highPriorityThisWeek: number;
    highPriorityPrevWeek: number;
  }>;
  dailyVelocityTrend: Array<{
    day: string;
    completed: number;
    delayed: number;
  }>;
}

// Supabase Database Mapping for Type-Safe Queries
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      boards: {
        Row: Board;
        Insert: {
          id?: string;
          name: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      columns: {
        Row: Column;
        Insert: {
          id?: string;
          board_id: string;
          name: string;
          order_index: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          board_id?: string;
          name?: string;
          order_index?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: {
          id?: string;
          column_id: string;
          title: string;
          description?: string | null;
          assignee_id?: string | null;
          deadline?: string | null;
          priority?: Priority;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          column_id?: string;
          title?: string;
          description?: string | null;
          assignee_id?: string | null;
          deadline?: string | null;
          priority?: Priority;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      priority: Priority;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
