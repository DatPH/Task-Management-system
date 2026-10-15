import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  Users,
  Share2,
  History,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Tag,
  Edit3,
  FilePlus,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import type { BoardDocument, BoardMember, DocumentActivity, DocumentActivityType } from '../../types';

interface DocumentFooterProps {
  document: BoardDocument;
  boardName?: string;
  boardMembers?: BoardMember[];
  onOpenShareModal?: () => void;
  className?: string;
  showFullHistoryByDefault?: boolean;
}

export const DocumentFooter: React.FC<DocumentFooterProps> = ({
  document,
  boardName = 'Board',
  boardMembers = [],
  className = '',
  showFullHistoryByDefault = false,
}) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(showFullHistoryByDefault);
  const [copiedLink, setCopiedLink] = useState(false);

  const lastActivity: DocumentActivity = document.last_activity || {
    id: 'fallback-act',
    document_id: document.id,
    user_name: document.created_by.name,
    user_email: document.created_by.email,
    user_avatar: document.created_by.avatar_url,
    action_type: 'created',
    action_description: `Document created by ${document.created_by.name}`,
    timestamp: document.created_at,
  };

  const formatRelativeTime = (isoString: string): string => {
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

  const formatExactDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
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

  const getActionBadge = (actionType: DocumentActivityType) => {
    switch (actionType) {
      case 'created':
        return {
          label: 'Created',
          color: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          icon: <FilePlus className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />,
        };
      case 'edited_content':
        return {
          label: 'Content Edited',
          color: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
          icon: <Edit3 className="h-3 w-3 text-sky-600 dark:text-sky-400" />,
        };
      case 'renamed':
        return {
          label: 'Renamed',
          color: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          icon: <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-400" />,
        };
      case 'status_changed':
        return {
          label: 'Status Updated',
          color: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          icon: <RefreshCw className="h-3 w-3 text-purple-600 dark:text-purple-400" />,
        };
      case 'tagged':
        return {
          label: 'Tags Changed',
          color: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
          icon: <Tag className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />,
        };
      case 'duplicated':
        return {
          label: 'Duplicated',
          color: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
          icon: <Copy className="h-3 w-3 text-rose-600 dark:text-rose-400" />,
        };
      default:
        return {
          label: 'Activity',
          color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
          icon: <Clock className="h-3 w-3 text-zinc-500" />,
        };
    }
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#doc=${document.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const badgeInfo = getActionBadge(lastActivity.action_type);
  const activities = document.activity_log || [lastActivity];

  return (
    <footer
      className={`border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs transition-colors ${className}`}
      aria-label="Document Footer"
    >
      {/* Primary Footer Bar */}
      <div className="px-4 py-3 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Left: Last Activity Highlights */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          {/* User Initials Avatar */}
          <div className="relative shrink-0 mt-0.5 sm:mt-0">
            <div
              className="h-8 w-8 rounded-full bg-linear-to-br from-zinc-800 to-zinc-900 dark:from-zinc-700 dark:to-zinc-800 text-white flex items-center justify-center text-[11px] font-bold shadow-2xs border border-white/20 dark:border-zinc-700"
              title={`Last active user: ${lastActivity.user_name} (${lastActivity.user_email})`}
            >
              {getInitials(lastActivity.user_name)}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900"
              title="Active contributor on this document"
            />
          </div>

          {/* Activity summary text */}
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {lastActivity.action_description}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${badgeInfo.color}`}
              >
                {badgeInfo.icon}
                <span>{badgeInfo.label}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>
                By <strong className="text-zinc-700 dark:text-zinc-300 font-medium">{lastActivity.user_name}</strong>
              </span>
              <span>•</span>
              <span
                className="flex items-center gap-1 cursor-help hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                title={formatExactDate(lastActivity.timestamp)}
              >
                <Clock className="h-3 w-3 shrink-0" />
                <span>{formatRelativeTime(lastActivity.timestamp)}</span>
              </span>
              <span>•</span>
              <span className="hidden sm:inline text-zinc-400 dark:text-zinc-500">
                {formatExactDate(lastActivity.timestamp)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Board Sharing, Sync Status & Activity History Toggle */}
        <div className="flex items-center flex-wrap gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800 shrink-0">
          {/* Shareable Board Members Access Indicator */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-300"
            title={`Shareable among all members of board "${boardName}"`}
          >
            <Users className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
            <span className="truncate max-w-[130px] sm:max-w-none">
              Shared in <strong>{boardName}</strong>
            </span>

            {/* Member Avatars Stack */}
            {boardMembers.length > 0 && (
              <div className="flex items-center -space-x-1.5 ml-1">
                {boardMembers.slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    title={`${m.name} (${m.role})`}
                    className="h-4.5 w-4.5 rounded-full bg-zinc-800 dark:bg-zinc-700 text-white text-[8px] font-bold flex items-center justify-center border border-white dark:border-zinc-850"
                  >
                    {getInitials(m.name)}
                  </div>
                ))}
                {boardMembers.length > 3 && (
                  <div className="h-4.5 w-4.5 rounded-full bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-200 text-[8px] font-bold flex items-center justify-center border border-white dark:border-zinc-850">
                    +{boardMembers.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Copy Share Link Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            title="Copy shareable link for board members"
          >
            {copiedLink ? (
              <>
                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Share2 className="h-3 w-3 text-zinc-500" />
                <span>Share</span>
              </>
            )}
          </button>

          {/* Saved / Live Sync Indicator */}
          <div
            className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium px-1.5"
            title="All modifications are live synced across board members"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Synced</span>
          </div>

          {/* History Drawer Toggle Button */}
          <button
            type="button"
            onClick={() => setIsHistoryOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
            title="Toggle full activity history log"
          >
            <History className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span>Activity History</span>
            <span className="px-1.5 py-0.2 bg-zinc-200 dark:bg-zinc-700 rounded-full text-[10px] font-bold">
              {activities.length}
            </span>
            {isHistoryOpen ? (
              <ChevronUp className="h-3 w-3 text-zinc-400" />
            ) : (
              <ChevronDown className="h-3 w-3 text-zinc-400" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Activity History Timeline */}
      {isHistoryOpen && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/70 px-4 py-3 sm:px-6 transition-all duration-200 animate-in fade-in-50">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <History className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                Document Activity Audit Trail
              </h4>
            </div>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Captures all user activities for board members
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {activities.map((act, index) => {
              const actBadge = getActionBadge(act.action_type);
              const isLatest = index === 0;

              return (
                <div
                  key={act.id || index}
                  className={`flex items-start gap-3 p-2 rounded-lg text-xs transition-colors ${
                    isLatest
                      ? 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs'
                      : 'hover:bg-white/60 dark:hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="h-6 w-6 rounded-full bg-zinc-800 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {getInitials(act.user_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {act.user_name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium border ${actBadge.color}`}
                      >
                        {actBadge.icon}
                        <span>{actBadge.label}</span>
                      </span>
                      {isLatest && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          Latest Activity
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">{act.action_description}</p>
                    {act.details && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-500 italic mt-0.5">
                        {act.details}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium block">
                      {formatRelativeTime(act.timestamp)}
                    </span>
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 block">
                      {formatExactDate(act.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </footer>
  );
};
