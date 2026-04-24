import { useEffect, useState } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  runTransaction,
  doc,
  serverTimestamp,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Event, Registration } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Timer, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { formatTime } from '../utils';

export default function Masterclasses() {
  const { profile } = useAuth();
  const [masterclasses, setMasterclasses] = useState<Event[]>([]);
  const [userRegistrations, setUserRegistrations] = useState<Record<string, Registration>>({});
  const [attendeeCounts, setAttendeeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    
    // 1. Listen for masterclasses
    const q = query(collection(db, 'events'), where('type', '==', 'masterclass'));
    const unsubEvents = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
      setMasterclasses(list);
    }, (error) => {
      console.warn("Events listener error:", error);
    });

    // 2. Listen for user registrations
    const regQ = query(collection(db, 'registrations'), where('userId', '==', profile.id));
    const unsubRegs = onSnapshot(regQ, (snapshot) => {
      const regs: Record<string, Registration> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as Registration;
        regs[data.eventId] = { id: doc.id, ...data };
      });
      setUserRegistrations(regs);
      setLoading(false);
    }, (error) => {
      console.warn("Registrations listener error:", error);
    });

    return () => {
      unsubEvents();
      unsubRegs();
    };
  }, [profile?.id]);

  const handleRegister = async (masterclassId: string) => {
    if (!profile) return;
    setActionLoading(masterclassId);

    try {
      // 1. Get waitlist size outside transaction
      const waitlistQuery = query(
        collection(db, 'registrations'),
        where('eventId', '==', masterclassId),
        where('status', '==', 'waitlist'),
        orderBy('timestamp', 'asc')
      );
      const wlSnapshot = await getDocs(waitlistQuery);
      const nextPos = wlSnapshot.size + 1;

      await runTransaction(db, async (transaction) => {
        const mcDoc = await transaction.get(doc(db, 'events', masterclassId));
        if (!mcDoc.exists()) throw new Error("Мастер-класс не найден");

        const mcData = mcDoc.data() as Event;
        const max = mcData.maxParticipants || 0;
        const currentCount = mcData.confirmedCount || 0;

        const newRegRef = doc(collection(db, 'registrations'));
        
        if (currentCount < max) {
          transaction.set(newRegRef, {
            userId: profile.id,
            eventId: masterclassId,
            status: 'confirmed',
            timestamp: serverTimestamp()
          });
          transaction.update(doc(db, 'events', masterclassId), {
            confirmedCount: currentCount + 1
          });
        } else {
          transaction.set(newRegRef, {
            userId: profile.id,
            eventId: masterclassId,
            status: 'waitlist',
            queuePosition: nextPos,
            timestamp: serverTimestamp()
          });
        }
      });
    } catch (err: any) {
      console.error("Register error:", err);
      alert('Ошибка при регистрации: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnregister = async (regId: string) => {
    const reg = (Object.values(userRegistrations) as Registration[]).find(r => r.id === regId);
    if (!reg) {
      console.warn("Registration not found for ID:", regId);
      return;
    }
    
    const eventId = reg.eventId;
    setActionLoading(eventId);

    // Optimistic update
    const previousRegs = { ...userRegistrations };
    const updatedRegs = { ...userRegistrations };
    delete updatedRegs[eventId];
    setUserRegistrations(updatedRegs);

    try {
      // 1. Find if there's someone in waitlist BEFORE the transaction
      const waitlistQuery = query(
        collection(db, 'registrations'),
        where('eventId', '==', eventId),
        where('status', '==', 'waitlist'),
        orderBy('timestamp', 'asc'),
        limit(1)
      );
      const wlSnapshot = await getDocs(waitlistQuery);
      const nextInLineId = !wlSnapshot.empty ? wlSnapshot.docs[0].id : null;

      await runTransaction(db, async (transaction) => {
        const regDoc = await transaction.get(doc(db, 'registrations', regId));
        if (!regDoc.exists()) {
          console.warn("Registration doc does not exist anymore");
          return;
        }
        
        const regData = regDoc.data() as Registration;
        const currentStatus = regData.status;

        const eventDoc = await transaction.get(doc(db, 'events', eventId));
        if (!eventDoc.exists()) throw new Error("Событие не найдено");
        
        const eventData = eventDoc.data() as Event;

        // READ next in line IF it was pre-fetched
        let nextDoc = null;
        if (currentStatus === 'confirmed' && nextInLineId) {
          nextDoc = await transaction.get(doc(db, 'registrations', nextInLineId));
        }
        
        // ALL READS COMPLETED. NOW WRITES.

        transaction.delete(doc(db, 'registrations', regId));

        if (currentStatus === 'confirmed') {
          if (nextDoc && nextDoc.exists() && nextDoc.data()?.status === 'waitlist') {
            transaction.update(doc(db, 'registrations', nextInLineId!), {
              status: 'confirmed',
              queuePosition: null
            });
            // confirmedCount stays the same
          } else {
            // No one to promote or waitlist changed
            transaction.update(doc(db, 'events', eventId), {
              confirmedCount: Math.max(0, (eventData.confirmedCount || 1) - 1)
            });
          }
        }
      });
    } catch (err: any) {
      console.error("Unregister error:", err);
      setUserRegistrations(previousRegs); // Rollback on error
      alert('Ошибка при отмене: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-900 uppercase tracking-tight">Мастер-классы</h1>
          <div className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded uppercase tracking-wider">Registry Active</div>
          {profile?.role === 'organizer' ? (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase border border-purple-200">Организатор</span>
          ) : (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase border border-blue-200">Участник</span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-12">
          <h2 className="text-sm uppercase tracking-[0.2em] text-slate-400 font-bold mb-6">Доступные активности</h2>
          
          {loading ? (
             <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {masterclasses.map(mc => {
                const registration = userRegistrations[mc.id];
                return (
                  <motion.div 
                    layout
                    key={mc.id}
                    className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-500">
                        <Users size={20} />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-slate-400">ID: {mc.id.slice(0, 5)}</span>
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-900 mb-1">{mc.title}</h3>
                    <p className="text-xs text-slate-500 mb-6 uppercase tracking-wider">Спикер: {mc.speakerName}</p>

                    <div className="space-y-2 mb-8">
                      <div className="flex items-center justify-between text-xs py-2 border-b border-slate-50">
                        <span className="text-slate-400 uppercase tracking-widest font-semibold">Время</span>
                        <span className="font-mono text-blue-600">{formatTime(mc.startTime)} — {formatTime(mc.endTime)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs py-2">
                        <span className="text-slate-400 uppercase tracking-widest font-semibold">Заполнено</span>
                        <span className={`font-bold ${((mc.confirmedCount || 0) >= (mc.maxParticipants || 0)) ? 'text-red-500' : 'text-slate-900'}`}>
                          {mc.confirmedCount || 0} / {mc.maxParticipants}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <AnimatePresence mode="wait">
                        {registration ? (
                          <motion.div 
                            key="registered"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`p-3 rounded text-center mb-2 ${
                              registration.status === 'confirmed' 
                              ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <p className="text-[10px] font-bold uppercase tracking-widest">
                              {registration.status === 'confirmed' ? 'Подтверждено' : `Ожидание (#${registration.queuePosition})`}
                            </p>
                            <button 
                              disabled={actionLoading !== null}
                              onClick={() => handleUnregister(registration.id)}
                              className="mt-2 text-[9px] underline opacity-60 hover:opacity-100 transition-opacity flex items-center justify-center w-full"
                            >
                              {actionLoading === mc.id ? <Loader2 size={10} className="animate-spin" /> : 'Отменить'}
                            </button>
                          </motion.div>
                        ) : (
                          <motion.button 
                            key="unregister"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            onClick={() => handleRegister(mc.id)}
                            disabled={actionLoading !== null}
                            className="w-full py-3 bg-slate-900 text-white text-xs font-bold rounded hover:bg-slate-800 transition-colors uppercase tracking-widest"
                          >
                            {actionLoading === mc.id ? <Loader2 size={14} className="mx-auto animate-spin" /> : 'Записаться'}
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>

  );
}
