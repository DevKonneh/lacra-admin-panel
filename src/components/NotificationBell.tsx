import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { getNotifications, markNotificationRead, markAllNotificationsRead, type Notification } from '../api/notifications';

const NotificationBell: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        load();
    }, []);

    const load = () => {
        getNotifications().then(r => {
            if (r.data.status) setNotifications(r.data.data);
        });
    };

    const unreadCount = notifications.filter(n => !n.readAt).length;

    const handleMarkRead = async (id: string) => {
        await markNotificationRead(id);
        load();
    };

    const handleMarkAllRead = async () => {
        await markAllNotificationsRead();
        load();
    };

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 relative"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 mt-1 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                        <div className="p-3 border-b flex justify-between items-center">
                            <span className="font-semibold">Notifications</span>
                            {unreadCount > 0 && (
                                <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:underline">
                                    Mark all read
                                </button>
                            )}
                        </div>
                        <ul className="divide-y">
                            {notifications.slice(0, 20).map(n => (
                                <li
                                    key={n.id}
                                    className={`p-3 text-sm hover:bg-gray-50 cursor-pointer ${!n.readAt ? 'bg-blue-50/50' : ''}`}
                                    onClick={() => !n.readAt && handleMarkRead(n.id)}
                                >
                                    <p className="font-medium">{n.title}</p>
                                    <p className="text-gray-600 text-xs mt-0.5 line-clamp-2">{n.body}</p>
                                    <p className="text-gray-400 text-xs mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                                </li>
                            ))}
                            {notifications.length === 0 && (
                                <li className="p-4 text-center text-gray-500">No notifications</li>
                            )}
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationBell;
