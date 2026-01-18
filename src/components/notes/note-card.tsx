'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TagBadge } from '@/components/tag-badge';
import { TagPicker } from '@/components/tag-picker';
import { ResizeHandle } from './resize-handle';
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
  cardColSpan: number;
  cardRowSpan: number;
}

interface NoteCardProps {
  note: Note;
  onDelete: (note: Note) => void;
  onTagsChange: () => void;
  onResize: (noteId: string, colSpan: number, rowSpan: number) => void;
  disableGridStyles?: boolean;
}

export function NoteCard({ note, onDelete, onTagsChange, onResize, disableGridStyles }: NoteCardProps) {
  const colSpan = note.cardColSpan || 1;
  const rowSpan = note.cardRowSpan || 1;

  // Dynamic line clamp based on row span (roughly 7 lines per row unit)
  const lineClampValue = rowSpan * 7;
  // Max tags based on width
  const maxTags = colSpan * 3;

  return (
    <Card
      className="h-full hover:border-primary/50 hover:shadow-md transition-all group relative"
      style={disableGridStyles ? undefined : {
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
      }}
    >
      <Link href={`/notes/${note.id}`}>
        <CardContent className="p-5 h-full flex flex-col cursor-pointer">
          <h3 className={`font-semibold text-foreground mb-2 group-hover:text-primary transition-colors pr-16 ${rowSpan > 1 ? 'line-clamp-2' : 'line-clamp-1'}`}>
            {note.title}
          </h3>
          {note.tags && note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {note.tags.slice(0, maxTags).map(tag => (
                <TagBadge key={tag.id} name={tag.name} color={tag.color} />
              ))}
              {note.tags.length > maxTags && (
                <span className="text-xs text-muted-foreground">
                  +{note.tags.length - maxTags}
                </span>
              )}
            </div>
          )}
          <div
            className="prose prose-sm text-muted-foreground text-sm flex-1 mb-3 overflow-hidden"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: lineClampValue,
              WebkitBoxOrient: 'vertical',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground/60">
            <span>{countWords(note.content)} words</span>
            <span>{format(new Date(note.updatedAt), 'MMM d, yyyy')}</span>
          </div>
        </CardContent>
      </Link>

      {/* Action buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <TagPicker
          noteId={note.id}
          currentTags={note.tags || []}
          onTagsChange={onTagsChange}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            onDelete(note);
          }}
          className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
        >
          <Trash2 size={16} />
        </Button>
      </div>

      {/* Resize handle */}
      <ResizeHandle
        noteId={note.id}
        currentColSpan={colSpan}
        currentRowSpan={rowSpan}
        onResize={onResize}
      />
    </Card>
  );
}
