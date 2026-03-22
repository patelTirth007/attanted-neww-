import React, { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, User, db, doc, getDoc } from './firebase';
import Auth from './components/Auth';
import Layout from './components/Layout';
import TeacherDashboard from './components/TeacherDashboard';
import StudentScanner from './components/StudentScanner';
import RoleSelection from './components/RoleSelection';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'teacher' | 'student' | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setRoleLoading(true);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data().role);
          } else {
            // Check for hardcoded teacher email as fallback/initial setup
            if (currentUser.email === 'tirthpatel1112005@gmail.com') {
              setRole('teacher');
            } else {
              setRole(null); // Need selection
            }
          }
        } catch (error) {
          console.error('Error fetching role:', error);
        }
        setRoleLoading(false);
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin text-indigo-600" size={48} />
          <p className="mt-4 text-sm font-medium text-neutral-500 tracking-widest uppercase">Initializing Portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (!role) {
    return (
      <RoleSelection 
        userId={user.uid} 
        email={user.email} 
        onRoleSelected={(selectedRole) => setRole(selectedRole)} 
      />
    );
  }

  return (
    <Layout user={user} role={role}>
      {role === 'teacher' ? (
        <TeacherDashboard onSwitchRole={() => setRole(null)} />
      ) : (
        <StudentScanner user={user} onSwitchRole={() => setRole(null)} />
      )}
    </Layout>
  );
}
