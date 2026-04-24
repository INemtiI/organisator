import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// @ts-ignore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established.");
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.error("Firebase is offline. Check your configuration or network.");
    } else if (error?.code === 'permission-denied') {
      console.log("Firebase connected (Permission denied as expected).");
    } else {
      console.warn("Firebase connection status:", error.message);
    }
  }
}
testConnection();
