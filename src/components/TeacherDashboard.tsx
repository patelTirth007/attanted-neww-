import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, QrCode, FileSpreadsheet, Users, Calendar, CheckCircle, XCircle, Download, Loader2, Search, Edit2, ShieldCheck, ArrowLeft, Lock, KeyRound, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { db, collection, addDoc, getDocs, query, where, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { Student, AttendanceSession, AttendanceRecord } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TeacherDashboardProps {
  onSwitchRole?: () => void;
}

export default function TeacherDashboard({ onSwitchRole }: TeacherDashboardProps) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'students' | 'sessions' | 'reports'>('sessions');
  
  // Form states
  const [newStudent, setNewStudent] = useState({ name: '', rollNo: '' });
  const [newSession, setNewSession] = useState({ className: '' });
  const [showQR, setShowQR] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'students'));

    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceSession)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sessions'));

    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'attendance'));

    return () => {
      unsubStudents();
      unsubSessions();
      unsubAttendance();
    };
  }, []);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.rollNo) return;
    try {
      await addDoc(collection(db, 'students'), {
        ...newStudent,
        onLeave: false,
        createdAt: serverTimestamp()
      });
      setNewStudent({ name: '', rollNo: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'students');
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Are you sure you want to remove this student?')) return;
    try {
      await deleteDoc(doc(db, 'students', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'students');
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSession.className) return;
    const qrToken = Math.random().toString(36).substring(2, 15);
    try {
      await addDoc(collection(db, 'sessions'), {
        className: newSession.className,
        date: format(new Date(), 'yyyy-MM-dd'),
        qrToken,
        active: true,
        createdAt: serverTimestamp()
      });
      setNewSession({ className: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'sessions');
    }
  };

  const toggleSession = async (id: string, active: boolean) => {
    try {
      await updateDoc(doc(db, 'sessions', id), { active: !active });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'sessions');
    }
  };

  const toggleLeaveStatus = async (id: string, onLeave: boolean) => {
    try {
      await updateDoc(doc(db, 'students', id), { onLeave: !onLeave });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'students');
    }
  };

  const downloadReport = () => {
    const headers = ['Student Name', 'Roll No', 'Class', 'Date', 'Time'];
    const rows = attendance.map(record => {
      const session = sessions.find(s => s.id === record.sessionId);
      return [
        record.studentName,
        record.rollNo,
        session?.className || 'Unknown',
        session?.date || 'Unknown',
        format(record.timestamp.toDate(), 'HH:mm:ss')
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.rollNo.includes(searchTerm)
  );

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Teacher@ssit') {
      setIsAuthorized(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl"
        >
          <div className="text-center mb-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white mb-4 shadow-lg">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Teacher Portal Access</h2>
            <p className="text-neutral-500 mt-1">Please enter the portal password to continue</p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
              <input
                type="password"
                placeholder="Enter Password"
                className={cn(
                  "w-full rounded-xl border pl-12 pr-4 py-3 focus:outline-none focus:ring-2 transition-all",
                  passwordError 
                    ? "border-red-300 bg-red-50 focus:ring-red-500" 
                    : "border-neutral-200 focus:ring-indigo-500"
                )}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(false);
                }}
                autoFocus
              />
              {passwordError && (
                <p className="mt-2 text-sm font-medium text-red-600">Incorrect password. Please try again.</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 py-3.5 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
            >
              Access Portal
            </button>

            {onSwitchRole && (
              <button 
                type="button"
                onClick={onSwitchRole}
                className="w-full text-sm font-bold text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                Back to Selection
              </button>
            )}
          </form>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Switch Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-neutral-900">Teacher Portal</h2>
        {onSwitchRole && (
          <button 
            onClick={onSwitchRole}
            className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-600 shadow-sm transition-all hover:bg-neutral-50 active:scale-95"
          >
            <ArrowLeft size={18} />
            Switch Portal
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 rounded-xl bg-neutral-100 p-1">
        {[
          { id: 'sessions', icon: QrCode, label: 'Sessions' },
          { id: 'students', icon: Users, label: 'Students' },
          { id: 'reports', icon: FileSpreadsheet, label: 'Reports' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab.id 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'sessions' && (
          <motion.div
            key="sessions"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Plus className="text-indigo-600" size={20} />
                Create New Session
              </h3>
              <form onSubmit={handleCreateSession} className="flex gap-4">
                <input
                  type="text"
                  placeholder="Class Name (e.g. CS101)"
                  className="flex-1 rounded-xl border border-neutral-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newSession.className}
                  onChange={(e) => setNewSession({ ...newSession, className: e.target.value })}
                />
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  Generate QR
                </button>
              </form>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()).map((session) => (
                <div key={session.id} className="group relative rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-lg">{session.className}</h4>
                      <p className="text-sm text-neutral-500">{session.date}</p>
                    </div>
                    <button
                      onClick={() => toggleSession(session.id, session.active)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
                        session.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}
                    >
                      {session.active ? 'Active' : 'Closed'}
                    </button>
                  </div>
                  
                  <div className="flex justify-center p-4 bg-neutral-50 rounded-xl mb-4">
                    <QRCodeSVG value={session.qrToken} size={150} />
                  </div>

                  <div className="flex justify-between items-center text-sm text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {attendance.filter(a => a.sessionId === session.id).length} Present
                    </span>
                    <button 
                      onClick={() => setShowQR(session.qrToken)}
                      className="text-indigo-600 font-medium hover:underline"
                    >
                      Full Screen QR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'students' && (
          <motion.div
            key="students"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Plus className="text-indigo-600" size={20} />
                Add New Student
              </h3>
              <form onSubmit={handleAddStudent} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Student Name"
                  className="rounded-xl border border-neutral-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Roll Number"
                  className="rounded-xl border border-neutral-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newStudent.rollNo}
                  onChange={(e) => setNewStudent({ ...newStudent, rollNo: e.target.value })}
                />
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  Add Student
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-neutral-100 p-4 bg-neutral-50 flex justify-between items-center">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search students..."
                    className="w-full rounded-lg border border-neutral-200 pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <span className="text-sm text-neutral-500 font-medium">Total: {students.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-neutral-50 text-xs font-bold uppercase tracking-wider text-neutral-500">
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Roll No</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-6 py-4 font-medium">{student.name}</td>
                        <td className="px-6 py-4 text-neutral-600">{student.rollNo}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {student.onLeave ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-700 w-fit">
                                <AlertCircle size={10} /> On Leave
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 w-fit">
                                <CheckCircle size={10} /> Active
                              </span>
                            )}
                            {student.uid ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 w-fit">
                                <ShieldCheck size={10} /> Linked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-fit">
                                Unlinked
                              </span>
                            )}
                            {student.faceImage ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 w-fit">
                                <CheckCircle size={10} /> Face AI Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 w-fit">
                                <XCircle size={10} /> No Face Data
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => toggleLeaveStatus(student.id, !!student.onLeave)}
                              title={student.onLeave ? "Mark as Active" : "Mark as On Leave"}
                              className={cn(
                                "p-2 rounded-lg transition-colors",
                                student.onLeave ? "text-emerald-600 hover:bg-emerald-50" : "text-amber-600 hover:bg-amber-50"
                              )}
                            >
                              {student.onLeave ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div
            key="reports"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Attendance Records</h3>
              <button
                onClick={downloadReport}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                <Download size={18} />
                Export CSV
              </button>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-neutral-50 text-xs font-bold uppercase tracking-wider text-neutral-500">
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">Roll No</th>
                      <th className="px-6 py-4">Class</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {attendance.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()).map((record) => {
                      const session = sessions.find(s => s.id === record.sessionId);
                      return (
                        <tr key={record.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-6 py-4 font-medium">{record.studentName}</td>
                          <td className="px-6 py-4 text-neutral-600">{record.rollNo}</td>
                          <td className="px-6 py-4">{session?.className || 'N/A'}</td>
                          <td className="px-6 py-4">{session?.date || 'N/A'}</td>
                          <td className="px-6 py-4 text-neutral-500">
                            {format(record.timestamp.toDate(), 'HH:mm:ss')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative rounded-3xl bg-white p-8 shadow-2xl max-w-lg w-full text-center"
          >
            <button
              onClick={() => setShowQR(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600"
            >
              <XCircle size={32} />
            </button>
            <h2 className="text-2xl font-bold mb-6">Scan to Mark Attendance</h2>
            <div className="flex justify-center p-8 bg-neutral-50 rounded-2xl mb-6">
              <QRCodeSVG value={showQR} size={300} />
            </div>
            <p className="text-neutral-500 font-medium">Keep this open for students to scan</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
