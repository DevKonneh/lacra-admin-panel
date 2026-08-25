import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, X, LogOut, User } from 'lucide-react';
import { navigationMenu, type NavigationItem } from '../config/navigation';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import lacraLogo from '../assets/lacra_logo.jpg';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleExpand = (label: string) => {
        setExpandedItems(prev =>
            prev.includes(label)
                ? prev.filter(item => item !== label)
                : [...prev, label]
        );
    };

    const hasPermission = (item: NavigationItem): boolean => {
        if (!item.roles) return true;
        if (!user) return false;
        return item.roles.includes(user.role as UserRole);
    };

    const isActive = (item: NavigationItem): boolean => {
        if (item.path === location.pathname) return true;
        if (item.children) {
            return item.children.some(child => isActive(child));
        }
        return false;
    };

    const renderMenuItem = (item: NavigationItem, depth = 0) => {
        if (!hasPermission(item)) return null;

        const isExpanded = expandedItems.includes(item.label);
        const active = isActive(item);
        const hasChildren = item.children && item.children.length > 0;
        const Icon = item.icon;

        // Base classes for the nav button (.navBtn)
        const baseClasses = `
            w-full text-left bg-white border border-brand-border rounded-lg
            p-2.5 cursor-pointer transition-all duration-150
            flex gap-2.5 items-start mb-2 group
            hover:bg-brand-green/3 hover:border-brand-green/22
        `;

        const activeClasses = `
            border-brand-green/35 shadow-[0_10px_20px_rgba(11,122,51,0.10)] bg-brand-green/4
        `;

        // Icon classes (.navIcon) - simplified for dynamic icons
        const iconClasses = `
            w-[26px] h-[26px] rounded-full grid place-items-center
            bg-brand-green/8 border border-brand-green/16
            text-brand-green font-extrabold flex-none mt-[1px]
        `;

        if (hasChildren) {
            return (
                <div key={item.label} className="w-full">
                    <button
                        onClick={() => toggleExpand(item.label)}
                        className={`${baseClasses} ${active ? activeClasses : ''}`}
                        style={{ marginLeft: depth > 0 ? `${depth * 0.5}rem` : 0 }}
                    >
                        <div className={iconClasses}>
                            {Icon ? <Icon size={14} strokeWidth={3} /> : item.label[0]}
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <div className="font-extrabold text-[13px] text-brand-text">{item.label}</div>
                                {isExpanded ? <ChevronDown size={14} className="text-brand-muted" /> : <ChevronRight size={14} className="text-brand-muted" />}
                            </div>
                            <div className="text-[12px] text-brand-muted mt-0.5 leading-tight">Section</div>
                        </div>
                    </button>

                    {isExpanded && (
                        <div className="pl-2 border-l border-brand-border ml-3 mb-2">
                            {item.children!.map(child => renderMenuItem(child, depth + 1))}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <NavLink
                key={item.label}
                to={item.path || '#'}
                className={({ isActive: linkActive }) => `
                    ${baseClasses} ${linkActive || active ? activeClasses : ''}
                `}
                style={{ marginLeft: depth > 0 ? `${depth * 0.5}rem` : 0 }}
                onClick={() => {
                    // Auto-close sidebar on mobile when link clicked
                    if (window.innerWidth < 1024) onClose();
                }}
            >
                <div className={iconClasses}>
                    {Icon ? <Icon size={14} strokeWidth={3} /> : item.label[0]}
                </div>
                <div>
                    <div className="font-extrabold text-[13px] text-brand-text">{item.label}</div>
                    <div className="text-[12px] text-brand-muted mt-0.5 leading-tight">View details</div>
                </div>
            </NavLink>
        );
    };

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity lg:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            {/* Sidebar Container (.sidebar) */}
            <aside
                className={`
                    fixed top-0 left-0 h-screen z-50 w-[270px] 
                    bg-white border-r border-brand-border p-3.5 
                    flex flex-col gap-3 transition-transform duration-300 ease-in-out
                    lg:sticky lg:translate-x-0 lg:shadow-none
                    ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
                `}
            >
                {/* Brand (.brand) */}
                <div className="flex gap-3 items-center p-3 border border-brand-border rounded-xl bg-gradient-to-br from-brand-green/10 to-brand-green/6 shadow-card">
                    <img
                        src={lacraLogo}
                        alt="LACRA"
                        className="w-[46px] h-[46px] rounded-full flex-none border-2 border-white shadow-sm object-cover bg-white"
                    />
                    <div>
                        <h1 className="m-0 text-[13px] font-extrabold leading-[1.15] text-brand-text">LACRA</h1>
                        <p className="m-0 mt-0.5 text-[11px] text-brand-muted leading-tight">Farm Mapping &amp; EUDR Compliance</p>
                    </div>
                    <button onClick={onClose} className="lg:hidden ml-auto p-1 text-brand-muted hover:text-brand-text">
                        <X size={20} />
                    </button>
                </div>

                <div className="mt-1.5 mx-1.5 text-[11px] tracking-widest text-slate-500 font-extrabold uppercase">
                    Navigation
                </div>

                {/* Nav (.nav) */}
                <nav className="flex-1 flex flex-col gap-2 overflow-y-auto overflow-x-hidden pr-0.5 scrollbar-thin">
                    {navigationMenu.map(item => renderMenuItem(item))}
                </nav>

                {/* Footer (.sideFoot) */}
                <div className="border-t border-brand-border pt-3 mt-auto">
                    <div className="flex items-center gap-3 px-2 py-2">
                        <div className="w-8 h-8 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green font-bold">
                            <User size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-brand-text truncate">{user?.name || 'User'}</p>
                            <p className="text-[11px] text-brand-muted truncate">{user?.role || 'Role'}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-lg text-brand-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Logout"
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
