import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Map as MapIcon, Loader2, Info, MapPin, Clock } from 'lucide-react';
import { formatTime } from '../utils';

const VENUE_LOCATIONS = [
  { id: 'stage', name: 'Главная сцена', description: 'Основные доклады и выступления', x: '50%', y: '20%' },
  { id: 'reg', name: 'Стойка регистрации', description: 'Выдача бейджей и мерча', x: '20%', y: '80%' },
  { id: 'hall_a', name: 'Конференц-зал A', description: 'Практические мастер-классы', x: '80%', y: '40%' },
  { id: 'hall_b', name: 'Конференц-зал B', description: 'Технические сессии', x: '80%', y: '70%' },
  { id: 'food', name: 'Зона питания', description: 'Кофе-брейки и обеды', x: '20%', y: '30%' },
  { id: 'cloakroom', name: 'Гардероб', description: 'Хранение вещей', x: '10%', y: '50%' },
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
              
              {/* Registration */}
              <circle cx="150" cy="350" r="40" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
            </svg>
          </div>

          {/* Interactive Markers - Can now overflow white area */}
          {VENUE_LOCATIONS.map((loc) => {
            const activeEvent = getActiveEventAtLocation(loc.name);
            const allAtLocation = getEventsAtLocation(loc.name);
            const isSelected = selectedLocation === loc.id;

            return (
              <div 
                key={loc.id}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${isSelected ? 'z-[50]' : 'z-20'}`}
                style={{ left: loc.x, top: loc.y }}
              >
                <button
                  onClick={() => setSelectedLocation(isSelected ? null : loc.id)}
                  className={`relative group transition-all duration-300 ${isSelected ? 'scale-110' : 'scale-100 hover:scale-105'}`}
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
                    {loc.id === 'reg' && <Info size={20} />}
                    {(loc.id === 'hall_a' || loc.id === 'hall_b') && <Clock size={20} />}
                    {loc.id === 'food' && <div className="text-sm font-bold">🍴</div>}
                    {loc.id === 'cloakroom' && <div className="text-sm font-bold">📦</div>}
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

      <div className="h-20 border-t border-slate-200 bg-white grid grid-cols-6 shrink-0 relative z-10 px-4">
        {VENUE_LOCATIONS.map((loc) => {
           const activeEvent = getActiveEventAtLocation(loc.name);
           return (
             <button
              key={loc.id}
              onClick={() => setSelectedLocation(selectedLocation === loc.id ? null : loc.id)}
              className={`flex flex-col items-center justify-center transition-all ${selectedLocation === loc.id ? 'bg-slate-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
               <span className="text-[9px] font-black uppercase tracking-widest leading-none mb-1 text-center px-2">{loc.name}</span>
               {activeEvent && <div className="w-1 h-1 rounded-full bg-blue-500 mt-1"></div>}
             </button>
           );
        })}
      </div>
    </div>
  );
}
