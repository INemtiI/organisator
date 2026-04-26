import { NavLink } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  MessageSquare, 
  ShieldCheck, 
  LogOut,
  Home,
  Map as MapIcon,
  HelpCircle,
  QrCode,
  X,
  Camera,
  User,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { QRCodeSVG } from 'qrcode.react';
import { Event, Registration } from '../types';
import NotificationBell from './NotificationBell';

const navItems = [
  { name: 'Расписание', path: '/', icon: Calendar },
  { name: 'Мастер-классы', path: '/masterclasses', icon: Users },
  { name: 'Карта', path: '/map', icon: MapIcon },
  { name: 'Чат', path: '/chat', icon: MessageSquare },
  { name: 'Вопросы', path: '/questions', icon: HelpCircle },
];

export default function Navigation() {
  const { profile, logout, updateProfilePhoto } = useAuth();
  const isAdmin = profile?.role === 'organizer' || profile?.email === 'rodionovazarij@gmail.com';
  const [showQrModal, setShowQrModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuTimeoutRef = useRef<any>(null);
  
  const [events, setEvents] = useState<Event[]>([]);
  const [userRegistrations, setUserRegistrations] = useState<Record<string, Registration>>({});

  useEffect(() => {
    // Listen for events to keep QR updated
    const q = query(collection(db, 'events'));
    const unsubscribeEvents = onSnapshot(q, (snapshot) => {
      const eventList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
      setEvents(eventList);
    });

    return () => unsubscribeEvents();
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    const regQ = query(collection(db, 'registrations'), where('userId', '==', profile.id));
    const unsubscribeRegs = onSnapshot(regQ, (snapshot) => {
      const regs: Record<string, Registration> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as Registration;
        regs[data.eventId] = { id: doc.id, ...data };
      });
      setUserRegistrations(regs);
    });
    return () => unsubscribeRegs();
  }, [profile?.id]);

  const qrValue = useMemo(() => {
    if (!profile) return '';
    return `${window.location.origin}/ticket/${profile.id}`;
  }, [profile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      await updateProfilePhoto(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleMouseEnter = () => {
    if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    setShowUserMenu(true);
  };

  const handleMouseLeave = () => {
    menuTimeoutRef.current = setTimeout(() => {
      setShowUserMenu(false);
    }, 300);
  };

  return (
    <>
      <AnimatePresence>
        {showQrModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/95 z-[100] flex items-center justify-center p-6 backdrop-blur-md"
            onClick={() => setShowQrModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-10 max-w-sm w-full flex flex-col items-center text-center shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowQrModal(false)}
                className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <QrCode size={24} />
              </div>
              
              <h2 className="text-xl font-bold text-slate-900 mb-2">Ваш QR-Пропуск</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed px-4">
                Покажите этот код представителю организаторов для подтверждения ваших записей
              </p>
              
              <div className="p-4 bg-white border-8 border-slate-50 rounded-3xl shadow-inner mb-6">
                <QRCodeSVG 
                  value={qrValue} 
                  size={200} 
                  level="H" 
                  includeMargin={false}
                />
              </div>

              <div className="w-full">
                <div className="py-3 border-t border-slate-100 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Участник</span>
                  <span className="text-sm font-bold text-slate-900">{profile?.displayName}</span>
                </div>

                <div className="mt-4 text-left">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <div className="w-4 h-[1px] bg-blue-500"></div>
                    Ваши курсы
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-2 pr-1 -mr-1">
                    {events.filter(e => userRegistrations[e.id]?.status === 'confirmed').length > 0 ? (
                      events.filter(e => userRegistrations[e.id]?.status === 'confirmed').map(mc => (
                        <div key={mc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                          <div className="w-6 h-6 rounded bg-white flex items-center justify-center text-blue-500 shadow-sm shrink-0">
                            <Calendar size={12} />
                          </div>
                          <p className="text-xs font-bold text-slate-900 truncate uppercase tracking-tighter">{mc.title}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest text-center py-4 italic">Нет подтвержденных записей</p>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => setShowQrModal(false)}
                  className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-blue-500 rounded-sm flex items-center justify-center font-bold text-white">О</div>
          <span className="text-white font-semibold tracking-tight">Организатор в кармане</span>
        </div>

        <nav className="flex-1 py-6">
          <div className="px-6 text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-4">Мероприятие</div>
          <div className="space-y-1 px-3">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                    isActive 
                    ? 'bg-slate-800 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`
                }
              >
                <item.icon size={18} />
                {item.name}
              </NavLink>
            ))}
          </div>

          {(isAdmin) && (
            <>
              <div className="px-6 text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-8 mb-4">Администрирование</div>
              <div className="px-3">
                <NavLink
                  to="/admin"
                  className={({ isActive }) => 
                    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                      isActive 
                      ? 'bg-slate-800 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`
                  }
                >
                  <ShieldCheck size={18} />
                  Панель управления
                </NavLink>
              </div>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Оповещения</div>
          <NotificationBell />
        </div>

        <div 
          className="p-4 border-t border-slate-800 relative"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute bottom-full left-4 mb-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 py-2"
              >
                <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden relative group/avatar">
                    <img 
                      src={profile?.photoURL || 'https://via.placeholder.com/40'} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white"
                    >
                      <Camera size={14} />
                    </button>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-slate-900 truncate">{profile?.displayName}</p>
                    <p className="text-[10px] text-slate-400 truncate uppercase tracking-widest">{profile?.role}</p>
                  </div>
                </div>

                <div className="p-1">
                  {!isAdmin && (
                    <button 
                      onClick={() => {
                        setShowQrModal(true);
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-all"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <QrCode size={16} />
                      </div>
                      Свой QR-код
                    </button>
                  )}

                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Camera size={16} />
                    </div>
                    Сменить аватар
                  </button>

                  <div className="my-1 border-t border-slate-50"></div>

                  <button 
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                      <LogOut size={16} />
                    </div>
                    Выйти
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange}
          />

          <div 
            className="flex items-center gap-3 p-2 group cursor-pointer"
            onClick={() => !isAdmin && setShowQrModal(true)}
          >
            <div className="relative">
              <img 
                src={profile?.photoURL || 'https://via.placeholder.com/40'} 
                alt="Avatar" 
                className="w-9 h-9 rounded-full bg-slate-700 object-cover ring-2 ring-slate-800"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>
            </div>
            <div className="flex flex-col overflow-hidden flex-1">
              <span className="text-xs font-bold text-white truncate">{profile?.displayName}</span>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black leading-none mt-1">Профиль</span>
            </div>
            <ChevronRight size={14} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                isActive ? 'text-orange-600 font-semibold' : 'text-gray-500'
              }`
            }
          >
            <item.icon size={24} />
            <span className="text-[10px]">{item.name}</span>
          </NavLink>
        ))}
        {!isAdmin && (
          <button 
            onClick={() => setShowQrModal(true)}
            className="flex flex-col items-center gap-1 p-2 text-blue-500 rounded-lg transition-colors"
          >
            <QrCode size={24} />
            <span className="text-[10px] font-bold">QR</span>
          </button>
        )}
        <div className="flex flex-col items-center justify-center -mt-1">
          <NotificationBell />
          <span className="text-[10px] text-gray-500">Инфо</span>
        </div>
        <button 
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex flex-col items-center gap-1 p-2 text-slate-500 rounded-lg transition-colors relative"
        >
          <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200">
            <img src={profile?.photoURL || 'https://via.placeholder.com/40'} alt="Me" className="w-full h-full object-cover" />
          </div>
          <span className="text-[10px]">Профиль</span>
        </button>
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) => 
              `flex flex-col items-center gap-1 p-2 transition-colors ${
                isActive ? 'text-orange-600' : 'text-gray-500'
              }`
            }
          >
            <ShieldCheck size={24} />
            <span className="text-[10px]">Редактор</span>
          </NavLink>
        )}
      </nav>
    </>
  );
}
