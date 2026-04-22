"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface LHNotification {
  id: string;
  event: string;
  title: string;
  body: string;
  targetRoute: string;
  read: boolean;
  createdAt: number;
}

interface NotifCtx {
  notifications: LHNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotif: (id: string) => void;
}

const NotifContext = createContext<NotifCtx>({
  notifications: [],
  unreadCount: 0,
  markRead: () => {},
  markAllRead: () => {},
  clearNotif: () => {},
});

export function useNotifications() {
  return useContext(NotifContext);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<LHNotification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Get user ID from session on mount
  useEffect(() => {
    fetch("/api/learnhub/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data.type === "session") {
          setUserId(data.session.sub);
        }
      })
      .catch(() => {});
  }, []);

  // Subscribe to Firestore notifications once we have a userId
  useEffect(() => {
    if (!userId) return;

    let unsubscribe: (() => void) | null = null;

    (async () => {
      try {
        const { firestore, firebaseAuth } = await import(
          "@/lib/learnhub/firebase/config"
        );
        const { signInWithCustomToken } = await import("firebase/auth");
        const { collection, onSnapshot, orderBy, query, limit } = await import(
          "firebase/firestore"
        );

        // Mint and use Firebase custom token for Firestore auth
        const tokenRes = await fetch("/api/learnhub/auth/firebase-token", {
          method: "POST",
        });
        if (tokenRes.ok) {
          const { token } = await tokenRes.json();
          await signInWithCustomToken(firebaseAuth, token);
        }

        const notifRef = collection(
          firestore,
          "learnhub_notifications",
          userId,
          "items"
        );
        const q = query(notifRef, orderBy("createdAt", "desc"), limit(50));

        unsubscribe = onSnapshot(q, (snapshot) => {
          const notifs: LHNotification[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<LHNotification, "id">),
          }));
          setNotifications(notifs);
        });
      } catch (err) {
        console.warn("[LearnHub] Notification subscription failed:", err);
      }
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userId]);

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      if (!userId) return;
      try {
        const { firestore } = await import("@/lib/learnhub/firebase/config");
        const { doc, updateDoc } = await import("firebase/firestore");
        await updateDoc(
          doc(firestore, "learnhub_notifications", userId, "items", id),
          { read: true }
        );
      } catch {}
    },
    [userId]
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (!userId) return;
    try {
      const { firestore } = await import("@/lib/learnhub/firebase/config");
      const { collection, getDocs, writeBatch, doc } = await import(
        "firebase/firestore"
      );
      const batch = writeBatch(firestore);
      const snap = await getDocs(
        collection(firestore, "learnhub_notifications", userId, "items")
      );
      snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
      await batch.commit();
    } catch {}
  }, [userId]);

  const clearNotif = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (!userId) return;
      try {
        const { firestore } = await import("@/lib/learnhub/firebase/config");
        const { doc, deleteDoc } = await import("firebase/firestore");
        await deleteDoc(
          doc(firestore, "learnhub_notifications", userId, "items", id)
        );
      } catch {}
    },
    [userId]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotifContext.Provider
      value={{ notifications, unreadCount, markRead, markAllRead, clearNotif }}
    >
      {children}
    </NotifContext.Provider>
  );
}
