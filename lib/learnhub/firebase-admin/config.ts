import admin from "firebase-admin"

function getAdminApp(): admin.app.App {
  const existing = admin.apps.find((a) => a?.name === "learnhub-admin")
  if (existing) return existing

  const privateKey = process.env.LH_FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n")

  return admin.initializeApp(
    {
      credential: admin.credential.cert({
        projectId: process.env.LH_FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.LH_FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
    },
    "learnhub-admin"
  )
}

export const adminApp = new Proxy({} as admin.app.App, {
  get(_t, prop) { return (getAdminApp() as any)[prop] }
})

export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(_t, prop) { return (getAdminApp().auth() as any)[prop] }
})

export const adminFirestore = new Proxy({} as admin.firestore.Firestore, {
  get(_t, prop) { return (getAdminApp().firestore() as any)[prop] }
})

export const adminMessaging = new Proxy({} as admin.messaging.Messaging, {
  get(_t, prop) { return (getAdminApp().messaging() as any)[prop] }
})
