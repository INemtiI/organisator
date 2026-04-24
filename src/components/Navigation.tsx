import { NavLink } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  MessageSquare, 
  ShieldCheck, 
  LogOut,
  Home,
  Map as MapIcon,
  HelpCircle,
  QrCode
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';

const navItems = [
  { name: 'Расписание', path: '/', icon: Calendar },
  { name: 'Мастер-классы', path: '/masterclasses', icon: Users },
  { name: 'Чат', path: '/chat', icon: MessageSquare },
  { name: 'Вопросы', path: '/questions', icon: HelpCircle },
];

export default function Navigation() {
  const { profile, logout } = useAuth();
  const isAdmin = profile?.role === 'organizer' || profile?.email === 'rodionovazarij@gmail.com';

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-blue-500 rounded-sm flex items-center justify-center font-bold text-white">О</div>
          <span className="text-white font-semibold tracking-tight">Организатор в кармане</span>
        </div>

        <nav className="flex-1 py-6">
          <div className="px-6 text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-4">Мероприятие</div>
          <div className="space-y-1 px-3">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                    isActive 
                    ? 'bg-slate-800 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`
                }
              >
                <item.icon size={18} />
                {item.name}
              </NavLink>
            ))}
          </div>

          {(isAdmin) && (
            <>
              <div className="px-6 text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-8 mb-4">Администрирование</div>
              <div className="px-3">
                <NavLink
                  to="/admin"
                  className={({ isActive }) => 
                    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                      isActive 
                      ? 'bg-slate-800 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`
                  }
                >
                  <ShieldCheck size={18} />
                  Панель управления
                </NavLink>
              </div>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-2 mb-4">
            <img 
              src={profile?.photoURL || 'https://via.placeholder.com/40'} 
              alt="Avatar" 
              className="w-8 h-8 rounded-full bg-slate-700"
            />
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-medium text-white truncate">{profile?.displayName}</span>
              <div className="flex items-center gap-1 mt-0.5">
                {profile?.role === 'organizer' ? (
                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[8px] font-bold rounded uppercase border border-purple-500/30">Организатор</span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[8px] font-bold rounded uppercase border border-blue-500/30">Участник</span>
                )}
              </div>
            </div>
          </div>
          
          <button className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md hover:bg-blue-500/20 transition-all mb-2">
            <QrCode size={16} />
            Check-in QR
          </button>
          
          <button 
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                isActive ? 'text-orange-600 font-semibold' : 'text-gray-500'
              }`
            }
          >
            <item.icon size={24} />
            <span className="text-[10px]">{item.name}</span>
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) => 
              `flex flex-col items-center gap-1 p-2 transition-colors ${
                isActive ? 'text-orange-600' : 'text-gray-500'
              }`
            }
          >
            <ShieldCheck size={24} />
            <span className="text-[10px]">Редактор</span>
          </NavLink>
        )}
      </nav>
    </>
  );
}
