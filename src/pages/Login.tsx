import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { User, ShieldCheck, Mail, Lock, UserPlus } from 'lucide-react';
import { UserRole } from '../types';

export default function Login() {
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('participant');

  if (user) return <Navigate to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isRegister) {
        await signUp(email, password, name, role);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка при входе');
    } finally {
      setLoading(false);
    }
  };

  const isFormLoading = loading || authLoading;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <motion.div 
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full bg-white rounded-lg border border-slate-200 shadow-xl p-8 md:p-12 overflow-hidden"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 bg-blue-500 rounded-sm flex items-center justify-center text-white font-bold text-xl mb-6 shadow-md border-b-2 border-blue-700">О</div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2 uppercase tracking-[0.1em]">Организатор в кармане</h1>
          <div className="w-8 h-0.5 bg-slate-200 mb-4"></div>
          <p className="text-slate-400 text-xs text-center uppercase tracking-widest font-medium">Система управления мероприятиями</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {isRegister && (
              <motion.div
                key="register-fields"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="relative">
                  <UserPlus className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Полное имя" 
                    required 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setRole('participant')}
                    className={`flex items-center justify-center gap-2 py-3 rounded border text-[10px] font-bold uppercase tracking-widest transition-all ${
                      role === 'participant' 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                      : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <User size={14} />
                    Участник
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('organizer')}
                    className={`flex items-center justify-center gap-2 py-3 rounded border text-[10px] font-bold uppercase tracking-widest transition-all ${
                      role === 'organizer' 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                      : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <ShieldCheck size={14} />
                    Организатор
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="email" 
              placeholder="Email адрес" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="password" 
              placeholder="Пароль" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isFormLoading}
            className="w-full bg-slate-900 text-white py-4 rounded text-xs font-bold uppercase tracking-[0.2em] hover:bg-slate-800 transition-all active:translate-y-[1px] disabled:opacity-50 mt-4"
          >
            {isFormLoading ? 'Обработка...' : isRegister ? 'Создать аккаунт' : 'Войти в систему'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border-l-2 border-red-500 text-red-700 text-xs text-left">
            <p className="font-bold mb-1 uppercase tracking-wider">Ошибка авторизации</p>
            {error}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center">
          <button 
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-[10px] text-slate-500 uppercase tracking-widest font-bold hover:text-blue-500 transition-colors"
          >
            {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Регистрация'}
          </button>
        </div>

        <div className="mt-12 flex flex-col items-center">
          <div className="flex items-center gap-4 text-[10px] text-slate-300 font-mono">
            <span>v1.3.0-stable</span>
            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
            <span>secure_auth_v3</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
