// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

// REPLACE THE VALUES BELOW WITH YOUR FIREBASE PROJECT SETTINGS
// You can find these in Firebase Console > Project Settings > General > Your Apps > SDK Setup and Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAR8TbEXRuYTX8_6UAx2DBa9BD1a7LK6U0",
  authDomain: "dash-q.firebaseapp.com",
  projectId: "dash-q",
  storageBucket: "dash-q.firebasestorage.app",
  messagingSenderId: "172404162598",
  appId: "1:172404162598:web:f086600da40973430a66e7",
  measurementId: "G-017W5GCMWL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Messaging and export it
export const messaging = getMessaging(app);