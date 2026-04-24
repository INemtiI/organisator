import React, { useEffect, useState, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User as UserIcon } from 'lucide-react';

export default function CommunityChat() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'chat_messages'), orderBy('timestamp', 'asc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[];
      setMessages(list);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      console.warn("Chat messages error:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;

    try {
      await addDoc(collection(db, 'chat_messages'), {
        userId: profile.id,
        userName: profile.displayName,
        text: newMessage,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-900 uppercase tracking-tight">Общий чат</h1>
          <div className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded uppercase tracking-wider">Community HUB</div>
          {profile?.role === 'organizer' ? (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase border border-purple-200">Организатор</span>
          ) : (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase border border-blue-200">Участник</span>
          )}
        </div>
        <div className="flex -space-x-1.5">
          {[1,2,3,4].map(i => (
            <div key={i} className="w-6 h-6 rounded-full border border-white bg-slate-200" />
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.userId === profile?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] ${
                msg.userId === profile?.id 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-white border border-slate-200 text-slate-900 shadow-sm'
              } p-4 rounded-lg`}>
                {msg.userId !== profile?.id && (
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-blue-600">{msg.userName}</p>
                )}
                <p className="text-sm leading-relaxed">{msg.text}</p>
                <p className={`text-[9px] mt-2 font-mono uppercase opacity-40 ${msg.userId === profile?.id ? 'text-right' : ''}`}>
                  {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <input 
            type="text" 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Введите сообщение в хаб..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all font-medium"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-slate-900 text-white h-11 px-6 rounded text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-20 uppercase tracking-widest"
          >
            Отправить
          </button>
        </div>
      </form>
    </div>
  );
}
