// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyDDm-MYUp0Y5lUoOOTfMPhRAVqglN32mFE',
  authDomain: 'cachess-47c1c.firebaseapp.com',
  projectId: 'cachess-47c1c',
  storageBucket: 'cachess-47c1c.firebasestorage.app',
  messagingSenderId: '438793937466',
  appId: '1:438793937466:web:d10f282a3458424e0acb03',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Initialize Firestore

export { auth, db };
