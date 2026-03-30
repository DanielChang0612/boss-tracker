import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyANt5AvRtVrjXFILgqD6Q12zOCIoYBI0VM",
  authDomain: "pikapi-boss-v2.firebaseapp.com",
  databaseURL: "https://pikapi-boss-v2-default-rtdb.firebaseio.com/",
  projectId: "pikapi-boss-v2",
  storageBucket: "pikapi-boss-v2.firebasestorage.app",
  messagingSenderId: "796098063643",
  appId: "1:796098063643:web:69fadf1dd1df6b185b77be",
  measurementId: "G-D3PEMMBHR5"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
