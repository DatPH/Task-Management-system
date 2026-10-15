import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  FileAudio,
  FileVideo,
  File,
  Download,
  Trash2,
  Maximize2,
  X,
  AlertTriangle,
  Check,
} from 'lucide-react';
import type { CommentAttachment } from '../types';
import {
  formatFileSize,
  getFileCategory,
  downloadAttachment,
  FileCategory,
} from '../utils/fileUtils';

interface CommentAttachmentViewerProps {
  attachments: CommentAttachment[];
  onRemoveAttachment?: (attachmentId: string) => Promise<void> | void;
  canRemove?: boolean;
}

export const CommentAttachmentViewer: React.FC<CommentAttachmentViewerProps> = ({
  attachments,
  onRemoveAttachment,
  canRemove = true,
}) => {
  const [activePreviewImage, setActivePreviewImage] = useState<CommentAttachment | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const images = attachments.filter((att) => getFileCategory(att.type, att.name) === 'image');
  const nonImages = attachments.filter((att) => getFileCategory(att.type, att.name) !== 'image');

  const handleDelete = async (attId: string) => {
    if (!onRemoveAttachment) return;
    try {
      setIsDeleting(attId);
      await onRemoveAttachment(attId);
      setConfirmDeleteId(null);
      if (activePreviewImage?.id === attId) {
        setActivePreviewImage(null);
      }
    } catch (err) {
      console.error('Failed to remove attachment:', err);
    } finally {
      setIsDeleting(null);
    }
  };

  const renderFileIcon = (category: FileCategory) => {
    switch (category) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-rose-600" />;
      case 'document':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'spreadsheet':
        return <FileSpreadsheet className="h-4 w-4 text-emerald-600" />;
      case 'code':
        return <FileCode className="h-4 w-4 text-violet-600" />;
      case 'archive':
        return <FileArchive className="h-4 w-4 text-amber-600" />;
      case 'audio':
        return <FileAudio className="h-4 w-4 text-purple-600" />;
      case 'video':
        return <FileVideo className="h-4 w-4 text-pink-600" />;
      default:
        return <File className="h-4 w-4 text-zinc-500" />;
    }
  };

  return (
    <div className="mt-2.5 space-y-2.5 pl-7">
      {/* 1. Image Attachments Gallery */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-0.5">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative rounded-lg border border-zinc-200/90 bg-zinc-100 overflow-hidden shadow-2xs hover:shadow-xs transition-all w-28 sm:w-36 flex flex-col"
            >
              {/* Thumbnail Container */}
              <div
                onClick={() => setActivePreviewImage(img)}
                className="relative h-20 sm:h-24 w-full cursor-zoom-in bg-zinc-900/5 flex items-center justify-center overflow-hidden"
                title={`Click to preview full size: ${img.name}`}
              >
                <img
                  src={img.url}
                  alt={img.name}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white">
                  <Maximize2 className="h-4 w-4 drop-shadow-sm" />
                </div>
              </div>

              {/* Bottom Info & Action Bar */}
              <div className="p-1.5 bg-white border-t border-zinc-100 flex items-center justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[11px] font-medium text-zinc-700 truncate"
                    title={img.name}
                  >
                    {img.name}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    {formatFileSize(img.size)}
                  </p>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadAttachment(img);
                    }}
                    className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-colors"
                    title="Download image"
                  >
                    <Download className="h-3 w-3" />
                  </button>

                  {canRemove && onRemoveAttachment && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(img.id);
                      }}
                      className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Remove attachment from database"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Delete Confirmation Overlay */}
              {confirmDeleteId === img.id && (
                <div className="absolute inset-0 bg-white/95 p-2 flex flex-col justify-center items-center text-center z-10 animate-in fade-in duration-150">
                  <AlertTriangle className="h-4 w-4 text-rose-600 mb-1" />
                  <p className="text-[10px] font-semibold text-zinc-800 leading-tight mb-2">
                    Remove attachment?
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isDeleting === img.id}
                      onClick={() => handleDelete(img.id)}
                      className="px-2 py-0.5 text-[10px] font-semibold bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors disabled:opacity-50"
                    >
                      {isDeleting === img.id ? 'Removing...' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 2. Non-Image Document / File Attachments */}
      {nonImages.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-0.5">
          {nonImages.map((file) => {
            const category = getFileCategory(file.type, file.name);

            return (
              <div
                key={file.id}
                className="relative group flex items-center justify-between gap-2.5 p-2 rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50 transition-all max-w-md shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="p-1.5 rounded-md bg-zinc-100 shrink-0">
                    {renderFileIcon(category)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs font-medium text-zinc-800 truncate"
                      title={file.name}
                    >
                      {file.name}
                    </p>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadAttachment(file)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors"
                    title="Download file"
                  >
                    <Download className="h-3 w-3 text-zinc-500" />
                    <span className="hidden sm:inline">Download</span>
                  </button>

                  {canRemove && onRemoveAttachment && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(file.id)}
                      className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="Remove attachment from database"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Inline Confirmation */}
                {confirmDeleteId === file.id && (
                  <div className="absolute inset-0 bg-white/95 rounded-lg px-3 py-1.5 flex items-center justify-between z-10 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 text-xs text-rose-700 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Remove from database?</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isDeleting === file.id}
                        onClick={() => handleDelete(file.id)}
                        className="px-2 py-1 text-xs font-semibold bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors disabled:opacity-50"
                      >
                        {isDeleting === file.id ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 text-xs text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Fullscreen / Lightbox Modal for Active Image */}
      {activePreviewImage && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="fixed inset-0"
            onClick={() => setActivePreviewImage(null)}
          />

          <div className="relative max-w-4xl w-full max-h-[90vh] bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl flex flex-col z-10 border border-zinc-800">
            {/* Lightbox Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 text-white">
              <div className="min-w-0 flex-1 pr-3">
                <h4 className="text-sm font-semibold truncate text-zinc-100">
                  {activePreviewImage.name}
                </h4>
                <p className="text-xs text-zinc-400 font-mono">
                  {formatFileSize(activePreviewImage.size)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadAttachment(activePreviewImage)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
                  title="Download image"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>

                {canRemove && onRemoveAttachment && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Are you sure you want to remove this attachment from the database?')) {
                        handleDelete(activePreviewImage.id);
                      }
                    }}
                    className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                    title="Remove attachment from database"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActivePreviewImage(null)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors ml-1"
                  title="Close preview (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Lightbox Image Stage */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-zinc-950/50 min-h-[300px]">
              <img
                src={activePreviewImage.url}
                alt={activePreviewImage.name}
                className="max-h-[75vh] max-w-full object-contain rounded shadow-lg select-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
