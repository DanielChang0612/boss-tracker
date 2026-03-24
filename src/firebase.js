import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBVxbTodOlle3LYaSIDRHD-lza_cCKNpKk",
  authDomain: "boss-tracker-c83e0.firebaseapp.com",
  projectId: "boss-tracker-c83e0",
  storageBucket: "boss-tracker-c83e0.appspot.com",
  messagingSenderId: "861594497284",
  appId: "1:861594497284:web:bbf9ba6dde2cbf2f77a051",
  measurementId: "G-JX5M6WCJG1",
  databaseURL: "https://boss-tracker-c83e0-default-rtdb.firebaseio.com/" // 預測路徑，若不對請告知
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
