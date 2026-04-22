"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, type Messaging } from "firebase/messaging";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_LH_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_LH_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_LH_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_LH_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_LH_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_LH_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_LH_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.NEXT_PUBLIC_LH_FIREBASE_RTDB_URL,
};

const app = getApps().find((a) => a.name === "learnhub") ?? initializeApp(firebaseConfig, "learnhub");

export const firebaseApp = app;
export const firestore = getFirestore(app);
export const firebaseAuth = getAuth(app);
export const rtdb = getDatabase(app);

export function getLearnHubMessaging(): Messaging | null {
  if (typeof window === "undefined") return null;
  try {
    return getMessaging(app);
  } catch {
    return null;
  }
}
