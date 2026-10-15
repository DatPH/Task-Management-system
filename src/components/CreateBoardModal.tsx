import React, { useState } from 'react';
import { useKanbanStore, DEFAULT_WORKSPACE_1_ID } from '../store/useKanbanStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Kanban, Plus, Check, Users, AlertCircle, Sparkles } from 'lucide-react';

interface CreateBoardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBoardCreated?: (boardId: string) => void;
}

export const CreateBoardModal: React.FC<CreateBoardModalProps> = ({
  open,
  onOpenChange,
  onBoardCreated,
}) => {
  const { profiles, createBoard, fetchBoard, workspaces, activeWorkspaceId, boards } =
    useKanbanStore();

  const currentWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const currentWorkspaceBoards = boards.filter(
    (b) => (b.workspace_id || DEFAULT_WORKSPACE_1_ID) === currentWorkspace?.id
  );

  const isLimitReached = currentWorkspaceBoards.length >= 5;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [extraName, setExtraName] = useState('');
  const [extraEmail, setExtraEmail] = useState('');
  const [extraMembers, setExtraMembers] = useState<Array<{ name: string; email: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with the first profile selected by default
  React.useEffect(() => {
    if (profiles.length > 0 && selectedProfileIds.length === 0) {
      setSelectedProfileIds([profiles[0].id]);
    }
  }, [profiles, selectedProfileIds.length]);

  const toggleProfile = (id: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleAddExtraMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraEmail.trim() || !extraEmail.includes('@')) return;

    const newExtra = {
      name: extraName.trim() || extraEmail.split('@')[0],
      email: extraEmail.trim().toLowerCase(),
    };

    if (
      !extraMembers.some((m) => m.email === newExtra.email) &&
      !profiles.some((p) => p.email === newExtra.email)
    ) {
      setExtraMembers((prev) => [...prev, newExtra]);
    }
    setExtraName('');
    setExtraEmail('');
  };

  const removeExtraMember = (email: string) => {
    setExtraMembers((prev) => prev.filter((m) => m.email !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) {
      setError('Maximum 5 boards reached for this workspace in MVP version.');
      return;
    }

    if (!name.trim()) {
      setError('Board name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Gather initial members to invite
      const chosenProfiles = profiles.filter((p) => selectedProfileIds.includes(p.id));
      const initialMembers = [
        ...chosenProfiles.map((p, idx) => ({
          name: p.full_name || p.email?.split('@')[0] || 'Member',
          email: p.email || `user-${p.id}@company.com`,
          role: (idx === 0 ? 'Owner' : 'Member') as 'Owner' | 'Member',
          profile_id: p.id,
        })),
        ...extraMembers.map((m) => ({
          name: m.name,
          email: m.email,
          role: 'Member' as const,
        })),
      ];

      const newBoardId = await createBoard(
        name.trim(),
        description.trim() || undefined,
        initialMembers,
        currentWorkspace?.id
      );
      await fetchBoard(newBoardId);

      // Reset form
      setName('');
      setDescription('');
      setExtraMembers([]);
      onOpenChange(false);
      if (onBoardCreated) {
        onBoardCreated(newBoardId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create board.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
        <div className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-2xs"
                style={{ backgroundColor: currentWorkspace?.color || '#18181b' }}
              >
                <Kanban className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Create New Board
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                  Adding to workspace:{' '}
                  <strong className="text-zinc-800 dark:text-zinc-200 font-medium">
                    {currentWorkspace?.name || 'Workspace'}
                  </strong>{' '}
                  ({currentWorkspaceBoards.length}/5 boards)
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Quota Banner */}
        <div className="px-6 pt-4 pb-1">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-700 text-xs">
            <span className="text-zinc-600 dark:text-zinc-400 font-medium flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
              <span>MVP Quota (Boards per Workspace)</span>
            </span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-md text-[11px] ${
                isLimitReached
                  ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {currentWorkspaceBoards.length} / 5 used
            </span>
          </div>
        </div>

        {isLimitReached && (
          <div className="mx-6 mt-3 p-3 rounded-lg text-xs bg-amber-50 text-amber-900 border border-amber-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <strong className="block font-medium">Workspace limit reached (5/5 boards)</strong>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                In this MVP version, each workspace can contain a maximum of 5 boards. You can create a new workspace from the left navigation rail or archive an unused board.
              </p>
            </div>
          </div>
        )}

        {error && !isLimitReached && (
          <div className="mx-6 mt-3 p-3 rounded-lg text-xs bg-rose-50 text-rose-800 border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Board Name */}
          <div className="space-y-1.5">
            <Label htmlFor="board-name" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Board Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="board-name"
              placeholder="e.g. Q4 Growth & Partner Sprint"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm font-medium bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
              disabled={isLimitReached || isSubmitting}
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="board-desc" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Description / Objective
            </Label>
            <Textarea
              id="board-desc"
              placeholder="Outline the board goals, key milestones, or target deliverables..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
              disabled={isLimitReached || isSubmitting}
            />
          </div>

          {/* Initial Columns Note */}
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3 border border-zinc-200/80 dark:border-zinc-700">
            <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              Included Workflow Stages:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['Backlog', 'In Progress', 'In Review', 'Completed'].map((stage) => (
                <span
                  key={stage}
                  className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 shadow-2xs"
                >
                  {stage}
                </span>
              ))}
            </div>
          </div>

          {/* Invite Members Selection */}
          <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                <span>Invite Members to this Board</span>
              </Label>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Only invited members can be assigned tasks
              </span>
            </div>

            {/* Profile Checkboxes */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {profiles.map((profile) => {
                const isSelected = selectedProfileIds.includes(profile.id);
                return (
                  <button
                    key={profile.id}
                    type="button"
                    disabled={isLimitReached}
                    onClick={() => toggleProfile(profile.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? 'border-zinc-900 dark:border-zinc-400 bg-zinc-900/5 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isSelected ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {(profile.full_name || profile.email || 'U')[0].toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-medium block truncate">
                          {profile.full_name || profile.email}
                        </span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block truncate">
                          {profile.email}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`h-4 w-4 rounded flex items-center justify-center border transition-colors ${
                        isSelected
                          ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 text-white dark:text-zinc-900'
                          : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Extra Members Tags */}
            {extraMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {extraMembers.map((m) => (
                  <span
                    key={m.email}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  >
                    <span>{m.name} ({m.email})</span>
                    <button
                      type="button"
                      onClick={() => removeExtraMember(m.email)}
                      className="text-blue-500 hover:text-blue-800 dark:hover:text-blue-200 ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add colleague by email */}
            <div className="pt-2 flex items-center gap-2">
              <Input
                placeholder="Colleague email..."
                type="email"
                value={extraEmail}
                onChange={(e) => setExtraEmail(e.target.value)}
                disabled={isLimitReached}
                className="text-xs h-8 flex-1 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLimitReached}
                onClick={handleAddExtraMember}
                className="h-8 px-2.5 text-xs shrink-0 gap-1 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Plus className="h-3 w-3" />
                <span>Add</span>
              </Button>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLimitReached || isSubmitting || !name.trim()}
              className="text-xs font-semibold gap-1.5 shadow-xs bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Creating...' : 'Create & Open Board'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
