import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, X, LogOut, User, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { navigationMenu, type NavigationItem } from '../config/navigation';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import lacraLogo from '../assets/lacra_logo.jpg';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    collapsed: boolean;
    onToggleCollapsed: () => void;
}

// Persist which top-level group is expanded across reloads (requirement:
// "Keep the active group expanded on navigation and reload"). We only ever
// need to remember ONE open group at a time — opening another closes the
// previous one — which also keeps the menu compact instead of growing into
// a long accordion of simultaneously-open sections.
const EXPANDED_GROUP_STORAGE_KEY = 'lacra.sidebar.expandedGroup';

// Finds the top-level item whose own path, or one of whose descendants'
// paths, matches the current route. Used to auto-expand the relevant group
// on navigation/reload instead of relying purely on manual toggle state.
const findActiveTopLevelLabel = (pathname: string): string | null => {
    const pathMatches = (item: NavigationItem): boolean => {
        if (item.path === pathname) return true;
        if (item.children) return item.children.some(pathMatches);
        return false;
    };
    const top = navigationMenu.find(pathMatches);
    return top ? top.label : null;
};

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, collapsed, onToggleCollapsed }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Which top-level group is currently expanded. Initialised from the
    // active route so a hard reload lands with the right group open even
    // before localStorage is consulted; localStorage is only used to keep
    // a MANUALLY opened group (one that doesn't match the current route,
    // e.g. the user expanded it to look around) open across a reload too.
    const [expandedGroup, setExpandedGroup] = useState<string | null>(() => {
        const active = findActiveTopLevelLabel(location.pathname);
        if (active) return active;
        try {
            return window.localStorage.getItem(EXPANDED_GROUP_STORAGE_KEY);
        } catch {
            return null;
        }
    });

    // Nested (depth-2) expand state, e.g. "Applications & Review Queues"
    // inside "Licensing & Permits". Kept separate/simple since only one
    // group in the current taxonomy nests this deep.
    const [expandedSubGroup, setExpandedSubGroup] = useState<string | null>(() => {
        for (const top of navigationMenu) {
            if (!top.children) continue;
            for (const child of top.children) {
                if (!child.children) continue;
                const match = child.children.some(gc => gc.path === location.pathname);
                if (match) return child.label;
            }
        }
        return null;
    });

    // Whenever the route changes, make sure the group containing the new
    // active page is expanded (requirement: "active group expanded on
    // navigation"). Manual expansions the user made that are unrelated to
    // the route are left untouched if navigation didn't land in a
    // different group.
    useEffect(() => {
        const active = findActiveTopLevelLabel(location.pathname);
        if (active) {
            setExpandedGroup(active);
            try {
                window.localStorage.setItem(EXPANDED_GROUP_STORAGE_KEY, active);
            } catch {
                /* ignore storage errors (private browsing, quota, etc.) */
            }
        }
        for (const top of navigationMenu) {
            if (!top.children) continue;
            for (const child of top.children) {
                if (!child.children) continue;
                if (child.children.some(gc => gc.path === location.pathname)) {
                    setExpandedSubGroup(child.label);
                }
            }
        }
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleGroup = (label: string) => {
        setExpandedGroup(prev => {
            const next = prev === label ? null : label;
            try {
                if (next) {
                    window.localStorage.setItem(EXPANDED_GROUP_STORAGE_KEY, next);
                } else {
                    window.localStorage.removeItem(EXPANDED_GROUP_STORAGE_KEY);
                }
            } catch {
                /* ignore storage errors */
            }
            return next;
        });
    };

    const toggleSubGroup = (label: string) => {
        setExpandedSubGroup(prev => (prev === label ? null : label));
    };

    const hasPermission = (item: NavigationItem): boolean => {
        if (item.roles) {
            if (!user) return false;
            if (!item.roles.includes(user.role as UserRole)) return false;
        }

        // Additional narrowing from the account's assigned Permission
        // Group (Role.permissions from the "Roles & Permissions" screen).
        // This only ever NARROWS what the role check above already
        // allows — it never grants access beyond it. Accounts with no
        // Permission Group assigned (user.permissions is empty/undefined,
        // which is the case for most accounts today) are unaffected and
        // see the item exactly as the role check alone decided.
        if (item.permissionPrefixes && user?.permissions && user.permissions.length > 0) {
            const granted = item.permissionPrefixes.some(prefix =>
                user.permissions!.some(p => p === prefix || p.startsWith(`${prefix}.`) || p === 'all')
            );
            if (!granted) return false;
        }

        return true;
    };

    // An item/group only counts as "visible" if it either has a path of
    // its own, or has at least one descendant left after permission
    // filtering — this keeps role-gated groups from rendering as an empty
    // shell when none of their children apply to the current user.
    const isVisible = (item: NavigationItem): boolean => {
        if (!hasPermission(item)) return false;
        if (!item.children) return true;
        return item.children.some(isVisible);
    };

    const isActive = (item: NavigationItem): boolean => {
        if (item.path === location.pathname) return true;
        if (item.children) {
            return item.children.some(child => isActive(child));
        }
        return false;
    };

    const closeOnMobile = () => {
        if (window.innerWidth < 1024) onClose();
    };

    // ---- Leaf item (an actual page link) --------------------------------
    const renderLeaf = (item: NavigationItem, depth: number) => {
        if (!isVisible(item)) return null;
        const Icon = item.icon;

        return (
            <NavLink
                key={item.label}
                to={item.path || '#'}
                title={collapsed ? item.label : undefined}
                className={({ isActive: linkActive }) => `
                    group flex items-center gap-2.5 rounded-lg px-2.5 py-2
                    text-[13px] font-semibold transition-colors duration-100
                    ${depth > 0 ? 'ml-4 border-l border-brand-border pl-3' : ''}
                    ${linkActive
                        ? 'bg-brand-green text-white shadow-sm'
                        : 'text-brand-text hover:bg-brand-green/8'
                    }
                `}
                onClick={closeOnMobile}
            >
                {Icon ? <Icon size={16} strokeWidth={2.25} className="flex-none" /> : <span className="w-4 flex-none" />}
                {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
        );
    };

    // ---- Nested sub-group, e.g. "Applications & Review Queues" ----------
    const renderSubGroup = (item: NavigationItem) => {
        if (!isVisible(item)) return null;
        const visibleChildren = (item.children || []).filter(isVisible);
        if (visibleChildren.length === 0) return null;

        const open = expandedSubGroup === item.label;
        const active = isActive(item);
        const Icon = item.icon;

        if (collapsed) {
            // In collapsed-desktop mode we flatten sub-groups so every
            // destination stays reachable via a single icon click.
            return <React.Fragment key={item.label}>{visibleChildren.map(child => renderLeaf(child, 0))}</React.Fragment>;
        }

        return (
            <div key={item.label} className="ml-4 border-l border-brand-border pl-3">
                <button
                    type="button"
                    onClick={() => toggleSubGroup(item.label)}
                    aria-expanded={open}
                    className={`
                        w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2
                        text-[12.5px] font-bold uppercase tracking-wide transition-colors
                        ${active ? 'text-brand-green' : 'text-brand-muted hover:bg-brand-green/8'}
                    `}
                >
                    {Icon ? <Icon size={15} strokeWidth={2.25} className="flex-none" /> : <span className="w-[15px] flex-none" />}
                    <span className="flex-1 text-left truncate normal-case font-semibold text-[13px]">{item.label}</span>
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {open && (
                    <div className="mt-0.5 flex flex-col gap-0.5">
                        {visibleChildren.map(child => renderLeaf(child, 1))}
                    </div>
                )}
            </div>
        );
    };

    // ---- Top-level group heading -----------------------------------------
    const renderGroup = (item: NavigationItem) => {
        if (!isVisible(item)) return null;
        const visibleChildren = (item.children || []).filter(isVisible);
        const Icon = item.icon;
        const active = isActive(item);

        // Top-level items without children (just "Dashboard" today) render
        // as a plain leaf link, same visual language as the rest.
        if (!item.children) {
            return renderLeaf(item, 0);
        }

        if (collapsed) {
            // Collapsed desktop rail: show the group icon only; clicking it
            // expands/flattens its children inline as icon-only rows.
            const open = expandedGroup === item.label;
            return (
                <div key={item.label}>
                    <button
                        type="button"
                        onClick={() => toggleGroup(item.label)}
                        title={item.label}
                        aria-label={item.label}
                        aria-expanded={open}
                        className={`
                            w-full flex items-center justify-center rounded-lg p-2.5
                            transition-colors duration-100
                            ${active ? 'bg-brand-green/12 text-brand-green' : 'text-brand-muted hover:bg-brand-green/8 hover:text-brand-green'}
                        `}
                    >
                        {Icon ? <Icon size={18} strokeWidth={2.25} /> : <span className="w-[18px]" />}
                    </button>
                    {open && (
                        <div className="mt-0.5 flex flex-col gap-0.5">
                            {visibleChildren.map(child =>
                                child.children ? renderSubGroup(child) : renderLeaf(child, 0)
                            )}
                        </div>
                    )}
                </div>
            );
        }

        const open = expandedGroup === item.label;

        return (
            <div key={item.label}>
                <button
                    type="button"
                    onClick={() => toggleGroup(item.label)}
                    aria-expanded={open}
                    className={`
                        w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2
                        text-[11px] font-extrabold uppercase tracking-widest
                        transition-colors duration-100
                        ${active ? 'text-brand-green' : 'text-slate-500 hover:text-brand-text'}
                    `}
                >
                    {Icon ? <Icon size={17} strokeWidth={2.4} className="flex-none" /> : <span className="w-[17px] flex-none" />}
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {open && (
                    <div className="mt-0.5 mb-1.5 flex flex-col gap-0.5">
                        {visibleChildren.map(child =>
                            child.children ? renderSubGroup(child) : renderLeaf(child, 0)
                        )}
                    </div>
                )}
            </div>
        );
    };

    // isVisible closes over `user` (already a dep below) and `hasPermission`,
    // which is intentionally recomputed fresh each render rather than
    // memoised; re-running this filter on every render is cheap for a menu
    // of this size, so the exhaustive-deps warning here is safe to disable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const visibleMenu = useMemo(() => navigationMenu.filter(isVisible), [user, location.pathname]);

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity lg:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Sidebar Container */}
            <aside
                className={`
                    fixed top-0 left-0 h-screen z-50
                    ${collapsed ? 'lg:w-[72px]' : 'lg:w-[270px]'} w-[270px]
                    bg-white border-r border-brand-border p-3
                    flex flex-col gap-3 transition-[transform,width] duration-200 ease-in-out
                    lg:sticky lg:translate-x-0 lg:shadow-none
                    ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
                `}
            >
                {/* Brand */}
                <div className={`flex gap-3 items-center p-2.5 border border-brand-border rounded-xl bg-gradient-to-br from-brand-green/10 to-brand-green/6 shadow-card ${collapsed ? 'lg:justify-center lg:p-2' : ''}`}>
                    <img
                        src={lacraLogo}
                        alt="LACRA"
                        className="w-[40px] h-[40px] rounded-full flex-none border-2 border-white shadow-sm object-cover bg-white"
                    />
                    {!collapsed && (
                        <div className="min-w-0">
                            <h1 className="m-0 text-[13px] font-extrabold leading-[1.15] text-brand-text truncate">LACRA CMIS</h1>
                            <p className="m-0 mt-0.5 text-[11px] text-brand-muted leading-tight truncate">Commodity Management Information System</p>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        aria-label="Close navigation menu"
                        className="lg:hidden ml-auto p-1 text-brand-muted hover:text-brand-text"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 flex flex-col gap-1 overflow-y-auto overflow-x-hidden pr-0.5 scrollbar-thin" aria-label="Primary">
                    {visibleMenu.map(item => renderGroup(item))}
                </nav>

                {/* Desktop collapse toggle */}
                <button
                    type="button"
                    onClick={onToggleCollapsed}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className="hidden lg:flex items-center justify-center gap-2 rounded-lg border border-brand-border py-2 text-brand-muted hover:bg-brand-green/8 hover:text-brand-green transition-colors"
                >
                    {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                    {!collapsed && <span className="text-[12px] font-bold">Collapse</span>}
                </button>

                {/* Footer */}
                <div className="border-t border-brand-border pt-3">
                    <div className={`flex items-center gap-3 px-1 py-1 ${collapsed ? 'lg:flex-col lg:gap-2' : ''}`}>
                        <div className="w-8 h-8 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green font-bold flex-none" aria-hidden="true">
                            <User size={16} />
                        </div>
                        {!collapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-bold text-brand-text truncate">{user?.name || 'User'}</p>
                                <p className="text-[11px] text-brand-muted truncate">{user?.role || 'Role'}</p>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            aria-label="Log out"
                            title="Logout"
                            className="p-2 rounded-lg text-brand-muted hover:bg-red-50 hover:text-red-600 transition-colors flex-none"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
