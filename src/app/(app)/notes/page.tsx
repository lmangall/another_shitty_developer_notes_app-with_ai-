'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search, FileText, Trash2, Send, Bold, Italic, List, Code, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TagBadge } from '@/components/tag-badge';
import { TagPicker } from '@/components/tag-picker';
import { format } from 'date-fns';

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
}

interface NotesResponse {
  notes: Note[];
  total: number;
  page: number;
  totalPages: number;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchNotes();
  }, [page, search]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) params.set('search', search);

      const res = await fetch(`/api/notes?${params}`);
      const data: NotesResponse = await res.json();
      setNotes(data.notes);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchNotes();
  };

  const handleCreateNote = async () => {
    if (!newNote.trim() || creating) return;

    setCreating(true);
    try {
      const lines = newNote.trim().split('\n');
      const title = lines[0].slice(0, 100) || 'Untitled';
      const content = newNote.trim();

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      if (res.ok) {
        setNewNote('');
        fetchNotes();
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCreateNote();
    }
  };

  const insertFormat = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = newNote;
    const selected = text.substring(start, end);

    const newText = text.substring(0, start) + prefix + selected + suffix + text.substring(end);
    setNewNote(newText);

    // Restore cursor position
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
    const text = newNote;

    // Find the start of the current line
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;

    const newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);
    setNewNote(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const deleteNote = async (id: string) => {
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  return (
    <div className="w-full">
      {/* Quick Create Input */}
      <div className="mb-8">
        <div className="border rounded-lg overflow-hidden bg-card">
          {/* Formatting Toolbar */}
          <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => insertFormat('**')}
              title="Bold (wrap with **)"
            >
              <Bold size={16} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => insertFormat('*')}
              title="Italic (wrap with *)"
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
              Markdown supported
            </span>
          </div>

          {/* Textarea */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder="First line is the title...&#10;&#10;Rest is the body (supports Markdown)"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[120px] border-0 rounded-none focus-visible:ring-0 resize-none text-base"
              autoFocus
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {newNote.trim() ? 'Cmd+Enter to save' : ''}
              </span>
              <Button
                size="icon"
                onClick={handleCreateNote}
                disabled={!newNote.trim() || creating}
              >
                <Send size={18} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </form>

      {/* Notes Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p>No notes yet. Start typing above!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {notes.map((note) => (
            <Card key={note.id} className="h-full hover:border-primary/50 hover:shadow-md transition-all group relative">
              <Link href={`/notes/${note.id}`}>
                <CardContent className="p-5 h-full flex flex-col cursor-pointer">
                  <h3 className="font-semibold text-foreground mb-2 line-clamp-1 group-hover:text-primary transition-colors pr-16">
                    {note.title}
                  </h3>
                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {note.tags.slice(0, 3).map(tag => (
                        <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                      ))}
                      {note.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{note.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                  <div className="prose prose-sm text-muted-foreground text-sm line-clamp-6 flex-1 mb-3">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground/60">
                    <span>{countWords(note.content)} words</span>
                    <span>{format(new Date(note.updatedAt), 'MMM d, yyyy')}</span>
                  </div>
                </CardContent>
              </Link>
              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <TagPicker
                  noteId={note.id}
                  currentTags={note.tags || []}
                  onTagsChange={fetchNotes}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    setDeleteTarget(note);
                  }}
                  className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-sm font-medium border-l-2 pl-3">
              {deleteTarget.title}
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteNote(deleteTarget.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
