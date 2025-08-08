// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDmyFzYe9lYRgIAtsU0f2AZWLTztNPTPjE",
  authDomain: "project-store-44fff.firebaseapp.com",
  databaseURL: "https://project-store-44fff-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "project-store-44fff",
  storageBucket: "project-store-44fff.appspot.com",
  messagingSenderId: "711461666990",
  appId: "1:711461666990:web:951ba33b6e61ed77736d3f",
  measurementId: "G-R99SHQ47E1"
};


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const database = getDatabase(app);

export { app, database };
