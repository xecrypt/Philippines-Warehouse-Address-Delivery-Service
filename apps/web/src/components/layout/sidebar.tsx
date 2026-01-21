'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Truck,
  Warehouse,
  PackagePlus,
  Users,
  AlertTriangle,
  FileText,
  LogOut,
  X,
} from 'lucide-react';
import { Role } from '@warehouse/shared';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui';
import { useSidebar } from './sidebar-context';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  [Role.USER]: [
    { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'My Parcels', href: '/parcels', icon: <Package className="h-5 w-5" /> },
    { label: 'Deliveries', href: '/deliveries', icon: <Truck className="h-5 w-5" /> },
  ],
  [Role.WAREHOUSE_STAFF]: [
    { label: 'Dashboard', href: '/warehouse', icon: <Warehouse className="h-5 w-5" /> },
    { label: 'Parcel Intake', href: '/warehouse/intake', icon: <PackagePlus className="h-5 w-5" /> },
    { label: 'Manage Parcels', href: '/warehouse/parcels', icon: <Package className="h-5 w-5" /> },
  ],
  [Role.ADMIN]: [
    { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'Users', href: '/admin/users', icon: <Users className="h-5 w-5" /> },
    { label: 'Exceptions', href: '/admin/exceptions', icon: <AlertTriangle className="h-5 w-5" /> },
    { label: 'Audit Logs', href: '/admin/audit', icon: <FileText className="h-5 w-5" /> },
    { label: 'Warehouse', href: '/warehouse', icon: <Warehouse className="h-5 w-5" /> },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isOpen, close } = useSidebar();

  if (!user) return null;

  const navItems = NAV_ITEMS[user.role] || NAV_ITEMS[Role.USER];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen w-64 border-r bg-background transition-transform duration-300',
          // Mobile: hidden by default, shown when isOpen
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b px-6">
            <Link href="/" className="flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">Warehouse</span>
            </Link>
            {/* Close button - mobile only */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={close}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-4">
            <div className="mb-3 px-3">
              <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">Code: {user.memberCode}</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => logout()}
            >
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
