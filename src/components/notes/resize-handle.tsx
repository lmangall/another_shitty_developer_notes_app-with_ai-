'use client';

import { Square, RectangleHorizontal, RectangleVertical, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SIZE_OPTIONS = [
  { label: 'Small', colSpan: 1, rowSpan: 1, icon: Square, description: '1×1' },
  { label: 'Wide', colSpan: 2, rowSpan: 1, icon: RectangleHorizontal, description: '2×1' },
  { label: 'Tall', colSpan: 1, rowSpan: 2, icon: RectangleVertical, description: '1×2' },
  { label: 'Large', colSpan: 2, rowSpan: 2, icon: Maximize2, description: '2×2' },
] as const;

interface ResizeHandleProps {
  noteId: string;
  currentColSpan: number;
  currentRowSpan: number;
  onResize: (noteId: string, colSpan: number, rowSpan: number) => void;
}

export function ResizeHandle({
  noteId,
  currentColSpan,
  currentRowSpan,
  onResize,
}: ResizeHandleProps) {
  const currentSize = SIZE_OPTIONS.find(
    (s) => s.colSpan === currentColSpan && s.rowSpan === currentRowSpan
  ) || SIZE_OPTIONS[0];

  const CurrentIcon = currentSize.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="absolute bottom-1 right-1 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <CurrentIcon size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {SIZE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = option.colSpan === currentColSpan && option.rowSpan === currentRowSpan;
          return (
            <DropdownMenuItem
              key={option.label}
              onClick={() => onResize(noteId, option.colSpan, option.rowSpan)}
              className={isSelected ? 'bg-accent' : ''}
            >
              <Icon size={16} className="mr-2" />
              <span className="flex-1">{option.label}</span>
              <span className="text-xs text-muted-foreground ml-2">{option.description}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
