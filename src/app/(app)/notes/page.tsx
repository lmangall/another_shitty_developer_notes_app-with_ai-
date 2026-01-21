'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, FileText, Send, Bold, Italic, List, Code, Hash } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NoteCard } from '@/components/notes/note-card';
import { SortableNoteCard } from '@/components/notes/sortable-note-card';
import { TrashDropZone } from '@/components/notes/trash-drop-zone';
import { NotesTable } from '@/components/notes/notes-table';
import { NotesFilterBar } from '@/components/notes/notes-filter-bar';
import { ViewToggle } from '@/components/notes/view-toggle';
import type { ViewOption, NoteSortOption, SortOrder } from '@/lib/constants';
import { useToastActions } from '@/components/ui/toast';

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
  cardColSpan: number;
  cardRowSpan: number;
  isPinned: boolean;
}

interface NotesResponse {
  notes: Note[];
  total: number;
  page: number;
  totalPages: number;
}

// Local storage key for view preference
const VIEW_STORAGE_KEY = 'notes-view-preference';

// Hook to detect mobile devices
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
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

  // View and filter state
  const [view, setView] = useState<ViewOption>('grid');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<NoteSortOption>('position');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeNote = activeId ? notes.find(n => n.id === activeId) : null;

  // Toast notifications
  const toast = useToastActions();

  // Detect mobile for DND
  const isMobile = useIsMobile();

  // dnd-kit sensors - disabled on mobile
  const desktopSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Empty sensors for mobile (effectively disables DND)
  const mobileSensors = useSensors();

  const sensors = isMobile ? mobileSensors : desktopSensors;

  // Load view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
    if (savedView === 'grid' || savedView === 'table') {
      setView(savedView);
    }
  }, []);

  // Save view preference to localStorage
  function handleViewChange(newView: ViewOption) {
    setView(newView);
    localStorage.setItem(VIEW_STORAGE_KEY, newView);
  }

  useEffect(() => {
    fetchNotes();
  }, [page, search, selectedTagIds, sortBy, sortOrder, dateFrom, dateTo]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy,
        sortOrder,
      });
      if (search) params.set('search', search);
      if (selectedTagIds.length > 0) params.set('tags', selectedTagIds.join(','));
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

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
      // Content is everything after the first line (title)
      const bodyLines = lines.slice(1);
      // Skip empty lines immediately after the title
      let startIndex = 0;
      while (startIndex < bodyLines.length && bodyLines[startIndex].trim() === '') {
        startIndex++;
      }
      const content = bodyLines.slice(startIndex).join('\n').trim() || title;

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      if (res.ok) {
        setNewNote('');
        fetchNotes();
        toast.success('Note created');
      } else {
        toast.error('Failed to create note');
      }
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error('Failed to create note');
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl+Enter to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCreateNote();
      return;
    }

    // Enter key - handle list continuation
    if (e.key === 'Enter' && !e.shiftKey) {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart } = textarea;
      const text = newNote;

      // Find the start of the current line
      const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
      const lineEnd = text.indexOf('\n', selectionStart);
      const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);

      // Check for list patterns
      const bulletMatch = currentLine.match(/^(\s*)([-*])\s/);
      const checkboxMatch = currentLine.match(/^(\s*)([-*])\s\[([ xX])\]\s/);
      const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s/);

      let listPrefix = '';
      let isEmptyListItem = false;

      if (checkboxMatch) {
        // Checkbox list: "- [ ] " or "* [x] "
        const [fullMatch, indent, marker] = checkboxMatch;
        const lineContent = currentLine.substring(fullMatch.length);
        isEmptyListItem = lineContent.trim() === '';
        listPrefix = `${indent}${marker} [ ] `;
      } else if (bulletMatch) {
        // Bullet list: "- " or "* "
        const [fullMatch, indent, marker] = bulletMatch;
        const lineContent = currentLine.substring(fullMatch.length);
        isEmptyListItem = lineContent.trim() === '';
        listPrefix = `${indent}${marker} `;
      } else if (numberedMatch) {
        // Numbered list: "1. "
        const [fullMatch, indent, num] = numberedMatch;
        const lineContent = currentLine.substring(fullMatch.length);
        isEmptyListItem = lineContent.trim() === '';
        listPrefix = `${indent}${parseInt(num) + 1}. `;
      }

      if (listPrefix) {
        e.preventDefault();

        if (isEmptyListItem) {
          // Remove the empty list item
          const beforeLine = text.substring(0, lineStart);
          const afterLine = text.substring(lineEnd === -1 ? text.length : lineEnd);
          const newText = beforeLine.trimEnd() + afterLine;
          setNewNote(newText);
          setTimeout(() => {
            textarea.focus();
            const newPos = beforeLine.trimEnd().length;
            textarea.setSelectionRange(newPos, newPos);
          }, 0);
        } else {
          // Insert newline with list prefix
          const before = text.substring(0, selectionStart);
          const after = text.substring(selectionStart);
          const newText = before + '\n' + listPrefix + after;
          setNewNote(newText);
          setTimeout(() => {
            textarea.focus();
            const newPos = selectionStart + 1 + listPrefix.length;
            textarea.setSelectionRange(newPos, newPos);
          }, 0);
        }
      }
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
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      if (res.ok) {
        fetchNotes();
        toast.success('Note moved to trash');
      } else {
        toast.error('Failed to delete note');
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Failed to delete note');
    }
  };

  // Handle sort column click - toggle order if same column, otherwise set new column
  const handleSortChange = (column: NoteSortOption) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleResize = async (noteId: string, colSpan: number, rowSpan: number) => {
    // Optimistic update
    setNotes(prev => prev.map(note =>
      note.id === noteId
        ? { ...note, cardColSpan: colSpan, cardRowSpan: rowSpan }
        : note
    ));

    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardColSpan: colSpan, cardRowSpan: rowSpan }),
      });

      if (!res.ok) {
        // Revert on error
        fetchNotes();
      }
    } catch (error) {
      console.error('Failed to resize note:', error);
      fetchNotes();
    }
  };

  const handlePinToggle = async (noteId: string, isPinned: boolean) => {
    // Optimistic update
    setNotes(prev => prev.map(note =>
      note.id === noteId ? { ...note, isPinned } : note
    ));

    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned }),
      });

      if (!res.ok) {
        fetchNotes();
        toast.error('Failed to update pin status');
      } else {
        // Re-fetch to get correct sort order with pinned notes first
        fetchNotes();
        toast.success(isPinned ? 'Note pinned' : 'Note unpinned');
      }
    } catch (error) {
      console.error('Failed to pin note:', error);
      fetchNotes();
      toast.error('Failed to update pin status');
    }
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Check if dropped on trash
    if (over.id === 'trash-zone') {
      const noteToDelete = notes.find(n => n.id === active.id);
      if (noteToDelete) {
        setDeleteTarget(noteToDelete);
      }
      return;
    }

    // Reorder notes
    if (active.id !== over.id) {
      const oldIndex = notes.findIndex(n => n.id === active.id);
      const newIndex = notes.findIndex(n => n.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Optimistic update
        const newNotes = [...notes];
        const [movedNote] = newNotes.splice(oldIndex, 1);
        newNotes.splice(newIndex, 0, movedNote);
        setNotes(newNotes);

        // Persist new order
        try {
          await fetch('/api/notes/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ noteIds: newNotes.map(n => n.id) }),
          });
        } catch (error) {
          console.error('Failed to reorder notes:', error);
          fetchNotes();
        }
      }
    }
  };

  return (
    <div className="w-full overflow-x-hidden">
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
      <form onSubmit={handleSearch} className="mb-4">
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

      {/* Filters and View Toggle */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <NotesFilterBar
          selectedTagIds={selectedTagIds}
          onTagsChange={setSelectedTagIds}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortByChange={setSortBy}
          onSortOrderChange={setSortOrder}
        />
        <ViewToggle view={view} onViewChange={handleViewChange} />
      </div>

      {/* Notes Grid or Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p>No notes yet. Start typing above!</p>
        </div>
      ) : view === 'grid' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={notes.map(n => n.id)} strategy={rectSortingStrategy}>
            <div className="notes-grid">
              {notes.map((note) => (
                <SortableNoteCard
                  key={note.id}
                  note={note}
                  onDelete={setDeleteTarget}
                  onTagsChange={fetchNotes}
                  onResize={handleResize}
                  onPinToggle={handlePinToggle}
                />
              ))}
            </div>
          </SortableContext>

          {/* Trash drop zone - visible during drag (desktop only) */}
          {!isMobile && <TrashDropZone isVisible={!!activeId} />}

          {/* Drag overlay for the card being dragged */}
          <DragOverlay>
            {activeNote ? (
              <div className="opacity-80">
                <NoteCard
                  note={activeNote}
                  onDelete={() => {}}
                  onTagsChange={() => {}}
                  onResize={() => {}}
                  onPinToggle={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <NotesTable
          notes={notes}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          onDelete={setDeleteTarget}
          onTagsChange={fetchNotes}
          onPinToggle={handlePinToggle}
        />
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
