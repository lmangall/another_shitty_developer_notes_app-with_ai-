'use client';

import { useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bold,
  Italic,
  List,
  Code,
  Hash,
  Eye,
  EyeOff,
  Link2,
  Columns2,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  className?: string;
  onSave?: () => void;
  viewMode?: 'edit' | 'preview' | 'split';
  onViewModeChange?: (mode: 'edit' | 'preview' | 'split') => void;
  showToolbar?: boolean;
  autoFocus?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your note... (Markdown supported)',
  minRows = 15,
  className,
  onSave,
  viewMode = 'edit',
  onViewModeChange,
  showToolbar = true,
  autoFocus = false,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when autoFocus is true
  useEffect(() => {
    if (autoFocus && textareaRef.current && viewMode !== 'preview') {
      textareaRef.current.focus();
    }
  }, [autoFocus, viewMode]);

  const insertFormat = useCallback(
    (prefix: string, suffix: string = prefix) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = value.substring(start, end);

      const newText =
        value.substring(0, start) +
        prefix +
        selected +
        suffix +
        value.substring(end);
      onChange(newText);

      setTimeout(() => {
        textarea.focus();
        if (selected) {
          // Keep selection after formatting
          textarea.setSelectionRange(
            start + prefix.length,
            start + prefix.length + selected.length
          );
        } else {
          // Place cursor between markers
          textarea.setSelectionRange(start + prefix.length, start + prefix.length);
        }
      }, 0);
    },
    [value, onChange]
  );

  const insertAtLineStart = useCallback(
    (prefix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;

      const newText =
        value.substring(0, lineStart) + prefix + value.substring(lineStart);
      onChange(newText);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      }, 0);
    },
    [value, onChange]
  );

  const insertLink = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);

    // If text is selected, wrap it as link text
    if (selected) {
      const newText =
        value.substring(0, start) + `[${selected}](url)` + value.substring(end);
      onChange(newText);
      setTimeout(() => {
        textarea.focus();
        // Select "url" so user can type the URL
        textarea.setSelectionRange(
          start + selected.length + 3,
          start + selected.length + 6
        );
      }, 0);
    } else {
      const newText = value.substring(0, start) + '[text](url)' + value.substring(end);
      onChange(newText);
      setTimeout(() => {
        textarea.focus();
        // Select "text" so user can type the link text
        textarea.setSelectionRange(start + 1, start + 5);
      }, 0);
    }
  }, [value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Keyboard shortcuts for formatting
      if (isMod) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            insertFormat('**');
            return;
          case 'i':
            e.preventDefault();
            insertFormat('*');
            return;
          case 'e':
            e.preventDefault();
            insertFormat('`');
            return;
          case 'k':
            e.preventDefault();
            insertLink();
            return;
          case 's':
            e.preventDefault();
            onSave?.();
            return;
          case 'enter':
            e.preventDefault();
            onSave?.();
            return;
        }
      }

      // Enter key - handle list continuation
      if (e.key === 'Enter' && !e.shiftKey && !isMod) {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const { selectionStart } = textarea;
        const text = value;

        // Find the start of the current line
        const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
        const lineEnd = text.indexOf('\n', selectionStart);
        const currentLine = text.substring(
          lineStart,
          lineEnd === -1 ? text.length : lineEnd
        );

        // Check for list patterns
        const bulletMatch = currentLine.match(/^(\s*)([-*])\s/);
        const checkboxMatch = currentLine.match(/^(\s*)([-*])\s\[([ xX])\]\s/);
        const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s/);

        let listPrefix = '';
        let isEmptyListItem = false;

        if (checkboxMatch) {
          const [fullMatch, indent, marker] = checkboxMatch;
          const lineContent = currentLine.substring(fullMatch.length);
          isEmptyListItem = lineContent.trim() === '';
          listPrefix = `${indent}${marker} [ ] `;
        } else if (bulletMatch) {
          const [fullMatch, indent, marker] = bulletMatch;
          const lineContent = currentLine.substring(fullMatch.length);
          isEmptyListItem = lineContent.trim() === '';
          listPrefix = `${indent}${marker} `;
        } else if (numberedMatch) {
          const [fullMatch, indent, num] = numberedMatch;
          const lineContent = currentLine.substring(fullMatch.length);
          isEmptyListItem = lineContent.trim() === '';
          listPrefix = `${indent}${parseInt(num) + 1}. `;
        }

        if (listPrefix) {
          e.preventDefault();

          if (isEmptyListItem) {
            const beforeLine = text.substring(0, lineStart);
            const afterLine = text.substring(lineEnd === -1 ? text.length : lineEnd);
            const newText = beforeLine.trimEnd() + afterLine;
            onChange(newText);
            setTimeout(() => {
              textarea.focus();
              const newPos = beforeLine.trimEnd().length;
              textarea.setSelectionRange(newPos, newPos);
            }, 0);
          } else {
            const before = text.substring(0, selectionStart);
            const after = text.substring(selectionStart);
            const newText = before + '\n' + listPrefix + after;
            onChange(newText);
            setTimeout(() => {
              textarea.focus();
              const newPos = selectionStart + 1 + listPrefix.length;
              textarea.setSelectionRange(newPos, newPos);
            }, 0);
          }
        }
      }
    },
    [value, onChange, insertFormat, insertLink, onSave]
  );

  const cycleViewMode = useCallback(() => {
    if (!onViewModeChange) return;
    const modes: Array<'edit' | 'preview' | 'split'> = ['edit', 'split', 'preview'];
    const currentIndex = modes.indexOf(viewMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    onViewModeChange(nextMode);
  }, [viewMode, onViewModeChange]);

  const wordCount = value.trim()
    ? value
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length
    : 0;

  const showEditor = viewMode === 'edit' || viewMode === 'split';
  const showPreview = viewMode === 'preview' || viewMode === 'split';

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {showToolbar && (
        <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30">
          {showEditor && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertFormat('**')}
                title="Bold (Cmd+B)"
              >
                <Bold size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertFormat('*')}
                title="Italic (Cmd+I)"
              >
                <Italic size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertFormat('`')}
                title="Inline code (Cmd+E)"
              >
                <Code size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={insertLink}
                title="Link (Cmd+K)"
              >
                <Link2 size={16} />
              </Button>
              <div className="w-px h-5 bg-border mx-1" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertAtLineStart('- ')}
                title="List item"
              >
                <List size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertAtLineStart('- [ ] ')}
                title="Checkbox"
              >
                <ListChecks size={16} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => insertAtLineStart('## ')}
                title="Heading"
              >
                <Hash size={16} />
              </Button>
            </>
          )}
          <span className="ml-auto text-xs text-muted-foreground mr-2">
            {wordCount} words
          </span>
          {onViewModeChange && (
            <Button
              type="button"
              variant={viewMode !== 'edit' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 px-2 gap-1"
              onClick={cycleViewMode}
              title={
                viewMode === 'edit'
                  ? 'Split view'
                  : viewMode === 'split'
                    ? 'Preview only'
                    : 'Edit only'
              }
            >
              {viewMode === 'edit' && <Eye size={16} />}
              {viewMode === 'split' && <Columns2 size={16} />}
              {viewMode === 'preview' && <EyeOff size={16} />}
              <span className="text-xs">
                {viewMode === 'edit' && 'Preview'}
                {viewMode === 'split' && 'Split'}
                {viewMode === 'preview' && 'Edit'}
              </span>
            </Button>
          )}
        </div>
      )}

      <div
        className={cn(
          'flex',
          viewMode === 'split' ? 'divide-x' : '',
          viewMode === 'split' && 'min-h-[300px]'
        )}
      >
        {showEditor && (
          <div className={cn('flex-1', viewMode === 'split' && 'w-1/2')}>
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={minRows}
              placeholder={placeholder}
              className={cn(
                'min-h-[300px] border-0 rounded-none focus-visible:ring-0 resize-none',
                viewMode === 'split' && 'h-full'
              )}
            />
          </div>
        )}

        {showPreview && (
          <div
            className={cn(
              'flex-1 p-3 overflow-auto',
              viewMode === 'split' && 'w-1/2 bg-muted/20'
            )}
          >
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {value ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground italic">Nothing to preview</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
