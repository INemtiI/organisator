import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  User,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  updateProfilePhoto: (photoURL: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const profileDoc = await getDoc(doc(db, 'users', user.uid));
          if (profileDoc.exists()) {
            setProfile({ id: profileDoc.id, ...profileDoc.data() } as UserProfile);
          }
        } catch (err) {
          console.error("Error fetching profile:", err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, name: string, role: UserRole) => {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update Firebase Auth profile
    await updateProfile(newUser, { displayName: name });

    // Create Firestore profile
    const profileData = {
      displayName: name,
      email: email,
      role: role,
      createdAt: serverTimestamp(),
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
    };

    await setDoc(doc(db, 'users', newUser.uid), profileData);
    
    // If organizer, also add to admins collection for rules (using bootstrapped logic if needed, but here we trust the choice)
    if (role === 'organizer') {
      await setDoc(doc(db, 'admins', newUser.uid), {
        email: email,
        assignedAt: serverTimestamp()
      });
    }

    setProfile({ id: newUser.uid, ...profileData } as any);
  };

  const logout = () => signOut(auth);

  const updateProfilePhoto = async (photoURL: string) => {
    if (!user) return;
    
    // Update Firebase Auth
    await updateProfile(user, { photoURL });

    // Update Firestore
    await setDoc(doc(db, 'users', user.uid), { photoURL }, { merge: true });

    // Update local state
    if (profile) {
      setProfile({ ...profile, photoURL });
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, logout, updateProfilePhoto }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
