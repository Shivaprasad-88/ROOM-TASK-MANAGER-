import { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  getDoc,
  getDocs,
  deleteDoc,
  deleteField,
  orderBy,
  limit,
  getDocFromServer
} from 'firebase/firestore';
import { 
  LogOut, 
  Plus, 
  Users, 
  Trash2, 
  Droplets, 
  Milk, 
  Banana, 
  MessageSquare, 
  CheckCircle2, 
  Circle, 
  Sparkles,
  Home,
  ArrowRight,
  Info,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Crown,
  Menu,
  UserCircle,
  Settings,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Room, Task, Activity } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const CURATED_AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Leo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Maya",
];

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
  }
}

function AdBanner() {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (adRef.current && !adRef.current.getAttribute('data-adsbygoogle-status')) {
          // AdSense requires a minimum width to function correctly with responsive ads
          const width = adRef.current.offsetWidth;
          
          // Only push if we have a reasonable width (AdSense usually needs > 120px for most units)
          if (width >= 120) {
            // @ts-ignore
            (window.adsbygoogle = window.adsbygoogle || []).push({});
          } else {
            console.warn(`AdSense: Container width (${width}px) too small for initialization.`);
          }
        }
      } catch (e) {
        console.error("AdSense error:", e);
      }
    }, 1000); // Increased delay to ensure full layout stability

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col items-center justify-center text-center min-h-[150px] overflow-hidden">
      <div className="flex items-center gap-2 text-gray-400 mb-3">
        <Info size={12} />
        <span className="text-[10px] font-bold uppercase tracking-widest">Sponsored</span>
      </div>
      
      <div className="w-full flex justify-center">
        {/* Google AdSense Unit */}
        <ins ref={adRef}
             className="adsbygoogle"
             style={{ 
               display: 'block', 
               width: '100%', 
               minWidth: '120px', 
               height: '90px' 
             }}
             data-ad-client="ca-pub-7939466441674446"
             data-ad-slot="2275555649"
             data-ad-format="fluid"
             data-ad-layout-key="-gw-3+1f-3d+2z"
             data-full-width-responsive="true"></ins>
      </div>
           
      <p className="mt-4 text-[10px] text-gray-300 italic">
        Ads help keep RoomMate free for students.
      </p>
    </div>
  );
}

export default function App() {
  const [user, loading] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [roomMembers, setRoomMembers] = useState<UserProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [userRooms, setUserRooms] = useState<Room[]>([]);
  const [isManageUsersOpen, setIsManageUsersOpen] = useState(false);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [isSwitchRoomOpen, setIsSwitchRoomOpen] = useState(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<'room' | 'history'>('room');
  const [historyFilterUser, setHistoryFilterUser] = useState<string>("all");
  const [historyFilterType, setHistoryFilterType] = useState<string>("all");
  const [historyDays, setHistoryDays] = useState<number>(30);
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  const handleFirestoreError = (err: any, operation: OperationType, path: string) => {
    const errInfo: FirestoreErrorInfo = {
      error: err instanceof Error ? err.message : String(err),
      operationType: operation,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
    setError(`Action failed: ${errInfo.error}`);
    setTimeout(() => setError(null), 5000);
  };

  // Test connection
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (err) {
        if (err instanceof Error && err.message?.includes('the client is offline')) {
          setError("Firebase is offline. Please check your configuration.");
        }
      }
    };
    testConnection();
  }, []);

  // Sync user profile to Firestore with real-time listener
  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      
      // First, ensure profile exists
      const ensureProfile = async () => {
        try {
          const docSnap = await getDoc(userRef);
          if (!docSnap.exists()) {
            const newProfile: UserProfile = {
              uid: user.uid,
              displayName: user.displayName || 'Anonymous',
              email: user.email || '',
              photoURL: user.photoURL || '',
              nickname: user.displayName || 'User',
              bio: '',
              avatarUrl: ''
            };
            await setDoc(userRef, newProfile);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        }
      };
      
      ensureProfile();

      // Then listen for changes
      const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      });

      return () => unsubscribe();
    } else {
      setProfile(null);
      setRoom(null);
    }
  }, [user]);

  // Listen to all rooms user is a member of
  useEffect(() => {
    if (user) {
      const roomsRef = collection(db, 'rooms');
      const q = query(roomsRef, where('members', 'array-contains', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
        setUserRooms(items);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'rooms');
      });
      return () => unsubscribe();
    } else {
      setUserRooms([]);
    }
  }, [user]);

  // Listen to Room changes
  useEffect(() => {
    if (profile?.currentRoomId) {
      const roomRef = doc(db, 'rooms', profile.currentRoomId);
      const unsubscribe = onSnapshot(roomRef, (docSnap) => {
        if (docSnap.exists()) {
          const roomData = { id: docSnap.id, ...docSnap.data() } as Room;
          // If user is no longer a member, clear currentRoomId
          if (user && roomData.members && !roomData.members.includes(user.uid)) {
            setDoc(doc(db, 'users', user.uid), { currentRoomId: null }, { merge: true });
            setRoom(null);
          } else {
            setRoom(roomData);
          }
        } else {
          // Room doesn't exist anymore, clear it from user profile
          setRoom(null);
          console.warn("Room not found, clearing currentRoomId");
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `rooms/${profile.currentRoomId}`);
      });
      return () => unsubscribe();
    } else {
      setRoom(null);
    }
  }, [profile?.currentRoomId, user]);

  const handleLeaveRoom = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { currentRoomId: null }, { merge: true });
      setRoom(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users/leave-room');
    }
  };

  // Listen to Tasks
  useEffect(() => {
    if (room?.id) {
      const tasksRef = collection(db, 'tasks');
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const q = query(tasksRef, where('roomId', '==', room.id), where('date', '==', dateStr));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        setTasks(items);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'tasks');
      });
      return () => unsubscribe();
    }
  }, [room?.id, selectedDate]);

  // Listen to All Completed Tasks for History
  useEffect(() => {
    if (room?.id && activeView === 'history') {
      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef, 
        where('roomId', '==', room.id), 
        where('status', '==', 'completed'),
        orderBy('date', 'desc'),
        limit(100)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        setCompletedTasks(items);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'completed-tasks');
      });
      return () => unsubscribe();
    }
  }, [room?.id, activeView]);

  // Auto-assign admin for D KRANTHI in room 3OOOK6
  useEffect(() => {
    if (room?.inviteCode === '3OOOK6' && user?.email === 'kranthi95259@gmail.com' && !room.admins?.includes(user.uid)) {
      const assignAdmin = async () => {
        try {
          await updateDoc(doc(db, 'rooms', room.id), {
            admins: [...(room.admins || []), user.uid]
          });
          console.log("Auto-assigned admin for D KRANTHI in room 3OOOK6");
        } catch (err) {
          console.error("Failed to auto-assign admin", err);
        }
      };
      assignAdmin();
    }
  }, [room, user]);

  // Listen to Activities
  useEffect(() => {
    if (room?.id) {
      const activitiesRef = collection(db, 'activities');
      const q = query(activitiesRef, where('roomId', '==', room.id), orderBy('timestamp', 'desc'), limit(20));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
        setActivities(items);
      });
      return () => unsubscribe();
    }
  }, [room?.id]);

  // Listen to Room Members
  useEffect(() => {
    if (room?.members?.length) {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('uid', 'in', room.members));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => doc.data() as UserProfile);
        setRoomMembers(items);
      });
      return () => unsubscribe();
    }
  }, [room?.members]);

  const handleCreateRoom = async (name: string) => {
    if (!user) return;
    try {
      const inviteCode = Math.floor(100000 + Math.random() * 900000).toString();
      const roomData = {
        name,
        createdBy: user.uid,
        admins: [user.uid],
        members: [user.uid],
        inviteCode,
        createdAt: new Date().toISOString()
      };
      const roomRef = await addDoc(collection(db, 'rooms'), roomData);
      await setDoc(doc(db, 'users', user.uid), { currentRoomId: roomRef.id }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'rooms');
    }
  };

  const handleJoinRoom = async (code: string) => {
    if (!user) return;
    try {
      const roomsRef = collection(db, 'rooms');
      const q = query(roomsRef, where('inviteCode', '==', code.toUpperCase()));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const roomDoc = snapshot.docs[0];
        const roomData = roomDoc.data() as Room;
        if (!roomData.members?.includes(user.uid)) {
          await updateDoc(doc(db, 'rooms', roomDoc.id), {
            members: [...(roomData.members || []), user.uid]
          });
        }
        await setDoc(doc(db, 'users', user.uid), { currentRoomId: roomDoc.id }, { merge: true });
      } else {
        setError("Invalid invite code. Please check and try again.");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'rooms/join');
    }
  };

  const handleSwitchRoom = async (roomId: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { currentRoomId: roomId }, { merge: true });
      setIsSwitchRoomOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users/switch-room');
    }
  };

  const handleRemoveUser = async (targetUid: string) => {
    if (!room || !user) return;
    if (!room.admins?.includes(user.uid)) return;
    if (targetUid === user.uid) return; // Can't remove self

    try {
      const newMembers = (room.members || []).filter(id => id !== targetUid);
      const newAdmins = (room.admins || []).filter(id => id !== targetUid);
      await updateDoc(doc(db, 'rooms', room.id), {
        members: newMembers,
        admins: newAdmins
      });
      
      // Log activity
      const targetUser = roomMembers.find(m => m.uid === targetUid);
      await addDoc(collection(db, 'activities'), {
        roomId: room.id,
        userId: user.uid,
        userName: profile?.nickname || "User",
        message: `removed ${targetUser?.nickname || "User"} from the room`,
        timestamp: new Date().toISOString(),
        type: 'log'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${room.id}/remove-user`);
    }
  };

  const handleLeaveGroup = async () => {
    if (!room || !user) return;
    
    const otherMembers = (room.members || []).filter(id => id !== user.uid);
    
    if (room.createdBy === user.uid && otherMembers.length === 0) {
      setError("As the only member and creator, you should delete the room instead of leaving it.");
      return;
    }

    try {
      const newMembers = otherMembers;
      const newAdmins = (room.admins || []).filter(id => id !== user.uid);
      
      const updateData: any = {
        members: newMembers,
        admins: newAdmins
      };

      // Transfer ownership if creator is leaving
      if (room.createdBy === user.uid && newMembers.length > 0) {
        // Prefer another admin, otherwise just the first member
        const otherAdmins = newAdmins;
        updateData.createdBy = otherAdmins.length > 0 ? otherAdmins[0] : newMembers[0];
        
        // Ensure the new creator is also an admin
        if (!updateData.admins.includes(updateData.createdBy)) {
          updateData.admins.push(updateData.createdBy);
        }
      }
      
      await updateDoc(doc(db, 'rooms', room.id), updateData);

      await setDoc(doc(db, 'users', user.uid), { currentRoomId: null }, { merge: true });
      
      // Log activity
      await addDoc(collection(db, 'activities'), {
        roomId: room.id,
        userId: user.uid,
        userName: profile?.nickname || "User",
        message: 'left the group permanently',
        timestamp: new Date().toISOString(),
        type: 'log'
      });

      setRoom(null);
      setIsManageUsersOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${room.id}/leave-group`);
    }
  };

  const handleToggleAdmin = async (targetUid: string) => {
    if (!room || !user) return;
    if (!room.admins?.includes(user.uid)) return;

    try {
      let newAdmins;
      if (room.admins?.includes(targetUid)) {
        if (room.createdBy === targetUid) return; // Can't remove creator from admins
        newAdmins = room.admins.filter(id => id !== targetUid);
      } else {
        newAdmins = [...room.admins, targetUid];
      }
      
      await updateDoc(doc(db, 'rooms', room.id), { admins: newAdmins });
      
      // Log activity
      const targetUser = roomMembers.find(m => m.uid === targetUid);
      const isNowAdmin = newAdmins?.includes(targetUid);
      await addDoc(collection(db, 'activities'), {
        roomId: room.id,
        userId: user.uid,
        userName: profile?.nickname || "User",
        message: `${isNowAdmin ? 'promoted' : 'demoted'} ${targetUser?.nickname || "User"} ${isNowAdmin ? 'to admin' : 'from admin'}`,
        timestamp: new Date().toISOString(),
        type: 'log'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${room.id}/toggle-admin`);
    }
  };

  const handleTransferOwnership = async (targetUid: string) => {
    if (!room || !user) return;
    if (room.createdBy !== user.uid) return;
    if (targetUid === user.uid) return;

    const targetUser = roomMembers.find(m => m.uid === targetUid);
    if (!window.confirm(`Are you sure you want to transfer ownership of "${room.name}" to ${targetUser?.nickname || "User"}? You will remain an admin but will no longer be the owner.`)) {
      return;
    }

    try {
      const newAdmins = Array.from(new Set([...(room.admins || []), targetUid]));
      await updateDoc(doc(db, 'rooms', room.id), { 
        createdBy: targetUid,
        admins: newAdmins
      });
      
      // Log activity
      await addDoc(collection(db, 'activities'), {
        roomId: room.id,
        userId: user.uid,
        userName: profile?.nickname || "User",
        message: `transferred ownership of the group to ${targetUser?.nickname || "User"}`,
        timestamp: new Date().toISOString(),
        type: 'log'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${room.id}/transfer-ownership`);
    }
  };

  const handleDeleteRoom = async (roomId?: string) => {
    const targetRoom = roomId ? userRooms.find(r => r.id === roomId) : room;
    if (!targetRoom || !user) return;
    
    if (targetRoom.createdBy !== user.uid) {
      setError("Only the room creator can delete the room.");
      return;
    }

    setIsDeletingRoom(true);
    try {
      const idToDelete = targetRoom.id;
      // 1. Delete all tasks in the room
      const tasksRef = collection(db, 'tasks');
      const tasksQuery = query(tasksRef, where('roomId', '==', idToDelete));
      const tasksSnapshot = await getDocs(tasksQuery);
      const taskDeletes = tasksSnapshot.docs.map(d => deleteDoc(d.ref));
      
      // 2. Delete all activities in the room
      const activitiesRef = collection(db, 'activities');
      const activitiesQuery = query(activitiesRef, where('roomId', '==', idToDelete));
      const activitiesSnapshot = await getDocs(activitiesQuery);
      const activityDeletes = activitiesSnapshot.docs.map(d => deleteDoc(d.ref));

      // 3. Delete the room itself
      await Promise.all([...taskDeletes, ...activityDeletes]);
      await deleteDoc(doc(db, 'rooms', idToDelete));

      // 4. Update user profile to remove currentRoomId if it was the deleted room
      if (profile?.currentRoomId === idToDelete) {
        await updateDoc(doc(db, 'users', user.uid), { currentRoomId: deleteField() });
        setRoom(null);
      }
      
      setIsManageUsersOpen(false);
      setRoomToDelete(null);
    } catch (err) {
      console.error("Error deleting room:", err);
      handleFirestoreError(err, OperationType.DELETE, `rooms/${targetRoom.id}`);
    } finally {
      setIsDeletingRoom(false);
    }
  };

  const handleUpdateProfile = async (nickname: string, bio: string, avatarUrl: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { 
        nickname,
        bio,
        avatarUrl
      });
      setIsProfileSettingsOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/profile`);
    }
  };

  const handleTakeOverTask = async (task: Task) => {
    if (!room || !user) return;
    try {
      await updateDoc(doc(db, 'tasks', task.id), { assignedTo: user.uid });
      
      // Log activity
      await addDoc(collection(db, 'activities'), {
        roomId: room.id,
        userId: user.uid,
        userName: profile?.nickname || "User",
        message: `took over task: ${task.title}`,
        timestamp: new Date().toISOString(),
        type: 'log'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}/takeover`);
    }
  };

  const handleAddTask = async (title: string, type: Task['type'], assignedTo: string) => {
    if (!room) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        roomId: room.id,
        title,
        type,
        assignedTo,
        status: 'pending',
        date: format(selectedDate, 'yyyy-MM-dd')
      });
      
      // Log activity
      const assignedUser = roomMembers.find(m => m.uid === assignedTo);
      await addDoc(collection(db, 'activities'), {
        roomId: room.id,
        userId: user?.uid,
        userName: profile?.nickname || "User",
        message: `assigned ${title} to ${assignedUser?.nickname || "User"} for ${format(selectedDate, 'MMM do')}`,
        timestamp: new Date().toISOString(),
        type: 'log'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tasks');
    }
  };

  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!room) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      
      // Log activity
      await addDoc(collection(db, 'activities'), {
        roomId: room.id,
        userId: user?.uid,
        userName: profile?.nickname || user?.displayName,
        message: `removed task: ${title}`,
        timestamp: new Date().toISOString(),
        type: 'log'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  const toggleTask = async (task: Task) => {
    if (!room || !user) return;
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    await updateDoc(doc(db, 'tasks', task.id), { status: newStatus });
    
    if (newStatus === 'completed') {
      await addDoc(collection(db, 'activities'), {
        roomId: room.id,
        userId: user.uid,
        userName: profile?.nickname || "User",
        message: `completed task: ${task.title}`,
        timestamp: new Date().toISOString(),
        type: 'log'
      });
    }
  };

  const sendChat = async (message: string) => {
    if (!room || !user) return;
    await addDoc(collection(db, 'activities'), {
      roomId: room.id,
      userId: user.uid,
      userName: profile?.nickname || "User",
      message,
      timestamp: new Date().toISOString(),
      type: 'chat'
    });
  };

  const getRotationInsight = (type: string) => {
    if (!roomMembers.length) return null;
    
    // Filter tasks by type
    const typeTasks = completedTasks.filter(t => t.type === type);
    
    // For each member, find their last completion date
    const memberStats = roomMembers.map(member => {
      const lastTask = typeTasks
        .filter(t => t.assignedTo === member.uid)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      return {
        member,
        lastDate: lastTask ? new Date(lastTask.date) : null,
        count: typeTasks.filter(t => t.assignedTo === member.uid).length
      };
    });

    // Sort by lastDate (oldest first) to find who is "Next"
    // Members who have NEVER done it come first
    const sorted = [...memberStats].sort((a, b) => {
      if (!a.lastDate && !b.lastDate) return 0;
      if (!a.lastDate) return -1;
      if (!b.lastDate) return 1;
      return a.lastDate.getTime() - b.lastDate.getTime();
    });

    return sorted;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-[#5A5A40] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[32px] p-12 shadow-xl text-center"
        >
          <div className="w-20 h-20 bg-[#5A5A40] rounded-full flex items-center justify-center mx-auto mb-8">
            <Home className="text-white w-10 h-10" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-[#1a1a1a] mb-4">RoomMate</h1>
          <p className="text-[#5A5A40] mb-12 italic">The smart way to manage your student room chores.</p>
          <button 
            onClick={signInWithGoogle}
            className="w-full bg-[#5A5A40] text-white rounded-full py-4 px-8 font-medium flex items-center justify-center gap-3 hover:bg-[#4A4A30] transition-colors"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 bg-white rounded-full p-1" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (!profile?.currentRoomId || !room) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl w-full mb-8 bg-white rounded-[32px] p-8 shadow-lg"
        >
          <div className="flex flex-col md:flex-row items-center gap-6 pb-8 border-b border-gray-100 mb-8">
            <img 
              src={profile?.avatarUrl || profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`} 
              className="w-20 h-20 rounded-full border-4 border-white shadow-md object-cover" 
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-serif font-bold">Welcome, {profile?.nickname || profile?.displayName}</h2>
              <p className="text-gray-500 text-sm mb-4">Customize your profile so your roommates know who you are.</p>
              <div className="flex items-center gap-2 max-w-xs mx-auto md:mx-0">
                <input 
                  type="text"
                  defaultValue={profile?.nickname || ''}
                  placeholder="Your Username"
                  className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none"
                  onBlur={(e) => handleUpdateProfile(e.target.value, profile?.bio || '', profile?.avatarUrl || '')}
                />
                <Sparkles size={18} className="text-[#5A5A40]" />
              </div>
            </div>
          </div>

          {userRooms.length > 0 && (
            <>
              <h2 className="text-xl font-serif font-bold mb-6">Your Rooms</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {userRooms.map(r => (
                  <div key={r.id} className="group relative">
                    <button 
                      onClick={() => handleSwitchRoom(r.id)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:border-[#5A5A40] hover:bg-gray-50 transition-all text-left pr-12"
                    >
                      <div>
                        <p className="font-bold">{r.name}</p>
                        <p className="text-xs text-gray-500">{r.members.length} members</p>
                      </div>
                      <ArrowRight size={18} className="text-gray-400" />
                    </button>
                    {r.createdBy === user?.uid && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setRoomToDelete(r);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete Room"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>

        {profile?.currentRoomId && !room ? (
          <div className="text-center space-y-4">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-4 border-[#5A5A40] border-t-transparent rounded-full mx-auto"
            />
            <p className="text-gray-500 italic">Finding your room...</p>
            <button 
              onClick={handleLeaveRoom}
              className="text-sm text-[#5A5A40] underline"
            >
              Stuck? Click here to go back
            </button>
          </div>
        ) : (
          <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-[32px] p-10 shadow-lg"
            >
              <h2 className="text-2xl font-serif font-bold mb-6">Create a Room</h2>
              <p className="text-gray-600 mb-8">Start a new shared space and invite your roommates.</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const name = (e.target as any).roomName.value;
                if (name) handleCreateRoom(name);
              }}>
                <input 
                  name="roomName"
                  placeholder="Room Name (e.g. Flat 302)"
                  className="w-full border-b-2 border-gray-200 py-3 mb-8 focus:border-[#5A5A40] outline-none transition-colors"
                  required
                />
                <button className="w-full bg-[#5A5A40] text-white rounded-full py-4 font-medium hover:bg-[#4A4A30] transition-colors">
                  Create Room
                </button>
              </form>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-[32px] p-10 shadow-lg"
            >
              <h2 className="text-2xl font-serif font-bold mb-6">Join a Room</h2>
              <p className="text-gray-600 mb-8">Enter an invite code to join your friends.</p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const code = (e.target as any).inviteCode.value;
                if (code) handleJoinRoom(code);
              }}>
                <input 
                  name="inviteCode"
                  placeholder="Invite Code (e.g. 123456)"
                  className="w-full border-b-2 border-gray-200 py-3 mb-8 focus:border-[#5A5A40] outline-none transition-colors"
                  required
                />
                <button className="w-full border-2 border-[#5A5A40] text-[#5A5A40] rounded-full py-4 font-medium hover:bg-[#5A5A40] hover:text-white transition-all">
                  Join Room
                </button>
              </form>
            </motion.div>
          </div>
        )}
        <button onClick={logout} className="mt-12 text-gray-500 flex items-center gap-2 hover:text-[#5A5A40]">
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    );
  }

  const filteredTasks = tasks.filter(task => {
    const userMatch = filterUser === "all" || task.assignedTo === filterUser;
    const typeMatch = filterType === "all" || task.type === filterType;
    return userMatch && typeMatch;
  });

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1a1a1a]">
      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2"
          >
            <Info size={18} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 -ml-2 text-gray-500 hover:text-[#5A5A40] transition-colors"
            >
              <Menu size={24} />
            </button>
            <button 
              onClick={() => setIsSwitchRoomOpen(true)}
              className="w-8 h-8 sm:w-10 sm:h-10 bg-[#5A5A40] rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              title="Switch Room"
            >
              <Home className="text-white w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="min-w-0">
              <h1 className="font-serif font-bold text-base sm:text-xl truncate">{room?.name}</h1>
              <p className="text-[10px] text-[#5A5A40] font-medium tracking-widest uppercase">Code: {room?.inviteCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button 
                onClick={() => setActiveView('room')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  activeView === 'room' ? "bg-white text-[#5A5A40] shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveView('history')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                  activeView === 'history' ? "bg-white text-[#5A5A40] shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                History
              </button>
            </nav>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-3 p-1.5 rounded-2xl hover:bg-gray-50 transition-all"
                >
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-[#5A5A40]">
                      {profile?.nickname || "Set Username"}
                    </p>
                    {profile?.bio && <p className="text-[10px] text-gray-400 truncate max-w-[100px]">{profile.bio}</p>}
                  </div>
                  <div className="relative">
                    <img 
                      src={profile?.avatarUrl || profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`}
                      className="w-10 h-10 rounded-full border-2 border-white object-cover shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-gray-100">
                      <ChevronDown size={10} className={cn("transition-transform", isUserMenuOpen && "rotate-180")} />
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isUserMenuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsUserMenuOpen(false)} 
                      />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
                      >
                        <div className="p-2">
                          <button 
                            onClick={() => {
                              setIsProfileSettingsOpen(true);
                              setIsUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
                          >
                            <Settings size={18} />
                            Profile Settings
                          </button>
                          <button 
                            onClick={() => {
                              setIsManageUsersOpen(true);
                              setIsUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
                          >
                            <Users size={18} />
                            {room?.admins?.includes(user?.uid || '') ? "Manage Users" : "Group Members"}
                          </button>
                          <div className="h-px bg-gray-100 my-2 mx-2" />
                          <button 
                            onClick={() => {
                              handleLeaveRoom();
                              setIsUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
                          >
                            <LogOut size={18} />
                            Exit Current Room
                          </button>
                          <button 
                            onClick={logout}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
                          >
                            <LogOut size={18} className="rotate-180" />
                            Sign Out
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block" />

              <div className="flex -space-x-2">
                {roomMembers.map(member => (
                  <img 
                    key={member.uid}
                    src={member.avatarUrl || member.photoURL || `https://ui-avatars.com/api/?name=${member.displayName}`}
                    className="w-8 h-8 rounded-full border-2 border-white object-cover"
                    title={member.nickname || "User"}
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-64 bg-white z-50 shadow-2xl md:hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#5A5A40] rounded-full flex items-center justify-center">
                    <Home className="text-white w-4 h-4" />
                  </div>
                  <span className="font-serif font-bold text-lg">RoomMate</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 space-y-2 flex-grow">
                <button 
                  onClick={() => {
                    setActiveView('room');
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-all",
                    activeView === 'room' ? "bg-[#5A5A40] text-white shadow-md" : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Home size={20} />
                  Dashboard
                </button>
                <button 
                  onClick={() => {
                    setActiveView('history');
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition-all",
                    activeView === 'history' ? "bg-[#5A5A40] text-white shadow-md" : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <CalendarIcon size={20} />
                  History
                </button>
              </div>

              <div className="p-6 border-t border-gray-100 space-y-4">
                <div className="flex items-center gap-3">
                  <img 
                    src={profile?.avatarUrl || profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`}
                    className="w-10 h-10 rounded-full border border-gray-200 object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{profile?.nickname || "User"}</p>
                    <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
                  </div>
                </div>
                <button 
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium text-red-500 hover:bg-red-50 transition-all"
                >
                  <LogOut size={20} />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {isProfileSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileSettingsOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-serif font-bold">Profile Settings</h2>
                <button onClick={() => setIsProfileSettingsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleUpdateProfile(
                  formData.get('nickname') as string,
                  formData.get('bio') as string,
                  formData.get('avatarUrl') as string
                );
              }} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Choose Avatar</label>
                  <div className="grid grid-cols-4 gap-3">
                    {CURATED_AVATARS.map((url) => (
                      <label key={url} className="relative cursor-pointer group">
                        <input 
                          type="radio" 
                          name="avatarUrl" 
                          value={url} 
                          className="peer sr-only" 
                          defaultChecked={profile?.avatarUrl === url}
                        />
                        <div className="w-full aspect-square rounded-2xl border-2 border-transparent peer-checked:border-[#5A5A40] peer-checked:bg-gray-50 group-hover:bg-gray-50 transition-all overflow-hidden">
                          <img src={url} className="w-full h-full object-cover" alt="Avatar" />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                          <div className="bg-[#5A5A40] text-white rounded-full p-1 shadow-lg">
                            <CheckCircle2 size={12} />
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Nickname</label>
                    <input 
                      name="nickname"
                      defaultValue={profile?.nickname}
                      placeholder="Your nickname"
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Bio</label>
                    <textarea 
                      name="bio"
                      defaultValue={profile?.bio}
                      placeholder="Tell us about yourself..."
                      rows={3}
                      className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all resize-none"
                    />
                  </div>
                </div>

                <button className="w-full bg-[#5A5A40] text-white rounded-full py-4 font-bold shadow-lg shadow-[#5A5A40]/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  Save Changes
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isSwitchRoomOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSwitchRoomOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-serif font-bold">Switch Room</h2>
                <button onClick={() => setIsSwitchRoomOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
              </div>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {userRooms.map(r => (
                  <button 
                    key={r.id}
                    onClick={() => handleSwitchRoom(r.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                      r.id === room?.id ? "border-[#5A5A40] bg-gray-50" : "border-gray-100 hover:bg-gray-50"
                    )}
                  >
                    <div>
                      <p className="font-bold">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.members.length} members</p>
                    </div>
                    {r.id === room?.id && <CheckCircle2 size={18} className="text-[#5A5A40]" />}
                  </button>
                ))}
                <button 
                  onClick={() => {
                    handleLeaveRoom();
                    setIsSwitchRoomOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border border-dashed border-gray-200 text-gray-500 hover:bg-gray-50 transition-all"
                >
                  <Plus size={18} />
                  <span>Create or Join New Room</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isManageUsersOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManageUsersOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-serif font-bold">
                  {room?.admins?.includes(user?.uid || '') ? "Manage Users" : "Group Members"}
                </h2>
                <button onClick={() => setIsManageUsersOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
              </div>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {roomMembers.map(member => (
                    <div key={member.uid} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50">
                      <div className="flex items-center gap-3">
                        <img 
                          src={member.avatarUrl || member.photoURL || `https://ui-avatars.com/api/?name=${member.displayName}`}
                          className="w-10 h-10 rounded-full border border-gray-200 object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <p className="font-bold text-sm">{member.nickname || "User"}</p>
                          {member.bio && <p className="text-[10px] text-gray-400 line-clamp-1">{member.bio}</p>}
                          <p className="text-[10px] text-gray-500">
                            {room?.admins?.includes(member.uid) ? 'Admin' : 'Member'}
                            {room?.createdBy === member.uid && ' (Creator)'}
                          </p>
                        </div>
                      </div>
                    <div className="flex items-center gap-2">
                      {user?.uid === member.uid ? (
                        <button 
                          onClick={handleLeaveGroup}
                          className="text-xs font-bold px-3 py-1 rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition-all"
                        >
                          Leave Group
                        </button>
                      ) : (
                        <>
                          {room?.createdBy === user?.uid && (
                            <button 
                              onClick={() => handleTransferOwnership(member.uid)}
                              className="p-2 text-gray-400 hover:text-amber-500 transition-colors"
                              title="Transfer Ownership"
                            >
                              <Crown size={18} />
                            </button>
                          )}
                          {room?.admins?.includes(user?.uid || '') && (
                            <>
                              <button 
                                onClick={() => handleToggleAdmin(member.uid)}
                                className={cn(
                                  "text-xs font-bold px-3 py-1 rounded-full border transition-all",
                                  room?.admins?.includes(member.uid) 
                                    ? "border-gray-200 text-gray-500 hover:bg-white" 
                                    : "border-[#5A5A40] text-[#5A5A40] hover:bg-[#5A5A40] hover:text-white"
                                )}
                              >
                                {room?.admins?.includes(member.uid) ? 'Revoke Admin' : 'Make Admin'}
                              </button>
                              <button 
                                onClick={() => handleRemoveUser(member.uid)}
                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                title="Remove from Room"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 bg-gray-100 rounded-2xl space-y-4">
                <p className="text-xs text-gray-500 text-center">
                  Invite Code: <span className="font-mono font-bold text-[#5A5A40]">{room?.inviteCode}</span>
                </p>
                {room?.createdBy === user?.uid && (
                  <button 
                    onClick={() => setRoomToDelete(room)}
                    disabled={isDeletingRoom}
                    className={cn(
                      "w-full py-3 px-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2",
                      isDeletingRoom ? "opacity-50 cursor-not-allowed" : "hover:bg-red-100"
                    )}
                  >
                    <Trash2 size={16} />
                    Delete Room Permanently
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {roomToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-serif font-bold text-center mb-2">Delete Room?</h3>
              <p className="text-gray-500 text-center text-sm mb-8">
                Are you sure you want to permanently delete <span className="font-bold text-gray-900">"{roomToDelete.name}"</span>? 
                This will remove all tasks and activity history. This action cannot be undone.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleDeleteRoom(roomToDelete.id)}
                  disabled={isDeletingRoom}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeletingRoom && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {isDeletingRoom ? 'Deleting...' : 'Yes, Delete Permanently'}
                </button>
                <button 
                  onClick={() => setRoomToDelete(null)}
                  disabled={isDeletingRoom}
                  className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto p-6">
        {activeView === 'room' ? (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column: Tasks */}
            <div className="lg:col-span-2 space-y-8">
              <section className="bg-white rounded-[32px] p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-serif font-bold">
                      {isSameDay(selectedDate, new Date()) ? "Today's Chores" : `Chores for ${format(selectedDate, 'MMM do')}`}
                    </h2>
                    <button 
                      onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        isCalendarOpen ? "bg-[#5A5A40] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      <CalendarIcon size={20} />
                    </button>
                  </div>
                  <span className="text-sm text-gray-400">{format(selectedDate, 'EEEE, MMM do')}</span>
                </div>

                <AnimatePresence>
                  {isCalendarOpen && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-8"
                    >
                      <div className="bg-gray-50 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-[#5A5A40]">{format(selectedDate, 'MMMM yyyy')}</h3>
                          <div className="flex gap-2">
                            <button onClick={() => setSelectedDate(subMonths(selectedDate, 1))} className="p-1 hover:bg-gray-200 rounded-lg"><ChevronLeft size={20} /></button>
                            <button onClick={() => setSelectedDate(addMonths(selectedDate, 1))} className="p-1 hover:bg-gray-200 rounded-lg"><ChevronRight size={20} /></button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-400 uppercase mb-2">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {(() => {
                            const monthStart = startOfMonth(selectedDate);
                            const monthEnd = endOfMonth(monthStart);
                            const startDate = startOfWeek(monthStart);
                            const endDate = endOfWeek(monthEnd);
                            const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

                            return calendarDays.map(day => (
                              <button
                                key={day.toString()}
                                onClick={() => setSelectedDate(day)}
                                className={cn(
                                  "aspect-square flex items-center justify-center rounded-xl text-sm transition-all relative",
                                  !isSameMonth(day, monthStart) && "text-gray-300",
                                  isSameDay(day, selectedDate) && "bg-[#5A5A40] text-white font-bold shadow-md",
                                  isSameDay(day, new Date()) && !isSameDay(day, selectedDate) && "text-[#5A5A40] font-bold border border-[#5A5A40]/20",
                                  !isSameDay(day, selectedDate) && isSameMonth(day, monthStart) && "hover:bg-gray-200"
                                )}
                              >
                                {format(day, 'd')}
                              </button>
                            ));
                          })()}
                        </div>
                        <div className="mt-4 flex justify-end">
                          <button 
                            onClick={() => {
                              setSelectedDate(new Date());
                              setIsCalendarOpen(false);
                            }}
                            className="text-xs font-bold text-[#5A5A40] hover:underline"
                          >
                            Back to Today
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Filter by Member</label>
                    <select 
                      value={filterUser}
                      onChange={(e) => setFilterUser(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-xl text-xs font-medium py-2 px-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                    >
                      <option value="all">Everyone</option>
                      {roomMembers.map(member => (
                        <option key={member.uid} value={member.uid}>{member.nickname || "User"}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Filter by Type</label>
                    <select 
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-xl text-xs font-medium py-2 px-3 focus:ring-2 focus:ring-[#5A5A40]/20"
                    >
                      <option value="all">All Types</option>
                      <option value="garbage">Garbage</option>
                      <option value="water">Water</option>
                      <option value="milk">Milk</option>
                      <option value="banana">Banana</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  {filteredTasks.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-3xl">
                      <p className="text-gray-400">
                        {tasks.length === 0 ? "No tasks for this date." : "No tasks match your filters."}
                      </p>
                    </div>
                  ) : (
                    filteredTasks.map(task => (
                      <motion.div 
                        layout
                        key={task.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all group",
                          task.status === 'completed' ? "bg-gray-50 border-transparent opacity-60" : "bg-white border-gray-100 shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <button onClick={() => toggleTask(task)} className="text-[#5A5A40]">
                            {task.status === 'completed' ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                          </button>
                          <div>
                            <h3 className={cn("font-medium", task.status === 'completed' && "line-through")}>{task.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500 capitalize">{task.type}</span>
                              <span className="text-xs text-gray-400">
                                Assigned to: {(() => {
                                  const assignedUser = roomMembers.find(m => m.uid === task.assignedTo);
                                  return assignedUser?.nickname || 'User';
                                })()}
                              </span>
                              {task.assignedTo !== user?.uid && task.status === 'pending' && (
                                <button 
                                  onClick={() => handleTakeOverTask(task)}
                                  className="text-[10px] font-bold text-[#5A5A40] hover:underline uppercase tracking-tighter"
                                >
                                  Take Over
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-[#5A5A40]">
                            {task.type === 'garbage' && <Trash2 size={18} />}
                            {task.type === 'water' && <Droplets size={18} />}
                            {task.type === 'milk' && <Milk size={18} />}
                            {task.type === 'banana' && <Banana size={18} />}
                          </div>
                          <button 
                            onClick={() => handleDeleteTask(task.id, task.title)}
                            className="p-2 text-gray-300 hover:text-red-500 transition-all"
                            title="Delete Task"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Add Task Form */}
                <div className="pt-8 border-t border-gray-100">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4">Add New Task</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as any;
                    handleAddTask(form.title.value, form.type.value, form.assignedTo.value);
                    form.reset();
                  }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <input name="title" placeholder="Task title..." className="col-span-2 md:col-span-1 border-b border-gray-200 py-2 outline-none focus:border-[#5A5A40]" required />
                    <select name="type" className="border-b border-gray-200 py-2 outline-none focus:border-[#5A5A40] bg-transparent">
                      <option value="garbage">Garbage</option>
                      <option value="water">Water</option>
                      <option value="milk">Milk</option>
                      <option value="banana">Banana</option>
                      <option value="other">Other</option>
                    </select>
                    <select name="assignedTo" className="border-b border-gray-200 py-2 outline-none focus:border-[#5A5A40] bg-transparent">
                      {roomMembers.map(m => (
                        <option key={m.uid} value={m.uid}>{m.nickname || "User"}</option>
                      ))}
                    </select>
                    <button className="bg-[#5A5A40] text-white rounded-full py-2 px-4 flex items-center justify-center gap-2 hover:bg-[#4A4A30]">
                      <Plus size={18} /> Add
                    </button>
                  </form>
                </div>
              </section>
            </div>

            {/* Right Column: Activity & Chat */}
            <div className="space-y-8">
              <section className="bg-white rounded-[32px] p-8 shadow-sm h-[600px] flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <MessageSquare className="text-[#5A5A40]" />
                  <h2 className="text-2xl font-serif font-bold">Room Feed</h2>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 custom-scrollbar">
                  {activities.map(activity => (
                    <div key={activity.id} className={cn(
                      "p-3 rounded-2xl",
                      activity.type === 'chat' ? "bg-gray-50 ml-4" : "bg-[#F5F5F0] mr-4 text-xs italic text-gray-500"
                    )}>
                      {activity.type === 'chat' && (
                        <p className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider mb-1">{activity.userName}</p>
                      )}
                      <p className="text-sm">{activity.message}</p>
                      <p className="text-[9px] text-gray-400 mt-1">{format(new Date(activity.timestamp), 'HH:mm')}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.target as any).message;
                  if (input.value) {
                    sendChat(input.value);
                    input.value = '';
                  }
                }} className="relative">
                  <input 
                    name="message"
                    placeholder="Share something..."
                    className="w-full bg-gray-100 rounded-full py-4 pl-6 pr-12 outline-none focus:ring-2 ring-[#5A5A40]/20"
                  />
                  <button className="absolute right-2 top-2 w-10 h-10 bg-[#5A5A40] text-white rounded-full flex items-center justify-center hover:bg-[#4A4A30]">
                    <ArrowRight size={18} />
                  </button>
                </form>
              </section>

              <section className="bg-white rounded-[32px] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <Users className="text-[#5A5A40]" />
                  <h2 className="text-2xl font-serif font-bold">Roommates</h2>
                </div>
                <div className="space-y-4">
                  {roomMembers.map(member => (
                    <div key={member.uid} className="flex items-center gap-3">
                      <img 
                        src={member.avatarUrl || member.photoURL || `https://ui-avatars.com/api/?name=${member.displayName}`}
                        className="w-10 h-10 rounded-full border border-gray-100 object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="font-bold text-sm">{member.nickname || member.displayName}</p>
                        {member.bio && <p className="text-[10px] text-gray-400 line-clamp-1">{member.bio}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <AdBanner />
            </div>
          </div>
        ) : (
          /* History View */
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-4xl font-serif font-bold mb-2">Task History</h2>
                <p className="text-gray-500">Review all completed tasks in this room.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Roommate</label>
                  <select 
                    value={historyFilterUser} 
                    onChange={(e) => setHistoryFilterUser(e.target.value)}
                    className="bg-white border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold text-[#5A5A40] outline-none shadow-sm"
                  >
                    <option value="all">All Roommates</option>
                    {roomMembers.map(m => (
                      <option key={m.uid} value={m.uid}>{m.nickname || "User"}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Type</label>
                  <select 
                    value={historyFilterType} 
                    onChange={(e) => setHistoryFilterType(e.target.value)}
                    className="bg-white border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold text-[#5A5A40] outline-none shadow-sm"
                  >
                    <option value="all">All Types</option>
                    <option value="garbage">Garbage</option>
                    <option value="water">Water</option>
                    <option value="milk">Milk</option>
                    <option value="banana">Banana</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Timeframe</label>
                  <select 
                    value={historyDays} 
                    onChange={(e) => setHistoryDays(Number(e.target.value))}
                    className="bg-white border border-gray-100 rounded-xl px-4 py-2 text-xs font-bold text-[#5A5A40] outline-none shadow-sm"
                  >
                    <option value={7}>Last 7 Days</option>
                    <option value={14}>Last 14 Days</option>
                    <option value={30}>Last 30 Days</option>
                    <option value={90}>Last 90 Days</option>
                    <option value={0}>All Time</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Rotation Insight Section */}
            <div className="bg-[#5A5A40] rounded-[32px] p-8 text-white shadow-xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Trash2 size={120} />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles size={20} className="text-yellow-400" />
                  <h3 className="text-xl font-serif font-bold">Rotation Insight: {historyFilterType === 'all' ? 'Garbage' : historyFilterType.charAt(0).toUpperCase() + historyFilterType.slice(1)}</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <p className="text-white/70 text-sm mb-4">Based on history, here is who hasn't done this task for the longest time:</p>
                    <div className="space-y-3">
                      {getRotationInsight(historyFilterType === 'all' ? 'garbage' : historyFilterType)?.map((stat, idx) => (
                        <div key={stat.member.uid} className={cn(
                          "flex items-center justify-between p-3 rounded-2xl transition-all",
                          idx === 0 ? "bg-white/20 border border-white/30" : "bg-white/5"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img 
                                src={stat.member.avatarUrl || stat.member.photoURL || `https://ui-avatars.com/api/?name=${stat.member.displayName}`}
                                className="w-8 h-8 rounded-full border border-white/20 object-cover"
                                referrerPolicy="no-referrer"
                              />
                              {idx === 0 && (
                                <div className="absolute -top-1 -right-1 bg-yellow-400 text-[#5A5A40] rounded-full p-0.5 shadow-sm">
                                  <ArrowRight size={10} />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold">{stat.member.nickname || "User"}</p>
                              <p className="text-[10px] text-white/50">
                                {stat.lastDate ? `Last done: ${format(stat.lastDate, 'MMM do')}` : 'Never done'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {idx === 0 ? (
                              <span className="text-[10px] font-bold bg-yellow-400 text-[#5A5A40] px-2 py-0.5 rounded-full uppercase tracking-tighter">Next Up</span>
                            ) : (
                              <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">{stat.count} times</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-black/10 rounded-2xl p-6 flex flex-col justify-center">
                    <h4 className="text-lg font-serif italic mb-2">"Fairness is key."</h4>
                    <p className="text-white/70 text-sm leading-relaxed">
                      {(() => {
                        const insight = getRotationInsight(historyFilterType === 'all' ? 'garbage' : historyFilterType);
                        if (!insight || insight.length === 0) return "Start completing tasks to see rotation insights!";
                        const next = insight[0];
                        return `It looks like ${next.member.nickname || 'User'} is up next for ${historyFilterType === 'all' ? 'garbage' : historyFilterType}. They ${next.lastDate ? `last did it on ${format(next.lastDate, 'MMMM do')}` : 'haven\'t done this task yet'}.`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[32px] p-4 sm:p-8 shadow-sm border border-gray-100 overflow-hidden">
              <div className="hidden sm:grid grid-cols-12 gap-4 pb-4 border-b border-gray-100 mb-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4">
                <div className="col-span-1">Icon</div>
                <div className="col-span-4">Task</div>
                <div className="col-span-3">Assigned To</div>
                <div className="col-span-3">Completed Date</div>
                <div className="col-span-1 text-right">Status</div>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {completedTasks
                  .filter(t => {
                    const userMatch = historyFilterUser === 'all' || t.assignedTo === historyFilterUser;
                    const typeMatch = historyFilterType === 'all' || t.type === historyFilterType;
                    
                    const taskDate = new Date(t.date);
                    const now = new Date();
                    const diffTime = Math.abs(now.getTime() - taskDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const daysMatch = historyDays === 0 || diffDays <= historyDays;
                    
                    return userMatch && typeMatch && daysMatch;
                  })
                  .map(task => (
                    <div 
                      key={task.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-center p-4 rounded-2xl hover:bg-gray-50 transition-all border border-gray-50 sm:border-transparent hover:border-gray-100"
                    >
                      <div className="hidden sm:block col-span-1">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-[#5A5A40]">
                          {task.type === 'garbage' && <Trash2 size={18} />}
                          {task.type === 'water' && <Droplets size={18} />}
                          {task.type === 'milk' && <Milk size={18} />}
                          {task.type === 'banana' && <Banana size={18} />}
                          {task.type === 'other' && <Plus size={18} />}
                        </div>
                      </div>
                      <div className="col-span-1 sm:col-span-4">
                        <div className="flex items-center justify-between sm:block">
                          <div>
                            <p className="font-bold text-gray-900">{task.title}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-tighter">{task.type}</p>
                          </div>
                          <div className="sm:hidden">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-bold uppercase">
                              <CheckCircle2 size={10} /> Done
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-1 sm:col-span-3">
                        <div className="flex items-center gap-2">
                          <img 
                            src={roomMembers.find(m => m.uid === task.assignedTo)?.avatarUrl || roomMembers.find(m => m.uid === task.assignedTo)?.photoURL || `https://ui-avatars.com/api/?name=User`}
                            className="w-6 h-6 rounded-full border border-gray-200 object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-sm font-medium text-gray-600">
                            {roomMembers.find(m => m.uid === task.assignedTo)?.nickname || "User"}
                          </span>
                        </div>
                      </div>
                      <div className="col-span-1 sm:col-span-3">
                        <div className="flex items-center justify-between sm:block">
                          <span className="text-xs sm:text-sm text-gray-500 font-medium">
                            {format(new Date(task.date), 'MMM do, yyyy')}
                          </span>
                          <div className="sm:hidden flex items-center gap-1 text-[#5A5A40]">
                            {task.type === 'garbage' && <Trash2 size={14} />}
                            {task.type === 'water' && <Droplets size={14} />}
                            {task.type === 'milk' && <Milk size={14} />}
                            {task.type === 'banana' && <Banana size={14} />}
                            {task.type === 'other' && <Plus size={14} />}
                          </div>
                        </div>
                      </div>
                      <div className="hidden sm:block col-span-1 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-bold uppercase">
                          <CheckCircle2 size={10} /> Done
                        </span>
                      </div>
                    </div>
                  ))}

                {completedTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 size={32} />
                    </div>
                    <p className="font-serif italic">No completed tasks found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Simple Summary Stats */}
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Completed</p>
                <p className="text-4xl font-serif font-bold text-[#5A5A40]">{completedTasks.length}</p>
              </div>
              <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Most Active Type</p>
                <p className="text-2xl font-serif font-bold text-[#5A5A40]">
                  {(() => {
                    const counts: any = {};
                    completedTasks.forEach(t => counts[t.type] = (counts[t.type] || 0) + 1);
                    const top = Object.entries(counts).sort((a: any, b: any) => b[1] - a[1])[0];
                    return top ? `${top[0]} (${top[1]})` : 'N/A';
                  })()}
                </p>
              </div>
              <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Top Contributor</p>
                <p className="text-2xl font-serif font-bold text-[#5A5A40]">
                  {(() => {
                    const counts: any = {};
                    completedTasks.forEach(t => counts[t.assignedTo] = (counts[t.assignedTo] || 0) + 1);
                    const top = Object.entries(counts).sort((a: any, b: any) => b[1] - a[1])[0];
                    if (!top) return 'N/A';
                    const user = roomMembers.find(m => m.uid === top[0]);
                    return `${user?.nickname || 'User'} (${top[1]})`;
                  })()}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
