import admin from "firebase-admin";

// Server-only — never import from client components

function initAdmin(): admin.app.App {
  if (admin.apps.find((a) => a?.name === "learnhub-admin")) {
    return admin.app("learnhub-admin");
  }
  const privateKey = process.env.LH_FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );
  return admin.initializeApp(
    {
      credential: admin.credential.cert({
        projectId: process.env.LH_FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.LH_FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
    },
    "learnhub-admin"
  );
}

export const adminApp = initAdmin();
export const adminAuth = adminApp.auth();
export const adminFirestore = adminApp.firestore();
export const adminMessaging = adminApp.messaging();
