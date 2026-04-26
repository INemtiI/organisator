import React, { useState, useRef, useEffect } from 'react';
import { Bell, Trash2, Check, X, Info } from 'lucide-react';
import { useNotifications, AppNotification } from '../contexts/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../utils';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      // Optional: mark all as read when opening? 
      // User might prefer marking individually or clicking a button
    }
  };

  return (
    <div className="relative" ref={bellRef}>
      <button 
        onClick={handleToggle}
        className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 rounded-full hover:bg-slate-100"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            
            {/* Centered Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-[101]"
            >
              <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Bell size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Уведомления</h3>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => markAllAsRead()}
                    className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                    title="Отметить все как прочитанные"
                  >
                    <Check size={18} />
                  </button>
                  <button 
                    onClick={() => clearNotifications()}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    title="Очистить все"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors ml-1"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div 
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`p-5 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 relative ${!n.read ? 'bg-blue-50/20' : ''}`}
                    >
                      <div className="flex gap-4">
                        <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${!n.read ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] animate-pulse' : 'bg-slate-200'}`}></div>
                        <div className="flex-1 overflow-hidden">
                          <div className="flex items-center justify-between gap-4 mb-1.5">
                            <p className={`text-[11px] font-bold uppercase tracking-wider truncate ${!n.read ? 'text-blue-600' : 'text-slate-400'}`}>
                              {n.title}
                            </p>
                            <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded-full">
                              {n.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className={`text-sm leading-relaxed ${!n.read ? 'text-slate-900 font-semibold' : 'text-slate-600 font-medium'}`}>
                            {n.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-16 px-8 text-center">
                    <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <Bell size={32} />
                    </div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">Нет новых уведомлений</p>
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="mt-6 text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
                    >
                      Закрыть
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
