import React, { useEffect, useRef } from 'react';
import { collection, query, onSnapshot, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Announcement, Event, Registration } from '../types';

export default function NotificationManager() {
  const { profile } = useAuth();
  const { addNotification } = useNotifications();
  const seenAnnouncements = useRef<Set<string>>(new Set());
  const seenNotifications = useRef<Set<string>>(new Set());
  const lastKnownStatuses = useRef<Record<string, string>>({});
  const lastKnownCounts = useRef<Record<string, number>>({});
  const confirmedEvents = useRef<Event[]>([]);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Permission logic remains same
    }
  }, []);

  const sendNotification = (title: string, body: string) => {
    // 1. App-level notification (always send to context)
    addNotification(title, body);

    // 2. System-level notification (if granted)
    if (Notification.permission === "granted") {
      try {
        new Notification(title, { 
          body, 
          icon: '/favicon.ico',
          tag: title + body 
        });
      } catch (err) {
        console.error("Notification error:", err);
      }
    }
  };

  useEffect(() => {
    if (!profile?.id) return;

    // 1. New Announcements
    const annQuery = query(collection(db, 'announcements'), orderBy('timestamp', 'desc'), limit(1));
    const unsubAnn = onSnapshot(annQuery, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const ann = { id: change.doc.id, ...change.doc.data() } as Announcement;
          if (!seenAnnouncements.current.has(ann.id)) {
            seenAnnouncements.current.add(ann.id);
            const annTime = ann.timestamp?.toDate ? ann.timestamp.toDate() : new Date();
            if (Date.now() - annTime.getTime() < 300000) { // last 5 mins
              sendNotification('Новое объявление', ann.text.substring(0, 100) + (ann.text.length > 100 ? '...' : ''));
            }
          }
        }
      });
    });

    // 2. Status changes & Waitlist spots
    const regQuery = query(collection(db, 'registrations'), where('userId', '==', profile.id));
    const unsubRegs = onSnapshot(regQuery, (regSnap) => {
      const currentRegs: Record<string, string> = {};
      regSnap.docs.forEach(doc => {
        const reg = { id: doc.id, ...doc.data() } as Registration;
        currentRegs[reg.eventId] = reg.status;
        const prevStatus = lastKnownStatuses.current[reg.eventId];
        
        if (prevStatus === 'waitlist' && reg.status === 'confirmed') {
          sendNotification('Вы подтверждены!', 'Вы были переведены из листа ожидания в основной список участников.');
        }
        lastKnownStatuses.current[reg.eventId] = reg.status;
      });
    });

    // 3. Overall event capacity (for waitlist users)
    const eventQuery = query(collection(db, 'events'));
    const unsubEvents = onSnapshot(eventQuery, (eventSnap) => {
      const eventList: Event[] = [];
      eventSnap.docs.forEach(doc => {
        const event = { id: doc.id, ...doc.data() } as Event;
        eventList.push(event);
        
        const prevCount = lastKnownCounts.current[event.id] || 0;
        const currentCount = event.confirmedCount || 0;
        const max = event.maxParticipants || 0;

        // Notify if spot opened and user is on waitlist
        if (lastKnownStatuses.current[event.id] === 'waitlist' && max > 0) {
          if (currentCount < max && prevCount >= max) {
            sendNotification('Место освободилось!', `На мастер-классе "${event.title}" появилось свободное место. Загляните в приложение!`);
          }
        }
        lastKnownCounts.current[event.id] = currentCount;
      });
      confirmedEvents.current = eventList;
    });

    // 4. Pre-event reminders (1 hour and 10 minutes)
    const interval = setInterval(() => {
      const now = Date.now();
      confirmedEvents.current.forEach(event => {
        if (lastKnownStatuses.current[event.id] === 'confirmed') {
          const startTime = event.startTime?.toDate ? event.startTime.toDate().getTime() : 0;
          if (startTime > 0) {
            const diffMinutes = Math.floor((startTime - now) / 60000);
            
            // 1 hour reminder
            if (diffMinutes > 58 && diffMinutes <= 60 && !seenNotifications.current.has(event.id + '-60m')) {
              seenNotifications.current.add(event.id + '-60m');
              sendNotification('Напоминание (1 час)', `"${event.title}" начнется через час в ${event.location}.`);
            }

            // 10 minutes reminder
            if (diffMinutes > 8 && diffMinutes <= 10 && !seenNotifications.current.has(event.id + '-10m')) {
              seenNotifications.current.add(event.id + '-10m');
              sendNotification('Напоминание (10 минут)', `"${event.title}" начнется через 10 минут в ${event.location}.`);
            }
          }
        }
      });
    }, 20000); // Check every 20 seconds

    return () => {
      unsubAnn();
      unsubRegs();
      unsubEvents();
      clearInterval(interval);
    };
  }, [profile?.id]);

  return null;
}
