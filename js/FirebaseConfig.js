// js/FirebaseConfig.js
// Firebase Configuration using v8 compatibility SDK (CDN approach)
const firebaseConfig = {
    apiKey: "AIzaSyDSIkp8d6btNirgfj8q8-KzE6GgJtQsUaw",
    authDomain: "trapdash-8e6b7.firebaseapp.com",
    databaseURL: "https://trapdash-8e6b7-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "trapdash-8e6b7",
    storageBucket: "trapdash-8e6b7.firebasestorage.app",
    messagingSenderId: "756996126307",
    appId: "1:756996126307:web:0f9ffe15c8bfa408cbaa56",
    measurementId: "G-P3M79908VW"
};

// Initialize Firebase using v8 compatibility SDK
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Export Firebase services for use in other files
window.firebaseAuth = firebase.auth();
window.firebaseDatabase = firebase.database();

// Set up authentication persistence for mobile
firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

console.log('🔥 Firebase initialized successfully with project:', firebaseConfig.projectId); 