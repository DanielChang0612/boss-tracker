import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBVxbTod0lle3lYaSIDrhD-lza_cCKNpKk",
  authDomain: "boss-tracker-c83e0.firebaseapp.com",
  databaseURL: "https://boss-tracker-c83e0-default-rtdb.firebaseio.com",
  projectId: "boss-tracker-c83e0",
  storageBucket: "boss-tracker-c83e0.firebasestorage.app",
  messagingSenderId: "861594497284",
  appId: "1:861594497284:web:bbf9ba6dde2cbf2f77a051",
  measurementId: "G-JX5M6WCJG1"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
