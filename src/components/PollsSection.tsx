import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  doc,
  updateDoc,
  increment,
  addDoc,
  getDocs,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Poll } from '../types';
import { motion } from 'motion/react';
import { BarChart3, CheckCircle2 } from 'lucide-react';

export default function PollsSection() {
  const { profile } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [allVotes, setAllVotes] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'polls'), where('isActive', '==', true));
    const unsubPolls = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Poll[];
      setPolls(list);
    });

    const unsubVotes = onSnapshot(collection(db, 'votes'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllVotes(list);
    });

    // Fetch user votes (this would be better with a subcollection and rules)
    const fetchVotes = async () => {
      if (!profile) return;
      const vQ = query(collection(db, 'votes'), where('userId', '==', profile.id));
      const vSnapshot = await getDocs(vQ);
      const vMap: Record<string, number> = {};
      vSnapshot.docs.forEach(d => {
        const data = d.data();
        vMap[data.pollId] = data.optionIndex;
      });
      setUserVotes(vMap);
    };
    fetchVotes();

    return () => {
      unsubPolls();
      unsubVotes();
    };
  }, [profile?.id]);

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!profile || userVotes[pollId] !== undefined) return;

    try {
      await addDoc(collection(db, 'votes'), {
        pollId,
        userId: profile.id,
        optionIndex,
        timestamp: serverTimestamp()
      });
      setUserVotes(prev => ({ ...prev, [pollId]: optionIndex }));
      // In a real app, votes are counted via a field on the poll doc or by counting docs
    } catch (err) {
      console.error(err);
    }
  };

  const createSamplePoll = async () => {
    await addDoc(collection(db, 'polls'), {
      question: "Как вам первый день интенсива?",
      options: ["Огонь! 🔥", "Полезно 📚", "Сложно, но интересно 🧩", "Нужен перерыв ☕️"],
      isActive: true,
      createdAt: serverTimestamp()
    });
  };

  if (polls.length === 0) {
    return (
      <div className="mt-12 bg-white rounded-3xl p-8 border border-gray-100 text-center">
        <p className="text-gray-400 mb-4">Активных опросов нет</p>
        {(profile?.role === 'organizer' || profile?.email === 'rodionovazarij@gmail.com') && (
          <button onClick={createSamplePoll} className="text-orange-600 text-sm font-bold underline">Создать пример опроса</button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-12 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <BarChart3 className="text-orange-600" />
        Активные опросы
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {polls.map(poll => {
          const pollVotes = allVotes.filter(v => v.pollId === poll.id);
          const totalVotes = pollVotes.length;
          const hasVoted = userVotes[poll.id] !== undefined;

          return (
            <motion.div 
              key={poll.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100"
            >
              <h3 className="font-bold text-gray-900 mb-4">{poll.question}</h3>
              <div className="space-y-3">
                {poll.options.map((option, idx) => {
                  const optionVotes = pollVotes.filter(v => v.optionIndex === idx).length;
                  const percent = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                  const isSelected = userVotes[poll.id] === idx;

                  return (
                    <div key={idx} className="space-y-1">
                      <button
                        onClick={() => handleVote(poll.id, idx)}
                        disabled={hasVoted}
                        className={`w-full text-left px-5 py-4 rounded-2xl text-sm font-medium transition-all flex items-center justify-between ${
                          isSelected 
                          ? 'bg-orange-600 text-white shadow-lg shadow-orange-100' 
                          : hasVoted
                          ? 'bg-gray-50 text-gray-400 cursor-default'
                          : 'bg-gray-50 text-gray-700 hover:bg-orange-50 hover:text-orange-600'
                        }`}
                      >
                        {option}
                        {isSelected && <CheckCircle2 size={18} />}
                      </button>
                      {hasVoted && (
                        <div className="px-2 flex items-center gap-3">
                          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              className={`h-full ${isSelected ? 'bg-orange-600' : 'bg-gray-300'}`}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 w-8">{percent}%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {hasVoted && (
                <p className="mt-4 text-[10px] uppercase font-bold text-gray-400 text-center tracking-widest">
                  Голос принят • {totalVotes} всего
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
