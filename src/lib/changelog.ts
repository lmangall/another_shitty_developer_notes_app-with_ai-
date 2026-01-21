export interface ChangelogEntry {
  date: string;
  type: 'feat' | 'fix' | 'refactor' | 'docs' | 'chore';
  message: string;
}

// Add new entries at the top
export const changelog: ChangelogEntry[] = [
  {
    date: '2025-01-21',
    type: 'refactor',
    message: 'Notes is now the home page',
  },
  {
    date: '2025-01-21',
    type: 'fix',
    message: 'Title no longer duplicated in note body',
  },
  {
    date: '2025-01-21',
    type: 'fix',
    message: 'Disabled drag & drop on mobile',
  },
  {
    date: '2025-01-21',
    type: 'refactor',
    message: 'Simplified dashboard layout',
  },
  {
    date: '2025-01-21',
    type: 'feat',
    message: 'Reminders can specify email, push, or both',
  },
  {
    date: '2025-01-20',
    type: 'feat',
    message: 'TipTap WYSIWYG editor replaces markdown',
  },
  {
    date: '2025-01-20',
    type: 'fix',
    message: 'Click-to-edit in note preview mode',
  },
  {
    date: '2025-01-20',
    type: 'feat',
    message: 'AI tools show spinner while executing',
  },
  {
    date: '2025-01-20',
    type: 'feat',
    message: 'Markdown rendering in AI chat messages',
  },
];

export const typeColors: Record<ChangelogEntry['type'], string> = {
  feat: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  fix: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  refactor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  docs: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  chore: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export const typeLabels: Record<ChangelogEntry['type'], string> = {
  feat: 'New',
  fix: 'Fix',
  refactor: 'Update',
  docs: 'Docs',
  chore: 'Chore',
};
