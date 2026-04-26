import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Event } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Map as MapIcon, Loader2, Info, MapPin, Clock, X } from 'lucide-react';
import { formatTime } from '../utils';

const VENUE_LOCATIONS = [
  { id: 'stage', name: 'Главная сцена', description: 'Основные доклады и выступления', x: '50%', y: '20%' },
  { id: 'reg', name: 'Стойка регистрации', description: 'Выдача бейджей и мерча', x: '20%', y: '80%' },
  { id: 'hall_a', name: 'Конференц-зал A', description: 'Практические мастер-классы', x: '80%', y: '40%' },
  { id: 'hall_b', name: 'Конференц-зал B', description: 'Технические сессии', x: '80%', y: '70%' },
  { id: 'food', name: 'Зона питания', description: 'Кофе-брейки и обеды', x: '20%', y: '30%' },
  { id: 'cloakroom', name: 'Гардероб', description: 'Хранение вещей', x: '10%', y: '50%' },
  { id: 'entrance', name: 'Вход', description: 'Главный вход в здание', x: '50%', y: '95%' },
];

export default function VenueMap() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('startTime', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Event[];
      setEvents(eventList);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'events');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const now = new Date();

  const getEventsAtLocation = (locationName: string) => {
    return events.filter(e => {
      // Normalize location names for comparison
      return e.location === locationName;
    });
  };

  const getActiveEventAtLocation = (locationName: string) => {
    const locEvents = getEventsAtLocation(locationName);
    return locEvents.find(e => {
      const start = (e.startTime as any).toDate ? (e.startTime as any).toDate() : new Date(e.startTime as any);
      const end = (e.endTime as any).toDate ? (e.endTime as any).toDate() : new Date(e.endTime as any);
      return now >= start && now <= end;
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white shrink-0 shadow-sm relative z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-900 uppercase tracking-tight">Навигация</h1>
          <div className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded uppercase tracking-wider flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
             Live Map
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center bg-slate-100">
        <div className="max-w-5xl w-full aspect-[16/9] bg-white rounded-2xl shadow-2xl relative border border-slate-200">
          {/* Background Layer with Clipping */}
          <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
            {/* Background Map Grid/Blueprint Style */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
            
            {/* Floor Plan Visualization */}
            <svg className="absolute inset-0 w-full h-full p-8" viewBox="0 0 800 450" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Outer Walls */}
              <rect x="50" y="50" width="700" height="350" rx="12" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="8 4" />
              
              {/* Stage Area */}
              <path d="M300 50 L500 50 L500 120 L300 120 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
              
              {/* Hall A */}
              <path d="M550 150 L750 150 L750 250 L550 250 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
              
              {/* Hall B */}
              <path d="M550 300 L750 300 L750 400 L550 400 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
              
              {/* Food Area */}
              <path d="M50 50 L250 50 L250 150 L50 150 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
              
              {/* Cloakroom Room */}
              <path d="M50 200 L120 200 L120 300 L50 300 Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
              
              {/* Registration */}
              <circle cx="150" cy="350" r="40" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
              
              {/* Entrance Area */}
              <path d="M350 400 L450 400 L450 430 L350 430 Z" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="2" strokeDasharray="4 2" />
              <text x="400" y="420" textAnchor="middle" fill="#94A3B8" fontSize="10" fontWeight="bold" className="uppercase tracking-widest">Entrance</text>
            </svg>
          </div>

          {/* Interactive Markers - Can now overflow white area */}
          {VENUE_LOCATIONS.map((loc) => {
            const activeEvent = getActiveEventAtLocation(loc.name);
            const allAtLocation = getEventsAtLocation(loc.name);
            const isSelected = selectedLocation === loc.id;
            const isInteractive = !['food', 'cloakroom', 'reg', 'entrance'].includes(loc.id);

            return (
              <div 
                key={loc.id}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${isSelected ? 'z-[50]' : 'z-20'}`}
                style={{ left: loc.x, top: loc.y }}
              >
                <button
                  onClick={() => {
                    if (isInteractive) {
                      setSelectedLocation(isSelected ? null : loc.id);
                      if (loc.id === 'stage') {
                        document.getElementById('bottom-info')?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }
                  }}
                  disabled={!isInteractive}
                  className={`relative group transition-all duration-300 ${!isInteractive ? 'cursor-default' : ''} ${isSelected ? 'scale-110' : 'scale-100'}`}
                >
                  {/* Ripple Effect for Active Event */}
                  {activeEvent && (
                    <div className="absolute inset-0 -m-4">
                      <div className="absolute inset-0 rounded-full bg-blue-400 opacity-20 animate-ping"></div>
                    </div>
                  )}

                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all border-2
                    ${activeEvent ? 'bg-blue-600 text-white border-blue-400' : 'bg-white text-slate-400 border-slate-200'}
                    ${isSelected ? 'ring-4 ring-blue-100 border-blue-500 scale-110' : ''}
                  `}>
                    {loc.id === 'stage' && <MapPin size={20} />}
                    {loc.id === 'reg' && null}
                    {(loc.id === 'hall_a' || loc.id === 'hall_b') && <Clock size={20} />}
                    {loc.id === 'food' && null}
                    {loc.id === 'cloakroom' && null}
                    {loc.id === 'entrance' && null}
                  </div>

                  {/* Activity Indicator Dots */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {allAtLocation.slice(0, 4).map((_, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full ${activeEvent ? 'bg-blue-300' : 'bg-slate-300'}`}></div>
                    ))}
                  </div>

                  {/* Label - Always readable now */}
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/90 backdrop-blur px-2 py-1 rounded border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{loc.name}</span>
                  </div>
                </button>

                {/* Popover */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full mb-6 left-1/2 -translate-x-1/2 w-64 bg-slate-900 text-white rounded-xl shadow-2xl p-4 pointer-events-auto"
                    >
                      <div className="flex items-center justify-between mb-2">
                         <h4 className="text-xs font-black uppercase tracking-[0.2em]">{loc.name}</h4>
                         <MapIcon size={12} className="text-blue-400" />
                      </div>
                      <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">{loc.description}</p>
                      
                      {activeEvent ? (
                        <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Сейчас здесь:</span>
                          </div>
                          <p className="text-xs font-bold text-white mb-1 truncate">{activeEvent.title}</p>
                          <p className="text-[10px] text-blue-200 font-mono">{formatTime(activeEvent.startTime)} - {formatTime(activeEvent.endTime)}</p>
                        </div>
                      ) : (
                        <div className="py-4 text-center border border-white/10 rounded-lg bg-white/5">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Нет активных событий</p>
                        </div>
                      )}
                      
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[8px] border-transparent border-t-slate-900"></div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      <div id="bottom-info" className="h-20 border-t border-slate-200 bg-white grid grid-cols-7 shrink-0 relative z-40 px-4">
        {VENUE_LOCATIONS.map((loc) => {
            const activeEvent = getActiveEventAtLocation(loc.name);
            const isInteractive = !['food', 'cloakroom', 'reg', 'entrance'].includes(loc.id);
            return (
              <button
               key={loc.id}
               onClick={() => isInteractive && setSelectedLocation(selectedLocation === loc.id ? null : loc.id)}
               disabled={!isInteractive}
               className={`flex flex-col items-center justify-center transition-all ${!isInteractive ? 'cursor-default opacity-60' : ''} ${selectedLocation === loc.id ? 'bg-slate-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
               <span className="text-[9px] font-black uppercase tracking-widest leading-none mb-1 text-center px-2">{loc.name}</span>
               {activeEvent && <div className="w-1 h-1 rounded-full bg-blue-500 mt-1"></div>}
             </button>
           );
        })}
      </div>

      {/* Sliding Info Plank */}
      <AnimatePresence>
        {selectedLocation && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute bottom-20 left-0 right-0 bg-white border-t border-slate-200 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                      {VENUE_LOCATIONS.find(l => l.id === selectedLocation)?.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Расписание на сегодня</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedLocation(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                {getEventsAtLocation(VENUE_LOCATIONS.find(l => l.id === selectedLocation)?.name || '').length > 0 ? (
                  getEventsAtLocation(VENUE_LOCATIONS.find(l => l.id === selectedLocation)?.name || '').sort((a, b) => a.startTime.seconds - b.startTime.seconds).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-4 group">
                      <div className="w-16 shrink-0 text-right">
                        <span className="text-[10px] font-mono text-slate-400">{formatTime(ev.startTime)}</span>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-blue-500 transition-colors" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-700 leading-none">{ev.title}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">На сегодня событий больше нет</p>
                  </div>
                )}
              </div>

              {selectedLocation === 'stage' && (
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                      <Info size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] text-blue-800 font-black uppercase tracking-widest mb-1">Важно</p>
                      <p className="text-[11px] text-blue-600 font-medium leading-relaxed">
                        На главной сцене проходят ключевые выступления конференции. 
                        Рекомендуем приходить за 5-10 минут до начала.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
