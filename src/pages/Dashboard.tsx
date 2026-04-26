import { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  where 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Event, Registration } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, MapPin, Clock, Plus, Info, Map as MapIcon, Loader2, Megaphone, History, Users, QrCode, X, Mail } from 'lucide-react';
import { formatTime, formatDate } from '../utils';
import PollsSection from '../components/PollsSection';
import { QRCodeSVG } from 'qrcode.react';
import NotificationBell from '../components/NotificationBell';

interface Announcement {
  id: string;
  text: string;
  timestamp: any;
  authorName: string;
  type?: 'info' | 'urgent' | 'schedule';
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [userRegistrations, setUserRegistrations] = useState<Record<string, Registration>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [nextMasterclass, setNextMasterclass] = useState<Event | null>(null);
  const [timeUntil, setTimeUntil] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' ? (window.Notification?.permission || 'default') : 'default'
  );

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('startTime', 'asc'));
    const unsubscribeEvents = onSnapshot(q, (snapshot) => {
      const eventList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Event[];
      setEvents(eventList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    // Fetch announcements
    const annQ = query(collection(db, 'announcements'), orderBy('timestamp', 'desc'));
    const unsubscribeAnn = onSnapshot(annQ, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      setAnnouncements(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'announcements');
    });

    return () => {
      unsubscribeEvents();
      unsubscribeAnn();
    };
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'registrations');
    });

    return () => unsubscribeRegs();
  }, [profile?.id]);

  useEffect(() => {
    if (events.length === 0) return;

    const updateTimer = () => {
      const now = new Date();
      
      const registeredMasterclasses = events.filter(e => 
        e.type === 'masterclass' && 
        userRegistrations[e.id]?.status === 'confirmed'
      );

      const future = registeredMasterclasses.filter(e => {
        const start = (e.startTime as any).toDate ? (e.startTime as any).toDate() : new Date(e.startTime as any);
        return start > now;
      });
      
      if (future.length > 0) {
        const next = future[0];
        setNextMasterclass(next);
        
        const start = (next.startTime as any).toDate ? (next.startTime as any).toDate() : new Date(next.startTime as any);
        const diff = start.getTime() - now.getTime();
        const minutes = Math.floor(diff / 1000 / 60);
        
        const dateStr = new Intl.DateTimeFormat('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).format(start);

        if (minutes < 60) {
          setTimeUntil(`${dateStr} (через ${minutes} мин)`);
        } else {
          const hours = Math.floor(minutes / 60);
          const rem = minutes % 60;
          setTimeUntil(`${dateStr} (через ${hours}ч ${rem}м)`);
        }
        
        // Progress for the last hour
        const hourInMs = 60 * 60 * 1000;
        const p = Math.max(0, Math.min(100, 100 - (diff / hourInMs) * 100));
        setProgress(p);
      } else {
        setNextMasterclass(null);
        setTimeUntil(registeredMasterclasses.length > 0 ? 'Все ваши занятия пройдены' : 'Вы не записаны на занятия');
        setProgress(100);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [events, userRegistrations]);

  const latestAnnouncement = announcements[0];

  const myMasterclasses = useMemo(() => {
    return events.filter(e => e.type === 'masterclass' && (userRegistrations[e.id]?.status === 'confirmed' || userRegistrations[e.id]?.status === 'waitlist'));
  }, [events, userRegistrations]);

  const formatAnnDate = (timestamp: any) => {
    if (!timestamp) return '';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white shrink-0 shadow-sm relative z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-900 uppercase tracking-tight">Рабочая доска</h1>
          <div className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold rounded uppercase tracking-wider">Live Updates</div>
        </div>
        <div className="flex items-center gap-6">
          <NotificationBell />
          <div className="h-8 w-[1px] bg-slate-200"></div>
          <div className="flex items-center gap-6 text-sm font-medium">
            <span className="text-slate-400">Привет, {profile?.displayName?.split(' ')[0] || 'Участник'}!</span>
            {profile?.role === 'organizer' ? (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase border border-purple-200">Организатор</span>
            ) : (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase border border-blue-200">Участник</span>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 content-start">
        {notificationPermission === 'default' && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-12 mb-8 bg-slate-900 rounded-lg p-5 flex flex-col md:flex-row items-center justify-between text-white shadow-xl shadow-slate-200 border border-slate-800"
          >
            <div className="flex items-center gap-5 mb-4 md:mb-0">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Megaphone size={24} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-sm tracking-tight">Включите уведомления</p>
                <p className="text-xs text-slate-400 font-medium">Получайте оповещения о свободных местах, начале событий и новых объявлениях.</p>
              </div>
            </div>
            <button 
              onClick={requestPermission}
              className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-600/20"
            >
              Включить
            </button>
          </motion.div>
        )}


        <div className="grid grid-cols-12 gap-8 mb-8">
          <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2 flex items-center gap-2">
              <Plus size={12} className="text-blue-500" />
              {nextMasterclass ? 'Ближайший мастер-класс' : 'Ваши мастер-классы'}
            </div>
            <div className="text-xl font-light mb-4 truncate text-slate-900">
              {nextMasterclass ? timeUntil : timeUntil || 'Загрузка...'}
              {nextMasterclass && (
                <div className="text-[10px] font-bold text-blue-600 uppercase mt-1">
                  {nextMasterclass.title}
                </div>
              )}
            </div>
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-1000 shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>

          </div>
          
          <div className="col-span-12 md:col-span-6 lg:col-span-8 bg-white border border-slate-200 p-6 rounded-lg shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-2">
                <Megaphone size={12} className="text-blue-500" />
                Объявления
              </div>
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="text-[10px] font-bold text-slate-400 hover:text-blue-500 uppercase tracking-widest flex items-center gap-1 transition-colors"
              >
                <History size={12} />
                {showHistory ? 'Скрыть историю' : 'История'}
              </button>
            </div>
            
            <div className="relative">
              <AnimatePresence mode="wait">
                {showHistory ? (
                  <motion.div 
                    key="history"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="max-h-40 overflow-y-auto space-y-3 pr-2 scrollbar-thin"
                  >
                    {announcements.length > 0 ? announcements.map((ann) => (
                      <div key={ann.id} className="border-l-2 border-slate-100 pl-4 py-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{formatAnnDate(ann.timestamp)}</span>
                          <span className="text-[9px] font-bold text-blue-500/60 uppercase">{ann.authorName}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">{ann.text}</p>
                      </div>
                    )) : (
                      <p className="text-xs text-slate-400 italic py-4">Объявлений пока нет</p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="latest"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                  >
                    {latestAnnouncement ? (
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-md">
                         <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded uppercase">New</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatAnnDate(latestAnnouncement.timestamp)}</span>
                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">— {latestAnnouncement.authorName}</span>
                         </div>
                         <p className="text-sm font-medium text-slate-800 leading-relaxed">
                            {latestAnnouncement.text}
                         </p>
                      </div>
                    ) : (
                      <p className="text-sm italic text-slate-400 py-4">Нет свежих объявлений для отображения.</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {myMasterclasses.length > 0 && (
          <div className="col-span-12 mb-8">
            <h2 className="text-sm uppercase tracking-[0.2em] text-slate-400 font-bold mb-4 flex items-center gap-3">
              <div className="w-8 h-[1px] bg-blue-500/30"></div>
              Ваши записи
              <div className="flex-1 h-[1px] bg-slate-200"></div>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myMasterclasses.map((mc) => (
                <motion.div 
                  key={mc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border-l-4 border-l-blue-600 border border-slate-200 p-5 rounded-lg shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">
                      {formatTime(mc.startTime)} - {formatTime(mc.endTime)}
                    </span>
                    {userRegistrations[mc.id]?.status === 'confirmed' ? (
                      <span className="text-[9px] font-bold text-green-600 uppercase tracking-widest bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                        Подтверждено
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                        Лист ожидания
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3 truncate">{mc.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400" />
                      <span>{mc.location}</span>
                    </div>
                    {mc.speakerName && (
                      <div className="flex items-center gap-1">
                        <Users size={12} className="text-slate-400" />
                        <span>{mc.speakerName}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className="col-span-12">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-400 font-bold mb-4 flex items-center gap-3">
            <div className="w-8 h-[1px] bg-slate-200"></div>
            График сессий
            <div className="flex-1 h-[1px] bg-slate-200"></div>
          </h2>
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4 font-bold border-r border-slate-100 w-32">Время</th>
                    <th className="px-6 py-4 font-bold">Сессия / Мастер-класс</th>
                    <th className="px-6 py-4 font-bold">Локация</th>
                    <th className="px-6 py-4 font-bold">Спикер</th>
                    <th className="px-6 py-4 font-bold text-right">Статус</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100">
                  {events.map((event) => (
                    <tr 
                      key={event.id} 
                      onClick={() => setSelectedEvent(event)}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-blue-600 tabular-nums border-r border-slate-50 bg-slate-50/30">
                        {formatTime(event.startTime)} — {formatTime(event.endTime)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {event.title}
                        {event.type === 'masterclass' && (
                          <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded border border-blue-100 uppercase font-extrabold tracking-tighter">MASTERCLASS</span>
                        )}
                        {event.type === 'break' && (
                          <span className="ml-2 px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[10px] rounded border border-orange-100 uppercase font-extrabold tracking-tighter">BREAK</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} className="text-slate-300" />
                          <span>{event.location}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">{event.speakerName || '—'}</td>
                      <td className="px-6 py-4 text-right">
                        {new Date((event.endTime as any).toDate ? (event.endTime as any).toDate() : event.endTime) < new Date() ? (
                           <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Завершено</span>
                        ) : new Date((event.startTime as any).toDate ? (event.startTime as any).toDate() : event.startTime) < new Date() ? (
                          <span className="flex items-center justify-end gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> 
                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">В процессе</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ожидание</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Polls Section Integration */}
        <div className="mt-8">
          <PollsSection />
        </div>
      </div>

      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-6 z-[100] backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedEvent(null)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 transition-colors"
                id="close-event-modal"
              >
                <Info size={20} />
              </button>

              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <CalendarIcon size={24} />
              </div>
              
              <h2 className="text-xl font-bold text-slate-900 mb-2">{selectedEvent.title}</h2>
              <div className="flex items-center gap-2 mb-6">
                {selectedEvent.type === 'masterclass' && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded border border-blue-100 uppercase tracking-tighter">Masterclass</span>}
                {selectedEvent.speakerName && <span className="text-slate-400 text-xs font-medium">— {selectedEvent.speakerName}</span>}
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-slate-500">
                   <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                      <MapPin size={16} />
                   </div>
                   <div className="text-xs">
                      <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Место проведения</p>
                      <p className="font-bold text-slate-900">{selectedEvent.location}</p>
                   </div>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                   <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                      <Clock size={16} />
                   </div>
                   <div className="text-xs">
                      <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Расписание</p>
                      <p className="font-bold text-slate-900">{formatTime(selectedEvent.startTime)} — {formatTime(selectedEvent.endTime)}</p>
                   </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-5 mb-8">
                <p className="text-sm text-slate-700 leading-relaxed italic">
                  {selectedEvent.description || 'Детальное описание события будет доступно в ближайшее время.'}
                </p>
              </div>

              <button 
                onClick={() => setSelectedEvent(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-xl text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
              >
                Закрыть
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
      </AnimatePresence>
    </div>
  );
}
