import React, { useEffect, useRef } from 'react';
import { collection, query, onSnapshot, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Announcement, Event, Registration } from '../types';

export default function NotificationManager() {
  const { profile } = useAuth();
  const seenAnnouncements = useRef<Set<string>>(new Set());
  const seenUpcoming = useRef<Set<string>>(new Set());
  const lastKnownStatuses = useRef<Record<string, string>>({});
  const lastKnownCounts = useRef<Record<string, number>>({});
  const confirmedEvents = useRef<Event[]>([]);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      // We don't force it immediately but it helps if they see common benefits
      console.log("Notifications permission is in default state.");
    }
  }, []);

  const sendNotification = (title: string, body: string) => {
    if (Notification.permission === "granted") {
      try {
        new Notification(title, { 
          body, 
          icon: '/favicon.ico',
          tag: title + body // Avoid some duplicates
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

    // 4. 10 minutes before timer
    const interval = setInterval(() => {
      const now = Date.now();
      confirmedEvents.current.forEach(event => {
        if (lastKnownStatuses.current[event.id] === 'confirmed') {
          const startTime = event.startTime?.toDate ? event.startTime.toDate().getTime() : 0;
          if (startTime > 0) {
            const diffMinutes = Math.floor((startTime - now) / 60000);
            
            // Check if exactly 10 minutes (or 9-11 range to be safe with interval)
            if (diffMinutes === 10 && !seenUpcoming.current.has(event.id)) {
              seenUpcoming.current.add(event.id);
              sendNotification('Событие скоро начнется', `"${event.title}" начнется через 10 минут в ${event.location}.`);
            }
          }
        }
      });
    }, 30000); // Check every 30 seconds

    return () => {
      unsubAnn();
      unsubRegs();
      unsubEvents();
      clearInterval(interval);
    };
  }, [profile?.id]);

  return null;
}
