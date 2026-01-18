'use client';

import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ViewOption } from '@/lib/constants';

interface ViewToggleProps {
  view: ViewOption;
  onViewChange: (view: ViewOption) => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center border rounded-md">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange('grid')}
        className={cn(
          'rounded-r-none h-8 px-2.5',
          view === 'grid' && 'bg-accent'
        )}
        title="Grid view"
      >
        <LayoutGrid size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewChange('table')}
        className={cn(
          'rounded-l-none h-8 px-2.5 border-l',
          view === 'table' && 'bg-accent'
        )}
        title="Table view"
      >
        <List size={16} />
      </Button>
    </div>
  );
}
