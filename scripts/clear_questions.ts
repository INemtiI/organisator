import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Use standard Node.js module loading instead of TypeScript for the script execution to be safe
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearQuestions() {
  console.log('Clearing questions collection...');
  const querySnapshot = await getDocs(collection(db, 'questions'));
  const deletePromises = querySnapshot.docs.map(document => {
    console.log(`Deleting question: ${document.id}`);
    return deleteDoc(doc(db, 'questions', document.id));
  });
  
  await Promise.all(deletePromises);
  console.log('Finished clearing questions.');
  process.exit(0);
}

clearQuestions().catch(err => {
  console.error('Error clearing questions:', err);
  process.exit(1);
});
