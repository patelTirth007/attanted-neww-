import React from 'react';
import { motion } from 'motion/react';
import { LogIn, ShieldCheck, User as UserIcon } from 'lucide-react';
import { auth, googleProvider, signInWithPopup } from '../firebase';

export default function Auth() {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md space-y-8 rounded-2xl border border-neutral-200 bg-white p-8 shadow-xl"
      >
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
            <ShieldCheck size={32} />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-neutral-900">
            Attendance System
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Secure QR & Face Recognition Attendance
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={handleLogin}
            className="group relative flex w-full items-center justify-center gap-3 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 active:scale-95"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-neutral-500">Access for Teachers & Students</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center text-xs text-neutral-500">
            <div className="rounded-lg border border-neutral-100 p-3">
              <UserIcon size={16} className="mx-auto mb-1 text-indigo-500" />
              <p className="font-medium">Teachers</p>
              <p>Manage & QR</p>
            </div>
            <div className="rounded-lg border border-neutral-100 p-3">
              <ShieldCheck size={16} className="mx-auto mb-1 text-emerald-500" />
              <p className="font-medium">Students</p>
              <p>Scan & Face AI</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
