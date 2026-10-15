import React from 'react';
import { CheckSquare, Square, Copy, Check } from 'lucide-react';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  onToggleCheckbox?: (lineIndex: number, newChecked: boolean) => void;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  className = '',
  onToggleCheckbox,
}) => {
  const [copiedCodeIndex, setCopiedCodeIndex] = React.useState<number | null>(null);

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  // Parse lines into blocks
  const renderFormattedText = (text: string): React.ReactNode => {
    // Process bold, italic, code, links
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    // Simple regex replacements
    const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g;
    let lastIndex = 0;
    let match;

    while ((match = tokenRegex.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        parts.push(remaining.substring(lastIndex, match.index));
      }

      const matchText = match[0];
      if (matchText.startsWith('**') && matchText.endsWith('**')) {
        parts.push(
          <strong key={key++} className="font-semibold text-zinc-900 dark:text-zinc-100">
            {matchText.slice(2, -2)}
          </strong>
        );
      } else if (matchText.startsWith('*') && matchText.endsWith('*')) {
        parts.push(
          <em key={key++} className="italic text-zinc-800 dark:text-zinc-200">
            {matchText.slice(1, -1)}
          </em>
        );
      } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
        parts.push(
          <code
            key={key++}
            className="px-1.5 py-0.5 rounded text-[12px] font-mono bg-zinc-100 dark:bg-zinc-800 text-pink-600 dark:text-pink-400 border border-zinc-200 dark:border-zinc-700"
          >
            {matchText.slice(1, -1)}
          </code>
        );
      } else if (matchText.startsWith('~~') && matchText.endsWith('~~')) {
        parts.push(
          <del key={key++} className="line-through text-zinc-400 dark:text-zinc-500">
            {matchText.slice(2, -2)}
          </del>
        );
      } else if (matchText.startsWith('[') && matchText.includes('](')) {
        const linkText = matchText.substring(1, matchText.indexOf(']('));
        const linkUrl = matchText.substring(matchText.indexOf('](') + 2, matchText.length - 1);
        parts.push(
          <a
            key={key++}
            href={linkUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sky-600 dark:text-sky-400 underline hover:text-sky-700 dark:hover:text-sky-300"
          >
            {linkText}
          </a>
        );
      }

      lastIndex = match.index + matchText.length;
    }

    if (lastIndex < remaining.length) {
      parts.push(remaining.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Line-by-line block parser
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];
  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];
  let codeBlockCounter = 0;

  const flushTable = (key: number) => {
    if (tableHeader.length > 0) {
      blocks.push(
        <div key={`table-${key}`} className="my-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-850">
              <tr>
                {tableHeader.map((th, i) => (
                  <th
                    key={i}
                    className="px-3.5 py-2 text-left font-semibold text-zinc-900 dark:text-zinc-100"
                  >
                    {renderFormattedText(th.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-850/50">
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-3.5 py-2 text-zinc-700 dark:text-zinc-300 whitespace-nowrap"
                    >
                      {renderFormattedText(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    inTable = false;
    tableHeader = [];
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        if (inTable) flushTable(i);
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeBlockLines = [];
      } else {
        const fullCode = codeBlockLines.join('\n');
        const codeIdx = codeBlockCounter++;
        blocks.push(
          <div
            key={`code-${i}`}
            className="my-3 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 text-xs font-mono shadow-xs"
          >
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-400">
              <span>{codeBlockLang || 'code'}</span>
              <button
                type="button"
                onClick={() => handleCopyCode(fullCode, codeIdx)}
                className="flex items-center gap-1 hover:text-zinc-200 transition-colors"
                title="Copy code"
              >
                {copiedCodeIndex === codeIdx ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400 text-[10px]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span className="text-[10px]">Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3.5 overflow-x-auto leading-relaxed">
              <code>{fullCode}</code>
            </pre>
          </div>
        );
        inCodeBlock = false;
        codeBlockLang = '';
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Markdown Table Detection
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line
        .trim()
        .slice(1, -1)
        .split('|');

      // Check if divider line like | :--- | :--- |
      const isDivider = cells.every((c) => /^\s*:?-+:?\s*$/.test(c));
      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else if (isDivider) {
        // Divider row, skip adding as data
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable(i);
    }

    // Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(line.trim())) {
      blocks.push(
        <hr key={`hr-${i}`} className="my-5 border-t border-zinc-200 dark:border-zinc-800" />
      );
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      blocks.push(
        <h1
          key={`h1-${i}`}
          className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-5 mb-2.5 pb-1 border-b border-zinc-100 dark:border-zinc-800"
        >
          {renderFormattedText(line.slice(2))}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(
        <h2
          key={`h2-${i}`}
          className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-4 mb-2"
        >
          {renderFormattedText(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push(
        <h3
          key={`h3-${i}`}
          className="text-sm sm:text-base font-semibold text-zinc-800 dark:text-zinc-200 mt-3 mb-1.5"
        >
          {renderFormattedText(line.slice(4))}
        </h3>
      );
      continue;
    }
    if (line.startsWith('#### ')) {
      blocks.push(
        <h4
          key={`h4-${i}`}
          className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mt-2.5 mb-1"
        >
          {renderFormattedText(line.slice(5))}
        </h4>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteText = line.slice(2);
      const isNotice = quoteText.includes('Notice:') || quoteText.includes('Warning:');
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          className={`my-3 p-3 rounded-r-lg border-l-4 text-xs leading-relaxed ${
            isNotice
              ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
              : 'border-zinc-400 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-850/60 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          {renderFormattedText(quoteText)}
        </blockquote>
      );
      continue;
    }

    // Checkbox Task Lists
    if (/^\s*-\s*\[([ xX])\]\s*/.test(line)) {
      const isChecked = /^\s*-\s*\[[xX]\]/.test(line);
      const itemText = line.replace(/^\s*-\s*\[([ xX])\]\s*/, '');
      blocks.push(
        <div key={`task-${i}`} className="flex items-start gap-2 my-1 text-xs">
          <button
            type="button"
            onClick={() => onToggleCheckbox?.(i, !isChecked)}
            className="mt-0.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            {isChecked ? (
              <CheckSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Square className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
            )}
          </button>
          <span
            className={`flex-1 leading-relaxed ${
              isChecked
                ? 'line-through text-zinc-400 dark:text-zinc-500'
                : 'text-zinc-800 dark:text-zinc-200'
            }`}
          >
            {renderFormattedText(itemText)}
          </span>
        </div>
      );
      continue;
    }

    // Unordered List item
    if (/^\s*[-*]\s+/.test(line)) {
      const itemText = line.replace(/^\s*[-*]\s+/, '');
      blocks.push(
        <div key={`li-${i}`} className="flex items-start gap-2 my-1 text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 mt-1.5 shrink-0" />
          <div className="flex-1">{renderFormattedText(itemText)}</div>
        </div>
      );
      continue;
    }

    // Ordered List item
    if (/^\s*\d+\.\s+/.test(line)) {
      const match = line.match(/^\s*(\d+)\.\s+(.*)/);
      if (match) {
        const num = match[1];
        const itemText = match[2];
        blocks.push(
          <div key={`ol-${i}`} className="flex items-start gap-2 my-1 text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
            <span className="font-semibold text-zinc-500 dark:text-zinc-400 text-[11px] min-w-[16px] text-right shrink-0">
              {num}.
            </span>
            <div className="flex-1">{renderFormattedText(itemText)}</div>
          </div>
        );
        continue;
      }
    }

    // Empty line
    if (line.trim() === '') {
      blocks.push(<div key={`empty-${i}`} className="h-2" />);
      continue;
    }

    // Standard paragraph line
    blocks.push(
      <p key={`p-${i}`} className="my-1 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
        {renderFormattedText(line)}
      </p>
    );
  }

  if (inTable) {
    flushTable(lines.length);
  }

  return (
    <div className={`markdown-body select-text ${className}`}>
      {blocks.length > 0 ? (
        blocks
      ) : (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No content yet.</p>
      )}
    </div>
  );
};
