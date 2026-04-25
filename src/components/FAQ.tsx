import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, HelpCircle, MessageCircle, Clock, MapPin, Zap } from 'lucide-react';

interface FAQItemProps {
  question: string;
  answer: string;
  icon?: React.ReactNode;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer, icon }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-5 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors px-2 rounded-lg group"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
            {icon || <HelpCircle size={18} />}
          </div>
          <span className={`text-[13px] font-bold tracking-tight transition-colors ${isOpen ? 'text-blue-600' : 'text-slate-700'}`}>
            {question}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="text-slate-300"
        >
          <ChevronDown size={18} />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pb-6 pl-[54px] pr-4 text-[13px] text-slate-500 leading-relaxed font-medium">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const faqs = [
    {
      question: "Как мне задать вопрос?",
      answer: "Вы можете задать вопрос в разделе 'Служба поддержки'. Там же вы увидите статус вашего обращения и ответ от организаторов. Мы стараемся отвечать на все запросы в течение 30 минут.",
      icon: <MessageCircle size={18} />
    },
    {
      question: "Как работает лист ожидания?",
      answer: "Если на мастер-класс нет свободных мест, вы можете записаться в лист ожидания. Когда кто-то из подтвержденных участников отменяет свою запись, мы автоматически приглашаем первого человека из списка и пришлем вам уведомление.",
      icon: <Clock size={18} />
    },
    {
      question: "Где найти информацию о месте проведения?",
      answer: "Место проведения указано в деталях каждого мастер-класса в разделе 'Мастер-классы'. Также на главной странице в блоке 'Расписание' вы можете увидеть карту локаций мероприятия.",
      icon: <MapPin size={18} />
    },
    {
      question: "Что делать, если я опаздываю?",
      answer: "Большинство мастер-классов имеют 10-минутный 'льготный период'. Если вы опаздываете более чем на 15 минут, организаторы могут передать ваше место участнику из листа ожидания, находящемуся на месте.",
      icon: <Zap size={18} />
    }
  ];

  return (
    <div className="col-span-12 mt-8">
      <h2 className="text-sm uppercase tracking-[0.2em] text-slate-400 font-bold mb-4 flex items-center gap-3">
        <div className="w-8 h-[1px] bg-slate-200"></div>
        Популярные вопросы
        <div className="flex-1 h-[1px] bg-slate-200"></div>
      </h2>
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-2 overflow-hidden">
        {faqs.map((faq, index) => (
          <FAQItem 
            key={index} 
            question={faq.question}
            answer={faq.answer}
            icon={faq.icon}
          />
        ))}
      </div>
    </div>
  );
}
