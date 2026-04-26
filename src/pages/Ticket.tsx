import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Event } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Clock, User, UserCheck, Calendar, MapPin } from 'lucide-react';
import { formatTime } from '../utils';

export default function Ticket() {
  const { userId } = useParams();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [confirmedEvents, setConfirmedEvents] = useState<Event[]>([]);

  useEffect(() => {
    async function fetchData() {
      if (!userId) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
          
          const q = query(collection(db, 'registrations'), where('userId', '==', userId), where('status', '==', 'confirmed'));
          const snap = await getDocs(q);
          const eventIds = snap.docs.map(d => d.data().eventId);
          
          if (eventIds.length > 0) {
            const eventsSnap = await getDocs(query(collection(db, 'events')));
            const filtered = eventsSnap.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter(e => eventIds.includes(e.id))
              .sort((a, b) => {
                 const tA = (a.startTime as any).toDate ? (a.startTime as any).toDate().getTime() : new Date(a.startTime).getTime();
                 const tB = (b.startTime as any).toDate ? (b.startTime as any).toDate().getTime() : new Date(b.startTime).getTime();
                 return tA - tB;
              }) as Event[];
            setConfirmedEvents(filtered);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-xl font-black text-slate-900 uppercase mb-2">Ошибка</h1>
          <p className="text-slate-500">Билет недействителен или пользователь не найден.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl relative"
        >
          {/* Header */}
          <div className="bg-slate-900 p-8 text-white relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-600/10 rounded-full blur-2xl -ml-12 -mb-12"></div>
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
                {userData.photoURL ? (
                  <img src={userData.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black">{userData.displayName[0]}</span>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-black tracking-tight truncate">{userData.displayName}</h1>
                <div className="flex items-center gap-2 mt-1">
                   <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                   <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{userData.role === 'organizer' ? 'Организатор' : 'Участник IT-Day'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-8">
            <div className="mb-8">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                <Calendar size={12} className="text-blue-500" />
                Подтвержденные записи
              </h2>
              
              <div className="space-y-3">
                {confirmedEvents.length > 0 ? (
                  confirmedEvents.map((mc, idx) => (
                    <motion.div 
                      key={mc.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="group p-4 bg-slate-50 hover:bg-white border border-slate-100 hover:border-blue-200 rounded-2xl transition-all shadow-sm"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-blue-500 shrink-0 group-hover:scale-110 transition-transform">
                          <UserCheck size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight leading-tight">{mc.title}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                              <Clock size={10} className="text-slate-400" />
                              {formatTime(mc.startTime)}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                              <MapPin size={10} className="text-slate-400" />
                              {mc.location}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-12 px-6 border-2 border-dashed border-slate-100 rounded-[2rem] text-center">
                    <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">
                      У данного пользователя<br />нет подтвержденных записей
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100/50">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-500 shadow-sm shrink-0">
                  <User size={20} />
                </div>
                <p className="text-[10px] text-blue-700 font-black uppercase tracking-tight leading-relaxed">
                  Данный пропуск подтверждает личность участника и право на участие в мастер-классах
                </p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
        </motion.div>
      </div>
    </div>
  );
}
