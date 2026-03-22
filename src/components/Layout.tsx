import React from 'react';
import { motion } from 'motion/react';
import { LogOut, User as UserIcon } from 'lucide-react';
import { auth, signOut } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  role: 'teacher' | 'student' | null;
}

export default function Layout({ children, user, role }: LayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900">
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md transition-colors",
              role === 'teacher' ? "bg-indigo-600" : "bg-emerald-600"
            )}>
              <span className="text-xl font-bold">{role === 'teacher' ? 'T' : 'S'}</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Attendance System</h1>
              <p className={cn(
                "text-[10px] uppercase tracking-[0.2em] font-black",
                role === 'teacher' ? "text-indigo-600" : "text-emerald-600"
              )}>
                {role === 'teacher' ? 'Faculty Portal' : 'Student Portal'}
              </p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium">{user.displayName}</span>
                <span className="text-xs text-neutral-500">{user.email}</span>
              </div>
              <button
                onClick={() => signOut(auth)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-red-600"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
