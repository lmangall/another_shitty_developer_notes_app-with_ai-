'use client';

import { Calendar, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
}

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: DateRangeFilterProps) {
  const hasFilter = dateFrom || dateTo;

  function setPreset(days: number) {
    const now = new Date();
    const from = new Date();
    from.setDate(now.getDate() - days);
    onDateFromChange(from.toISOString().split('T')[0]);
    onDateToChange(now.toISOString().split('T')[0]);
  }

  function clearDates() {
    onDateFromChange('');
    onDateToChange('');
  }

  function formatDateLabel(): string {
    if (dateFrom && dateTo) {
      return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
    }
    if (dateFrom) {
      return `From ${formatDate(dateFrom)}`;
    }
    if (dateTo) {
      return `Until ${formatDate(dateTo)}`;
    }
    return 'Date';
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar size={14} />
          <span className={hasFilter ? 'max-w-32 truncate' : ''}>
            {hasFilter ? formatDateLabel() : 'Date'}
          </span>
          {hasFilter && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full w-2 h-2" />
          )}
          <ChevronDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-3">
        <div className="space-y-3">
          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPreset(7)}
            >
              Last 7 days
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPreset(30)}
            >
              Last 30 days
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPreset(90)}
            >
              Last 90 days
            </Button>
          </div>

          <DropdownMenuSeparator />

          {/* Custom date inputs */}
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                From
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {hasFilter && (
            <>
              <DropdownMenuSeparator />
              <button
                onClick={clearDates}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm"
              >
                <X size={14} />
                Clear dates
              </button>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
