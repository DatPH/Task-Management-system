import React, { useState } from 'react';
import { useKanbanStore } from '../store/useKanbanStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  UserPlus,
  Users,
  Mail,
  User,
  Shield,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  boardName?: string;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  open,
  onOpenChange,
  boardId,
  boardName,
}) => {
  const {
    boardMembers,
    profiles,
    inviteMemberToBoard,
    removeMemberFromBoard,
  } = useKanbanStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Member' | 'Admin'>('Member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const activeMembers = boardMembers[boardId] || [];
  const invitedEmails = new Set(activeMembers.map((m) => m.email.toLowerCase()));

  // Directory profiles not yet on this board
  const availableDirectoryProfiles = profiles.filter(
    (p) => p.email && !invitedEmails.has(p.email.toLowerCase())
  );

  const handleCustomInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setFeedback({ type: 'error', message: 'Both full name and email are required.' });
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setFeedback({ type: 'error', message: 'Please provide a valid email address.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await inviteMemberToBoard(boardId, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
      });

      setFeedback({
        type: 'success',
        message: `${name.trim()} (${email.trim()}) invited! They can now be assigned tasks on this board.`,
      });
      setName('');
      setEmail('');
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to invite member.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDirectoryInvite = async (profile: (typeof profiles)[0]) => {
    if (!profile.email) return;
    setFeedback(null);
    try {
      await inviteMemberToBoard(boardId, {
        name: profile.full_name || profile.email.split('@')[0],
        email: profile.email,
        role: 'Member',
        profile_id: profile.id,
      });
      setFeedback({
        type: 'success',
        message: `${profile.full_name || profile.email} invited to this board.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to invite profile.',
      });
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (activeMembers.length <= 1) {
      setFeedback({
        type: 'error',
        message: 'A board must maintain at least one active member.',
      });
      return;
    }

    try {
      await removeMemberFromBoard(boardId, memberId);
      setFeedback({
        type: 'success',
        message: `${memberName} removed from this board.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to remove member.',
      });
    }
  };

  const getInitials = (fullName: string) => {
    return (
      fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U'
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
          <DialogHeader>
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Manage Board Members
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                  {boardName ? `Board: ${boardName}` : 'Assignee pool for this board'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Prompt Note */}
          <div className="mt-3.5 flex items-start gap-2 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 p-2.5 text-xs text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
            <Shield className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
            <p>
              <strong>Assignee Isolation:</strong> Only members invited to this board will appear
              in task assignee selection dropdowns.
            </p>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-6 mt-4 p-3 rounded-lg text-xs flex items-center justify-between gap-2 border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
          {/* Section 1: Active Invited Members */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>Active Board Members</span>
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-200 text-zinc-800 font-bold">
                  {activeMembers.length}
                </span>
              </h3>
              <span className="text-[11px] text-zinc-400">Can be assigned tasks</span>
            </div>

            <div className="space-y-2">
              {activeMembers.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-zinc-200 rounded-lg text-zinc-400 text-xs">
                  No members invited yet. Invite members below.
                </div>
              ) : (
                activeMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200/80 bg-white hover:border-zinc-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {getInitials(member.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-900">{member.name}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-medium uppercase tracking-wider ${
                              member.role === 'Owner'
                                ? 'bg-amber-100 text-amber-800'
                                : member.role === 'Admin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-zinc-100 text-zinc-700'
                            }`}
                          >
                            {member.role}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-500">{member.email}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id, member.name)}
                      disabled={activeMembers.length <= 1}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                      title={
                        activeMembers.length <= 1
                          ? 'Cannot remove the last member of a board'
                          : 'Remove from this board'
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 2: Quick Invite from Team Directory */}
          {availableDirectoryProfiles.length > 0 && (
            <div className="pt-2 border-t border-zinc-100">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5 text-zinc-600" />
                <span>Quick Invite from Team Directory</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableDirectoryProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-zinc-200/70 bg-zinc-50/50 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="h-7 w-7 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {getInitials(profile.full_name || profile.email || 'U')}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-medium text-zinc-800 truncate">
                          {profile.full_name || 'Team Member'}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate">{profile.email}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDirectoryInvite(profile)}
                      className="h-7 px-2 text-[11px] shrink-0 gap-1 border-zinc-300"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Invite</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Invite by Name & Email Form */}
          <div className="pt-2 border-t border-zinc-100">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-zinc-600" />
              <span>Invite New Colleague by Email</span>
            </h3>

            <form onSubmit={handleCustomInvite} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="invite-name" className="text-xs">
                    Full Name *
                  </Label>
                  <div className="relative">
                    <Input
                      id="invite-name"
                      placeholder="e.g. Elena Rostova"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="text-xs pl-8"
                      required
                    />
                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="invite-email" className="text-xs">
                    Email Address *
                  </Label>
                  <div className="relative">
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="e.g. elena@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="text-xs pl-8"
                      required
                    />
                    <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600">Board Role:</span>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'Member' | 'Admin')}
                    className="h-8 px-2 text-xs rounded-md border border-zinc-200 bg-white text-zinc-800 focus:ring-1 focus:ring-zinc-900"
                  >
                    <option value="Member">Member (Standard Assignee)</option>
                    <option value="Admin">Admin (Full Board Control)</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="h-8 px-4 text-xs font-semibold gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Send Board Invite</span>
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
