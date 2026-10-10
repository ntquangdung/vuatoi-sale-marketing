import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
}

const missing = Object.entries(config).filter(([, value]) => !value || value.startsWith('your-')).map(([key]) => key)
export const firebaseConfigError = missing.length
  ? `Thiếu cấu hình Firebase: ${missing.join(', ')}. Điền .env.local theo README rồi khởi động lại ứng dụng.`
  : null

export const firebaseApp: FirebaseApp | null = !firebaseConfigError ? initializeApp(config) : null
export const firebaseAuth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null
export const firestore: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null
