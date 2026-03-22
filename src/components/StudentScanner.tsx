import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QrCode, Camera, CheckCircle, XCircle, Loader2, User, ShieldCheck, RefreshCw, AlertCircle, FlipHorizontal, Upload, ArrowLeft } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { db, collection, addDoc, getDocs, query, where, onSnapshot, doc, updateDoc, serverTimestamp, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { Student, AttendanceSession, AttendanceRecord } from '../types';
import { verifyFace } from '../services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StudentScannerProps {
  user: any;
  onSwitchRole?: () => void;
}

export default function StudentScanner({ user, onSwitchRole }: StudentScannerProps) {
  const [step, setStep] = useState<'scan' | 'face' | 'success' | 'register'>('scan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.uid) return;
    
    // First, try to find student by UID
    const qUid = query(collection(db, 'students'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(qUid, async (snapshot) => {
      if (!snapshot.empty) {
        const sData = snapshot.docs[0].data() as Student;
        setStudent({ id: snapshot.docs[0].id, ...sData });
        if (sData.onLeave) {
          setError('You are currently marked as "On Leave". Attendance cannot be marked while on leave. Please contact your teacher if this is an error.');
        } else {
          setError(null);
        }
      } else {
        // If not found by UID, try by roll number (from email)
        const rollNo = user.email?.split('@')[0] || '';
        const qRoll = query(collection(db, 'students'), where('rollNo', '==', rollNo));
        const snapshotRoll = await getDocs(qRoll);
        
        if (!snapshotRoll.empty) {
          const sData = snapshotRoll.docs[0].data();
          await updateDoc(doc(db, 'students', snapshotRoll.docs[0].id), { uid: user.uid });
          // The onSnapshot will trigger again with the updated UID
        } else {
          setStep('register');
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (step === 'scan') {
      let isMounted = true;
      const startScanner = async () => {
        // Wait for the element to be available in the DOM
        let attempts = 0;
        while (attempts < 10) {
          if (document.getElementById("reader")) break;
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!isMounted || !document.getElementById("reader")) return;

        try {
          const scanner = new Html5Qrcode("reader");
          qrScannerRef.current = scanner;
          
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              handleScan(decodedText);
            },
            () => {} // Ignore failures
          );
        } catch (err) {
          if (isMounted) {
            console.error("Scanner error:", err);
            setError('Could not access camera for scanning. Please ensure camera permissions are granted.');
          }
        }
      };
      
      startScanner();
      
      return () => {
        isMounted = false;
        if (qrScannerRef.current) {
          const scanner = qrScannerRef.current;
          if (scanner.isScanning) {
            scanner.stop().then(() => {
              scanner.clear();
            }).catch(err => {
              console.warn("Error stopping scanner during cleanup:", err);
            });
          } else {
            try {
              scanner.clear();
            } catch (e) {}
          }
        }
      };
    }
  }, [step]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'face' | 'qr' = 'face') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'face') {
          setCapturedImage(reader.result as string);
        } else {
          handleQrUpload(reader.result as string);
        }
        // Stop camera if it was running
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQrUpload = async (dataUrl: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Create a temporary scanner on a hidden element to avoid conflict with the main reader
      const tempScanner = new Html5Qrcode("hidden-reader");
      
      try {
        const result = await tempScanner.scanFileV2(dataUrlToBlob(dataUrl), false);
        if (result && result.decodedText) {
          handleScan(result.decodedText);
        }
      } catch (scanErr) {
        console.warn("QR Scan error:", scanErr);
        setError("Could not find a valid QR code in the uploaded image. Please ensure the QR code is clearly visible.");
      } finally {
        tempScanner.clear();
      }
    } catch (err) {
      console.error("QR Upload initialization error:", err);
      setError("An error occurred while processing the QR image.");
    } finally {
      setLoading(false);
    }
  };

  const dataUrlToBlob = (dataUrl: string): File => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], "qr-code.png", { type: mime });
  };

  const handleUpdateReferencePhoto = async () => {
    if (!capturedImage || !student) return;
    setVerifying(true);
    try {
      await updateDoc(doc(db, 'students', student.id), { 
        faceImage: capturedImage,
        updatedAt: serverTimestamp()
      });
      setStudent(prev => prev ? { ...prev, faceImage: capturedImage } : null);
      setCapturedImage(null);
      setStep('scan');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'students');
    }
    setVerifying(false);
  };

  const handleScan = async (data: string) => {
    if (data && !loading && step === 'scan') {
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'sessions'), where('qrToken', '==', data), where('active', '==', true));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const sessionData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AttendanceSession;
          
          const aq = query(collection(db, 'attendance'), where('studentId', '==', user.uid), where('sessionId', '==', sessionData.id));
          const aSnapshot = await getDocs(aq);
          if (!aSnapshot.empty) {
            setError('Attendance already marked for this session.');
            setLoading(false);
            return;
          }

          if (qrScannerRef.current && qrScannerRef.current.isScanning) {
            try {
              await qrScannerRef.current.stop();
              qrScannerRef.current.clear();
            } catch (e) {
              console.warn("Error stopping scanner after scan:", e);
            }
          }

          setSession(sessionData);
          setStep('face');
          setTimeout(startCamera, 100);
        } else {
          setError('Invalid or closed QR code.');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'sessions');
      }
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError('Camera access denied. Please enable camera permissions in your browser settings.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const data = canvasRef.current.toDataURL('image/jpeg', 0.8);
        setCapturedImage(data);
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }
  };

  const handleVerifyAndSubmit = async () => {
    if (!capturedImage || !student || !session) return;
    
    if (student.onLeave) {
      setError('You are currently marked as "On Leave". Attendance cannot be marked while on leave. Please contact your teacher if this is an error.');
      setCapturedImage(null);
      startCamera();
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      let isMatch = false;
      
      if (!student.faceImage) {
        // First time registration: Use this image as the reference for future verifications
        await updateDoc(doc(db, 'students', student.id), { 
          faceImage: capturedImage,
          updatedAt: serverTimestamp()
        });
        setStudent(prev => prev ? { ...prev, faceImage: capturedImage } : null);
        isMatch = true; // First time is always a match as it's the registration
      } else {
        // Subsequent verifications: Compare with registered face image
        isMatch = await verifyFace(capturedImage, student.faceImage);
      }

      if (isMatch) {
        await addDoc(collection(db, 'attendance'), {
          studentId: user.uid,
          sessionId: session.id,
          studentName: student.name,
          rollNo: student.rollNo,
          timestamp: serverTimestamp()
        });
        setStep('success');
      } else {
        setError('Face verification failed. Please ensure your face is clearly visible and matches your registered profile.');
        setCapturedImage(null);
        startCamera();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'attendance');
    }
    setVerifying(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const rollNo = (form.elements.namedItem('rollNo') as HTMLInputElement).value;
    
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'students'), {
        uid: user.uid,
        name,
        rollNo,
        onLeave: false,
        createdAt: serverTimestamp()
      });
      setStudent({ id: docRef.id, uid: user.uid, name, rollNo, onLeave: false, createdAt: Timestamp.now() });
      setStep('scan');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'students');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Switch Portal Button */}
      {onSwitchRole && step === 'scan' && (
        <div className="flex justify-end mb-6">
          <button 
            onClick={onSwitchRole}
            className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-600 shadow-sm transition-all hover:bg-neutral-50 active:scale-95"
          >
            <ArrowLeft size={18} />
            Switch Portal
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 'register' && (
          <motion.div
            key="register"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl"
          >
            <div className="text-center mb-8">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-600 text-white mb-4 shadow-lg">
                <User size={40} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Student Registration</h2>
              <p className="text-neutral-500 mt-1">Link your account to the attendance system</p>
            </div>
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Full Name</label>
                <input
                  name="name"
                  required
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Roll Number / Enrollment No</label>
                <input
                  name="rollNo"
                  required
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="e.g. 123456"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Complete Registration'}
              </button>
            </form>
          </motion.div>
        )}

        {step === 'scan' && (
          <motion.div
            key="scan"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight">Scan QR Code</h2>
              <p className="text-neutral-500 mt-1">Point your camera at the teacher's screen</p>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-[2.5rem] border-8 border-white bg-black shadow-2xl ring-1 ring-neutral-200">
              <div id="reader" className="w-full h-full overflow-hidden"></div>
              <div id="hidden-reader" className="hidden"></div>
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-indigo-500 rounded-3xl border-dashed animate-pulse flex items-center justify-center">
                  <div className="w-full h-0.5 bg-indigo-500/50 absolute top-1/2 -translate-y-1/2 animate-[scan_2s_infinite]"></div>
                </div>
              </div>
              
              <div className="absolute bottom-6 left-0 right-0 flex justify-center px-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-md px-6 py-3 text-sm font-bold text-white border border-white/30 shadow-xl transition-all hover:bg-white/30 active:scale-95"
                >
                  <Upload size={18} />
                  Upload QR Image
                </button>
              </div>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={(e) => handleFileUpload(e, 'qr')}
            />

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 border border-red-100"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} className="shrink-0" />
                  <p className="font-medium">{error}</p>
                </div>
                <button 
                  onClick={() => window.location.reload()}
                  className="flex items-center justify-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-700 hover:bg-red-200 transition-colors"
                >
                  <RefreshCw size={14} /> Refresh Page
                </button>
              </motion.div>
            )}

            <div className="rounded-2xl bg-neutral-100 p-4 text-center relative group">
              <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold mb-1">Authenticated As</p>
              <p className="font-bold text-neutral-900">{student?.name}</p>
              <p className="text-xs text-neutral-500">{student?.rollNo}</p>
              
              <button
                onClick={() => {
                  setStep('face');
                  setCapturedImage(null);
                }}
                className="mt-3 flex items-center justify-center gap-2 mx-auto rounded-lg bg-white px-4 py-2 text-xs font-bold text-indigo-600 shadow-sm border border-neutral-200 transition-all hover:bg-indigo-50 active:scale-95"
              >
                <RefreshCw size={14} />
                Update Reference Photo
              </button>
            </div>
          </motion.div>
        )}

        {step === 'face' && (
          <motion.div
            key="face"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">
                <ShieldCheck size={14} /> AI Face Verification
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                {capturedImage ? 'Verify Identity' : 'Capture Face'}
              </h2>
              <p className="text-neutral-500 mt-1">
                {capturedImage ? 'Is this photo clear?' : 'Position your face within the frame or upload a photo'}
              </p>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-[2.5rem] border-8 border-white bg-neutral-900 shadow-2xl ring-1 ring-neutral-200">
              {!capturedImage ? (
                <>
                  <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover scale-x-[-1]" />
                  <div className="absolute inset-0 pointer-events-none border-[40px] border-black/20">
                    <div className="h-full w-full border-2 border-white/50 rounded-[2rem]"></div>
                  </div>
                  
                  <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 px-4">
                    <button
                      onClick={capturePhoto}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-indigo-600 shadow-xl transition-all hover:scale-110 active:scale-90"
                    >
                      <div className="h-16 w-16 rounded-full border-4 border-indigo-600 flex items-center justify-center">
                        <Camera size={32} />
                      </div>
                    </button>
                    
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white border border-white/30 shadow-xl transition-all hover:scale-110 active:scale-90"
                      title="Upload Photo"
                    >
                      <Upload size={32} />
                    </button>
                  </div>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileUpload}
                  />
                </>
              ) : (
                <div className="relative h-full w-full">
                  <img src={capturedImage} className="h-full w-full object-cover" />
                  {verifying && (
                    <div className="absolute inset-0 bg-indigo-600/20 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
                      <Loader2 className="animate-spin mb-4" size={48} />
                      <p className="font-bold text-lg animate-pulse">AI Verifying...</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {error && !verifying && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 border border-red-100"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} className="shrink-0" />
                  <p className="font-medium">{error}</p>
                </div>
                <button 
                  onClick={() => startCamera()}
                  className="flex items-center justify-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-700 hover:bg-red-200 transition-colors"
                >
                  <RefreshCw size={14} /> Retry Camera
                </button>
              </motion.div>
            )}

            {!verifying && (
              <div className="flex gap-4">
                {capturedImage ? (
                  <>
                    <button
                      onClick={() => { setCapturedImage(null); startCamera(); }}
                      className="flex-1 rounded-2xl border border-neutral-200 py-4 font-bold text-neutral-600 transition-all hover:bg-neutral-50 active:scale-95"
                    >
                      Retake
                    </button>
                    {session ? (
                      <button
                        onClick={handleVerifyAndSubmit}
                        className="flex-1 rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
                      >
                        Submit
                      </button>
                    ) : (
                      <button
                        onClick={handleUpdateReferencePhoto}
                        className="flex-1 rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
                      >
                        Save Photo
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setStep('scan')}
                    className="w-full rounded-2xl border border-neutral-200 py-4 font-bold text-neutral-600 transition-all hover:bg-neutral-50 active:scale-95"
                  >
                    Back to QR
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8 rounded-[3rem] bg-white p-12 shadow-2xl border border-emerald-100"
          >
            <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12 }}
                className="absolute inset-0 rounded-full bg-emerald-100"
              />
              <CheckCircle size={80} className="relative text-emerald-600" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-neutral-900 tracking-tight">Success!</h2>
              <p className="mt-3 text-neutral-600 leading-relaxed">
                Attendance for <span className="font-bold text-indigo-600">{session?.className}</span> has been marked.
              </p>
            </div>
            <button
              onClick={() => { setStep('scan'); setSession(null); setCapturedImage(null); }}
              className="w-full rounded-2xl bg-neutral-900 py-4 font-bold text-white shadow-xl transition-all hover:bg-black active:scale-95"
            >
              Back to Dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      <style>{`
        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
        #reader video {
          border-radius: 2rem;
          object-fit: cover;
        }
      `}</style>
    </div>
  );
}

