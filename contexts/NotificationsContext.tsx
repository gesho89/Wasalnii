import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface AppNotification {
  id: string;
  type: 'ride_accepted' | 'driver_arrived' | 'trip_completed' | 'payment' | 'general';
  title: string;
  body: string;
  time: string;
  read: boolean;
  icon: string;
  iconColor: string;
}

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  addNotification: (n: Omit<AppNotification, 'id' | 'read'>) => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const INITIAL: AppNotification[] = [
  {
    id: 'n1',
    type: 'ride_accepted',
    title: 'تم قبول طلبك',
    body: 'أحمد محمود قبل رحلتك وهو في الطريق إليك',
    time: 'منذ دقيقتين',
    read: false,
    icon: 'check-circle',
    iconColor: '#10B981',
  },
  {
    id: 'n2',
    type: 'driver_arrived',
    title: 'السائق وصل',
    body: 'كريم حسن وصل إلى موقعك. استعد للركوب',
    time: 'منذ 5 دقائق',
    read: false,
    icon: 'directions-car',
    iconColor: '#1A56DB',
  },
  {
    id: 'n3',
    type: 'trip_completed',
    title: 'اكتملت رحلتك',
    body: 'وصلت إلى وجهتك بأمان. تكلفة الرحلة 65 ج.م',
    time: 'منذ ساعة',
    read: false,
    icon: 'flag',
    iconColor: '#F5A623',
  },
  {
    id: 'n4',
    type: 'payment',
    title: 'تم خصم المبلغ',
    body: 'تم خصم 65 ج.م من محفظتك لرحلة مع أحمد محمود',
    time: 'منذ ساعة',
    read: true,
    icon: 'account-balance-wallet',
    iconColor: '#8B5CF6',
  },
  {
    id: 'n5',
    type: 'general',
    title: 'عرض خاص',
    body: 'احصل على خصم 20% على رحلتك القادمة باستخدام كود TUKTUKY20',

    time: 'منذ يوم',
    read: true,
    icon: 'local-offer',
    iconColor: '#EF4444',
  },
];

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const markRead = (id: string) =>
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const addNotification = (n: Omit<AppNotification, 'id' | 'read'>) =>
    setNotifications(prev => [{ ...n, id: Date.now().toString(), read: false }, ...prev]);

  const clearAll = () => setNotifications([]);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAllRead, markRead, addNotification, clearAll }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
