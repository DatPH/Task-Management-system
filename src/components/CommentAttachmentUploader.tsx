import React, { useRef, useState, useCallback } from 'react';
import {
  Paperclip,
  Image as ImageIcon,
  X,
  FileText,
  AlertCircle,
  Loader2,
  UploadCloud,
} from 'lucide-react';
import type { CommentAttachment } from '../types';
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  formatFileSize,
  getFileCategory,
  readFileAsDataUrl,
} from '../utils/fileUtils';

interface CommentAttachmentUploaderProps {
  stagedAttachments: CommentAttachment[];
  onAddAttachments: (attachments: CommentAttachment[]) => void;
  onRemoveStagedAttachment: (attachmentId: string) => void;
  error: string | null;
  setError: (err: string | null) => void;
  disabled?: boolean;
}

export const CommentAttachmentUploader: React.FC<CommentAttachmentUploaderProps> = ({
  stagedAttachments,
  onAddAttachments,
  onRemoveStagedAttachment,
  error,
  setError,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Calculate current total staged size
  const totalStagedSize = stagedAttachments.reduce((sum, a) => sum + a.size, 0);
  const percentUsed = Math.min(100, Math.round((totalStagedSize / MAX_ATTACHMENT_SIZE_BYTES) * 100));

  const processIncomingFiles = useCallback(
    async (fileList: FileList | File[]) => {
      setError(null);
      const files = Array.from(fileList);
      if (files.length === 0) return;

      // 1. Calculate incoming files size
      const incomingSize = files.reduce((sum, f) => sum + f.size, 0);
      const projectedTotal = totalStagedSize + incomingSize;

      if (projectedTotal > MAX_ATTACHMENT_SIZE_BYTES) {
        setError(
          `Total attachment size cannot exceed 2MB per upload. Currently selected: ${formatFileSize(
            projectedTotal
          )} (Limit: 2.0 MB). Please choose smaller files.`
        );
        return;
      }

      // Check single file limit safeguard
      const oversizeFile = files.find((f) => f.size > MAX_ATTACHMENT_SIZE_BYTES);
      if (oversizeFile) {
        setError(
          `File "${oversizeFile.name}" (${formatFileSize(
            oversizeFile.size
          )}) exceeds the 2MB limit per upload.`
        );
        return;
      }

      setIsProcessing(true);
      try {
        const readPromises = files.map(async (file): Promise<CommentAttachment> => {
          const dataUrl = await readFileAsDataUrl(file);
          return {
            id: crypto.randomUUID(),
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            url: dataUrl,
            created_at: new Date().toISOString(),
          };
        });

        const newAttachments = await Promise.all(readPromises);
        onAddAttachments(newAttachments);
      } catch (err) {
        console.error('Error reading attached files:', err);
        setError('Failed to process file attachment. Please try again.');
      } finally {
        setIsProcessing(false);
        // Reset inputs
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (imageInputRef.current) imageInputRef.current.value = '';
      }
    },
    [totalStagedSize, onAddAttachments, setError]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFiles(e.target.files);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="w-full space-y-2">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled || isProcessing}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled || isProcessing}
      />

      {/* Drag & Drop Visual Dropzone Overlay (when dragging files over composer) */}
      {isDragOver && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="p-3 border-2 border-dashed border-zinc-900 bg-zinc-50 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold text-zinc-800 animate-in fade-in"
        >
          <UploadCloud className="h-4 w-4 text-zinc-900 animate-bounce" />
          <span>Drop files or images here to attach (Max 2MB total)</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex items-start justify-between gap-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 animate-in fade-in">
          <div className="flex items-start gap-1.5 min-w-0">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-800 p-0.5 shrink-0"
            title="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Staged Attachments Preview Pills */}
      {stagedAttachments.length > 0 && (
        <div className="p-2 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2">
          {/* Header & Quota Meter */}
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span className="font-medium text-zinc-700">
              Attached ({stagedAttachments.length})
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono">
                {formatFileSize(totalStagedSize)} / 2.0 MB
              </span>
              <div className="w-16 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    percentUsed > 85 ? 'bg-amber-500' : 'bg-zinc-900'
                  }`}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
            </div>
          </div>

          {/* Staged Items Pills */}
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            {stagedAttachments.map((att) => {
              const category = getFileCategory(att.type, att.name);
              const isImg = category === 'image';

              return (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-md bg-white border border-zinc-200 shadow-2xs text-xs text-zinc-800 hover:border-zinc-300 transition-all max-w-[220px]"
                >
                  {isImg ? (
                    <img
                      src={att.url}
                      alt={att.name}
                      className="h-4 w-4 rounded object-cover shrink-0"
                    />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  )}

                  <span className="truncate text-[11px] font-medium" title={att.name}>
                    {att.name}
                  </span>

                  <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                    ({formatFileSize(att.size)})
                  </span>

                  <button
                    type="button"
                    onClick={() => onRemoveStagedAttachment(att.id)}
                    className="p-0.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors ml-auto shrink-0"
                    title="Remove attachment"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trigger Buttons (to be placed in composer bar) */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || isProcessing}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors disabled:opacity-50"
          title="Attach files (Max 2MB total)"
        >
          {isProcessing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
          ) : (
            <Paperclip className="h-3.5 w-3.5 text-zinc-500" />
          )}
          <span>Attach</span>
        </button>

        <button
          type="button"
          disabled={disabled || isProcessing}
          onClick={() => imageInputRef.current?.click()}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors disabled:opacity-50"
          title="Upload image (Max 2MB total)"
        >
          <ImageIcon className="h-3.5 w-3.5 text-zinc-500" />
          <span className="hidden sm:inline">Image</span>
        </button>

        <span className="text-[10px] text-zinc-400 font-mono hidden md:inline ml-1">
          (max 2MB per upload)
        </span>
      </div>
    </div>
  );
};
