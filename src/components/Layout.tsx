import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import OfflineBanner from './OfflineBanner';
import NotificationBell from './NotificationBell';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'lacra.sidebar.collapsed';

// The topbar's job is ONLY to carry the constant application identity
// ("LACRA CMIS" / "Commodity Management Information System") plus global
// chrome (menu toggle, notifications, platform badge). Per-page titles,
// descriptions, breadcrumbs and actions now live entirely inside each page
// via the shared <PageHeader> component — this is the single place that
// previously duplicated what pages already rendered themselves.
const Layout: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
        try {
            return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    });

    const toggleSidebarCollapsed = () => {
        setSidebarCollapsed(prev => {
            const next = !prev;
            try {
                window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
            } catch {
                /* ignore storage errors (private browsing, quota, etc.) */
            }
            return next;
        });
    };

    // .shell equivalent: grid layout on large screens, stacked on small.
    // The desktop column width tracks the sidebar's collapsed state so the
    // content area reflows alongside the icon-only rail.
    return (
        <div className={`min-h-screen grid ${sidebarCollapsed ? 'lg:grid-cols-[72px_1fr]' : 'lg:grid-cols-[270px_1fr]'} transition-all duration-300`}>

            {/* Sidebar Wrapper - Mobile overlay handling logic remains, but mapped to new design */}
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                collapsed={sidebarCollapsed}
                onToggleCollapsed={toggleSidebarCollapsed}
            />

            {/* Main Content Area (.main) */}
            <div className="flex flex-col min-w-0 bg-transparent">
                <OfflineBanner />

                {/* Mobile Header / Topbar - Merging existing mobile toggle with test.html topbar design */}
                <div className="sticky top-0 z-10 bg-white/92 backdrop-blur-md border-b border-brand-border px-4 py-3 flex items-center justify-between gap-3 flex-wrap">

                    {/* Left: Title or Mobile Toggle */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            aria-label="Open navigation menu"
                            className="lg:hidden p-2 rounded-xl text-brand-muted hover:bg-brand-green/10 hover:text-brand-green transition-colors"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="h-6 w-6" />
                        </button>

                        <div>
                            <h1 className="font-extrabold text-base text-brand-text leading-tight">LACRA CMIS</h1>
                            <div className="text-xs text-brand-muted mt-0.5">Commodity Management Information System</div>
                        </div>
                    </div>

                    {/* Right: Actions/Pills */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <NotificationBell />
                        <span className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-brand-green/8 border border-brand-green/18 text-brand-green font-extrabold text-xs whitespace-nowrap">
                            LACRA EUDR Platform
                        </span>
                        <span className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-extrabold text-xs whitespace-nowrap">
                            Signed in: Admin
                        </span>
                    </div>
                </div>

                {/* Content Wrap */}
                <main className="p-4">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
