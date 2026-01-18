'use client';

import { useDroppable } from '@dnd-kit/core';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrashDropZoneProps {
  isVisible: boolean;
}

export function TrashDropZone({ isVisible }: TrashDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'trash-zone',
  });

  if (!isVisible) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'fixed bottom-8 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-3 px-8 py-4 rounded-2xl',
        'border-2 border-dashed transition-all duration-200',
        'shadow-lg backdrop-blur-sm',
        isOver
          ? 'bg-destructive/20 border-destructive text-destructive scale-110'
          : 'bg-background/90 border-muted-foreground/30 text-muted-foreground'
      )}
    >
      <Trash2 size={24} className={cn(isOver && 'animate-bounce')} />
      <span className="font-medium">
        {isOver ? 'Release to delete' : 'Drop here to delete'}
      </span>
    </div>
  );
}
