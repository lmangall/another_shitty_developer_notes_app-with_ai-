'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { NoteCard } from './note-card';

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

interface SortableNoteCardProps {
  note: Note;
  onDelete: (note: Note) => void;
  onTagsChange: () => void;
  onResize: (noteId: string, colSpan: number, rowSpan: number) => void;
  onPinToggle: (noteId: string, isPinned: boolean) => void;
  isDragging?: boolean;
}

export function SortableNoteCard({
  note,
  onDelete,
  onTagsChange,
  onResize,
  onPinToggle,
}: SortableNoteCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    gridColumn: `span ${note.cardColSpan || 1}`,
    gridRow: `span ${note.cardRowSpan || 1}`,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <NoteCard
        note={note}
        onDelete={onDelete}
        onTagsChange={onTagsChange}
        onResize={onResize}
        onPinToggle={onPinToggle}
        disableGridStyles
      />
    </div>
  );
}
