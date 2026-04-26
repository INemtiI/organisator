import React, { useEffect, useState, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  where,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ChatMessage, Event } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User as UserIcon, Hash, Lock, Users, Heart, Flame, ThumbsUp, ThumbsDown, PartyPopper, Smile, Trash2, X } from 'lucide-react';

const REACTION_EMOJIS = [
  { emoji: '❤️', icon: <Heart size={10} className="fill-red-500 text-red-500" /> },
  { emoji: '🔥', icon: <Flame size={10} className="fill-orange-500 text-orange-500" /> },
  { emoji: '👍', icon: <ThumbsUp size={10} className="fill-blue-500 text-blue-500" /> },
  { emoji: '👎', icon: <ThumbsDown size={10} className="fill-slate-500 text-slate-500" /> },
  { emoji: '🎉', icon: <PartyPopper size={10} className="fill-purple-500 text-purple-500" /> },
];

export default function CommunityChat() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userEvents, setUserEvents] = useState<Event[]>([]);
  const [userRegistrations, setUserRegistrations] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeChannel, setActiveChannel] = useState<'general' | 'secret'>('general');
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [reactionMenuId, setReactionMenuId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Fetch registrations or events for organizers
  useEffect(() => {
    if (!profile) return;

    if (profile.role === 'organizer') {
      const q = query(collection(db, 'events'), where('type', '==', 'masterclass'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUserEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[]);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'events'));
      return () => unsubscribe();
    } else {
      const q = query(collection(db, 'registrations'), where('userId', '==', profile.id));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ids = snapshot.docs.map(doc => doc.data().eventId);
        setUserRegistrations(ids);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'registrations'));
      return () => unsubscribe();
    }
  }, [profile?.id, profile?.role]);

  // 2. Fetch event data based on registrations
  useEffect(() => {
    if (!profile || profile.role === 'organizer' || userRegistrations.length === 0) {
      if (profile?.role !== 'organizer') setUserEvents([]);
      return;
    }

    const eventIds = userRegistrations.slice(0, 10);
    const q = query(collection(db, 'events'), where('__name__', 'in', eventIds));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUserEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'events'));

    return () => unsubscribe();
  }, [userRegistrations, profile?.role]);

  // 3. Fetch chat messages
  useEffect(() => {
    if (!profile) return;

    // Organizers cannot access secret chat
    if (activeChannel === 'secret' && profile.role === 'organizer') {
      setActiveChannel('general');
      return;
    }

    const path = 'chat_messages';
    const q = query(
      collection(db, path), 
      where('channelId', '==', activeChannel),
      orderBy('timestamp', 'asc'), 
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChatMessage[];
      setMessages(list);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [activeChannel, activeEventId, profile]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;
    
    try {
      const msgData: any = {
        userId: profile.id,
        userName: profile.displayName,
        userPhotoURL: profile.photoURL,
        userRole: profile.role,
        channelId: activeChannel,
        text: newMessage,
        timestamp: serverTimestamp(),
        reactions: {}
      };
      
      await addDoc(collection(db, 'chat_messages'), msgData);
      setNewMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'chat_messages');
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!profile) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    const currentReactions = msg.reactions || {};
    const users = currentReactions[emoji] || [];
    const hasReacted = users.includes(profile.id);

    let newUsers;
    if (hasReacted) {
      newUsers = users.filter(id => id !== profile.id);
    } else {
      newUsers = [...users, profile.id];
    }

    const newReactions = { ...currentReactions, [emoji]: newUsers };
    
    // Cleanup empty emoji arrays
    if (newUsers.length === 0) {
      delete newReactions[emoji];
    }

    try {
      await updateDoc(doc(db, 'chat_messages', messageId), {
        reactions: newReactions
      });
      setReactionMenuId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'chat_messages/' + messageId);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, 'chat_messages', messageId));
      setDeletingId(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'chat_messages/' + messageId);
      alert('Ошибка при удалении: ' + (err.message || 'Нет доступа'));
      setDeletingId(null);
    }
  };

  const getChatTitle = () => {
    if (activeChannel === 'general') return 'Общий хаб';
    if (activeChannel === 'secret') return 'Чат участников';
    return 'Чат';
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <header className="h-20 border-b border-slate-200 flex flex-col justify-center px-8 bg-white shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-6">
            <h1 className="text-sm font-bold text-slate-900 uppercase tracking-widest">{getChatTitle()}</h1>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${activeChannel === 'general' ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">
                {activeChannel === 'general' ? 'Public' : 'Private'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right mr-2 hidden md:block">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Ваш статус</p>
                <p className="text-[10px] font-bold text-slate-900 uppercase">{profile?.role}</p>
             </div>
             <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">
                    U{i}
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button 
            onClick={() => setActiveChannel('general')}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all shrink-0 ${
              activeChannel === 'general' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <Hash size={12} />
            Общий
          </button>
          {profile?.role !== 'organizer' && (
            <button 
              onClick={() => setActiveChannel('secret')}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all shrink-0 ${
                activeChannel === 'secret' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Lock size={12} />
              Чат участников
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-end gap-3 ${msg.userId === profile?.id ? 'flex-row-reverse' : 'flex-row'}`}
              onDoubleClick={() => setReactionMenuId(reactionMenuId === msg.id ? null : msg.id)}
            >
              <div className="w-9 h-9 rounded-2xl border border-slate-200 bg-white overflow-hidden shrink-0 shadow-sm mb-1">
                {msg.userPhotoURL ? (
                  <img src={msg.userPhotoURL} alt={msg.userName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 text-[10px] font-bold text-slate-400 capitalize">
                    {msg.userName[0]}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1 max-w-[70%]">
                <div className={`relative ${
                  msg.userId === profile?.id 
                  ? (activeChannel === 'secret' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white') + ' shadow-md rounded-2xl rounded-br-none' 
                  : 'bg-white border border-slate-200 text-slate-900 shadow-sm rounded-2xl rounded-bl-none'
                } p-4`}>
                  
                  <div className="flex items-center gap-2 mb-1.5">
                    {msg.userId !== profile?.id && (
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${
                        msg.userRole === 'organizer' ? (msg.userId === profile?.id ? 'text-white' : 'text-purple-600') : (msg.userId === profile?.id ? 'text-white' : 'text-blue-600')
                      }`}>
                        {msg.userName}
                      </p>
                    )}
                    {msg.userRole && (
                      <span className={`text-[8px] font-black uppercase tracking-tighter px-1 rounded-sm border ${
                        msg.userId === profile?.id
                        ? 'bg-white/20 border-white/30 text-white'
                        : msg.userRole === 'organizer' 
                          ? 'bg-purple-50 text-purple-600 border-purple-100' 
                          : 'bg-blue-50 text-blue-600 border-blue-100'
                      }`}>
                        {msg.userRole === 'organizer' ? 'Организатор' : 'Участник'}
                      </span>
                    )}
                  </div>

                  <p className="text-sm leading-relaxed font-medium">{msg.text}</p>
                  
                  <div className="flex items-center justify-between mt-2 gap-4">
                    <p className={`text-[9px] font-mono uppercase opacity-40`}>
                      {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                    </p>
                    <div className="flex items-center gap-1">
                      {(msg.userId === user?.uid) && (
                        <div className="flex items-center gap-1">
                          {deletingId === msg.id ? (
                            <div className="flex items-center gap-2 bg-red-600 rounded-full px-3 py-1 shadow-lg animate-in fade-in zoom-in duration-200">
                              <button 
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="text-[10px] text-white font-black uppercase tracking-tight"
                              >
                                Удалить
                              </button>
                              <div className="w-[1px] h-3 bg-white/30"></div>
                              <button 
                                onClick={() => setDeletingId(null)}
                                className="text-white hover:scale-110 transition-transform"
                                title="Отмена"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setDeletingId(msg.id)}
                              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                msg.userId === user?.uid ? 'bg-white/10 hover:bg-white/30' : 'bg-slate-100 hover:bg-slate-200'
                              }`}
                              title="Удалить своё сообщение"
                            >
                              <Trash2 size={14} className={msg.userId === user?.uid ? 'text-white/70' : 'text-slate-400 hover:text-red-500'} />
                            </button>
                          )}
                        </div>
                      )}
                      <button 
                        onClick={() => setReactionMenuId(reactionMenuId === msg.id ? null : msg.id)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          msg.userId === user?.uid ? 'bg-white/10 hover:bg-white/30' : 'bg-slate-100 hover:bg-slate-200'
                        }`}
                      >
                        <Smile size={14} className={msg.userId === user?.uid ? 'text-white/70' : 'text-slate-400'} />
                      </button>
                    </div>
                  </div>

                  {/* Reaction Menu */}
                  <AnimatePresence>
                    {reactionMenuId === msg.id && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        className={`absolute bottom-full mb-2 bg-white rounded-full shadow-xl border border-slate-100 p-1 flex gap-1 z-20 ${
                          msg.userId === profile?.id ? 'right-0' : 'left-0'
                        }`}
                      >
                        {REACTION_EMOJIS.map(({ emoji }) => (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReaction(msg.id, emoji);
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 text-lg transition-transform active:scale-125`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Visible Reactions */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${msg.userId === profile?.id ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(msg.reactions).map(([emoji, users]) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(msg.id, emoji)}
                        className={`px-2 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1.5 transition-all ${
                          users.includes(profile.id) 
                          ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' 
                          : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-xs">{emoji}</span>
                        <span>{users.length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
             <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                <Send size={24} className="opacity-20" />
             </div>
             <p className="text-xs font-bold uppercase tracking-[0.2em]">Сообщений пока нет</p>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-6 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <input 
            type="text" 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={
              activeChannel === 'secret' 
              ? "Чат участников..." 
              : "Общий чат события..."
            }
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 text-sm focus:outline-none focus:border-blue-500 transition-all font-medium shadow-inner"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className={`h-12 px-8 rounded-xl text-[11px] font-bold hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 uppercase tracking-[0.2em] shadow-lg ${
              activeChannel === 'secret' 
              ? 'bg-amber-500 text-white shadow-amber-100' 
              : 'bg-blue-600 text-white shadow-blue-100'
            }`}
          >
            Отправить
          </button>
        </div>
      </form>
    </div>
  );
}
