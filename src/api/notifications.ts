import apiClient from './client';
import type { ApiResponse } from './types';

export interface Notification {
    id: string;
    type: string;
    title: string;
    body: string;
    readAt: string | null;
    createdAt: string;
}

export const getNotifications = () =>
    apiClient.get<ApiResponse<Notification[]>>('/notifications');

export const markNotificationRead = (id: string) =>
    apiClient.patch<ApiResponse<Notification>>(`/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
    apiClient.post<ApiResponse<{ message: string }>>('/notifications/mark-all-read');
