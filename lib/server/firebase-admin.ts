import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export function getFirebaseAdminAuth() {
  if (!getApps().length) {
    const projectId = required("FIREBASE_PROJECT_ID")
    const clientEmail = required("FIREBASE_CLIENT_EMAIL")
    const privateKey = required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n")

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    })
  }

  return getAuth()
}

