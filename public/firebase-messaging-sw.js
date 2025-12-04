/* public/firebase-messaging-sw.js */
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// REPLACE WITH YOUR FIREBASE CONFIG (From Step 1.4)
const firebaseConfig = {
  apiKey: "AIzaSyAR8TbEXRuYTX8_6UAx2DBa9BD1a7LK6U0",
  authDomain: "dash-q.firebaseapp.com",
  projectId: "dash-q",
  storageBucket: "dash-q.firebasestorage.app",
  messagingSenderId: "172404162598",
  appId: "1:172404162598:web:f086600da40973430a66e7",
  measurementId: "G-017W5GCMWL"
};

const messaging = firebase.messaging();

// Optional: Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png' // Ensure you have an icon.png in public folder
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});