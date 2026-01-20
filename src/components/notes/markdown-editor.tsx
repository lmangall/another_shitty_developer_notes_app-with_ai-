'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Bold,
  Italic,
  List,
  Code,
  Hash,
  Eye,
  Pencil,
  Link2,
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
  viewMode?: 'edit' | 'preview';
  onViewModeChange?: (mode: 'edit' | 'preview') => void;
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
  viewMode = 'preview',
  onViewModeChange,
  showToolbar = true,
  autoFocus = false,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [internalMode, setInternalMode] = useState<'edit' | 'preview'>(viewMode);

  // Sync internal mode with prop
  useEffect(() => {
    setInternalMode(viewMode);
  }, [viewMode]);

  // Focus textarea when switching to edit mode
  useEffect(() => {
    if (internalMode === 'edit' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [internalMode]);

  useEffect(() => {
    if (autoFocus && textareaRef.current && internalMode === 'edit') {
      textareaRef.current.focus();
    }
  }, [autoFocus, internalMode]);

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
          textarea.setSelectionRange(
            start + prefix.length,
            start + prefix.length + selected.length
          );
        } else {
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

    if (selected) {
      const newText =
        value.substring(0, start) + `[${selected}](url)` + value.substring(end);
      onChange(newText);
      setTimeout(() => {
        textarea.focus();
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

      // Escape to switch to preview
      if (e.key === 'Escape') {
        e.preventDefault();
        setInternalMode('preview');
        onViewModeChange?.('preview');
        return;
      }

      // Enter key - handle list continuation
      if (e.key === 'Enter' && !e.shiftKey && !isMod) {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const { selectionStart } = textarea;
        const text = value;

        const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
        const lineEnd = text.indexOf('\n', selectionStart);
        const currentLine = text.substring(
          lineStart,
          lineEnd === -1 ? text.length : lineEnd
        );

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
    [value, onChange, insertFormat, insertLink, onSave, onViewModeChange]
  );

  const switchToEdit = useCallback(() => {
    setInternalMode('edit');
    onViewModeChange?.('edit');
  }, [onViewModeChange]);

  const toggleViewMode = useCallback(() => {
    const newMode = internalMode === 'edit' ? 'preview' : 'edit';
    setInternalMode(newMode);
    onViewModeChange?.(newMode);
  }, [internalMode, onViewModeChange]);

  const wordCount = value.trim()
    ? value
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length
    : 0;

  const isEditMode = internalMode === 'edit';

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {showToolbar && (
        <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              if (!isEditMode) switchToEdit();
              setTimeout(() => insertFormat('**'), 10);
            }}
            title="Bold (Cmd+B)"
          >
            <Bold size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              if (!isEditMode) switchToEdit();
              setTimeout(() => insertFormat('*'), 10);
            }}
            title="Italic (Cmd+I)"
          >
            <Italic size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              if (!isEditMode) switchToEdit();
              setTimeout(() => insertFormat('`'), 10);
            }}
            title="Inline code (Cmd+E)"
          >
            <Code size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              if (!isEditMode) switchToEdit();
              setTimeout(() => insertLink(), 10);
            }}
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
            onClick={() => {
              if (!isEditMode) switchToEdit();
              setTimeout(() => insertAtLineStart('- '), 10);
            }}
            title="List item"
          >
            <List size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              if (!isEditMode) switchToEdit();
              setTimeout(() => insertAtLineStart('- [ ] '), 10);
            }}
            title="Checkbox"
          >
            <ListChecks size={16} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              if (!isEditMode) switchToEdit();
              setTimeout(() => insertAtLineStart('## '), 10);
            }}
            title="Heading"
          >
            <Hash size={16} />
          </Button>
          <span className="ml-auto text-xs text-muted-foreground mr-2">
            {wordCount} words
          </span>
          <Button
            type="button"
            variant={isEditMode ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-2 gap-1"
            onClick={toggleViewMode}
            title={isEditMode ? 'Preview (Esc)' : 'Edit raw markdown'}
          >
            {isEditMode ? <Eye size={16} /> : <Pencil size={16} />}
            <span className="text-xs">{isEditMode ? 'Preview' : 'Raw'}</span>
          </Button>
        </div>
      )}

      {isEditMode ? (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={minRows}
          placeholder={placeholder}
          className="min-h-[300px] border-0 rounded-none focus-visible:ring-0 resize-none"
        />
      ) : (
        <div
          className="p-3 min-h-[300px] cursor-text"
          onClick={switchToEdit}
          title="Click to edit"
        >
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {value ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground italic">Click to start writing...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
