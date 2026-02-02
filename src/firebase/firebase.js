// Firebase configuration and initialization
// Matrix Club Quiz Platform - Firebase Setup

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, serverTimestamp } from 'firebase/firestore';

// =============================================================================
// FIREBASE CONFIGURATION
// Matrix Club Project Credentials
// =============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyC0sG0sflxbmlF70GiTl4xk7s4m6B42JGA",
  authDomain: "matrix-4bee5.firebaseapp.com",
  projectId: "matrix-4bee5",
  storageBucket: "matrix-4bee5.firebasestorage.app",
  messagingSenderId: "28740893438",
  appId: "1:28740893438:web:efa54bbcc8591344da43af",
  measurementId: "G-N9JQPLWHC9"
};

// =============================================================================
// ADMIN EMAIL WHITELIST
// Add Gmail addresses that should have admin (host) access
// =============================================================================
export const ADMIN_EMAILS = [
  "dipakshukla158@gmail.com",
  "rakshitraj2323@gmail.com"
  // Add more admin emails here
  // "matrixclub@gmail.com",
];

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Google Auth Provider for Sign-In
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore Database
export const db = getFirestore(app);

// Server timestamp for synchronized timing
export const getServerTimestamp = () => serverTimestamp();

export default app;
