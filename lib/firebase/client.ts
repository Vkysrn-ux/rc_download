import { getApps, initializeApp, type FirebaseApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export function getFirebaseClientApp(): FirebaseApp {
  const existing = getApps()[0]
  if (existing) return existing

  const apiKey = required(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, "NEXT_PUBLIC_FIREBASE_API_KEY")
  const authDomain = required(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN")
  const projectId = required(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "NEXT_PUBLIC_FIREBASE_PROJECT_ID")
  const appId = required(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, "NEXT_PUBLIC_FIREBASE_APP_ID")

  return initializeApp({
    apiKey,
    authDomain,
    projectId,
    appId,
  })
}

export function getFirebaseClientAuth(): Auth {
  return getAuth(getFirebaseClientApp())
}
