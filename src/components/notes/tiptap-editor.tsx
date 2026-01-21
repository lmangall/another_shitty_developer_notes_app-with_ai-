'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import {
  Bold,
  Italic,
  List,
  Code,
  Hash,
  Eye,
  Code2,
  Link2,
  ListChecks,
  ListOrdered,
  Quote,
  Undo,
  Redo,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  className?: string;
  onSave?: () => void;
  showToolbar?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
  onClickToEdit?: () => void;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('h-8 w-8 p-0', isActive && 'bg-accent text-accent-foreground')}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );
}

function EditorToolbar({
  editor,
  wordCount,
  isRawMode,
  onToggleRaw,
}: {
  editor: Editor | null;
  wordCount: number;
  isRawMode: boolean;
  onToggleRaw: () => void;
}) {
  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30 flex-wrap">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Cmd+B)"
      >
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Cmd+I)"
      >
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="Inline code (Cmd+E)"
      >
        <Code size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={setLink} isActive={editor.isActive('link')} title="Link (Cmd+K)">
        <Link2 size={16} />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet list"
      >
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered list"
      >
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title="Checkbox list"
      >
        <ListChecks size={16} />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading"
      >
        <Hash size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Quote"
      >
        <Quote size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Code block"
      >
        <Code2 size={16} />
      </ToolbarButton>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Cmd+Z)"
      >
        <Undo size={16} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Cmd+Shift+Z)"
      >
        <Redo size={16} />
      </ToolbarButton>

      <span className="ml-auto text-xs text-muted-foreground mr-2">{wordCount} words</span>

      <Button
        type="button"
        variant={isRawMode ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 px-2 gap-1"
        onClick={onToggleRaw}
        title={isRawMode ? 'WYSIWYG view' : 'Raw markdown'}
      >
        {isRawMode ? <Eye size={16} /> : <Code size={16} />}
        <span className="text-xs">{isRawMode ? 'WYSIWYG' : 'Raw'}</span>
      </Button>
    </div>
  );
}

export function TiptapEditor({
  value,
  onChange,
  placeholder = 'Write your note... (Markdown supported)',
  minRows = 15,
  className,
  onSave,
  showToolbar = true,
  autoFocus = false,
  editable = true,
  onClickToEdit,
}: TiptapEditorProps) {
  const [isRawMode, setIsRawMode] = useState(false);
  const [rawContent, setRawContent] = useState(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value,
    editable,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none dark:prose-invert focus:outline-none min-h-[300px] p-3',
      },
    },
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.storage as any).markdown.getMarkdown();
      onChange(markdown);
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && !editor.isFocused) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentMarkdown = (editor.storage as any).markdown?.getMarkdown() || '';
      if (value !== currentMarkdown) {
        editor.commands.setContent(value);
      }
    }
  }, [value, editor]);

  // Sync raw content when switching to raw mode
  // This is intentional - we need to sync the raw editor content with the value when mode changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isRawMode && rawContent !== value) {
      setRawContent(value);
    }
  }, [isRawMode, value, rawContent]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL', previousUrl);

        if (url === null) return;

        if (url === '') {
          editor.chain().focus().extendMarkRange('link').unsetLink().run();
          return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        return;
      }

      if (isMod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        editor.chain().focus().toggleCode().run();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor, onSave]);

  const handleRawChange = (newContent: string) => {
    setRawContent(newContent);
    onChange(newContent);
  };

  const handleToggleRaw = () => {
    if (isRawMode && editor) {
      // Switching from raw to WYSIWYG - update editor content
      editor.commands.setContent(rawContent);
    }
    setIsRawMode(!isRawMode);
  };

  const wordCount = value.trim()
    ? value
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length
    : 0;

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {showToolbar && (
        <EditorToolbar
          editor={editor}
          wordCount={wordCount}
          isRawMode={isRawMode}
          onToggleRaw={handleToggleRaw}
        />
      )}

      {isRawMode ? (
        <Textarea
          value={rawContent}
          onChange={(e) => handleRawChange(e.target.value)}
          rows={minRows}
          placeholder={placeholder}
          className="min-h-[300px] border-0 rounded-none focus-visible:ring-0 resize-none font-mono"
        />
      ) : (
        <div
          onClick={!editable && onClickToEdit ? onClickToEdit : undefined}
          className={cn(!editable && onClickToEdit && 'cursor-text')}
          title={!editable && onClickToEdit ? 'Click to edit' : undefined}
        >
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  );
}
