import React from 'react';
import { motion } from 'motion/react';
import { User as UserIcon, ShieldCheck, GraduationCap, Presentation } from 'lucide-react';
import { db, doc, setDoc, serverTimestamp } from '../firebase';

interface RoleSelectionProps {
  userId: string;
  email: string | null;
  onRoleSelected: (role: 'teacher' | 'student') => void;
}

export default function RoleSelection({ userId, email, onRoleSelected }: RoleSelectionProps) {
  const selectRole = async (role: 'teacher' | 'student') => {
    try {
      await setDoc(doc(db, 'users', userId), {
        uid: userId,
        email,
        role,
        createdAt: serverTimestamp()
      });
      onRoleSelected(role);
    } catch (error) {
      console.error('Error saving role:', error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl space-y-8"
      >
        <div className="text-center">
          <h2 className="text-3xl font-black text-neutral-900 tracking-tight">Welcome to Attendance System</h2>
          <p className="mt-2 text-neutral-600">Please select your portal to continue</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => selectRole('teacher')}
            className="group relative flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-white bg-white p-10 shadow-xl transition-all hover:border-indigo-500"
          >
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-indigo-100 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
              <Presentation size={48} />
            </div>
            <h3 className="text-2xl font-bold text-neutral-900">Teacher Portal</h3>
            <p className="mt-3 text-center text-sm text-neutral-500 leading-relaxed">
              Generate QR codes, manage student lists, and export attendance reports.
            </p>
            <div className="mt-6 rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600">
              Faculty Access
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => selectRole('student')}
            className="group relative flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-white bg-white p-10 shadow-xl transition-all hover:border-emerald-500"
          >
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
              <GraduationCap size={48} />
            </div>
            <h3 className="text-2xl font-bold text-neutral-900">Student Portal</h3>
            <p className="mt-3 text-center text-sm text-neutral-500 leading-relaxed">
              Scan QR codes and verify your identity with AI face recognition.
            </p>
            <div className="mt-6 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600">
              Student Access
            </div>
          </motion.button>
        </div>

        <p className="text-center text-xs text-neutral-400">
          Note: This selection is permanent. Contact admin to change your role.
        </p>
      </motion.div>
    </div>
  );
}
