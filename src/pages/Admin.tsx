import React, { useEffect, useState } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  where,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Event, Registration, Announcement, Poll } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Plus, Edit2, Users, Loader2, MessageSquare, CheckCircle2, X } from 'lucide-react';
import { VENUE_LOCATIONS } from '../constants';

interface Question {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  timestamp: any;
  reply?: string;
  repliedAt?: any;
  repliedBy?: string;
  status: 'pending' | 'answered';
  eventId?: string;
}

interface Vote {
  id: string;
  pollId: string;
  optionIndex: number;
  userId: string;
}

export default function AdminPanel() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [activeTab, setActiveTab] = useState<'events' | 'questions' | 'announcements' | 'polls'>('events');
  const [attendeeCounts, setAttendeeCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalQuestions: 0,
    waitlistCount: 0,
    activePolls: 0
  });
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<Question | null>(null);
  const [replyText, setReplyText] = useState('');

  const isAdmin = profile?.role === 'organizer' || profile?.email === 'rodionovazarij@gmail.com';

  useEffect(() => {
    if (!isAdmin) return;

    // Listen for events
    const q = query(collection(db, 'events'), orderBy('startTime', 'asc'));
    const unsubscribeEvents = onSnapshot(q, async (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
      setEvents(list);
      
      const counts: Record<string, number> = {};
      for (const event of list) {
        counts[event.id] = event.confirmedCount || 0;
      }
      setAttendeeCounts(counts);
      setLoading(false);
    }, (error) => {
      console.warn("Admin events listener error:", error);
    });

    // Listen for users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setStats(prev => ({ ...prev, totalUsers: snap.size }));
    }, (error) => {
      console.warn("Admin users listener error:", error);
    });

    // Listen for questions
    const qQuestions = query(collection(db, 'questions'), orderBy('timestamp', 'desc'));
    const unsubQuestions = onSnapshot(qQuestions, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Question[];
      setQuestions(list);
      setStats(prev => ({ ...prev, totalQuestions: snap.size }));
    }, (error) => {
      console.warn("Admin questions listener error:", error);
    });

    // Listen for waitlist
    const qWaitlist = query(collection(db, 'registrations'), where('status', '==', 'waitlist'));
    const unsubWaitlist = onSnapshot(qWaitlist, (snap) => {
      setStats(prev => ({ ...prev, waitlistCount: snap.size }));
    }, (error) => {
      console.warn("Admin waitlist listener error:", error);
    });

    // Listen for all polls
    const qPollsAll = query(collection(db, 'polls'), orderBy('createdAt', 'desc'));
    const unsubPollsAll = onSnapshot(qPollsAll, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Poll[];
      setPolls(list);
      setStats(prev => ({ ...prev, activePolls: list.filter(p => p.isActive).length }));
    });

    // Listen for votes to show stats
    const unsubVotes = onSnapshot(collection(db, 'votes'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Vote[];
      setVotes(list);
    });

    // Listen for announcements
    const qAnn = query(collection(db, 'announcements'), orderBy('timestamp', 'desc'));
    const unsubAnn = onSnapshot(qAnn, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Announcement[];
      setAnnouncements(list);
    });

    return () => {
      unsubscribeEvents();
      unsubUsers();
      unsubQuestions();
      unsubWaitlist();
      unsubPollsAll();
      unsubVotes();
      unsubAnn();
    };
  }, [isAdmin]);

  const [editingEvent, setEditingEvent] = useState<Partial<Event> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allRegistrations, setAllRegistrations] = useState<Registration[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedEventForList, setSelectedEventForList] = useState<Event | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteAnnConfirmId, setDeleteAnnConfirmId] = useState<string | null>(null);
  const [deletePollConfirmId, setDeletePollConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    // Listen for all registrations
    const unsubRegs = onSnapshot(collection(db, 'registrations'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Registration[];
      setAllRegistrations(list);
    });

    // Listen for all users
    const unsubUsersList = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(list);
    });

    return () => {
      unsubRegs();
      unsubUsersList();
    };
  }, [isAdmin]);

  const handleDeleteEvent = async (id: string) => {
    setDeleteConfirmId(null);
    console.log('Attempting to delete event:', id);
    setDeletingId(id);
    try {
      // 1. Try to delete all registrations for this event safely
      const regsQ = query(collection(db, 'registrations'), where('eventId', '==', id));
      const regsSnap = await getDocs(regsQ);
      
      const batch = writeBatch(db);
      console.log(`Found ${regsSnap.size} registrations to delete`);
      
      regsSnap.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      
      // 2. Delete the event itself
      batch.delete(doc(db, 'events', id));
      
      await batch.commit();
      console.log('Batch commit successful');
    } catch (err: any) {
      console.error('Batch delete error, trying simple delete:', err);
      try {
        // Fallback to just deleting the event if batch fails
        await deleteDoc(doc(db, 'events', id));
        console.log('Simple event delete successful');
      } catch (innerErr: any) {
        console.error('Simple delete also failed:', innerErr);
        alert('Ошибка при удалении: ' + (innerErr.message || 'Нет доступа'));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleReplyQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingTo || !replyText.trim()) return;

    try {
      await updateDoc(doc(db, 'questions', replyingTo.id), {
        reply: replyText.trim(),
        repliedAt: serverTimestamp(),
        repliedBy: profile?.displayName || user?.displayName || 'Организатор',
        status: 'answered'
      });
      setReplyingTo(null);
      setReplyText('');
    } catch (err) {
      console.error(err);
      alert('Ошибка при ответе: ' + (err as Error).message);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Удалить этот вопрос?')) return;
    try {
      await deleteDoc(doc(db, 'questions', id));
    } catch (err) {
      console.error(err);
      alert('Ошибка при удалении: ' + (err as Error).message);
    }
  };

  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [isAnnouncing, setIsAnnouncing] = useState(false);

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.trim()) return;
    setIsAnnouncing(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        text: newAnnouncement.trim(),
        timestamp: serverTimestamp(),
        authorName: profile?.displayName || user?.displayName || 'Организатор',
        type: 'info'
      });
      setNewAnnouncement('');
    } catch (err) {
      console.error(err);
      alert('Ошибка при создании объявления');
    } finally {
      setIsAnnouncing(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    setDeleteAnnConfirmId(null);
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (err) {
      console.error(err);
      alert('Ошибка при удалении');
    }
  };

  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isPollCreating, setIsPollCreating] = useState(false);

  const handleAddOption = () => {
    if (pollOptions.length < 10) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (pollOptions.length > 2) {
      const newOptions = [...pollOptions];
      newOptions.splice(index, 1);
      setPollOptions(newOptions);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = pollOptions.filter(opt => opt.trim() !== '');
    if (!pollQuestion.trim() || validOptions.length < 2) {
      alert('Минимум 2 варианта ответа');
      return;
    }
    setIsPollCreating(true);
    try {
      await addDoc(collection(db, 'polls'), {
        question: pollQuestion.trim(),
        options: validOptions,
        isActive: true,
        createdAt: serverTimestamp()
      });
      setPollQuestion('');
      setPollOptions(['', '']);
      setActiveTab('polls');
    } catch (err) {
      console.error(err);
      alert('Ошибка при создании опроса');
    } finally {
      setIsPollCreating(false);
    }
  };

  const handleTogglePollStatus = async (pollId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'polls', pollId), {
        isActive: !currentStatus
      });
    } catch (err) {
      console.error(err);
      alert('Ошибка при изменении статуса');
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    setDeletePollConfirmId(null);
    try {
      await deleteDoc(doc(db, 'polls', pollId));
    } catch (err) {
      console.error(err);
      alert('Ошибка при удалении');
    }
  };

  const toDatetimeLocal = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    try {
      const data = {
        title: editingEvent.title,
        description: editingEvent.description || '',
        startTime: editingEvent.startTime,
        endTime: editingEvent.endTime,
        location: editingEvent.location || '',
        type: editingEvent.type || 'session',
        speakerName: editingEvent.speakerName || '',
        maxParticipants: editingEvent.maxParticipants || 0,
        confirmedCount: editingEvent.confirmedCount || 0,
        updatedAt: serverTimestamp()
      };

      if (editingEvent.id) {
        await updateDoc(doc(db, 'events', editingEvent.id), data);
      } else {
        await addDoc(collection(db, 'events'), {
          ...data,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingEvent(null);
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении: ' + (err as Error).message);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '-';
    const d = date.toDate ? date.toDate() : new Date(date);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  };

  const handleSeedData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sampleEvents = [
        {
          title: "Регистрация и приветственный кофе",
          description: "Начало дня, получение бейджей",
          startTime: new Date(today.getTime() + 9 * 60 * 60 * 1000),
          endTime: new Date(today.getTime() + 10 * 60 * 60 * 1000),
          location: "Стойка регистрации",
          type: "session",
          speakerName: "Команда Организаторов",
          confirmedCount: 0
        },
        {
          title: "Открытие: Будущее интеллектуальных систем",
          description: "Главный доклад о трендах 2024",
          startTime: new Date(today.getTime() + 10 * 60 * 60 * 1000),
          endTime: new Date(today.getTime() + 11 * 30 * 60 * 1000),
          location: "Главная сцена",
          type: "session",
          speakerName: "Алексей Иванов",
          confirmedCount: 0
        },
        {
          title: "React 19: Глубокое погружение",
          description: "Разбор новых хуков и серверных компонентов",
          startTime: new Date(today.getTime() + 11 * 30 * 60 * 1000),
          endTime: new Date(today.getTime() + 13 * 60 * 60 * 1000),
          location: "Конференц-зал A",
          type: "masterclass",
          speakerName: "Мария Смирнова",
          maxParticipants: 15,
          confirmedCount: 0
        },
        {
          title: "Обеденный перерыв",
          description: "Нетворкинг и еда",
          startTime: new Date(today.getTime() + 13 * 60 * 60 * 1000),
          endTime: new Date(today.getTime() + 14 * 60 * 60 * 1000),
          location: "Зона питания",
          type: "break",
          confirmedCount: 0
        },
        {
          title: "AI в продакшене: Прикладные Кейсы",
          description: "Как внедрять LLM в реальные продукты",
          startTime: new Date(today.getTime() + 14 * 60 * 60 * 1000),
          endTime: new Date(today.getTime() + 15 * 30 * 60 * 1000),
          location: "Конференц-зал B",
          type: "session",
          speakerName: "Дмитрий Петров",
          confirmedCount: 0
        },
        {
          title: "Мастер-класс по Tailwind CSS",
          description: "Создание сложных UI за считанные минуты",
          startTime: new Date(today.getTime() + 15 * 30 * 60 * 1000),
          endTime: new Date(today.getTime() + 17 * 60 * 60 * 1000),
          location: "Конференц-зал A",
          type: "masterclass",
          speakerName: "Артем Кузнецов",
          maxParticipants: 20,
          confirmedCount: 0
        }
      ];

      for (const event of sampleEvents) {
        await addDoc(collection(db, 'events'), {
          ...event,
          createdAt: serverTimestamp()
        });
      }
      alert('Расписание успешно заполнено!');
    } catch (err) {
      console.error(err);
      alert('Ошибка при заполнении: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[calc(100vh-100px)]">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Доступ ограничен</h2>
        <p className="text-gray-500">У вас нет прав для просмотра этой страницы.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-900 uppercase tracking-tight">Backend Administration</h1>
          <div className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded uppercase tracking-wider">ROOT ACCESS</div>
          {profile?.role === 'organizer' ? (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase border border-purple-200">Организатор</span>
          ) : (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase border border-blue-200">Участник</span>
          )}
        </div>
        <div className="flex gap-4">
           <button 
             onClick={handleSeedData}
             className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded text-xs font-bold border border-green-200 hover:bg-green-200 transition-colors"
           >
            <Plus size={14} />
            Заполнить расписание
          </button>
           <button 
             onClick={() => setActiveTab('polls')}
             className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-colors"
           >
            <Plus size={14} />
            Добавить опрос
          </button>
          <button 
            onClick={() => {
              setEditingEvent({ type: 'session', startTime: new Date() as any, endTime: new Date() as any });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={14} />
            Новое событие
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div 
            onClick={() => setActiveTab('events')}
            className={`cursor-pointer p-6 rounded-sm shadow-sm border transition-all ${activeTab === 'events' ? 'bg-white border-blue-500 ring-1 ring-blue-500/20' : 'bg-white border-slate-200 opacity-70 hover:opacity-100'}`}
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Общая посещаемость</div>
            <div className="text-3xl font-light text-slate-900">{stats.totalUsers} <span className="text-xs text-slate-400">чел.</span></div>
          </div>
          <div 
            onClick={() => setActiveTab('questions')}
            className={`cursor-pointer p-6 rounded-sm shadow-sm border transition-all ${activeTab === 'questions' ? 'bg-white border-blue-500 ring-1 ring-blue-500/20' : 'bg-white border-slate-200 opacity-70 hover:opacity-100'}`}
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Вопросы организаторам</div>
            <div className="text-3xl font-light text-slate-900">{stats.totalQuestions} <span className={`text-xs font-bold ml-2 ${questions.some(q => q.status === 'pending') ? 'text-orange-500' : 'text-green-500'}`}>
              {questions.filter(q => q.status === 'pending').length} НОВЫХ
            </span></div>
          </div>
          <div 
            onClick={() => setActiveTab('announcements')}
            className={`cursor-pointer p-6 rounded-sm shadow-sm border transition-all ${activeTab === 'announcements' ? 'bg-white border-blue-500 ring-1 ring-blue-500/20' : 'bg-white border-slate-200 opacity-70 hover:opacity-100'}`}
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Объявления</div>
            <div className="text-3xl font-light text-slate-900">{announcements.length} <span className="text-xs text-slate-400">всего</span></div>
          </div>
          <div 
            onClick={() => setActiveTab('polls')}
            className={`cursor-pointer p-6 rounded-sm shadow-sm border transition-all ${activeTab === 'polls' ? 'bg-white border-blue-500 ring-1 ring-blue-500/20' : 'bg-white border-slate-200 opacity-70 hover:opacity-100'}`}
          >
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Активные опросы</div>
            <div className="text-3xl font-light text-slate-900">{stats.activePolls}</div>
          </div>
          <div className="bg-white border border-slate-200 p-6 rounded-sm shadow-sm opacity-70">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Лист ожидания</div>
            <div className="text-3xl font-light text-slate-900">{stats.waitlistCount} <span className="text-xs text-slate-400">актив.</span></div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>
        ) : activeTab === 'events' ? (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold">
                  <th className="px-6 py-4 text-center">Время</th>
                  <th className="px-6 py-4">Событие</th>
                  <th className="px-6 py-4">Тип</th>
                  <th className="px-6 py-4">Нагрузка</th>
                  <th className="px-6 py-4 text-right">Управление</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-center border-r border-slate-50">
                      <div className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                        {formatDate(event.startTime)}
                      </div>
                      <div className="text-[8px] text-slate-300">до {formatDate(event.endTime)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{event.title}</p>
                      <p className="text-[10px] font-mono text-slate-400 uppercase">{event.location}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border ${
                        event.type === 'masterclass' 
                        ? 'bg-blue-50 text-blue-700 border-blue-100' 
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {event.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {event.type === 'masterclass' ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                             <span className="text-slate-400 uppercase font-bold">Занято</span>
                             <span className="font-mono">{attendeeCounts[event.id] || 0} / {event.maxParticipants}</span>
                          </div>
                          <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500" 
                              style={{ width: `${Math.min(((attendeeCounts[event.id] || 0) / (event.maxParticipants || 1)) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-mono italic">GENERAL ENTRY</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => setSelectedEventForList(event)}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Список участников"
                        >
                          <Users size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            setEditingEvent(event);
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          disabled={deletingId !== null}
                          onClick={() => setDeleteConfirmId(event.id)}
                          className={`p-2 transition-colors ${deletingId === event.id ? 'text-slate-300' : 'text-slate-400 hover:text-red-500'}`}
                        >
                          {deletingId === event.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'questions' ? (
          <div className="space-y-4">
            {questions.map((q) => (
              <div 
                key={q.id} 
                className={`bg-white border rounded-lg shadow-sm overflow-hidden transition-all ${q.status === 'pending' ? 'border-orange-200' : 'border-slate-200'}`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 overflow-hidden">
                        {q.userPhoto ? <img src={q.userPhoto} alt="" className="w-full h-full object-cover" /> : <Users size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{q.userName}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-medium">{formatDate(q.timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                        q.status === 'answered' 
                          ? 'bg-green-50 text-green-700 border-green-100' 
                          : 'bg-orange-50 text-orange-700 border-orange-100'
                      }`}>
                        {q.status === 'answered' ? 'Отвечено' : 'Новый вопрос'}
                      </span>
                      <button 
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-50 font-medium italic">
                    "{q.text}"
                  </p>

                  {q.status === 'answered' ? (
                    <div className="flex items-start gap-4 p-4 bg-blue-50/30 rounded-lg border border-blue-50">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm border-b-2 border-blue-800">
                        <CheckCircle2 size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Ваш ответ</span>
                          <span className="text-[9px] text-slate-400 font-medium">{formatDate(q.repliedAt)}</span>
                        </div>
                        <p className="text-sm text-slate-600">{q.reply}</p>
                        <button 
                          onClick={() => {
                            setReplyingTo(q);
                            setReplyText(q.reply || '');
                          }}
                          className="mt-2 text-[10px] font-bold text-blue-600 uppercase hover:underline"
                        >
                          Редактировать ответ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setReplyingTo(q);
                        setReplyText('');
                      }}
                      className="w-full py-2.5 bg-blue-600 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageSquare size={14} />
                      Ответить участнику
                    </button>
                  )}
                </div>
              </div>
            ))}
            {questions.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-400">
                <MessageSquare size={32} className="mx-auto mb-4 opacity-20" />
                <p>Пока нет вопросов от участников</p>
              </div>
            )}
          </div>
        ) : activeTab === 'announcements' ? (
          <div className="space-y-8">
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-4">Создать объявление</h3>
              <form onSubmit={handlePostAnnouncement} className="space-y-4">
                <textarea 
                  value={newAnnouncement}
                  onChange={(e) => setNewAnnouncement(e.target.value)}
                  placeholder="Что вы хотите сообщить всем участникам?"
                  className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-all resize-none"
                />
                <button 
                  disabled={isAnnouncing || !newAnnouncement.trim()}
                  className="bg-blue-600 text-white px-8 py-3 rounded text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isAnnouncing ? 'Публикация...' : 'Опубликовать'}
                </button>
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 px-1">История объявлений</h3>
              {announcements.map((ann) => (
                <div key={ann.id} className="bg-white border border-slate-200 p-6 rounded-lg flex items-start justify-between shadow-sm">
                   <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(ann.timestamp)}</span>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">— {ann.authorName}</span>
                      </div>
                      <p className="text-sm text-slate-700">{ann.text}</p>
                   </div>
                   <button 
                     onClick={() => setDeleteAnnConfirmId(ann.id)}
                     className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                   >
                     <Trash2 size={16} />
                   </button>
                </div>
              ))}
              {announcements.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-400">
                  <p>Объявлений пока не было</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-4">Создать новый опрос</h3>
              <form onSubmit={handleCreatePoll} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Вопрос</label>
                  <input 
                    type="text" 
                    required
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="Например: Как прошла утренняя сессия?"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-all font-bold"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Варианты ответов (2-10)</label>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex gap-2">
                       <input 
                         type="text" 
                         required
                         value={opt}
                         onChange={(e) => {
                           const newOptions = [...pollOptions];
                           newOptions[idx] = e.target.value;
                           setPollOptions(newOptions);
                         }}
                         placeholder={`Вариант ${idx + 1}`}
                         className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                       />
                       {pollOptions.length > 2 && (
                         <button 
                           type="button"
                           onClick={() => handleRemoveOption(idx)}
                           className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                         >
                           <Trash2 size={16} />
                         </button>
                       )}
                    </div>
                  ))}
                  {pollOptions.length < 10 && (
                    <button 
                      type="button"
                      onClick={handleAddOption}
                      className="text-[10px] font-bold text-blue-500 uppercase tracking-widest hover:underline flex items-center gap-1"
                    >
                      <Plus size={12} /> Добавить вариант
                    </button>
                  )}
                </div>
                <button 
                  disabled={isPollCreating || !pollQuestion.trim() || pollOptions.filter(o => o.trim() !== '').length < 2}
                  className="bg-blue-600 text-white px-8 py-3 rounded text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isPollCreating ? 'Создание...' : 'Создать опрос'}
                </button>
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 px-1">Список опросов</h3>
              {polls.map((poll) => {
                const pollVotes = votes.filter(v => v.pollId === poll.id);
                const totalVotes = pollVotes.length;
                
                return (
                  <div key={poll.id} className="bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(poll.createdAt)}</span>
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${poll.isActive ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                            {poll.isActive ? 'Активен' : 'Архивирован'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{totalVotes} голосов</span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-900">{poll.question}</h4>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleTogglePollStatus(poll.id, poll.isActive)}
                          className={`p-2 border rounded transition-colors ${poll.isActive ? 'border-orange-200 text-orange-600 bg-orange-50' : 'border-slate-200 text-slate-400 bg-slate-50'}`}
                          title={poll.isActive ? "Архивировать" : "Активировать"}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => setDeletePollConfirmId(poll.id)}
                          className="p-2 border border-slate-200 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {poll.options.map((option, idx) => {
                        const count = pollVotes.filter(v => v.optionIndex === idx).length;
                        const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        
                        return (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight text-slate-700">
                              <span>{option}</span>
                              <span className="text-slate-400">{count} ({percent}%)</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${percent}%` }}
                                className="h-full bg-blue-500"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {polls.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-400">
                  <p>Опросов пока нет</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Participant List Modal */}
      {selectedEventForList && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedEventForList.title}</h3>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">Список участников и лист ожидания</p>
              </div>
              <button 
                onClick={() => setSelectedEventForList(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Confirmed Participants */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center font-bold">
                    {allRegistrations.filter(r => r.eventId === selectedEventForList.id && r.status === 'confirmed').length}
                  </div>
                  <h4 className="text-sm font-bold uppercase tracking-widest text-slate-900">Подтвержденные участники</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allRegistrations
                    .filter(r => r.eventId === selectedEventForList.id && r.status === 'confirmed')
                    .map(reg => {
                      const userProfile = users.find(u => u.id === reg.userId);
                      return (
                        <div key={reg.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg bg-slate-50/50">
                          <div className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 font-bold overflow-hidden">
                            {userProfile?.photoURL ? (
                              <img src={userProfile.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              userProfile?.displayName?.[0] || '?'
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{userProfile?.displayName || 'Анонимный пользователь'}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{userProfile?.email || 'email@hidden'}</p>
                          </div>
                          <div className="ml-auto">
                             <div className="text-[9px] uppercase font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded">OK</div>
                          </div>
                        </div>
                      );
                    })}
                  {allRegistrations.filter(r => r.eventId === selectedEventForList.id && r.status === 'confirmed').length === 0 && (
                    <div className="col-span-full border-2 border-dashed border-slate-100 rounded-xl p-8 text-center text-slate-400 italic text-sm">
                      Никто пока не подтвержден
                    </div>
                  )}
                </div>
              </section>

              {/* Waitlist */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                    {allRegistrations.filter(r => r.eventId === selectedEventForList.id && r.status === 'waitlist').length}
                  </div>
                  <h4 className="text-sm font-bold uppercase tracking-widest text-slate-900">Лист ожидания</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allRegistrations
                    .filter(r => r.eventId === selectedEventForList.id && r.status === 'waitlist')
                    .map(reg => {
                      const userProfile = users.find(u => u.id === reg.userId);
                      return (
                        <div key={reg.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg bg-slate-50/50">
                          <div className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 font-bold overflow-hidden">
                            {userProfile?.photoURL ? (
                              <img src={userProfile.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              userProfile?.displayName?.[0] || '?'
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{userProfile?.displayName || 'Анонимный пользователь'}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{userProfile?.email || 'email@hidden'}</p>
                          </div>
                          <div className="ml-auto">
                             <div className="text-[9px] uppercase font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded">Wait</div>
                          </div>
                        </div>
                      );
                    })}
                  {allRegistrations.filter(r => r.eventId === selectedEventForList.id && r.status === 'waitlist').length === 0 && (
                    <div className="col-span-full border-2 border-dashed border-slate-100 rounded-xl p-8 text-center text-slate-400 italic text-sm">
                      Лист ожидания пуст
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
              <button 
                onClick={() => setSelectedEventForList(null)}
                className="px-6 py-2 bg-slate-900 text-white rounded text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
              >
                Закрыть
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Poll Delete Confirmation Modal */}
      {deletePollConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[90] backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">Удалить опрос?</h3>
            <p className="text-slate-500 text-sm mb-6">
              Это действие необратимо. Статистика ответов будет также удалена.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setDeletePollConfirmId(null)}
                className="flex-1 py-2 border border-slate-200 rounded text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={() => handleDeletePoll(deletePollConfirmId)}
                className="flex-1 py-2 bg-red-600 text-white rounded text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-colors shadow-sm"
              >
                Удалить
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Announcement Delete Confirmation Modal */}
      {deleteAnnConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">Удалить объявление?</h3>
            <p className="text-slate-500 text-sm mb-6">
              Вы уверены? Объявление исчезнет с досок всех участников в реальном времени.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setDeleteAnnConfirmId(null)}
                className="flex-1 py-2 border border-slate-200 rounded text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={() => handleDeleteAnnouncement(deleteAnnConfirmId)}
                className="flex-1 py-2 bg-red-600 text-white rounded text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-colors shadow-sm"
              >
                Удалить
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Question Reply Modal */}
      {replyingTo && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900">
                Ответ участнику: {replyingTo.userName}
              </h3>
              <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 mb-6 italic text-sm text-slate-600">
                "{replyingTo.text}"
              </div>
              <form onSubmit={handleReplyQuestion}>
                <textarea 
                  required
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Введите ваш ответ..."
                  className="w-full h-40 p-4 bg-slate-50 border border-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none mb-6"
                />
                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="flex-1 py-3 border border-slate-200 rounded text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Отмена
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 text-white rounded text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Отправить ответ
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">Удалить событие?</h3>
            <p className="text-slate-500 text-sm mb-6">
              Это действие необратимо. Все регистрации участников будут удалены вместе с событием.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 border border-slate-200 rounded text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={() => handleDeleteEvent(deleteConfirmId)}
                className="flex-1 py-2 bg-red-600 text-white rounded text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-colors shadow-sm"
              >
                Удалить
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Event Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900">
                {editingEvent?.id ? 'Редактировать событие' : 'Новое событие'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <form onSubmit={handleSaveEvent} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Название</label>
                <input 
                  type="text" 
                  required
                  value={editingEvent?.title || ''}
                  onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Начало</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={toDatetimeLocal(editingEvent?.startTime)}
                    onChange={e => {
                      const date = new Date(e.target.value);
                      setEditingEvent({ ...editingEvent, startTime: date as any });
                    }}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Конец</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={toDatetimeLocal(editingEvent?.endTime)}
                    onChange={e => {
                      const date = new Date(e.target.value);
                      setEditingEvent({ ...editingEvent, endTime: date as any });
                    }}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Локация</label>
                  <select 
                    value={editingEvent?.location || ''}
                    onChange={e => setEditingEvent({ ...editingEvent, location: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Выберите локацию</option>
                    {VENUE_LOCATIONS.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Тип</label>
                  <select 
                    value={editingEvent?.type || 'session'}
                    onChange={e => setEditingEvent({ ...editingEvent, type: e.target.value as any })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="session">Сессия</option>
                    <option value="masterclass">Мастер-класс</option>
                    <option value="break">Перерыв</option>
                    <option value="other">Другое</option>
                  </select>
                </div>
              </div>
              {editingEvent?.type === 'masterclass' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Макс. участников</label>
                  <input 
                    type="number" 
                    value={editingEvent?.maxParticipants || 0}
                    onChange={e => setEditingEvent({ ...editingEvent, maxParticipants: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Спикер</label>
                <input 
                  type="text" 
                  value={editingEvent?.speakerName || ''}
                  onChange={e => setEditingEvent({ ...editingEvent, speakerName: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Описание</label>
                <textarea 
                  value={editingEvent?.description || ''}
                  onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 h-20"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 rounded text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Отмена
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
