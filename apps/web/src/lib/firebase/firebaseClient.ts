import { env } from "@/config/env";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

export function isFirebaseConfigured() {
  return Boolean(
    env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    env.NEXT_PUBLIC_FIREBASE_APP_ID
  );
}

function getFirebaseApp() {
  if (!isFirebaseConfigured()) throw new Error("FIREBASE_NOT_CONFIGURED");

  if (getApps().length) return getApp();

  return initializeApp({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}
