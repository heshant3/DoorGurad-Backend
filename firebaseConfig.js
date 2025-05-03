// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database"; // Import Realtime Database
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC1l39eGrqLORn-Xerb7TzcVEyZBG4LEDo",
  authDomain: "smartdoorlock-46c40.firebaseapp.com",
  databaseURL: "https://smartdoorlock-46c40-default-rtdb.firebaseio.com",
  projectId: "smartdoorlock-46c40",
  storageBucket: "smartdoorlock-46c40.firebasestorage.app",
  messagingSenderId: "387020676055",
  appId: "1:387020676055:web:68cbbd3dfa2b14bd85c992",
  measurementId: "G-MYXBTRYR4P",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const database = getDatabase(app); // Initialize Realtime Database

export default database; // Export the database instance
