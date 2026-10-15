import React, { useState } from 'react';
import { useKanbanStore } from '../store/useKanbanStore';
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
import { Layers, Plus, AlertCircle, Check, Sparkles } from 'lucide-react';

interface CreateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkspaceCreated?: (workspaceId: string) => void;
}

const PRESET_COLORS = [
  { label: 'Sky Blue', hex: '#0284c7' },
  { label: 'Purple', hex: '#8b5cf6' },
  { label: 'Emerald', hex: '#059669' },
  { label: 'Amber', hex: '#d97706' },
  { label: 'Rose', hex: '#e11d48' },
  { label: 'Indigo', hex: '#4f46e5' },
];

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  open,
  onOpenChange,
  onWorkspaceCreated,
}) => {
  const { workspaces, createWorkspace } = useKanbanStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].hex);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLimitReached = workspaces.length >= 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) {
      setError('Maximum 3 workspaces reached for this user in MVP version.');
      return;
    }

    if (!name.trim()) {
      setError('Workspace name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newWsId = await createWorkspace(name.trim(), description.trim() || undefined, selectedColor);
      setName('');
      setDescription('');
      setSelectedColor(PRESET_COLORS[0].hex);
      onOpenChange(false);
      if (onWorkspaceCreated) {
        onWorkspaceCreated(newWsId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
        <div className="p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-2xs transition-colors"
                style={{ backgroundColor: selectedColor }}
              >
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Create New Workspace
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                  Parent container for your teams, boards, and workflows.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Quota tracker banner */}
        <div className="px-6 pt-4 pb-1">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-800/70 border border-zinc-200/70 dark:border-zinc-700 text-xs">
            <span className="text-zinc-600 dark:text-zinc-400 font-medium flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
              <span>MVP Quota (Workspaces per User)</span>
            </span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-md text-[11px] ${
                isLimitReached
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {workspaces.length} / 3 used
            </span>
          </div>
        </div>

        {isLimitReached && (
          <div className="mx-6 mt-3 p-3 rounded-lg text-xs bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <strong className="block font-medium">Workspace limit reached (3/3)</strong>
              <p className="mt-0.5 text-amber-800 dark:text-amber-300 leading-relaxed">
                For the current MVP version, you can create up to 3 workspaces. Please use an existing workspace or organize boards inside them.
              </p>
            </div>
          </div>
        )}

        {error && !isLimitReached && (
          <div className="mx-6 mt-3 p-3 rounded-lg text-xs bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 pt-3 space-y-4">
          {/* Workspace Name */}
          <div className="space-y-1.5">
            <Label htmlFor="ws-name" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Workspace Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="ws-name"
              placeholder="e.g. Acme Tech, Marketing Hub, Client Ops"
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
            <Label htmlFor="ws-desc" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Description / Scope
            </Label>
            <Textarea
              id="ws-desc"
              placeholder="Brief summary of teams, domains, or departments in this workspace..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
              disabled={isLimitReached || isSubmitting}
            />
          </div>

          {/* Color Tag Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Workspace Color Accent
            </Label>
            <div className="flex items-center gap-2 pt-1">
              {PRESET_COLORS.map((c) => {
                const isSelected = selectedColor === c.hex;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => setSelectedColor(c.hex)}
                    disabled={isLimitReached}
                    className={`h-7 w-7 rounded-full flex items-center justify-center transition-transform ${
                      isSelected ? 'ring-2 ring-zinc-900 dark:ring-zinc-100 ring-offset-2 dark:ring-offset-zinc-900 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Initial Board Note */}
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3 border border-zinc-200/80 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">Automatic Initialization:</span> A starter project board with 4 standard stages (Backlog, In Progress, In Review, Completed) will be created automatically inside this workspace.
          </div>

          <DialogFooter className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
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
              <span>{isSubmitting ? 'Creating...' : 'Create Workspace'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
