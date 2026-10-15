// Import Firebase core and Firestore SDKs via CDN for modular Web v10
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDlI04Qlc2yodw2RsP4HEdb1Wf0ePckq9M",
  authDomain: "id-clash.firebaseapp.com",
  projectId: "id-clash",
  storageBucket: "id-clash.firebasestorage.app",
  messagingSenderId: "602647862905",
  appId: "1:602647862905:web:b406b585d18a17f984fea8"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore Database and export it
export const db = getFirestore(app);