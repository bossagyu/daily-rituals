/**
 * NavigationBar - Responsive navigation component.
 *
 * Renders as a bottom navigation bar on mobile (below md breakpoint)
 * and as a side navigation on desktop (md and above).
 * Includes Today, Calendar, Habits, and Settings tabs.
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarDays, CalendarRange, ListTodo, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItemConfig = {
  readonly to: string;
  readonly label: string;
  readonly icon: React.ReactNode;
};

const NAV_ITEMS: readonly NavItemConfig[] = [
  {
    to: '/',
    label: 'Today',
    icon: <CalendarDays className="size-5" />,
  },
  {
    to: '/calendar',
    label: 'カレンダー',
    icon: <CalendarRange className="size-5" />,
  },
  {
    to: '/habits',
    label: '習慣一覧',
    icon: <ListTodo className="size-5" />,
  },
  {
    to: '/settings',
    label: '設定',
    icon: <Settings className="size-5" />,
  },
];

function NavItem({ to, label, icon }: NavItemConfig) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </NavLink>
  );
}

function MobileNavItem({ to, label, icon }: NavItemConfig) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
          isActive
            ? 'text-primary'
            : 'text-muted-foreground',
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

/**
 * Desktop side navigation - visible at md breakpoint and above.
 */
export function SideNavigation() {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border md:bg-background">
      <div className="flex flex-1 flex-col gap-1 p-4">
        <nav className="flex flex-col gap-1" role="navigation" aria-label="メインナビゲーション">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
      </div>
    </aside>
  );
}

/**
 * Mobile bottom navigation - visible below md breakpoint.
 */
export function BottomNavigation() {
  return (
    <nav
      className="flex border-t border-border bg-background md:hidden"
      role="navigation"
      aria-label="メインナビゲーション"
    >
      {NAV_ITEMS.map((item) => (
        <MobileNavItem key={item.to} {...item} />
      ))}
    </nav>
  );
}
