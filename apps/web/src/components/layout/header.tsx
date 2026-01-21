'use client';

import { Menu, User } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui';
import { NotificationsDropdown } from './notifications-dropdown';
import { useSidebar } from './sidebar-context';

export function Header() {
  const { user } = useAuth();
  const { toggle } = useSidebar();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      <div className="flex items-center gap-4">
        {/* Hamburger menu - mobile only */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={toggle}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <h1 className="text-base font-semibold lg:text-lg">
          Welcome back, {user.firstName}
        </h1>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        <NotificationsDropdown />

        <div className="hidden items-center gap-2 sm:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium">{user.firstName}</span>
        </div>
      </div>
    </header>
  );
}
