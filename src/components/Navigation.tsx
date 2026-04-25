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
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { QRCodeSVG } from 'qrcode.react';
import { Event, Registration } from '../types';

const navItems = [
  { name: 'Расписание', path: '/', icon: Calendar },
  { name: 'Мастер-классы', path: '/masterclasses', icon: Users },
  { name: 'Карта', path: '/map', icon: MapIcon },
  { name: 'Чат', path: '/chat', icon: MessageSquare },
  { name: 'Вопросы', path: '/questions', icon: HelpCircle },
];

export default function Navigation() {
  const { profile, logout } = useAuth();
  const isAdmin = profile?.role === 'organizer' || profile?.email === 'rodionovazarij@gmail.com';
  const [showQrModal, setShowQrModal] = useState(false);
  
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
    const registrations = events
      .filter(e => e.type === 'masterclass')
      .map(e => ({
        title: e.title,
        status: userRegistrations[e.id]?.status || 'unregistered'
      }));
    
    return JSON.stringify({
      user: profile.displayName,
      email: profile.email,
      registrations
    });
  }, [profile, events, userRegistrations]);

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
              
              <div className="p-4 bg-white border-8 border-slate-50 rounded-3xl shadow-inner mb-8">
                <QRCodeSVG 
                  value={qrValue} 
                  size={240} 
                  level="H" 
                  includeMargin={false}
                />
              </div>

              <div className="w-full space-y-2">
                <div className="py-3 border-t border-slate-100 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Участник</span>
                  <span className="text-sm font-bold text-slate-900">{profile?.displayName}</span>
                </div>
                <button 
                  onClick={() => setShowQrModal(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
                >
                  Вернуться
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

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-2 mb-4">
            <img 
              src={profile?.photoURL || 'https://via.placeholder.com/40'} 
              alt="Avatar" 
              className="w-8 h-8 rounded-full bg-slate-700"
            />
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-medium text-white truncate">{profile?.displayName}</span>
              <div className="flex items-center gap-1 mt-0.5">
                {profile?.role === 'organizer' ? (
                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[8px] font-bold rounded uppercase border border-purple-500/30">Организатор</span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[8px] font-bold rounded uppercase border border-blue-500/30">Участник</span>
                )}
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md hover:bg-blue-500/20 transition-all mb-2"
          >
            <QrCode size={16} />
            Check-in QR
          </button>
          
          <button 
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
            Выйти
          </button>
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
        <button 
          onClick={() => setShowQrModal(true)}
          className="flex flex-col items-center gap-1 p-2 text-blue-500 rounded-lg transition-colors"
        >
          <QrCode size={24} />
          <span className="text-[10px] font-bold">QR</span>
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
