'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { LayoutDashboard, FileText, Bell, Mail, Mic, LogOut, Sun, Moon, Menu, X } from 'lucide-react';
import { signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/reminders', label: 'Reminders', icon: Bell },
  { href: '/logs', label: 'Email Logs', icon: Mail },
  { href: '/input', label: 'Quick Input', icon: Mic },
];

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Notes App</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Sun size={18} className="rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon size={18} className="absolute rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>

      <nav className="flex-1 px-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavClick}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-sm',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut size={18} />
          Sign Out
        </Button>
      </div>

      {process.env.NEXT_PUBLIC_BUILD_TIME && (
        <div className="px-4 pb-4 text-xs text-sidebar-foreground/50">
          Deployed: {new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString()}
        </div>
      )}
    </>
  );
}

export function MobileHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-sidebar-foreground">Notes App</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="text-sidebar-foreground"
        >
          <Menu size={24} />
          <span className="sr-only">Open menu</span>
        </Button>
      </header>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          'md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="absolute top-4 right-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="text-sidebar-foreground"
          >
            <X size={20} />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>
        <SidebarContent onNavClick={() => setIsOpen(false)} />
      </aside>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 bg-sidebar text-sidebar-foreground min-h-screen flex-col border-r border-sidebar-border">
      <SidebarContent />
    </aside>
  );
}
