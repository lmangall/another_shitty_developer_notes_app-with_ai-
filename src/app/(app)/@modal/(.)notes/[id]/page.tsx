'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, Trash2, Save, X, Bold, Italic, List, Code, Hash } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { format } from 'date-fns';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function NoteModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormat = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);

    const newText = content.substring(0, start) + prefix + selected + suffix + content.substring(end);
    setContent(newText);

    setTimeout(() => {
      textarea.focus();
      const newPos = selected ? start + prefix.length + selected.length + suffix.length : start + prefix.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const insertAtLineStart = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = content.lastIndexOf('\n', start - 1) + 1;

    const newText = content.substring(0, lineStart) + prefix + content.substring(lineStart);
    setContent(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  useEffect(() => {
    fetchNote();
  }, [id]);

  const fetchNote = async () => {
    try {
      const res = await fetch(`/api/notes/${id}`);
      if (!res.ok) throw new Error('Note not found');
      const data = await res.json();
      setNote(data);
      setTitle(data.title);
      setContent(data.content);
    } catch (error) {
      console.error('Failed to fetch note:', error);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) throw new Error('Failed to update note');
      const updated = await res.json();
      setNote(updated);
      setEditing(false);
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete note');
      router.push('/notes');
      router.refresh();
    } catch (error) {
      console.error('Failed to delete note:', error);
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    router.back();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {loading ? (
          <>
            <SheetHeader>
              <SheetTitle className="sr-only">Loading note...</SheetTitle>
            </SheetHeader>
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </>
        ) : note ? (
          <>
            <SheetHeader className="pr-8">
              {editing ? (
                <>
                  <SheetTitle className="sr-only">Editing: {note.title}</SheetTitle>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xl font-bold"
                    autoFocus
                  />
                </>
              ) : (
                <SheetTitle className="text-xl">{note.title}</SheetTitle>
              )}
            </SheetHeader>

            <div className="mt-6 flex-1">
              {editing ? (
                <div className="border rounded-lg overflow-hidden">
                  {/* Formatting Toolbar */}
                  <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => insertFormat('**')}
                      title="Bold"
                    >
                      <Bold size={16} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => insertFormat('*')}
                      title="Italic"
                    >
                      <Italic size={16} />
                    </Button>
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
                      onClick={() => insertFormat('`')}
                      title="Inline code"
                    >
                      <Code size={16} />
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
                    <span className="ml-auto text-xs text-muted-foreground">
                      Markdown
                    </span>
                  </div>
                  <Textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={15}
                    placeholder="Write your note... (Markdown supported)"
                    className="min-h-[300px] border-0 rounded-none focus-visible:ring-0"
                  />
                </div>
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
                </div>
              )}
            </div>

            <SheetFooter className="mt-6 flex-col gap-4 sm:flex-col">
              <div className="text-sm text-muted-foreground">
                Created {format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}
                {note.updatedAt !== note.createdAt && (
                  <span className="ml-4">
                    Updated {format(new Date(note.updatedAt), 'MMM d, yyyy h:mm a')}
                  </span>
                )}
              </div>

              <div className="flex gap-2 justify-end w-full">
                {editing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(false);
                        setTitle(note.title);
                        setContent(note.content);
                      }}
                    >
                      <X size={18} className="mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      <Save size={18} className="mr-1" />
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(true)}
                    >
                      <Edit2 size={18} className="mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      <Trash2 size={18} className="mr-1" />
                      {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </>
                )}
              </div>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
