// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');

firebase.initializeApp ({
  apiKey: "AIzaSyAR8TbEXRuYTX8_6UAx2DBa9BD1a7LK6U0",
  authDomain: "dash-q.firebaseapp.com",
  projectId: "dash-q",
  storageBucket: "dash-q.firebasestorage.app",
  messagingSenderId: "172404162598",
  appId: "1:172404162598:web:f086600da40973430a66e7",
  measurementId: "G-017W5GCMWL"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png' // Change to your logo path
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});