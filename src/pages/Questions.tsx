import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Send, MessageSquare, Clock, CheckCircle2, User } from 'lucide-react';
import FAQ from '../components/FAQ';

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

export default function Questions() {
  const { user, profile } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const path = 'questions';
    const isOrganizer = profile?.role === 'organizer';
    
    const q = isOrganizer 
      ? query(collection(db, path), orderBy('timestamp', 'desc'))
      : query(
          collection(db, path), 
          where('userId', '==', user.uid),
          orderBy('timestamp', 'desc')
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Question[];
      setQuestions(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newQuestion.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const path = 'questions';
    try {
      await addDoc(collection(db, path), {
        userId: user.uid,
        userName: profile?.displayName || user.displayName || 'Участник',
        userPhoto: profile?.photoURL || user.photoURL || '',
        text: newQuestion.trim(),
        timestamp: serverTimestamp(),
        status: 'pending'
      });
      setNewQuestion('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот вопрос?')) return;
    const path = 'questions';
    try {
      await deleteDoc(doc(db, path, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${path}/${id}`);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'Только что';
    const d = date.toDate ? date.toDate() : new Date(date);
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short'
    }).format(d);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white shrink-0">
        <h1 className="text-lg font-semibold text-slate-900 uppercase tracking-tight">Задать вопрос</h1>
        <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
          <MessageSquare size={14} />
          <span>Прямая связь с организаторами</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          <FAQ />
          {/* Ask Form */}
          <section className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Новое обращение</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <textarea
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Что вас интересует? Опишите ваш вопрос максимально подробно..."
                className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                maxLength={2000}
                required
              />
              <div className="flex items-center justify-between mt-4">
                <span className="text-[10px] text-slate-400 uppercase font-medium">
                  {newQuestion.length} / 2000 символов
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting || !newQuestion.trim()}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {isSubmitting ? 'Отправка...' : (
                    <>
                      <span>Отправить</span>
                      <Send size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* History */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Ваши вопросы</h2>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-slate-300"></div>
              </div>
            ) : questions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <MessageSquare size={32} />
                </div>
                <p className="text-slate-500 text-sm">У вас пока нет заданных вопросов.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {questions.map((q) => (
                    <motion.div
                      key={q.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 overflow-hidden">
                              {q.userPhoto ? (
                                <img src={q.userPhoto} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <User size={16} />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-700">{q.userName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Clock size={10} className="text-slate-400" />
                                <span className="text-[10px] text-slate-400 uppercase font-medium">{formatDate(q.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                              q.status === 'answered' 
                                ? 'bg-green-50 text-green-700 border-green-100' 
                                : 'bg-orange-50 text-orange-700 border-orange-100'
                            }`}>
                              {q.status === 'answered' ? 'Отвечено' : 'В ожидании'}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-slate-900 leading-relaxed bg-slate-50/50 p-4 rounded-lg border border-slate-50">
                          {q.text}
                        </p>

                        {q.status === 'answered' && (
                          <div className="mt-6 pt-6 border-t border-slate-100">
                            <div className="flex items-start gap-4">
                              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm border-b-2 border-blue-800">
                                <CheckCircle2 size={16} />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Ответ организаторов</span>
                                  <span className="text-[9px] text-slate-400 uppercase font-medium">{formatDate(q.repliedAt)}</span>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed italic">
                                  "{q.reply}"
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
