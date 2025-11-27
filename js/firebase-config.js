// Import Firebase functions from the CDN (available globally via window.firebase if using compat, 
// but we are using ES modules from the// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// TODO: Replace the following with your app's Firebase project configuration
// You can get this from the Firebase Console: Project Settings > General > Your apps > SDK setup and configuration
export const firebaseConfig = {
    apiKey: "AIzaSyDTQXvvGzhov3e2gllaeF_kPzBRbBREVeg",
    authDomain: "capacity-polypoint.firebaseapp.com",
    projectId: "capacity-polypoint",
    storageBucket: "capacity-polypoint.firebasestorage.app",
    messagingSenderId: "458798371480",
    appId: "1:458798371480:web:4f6c248ddad1a3a944f6ed",
    measurementId: "G-M4GQZN0LB1"
};

// Initialize Firebase
let app;
let db;

try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE") {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log("Firebase initialized");
    } else {
        console.warn("Firebase config missing. Using LocalStorage.");
    }
} catch (e) {
    console.error("Error initializing Firebase:", e);
}

export { db, collection, getDocs, setDoc, doc, deleteDoc, getDoc };
