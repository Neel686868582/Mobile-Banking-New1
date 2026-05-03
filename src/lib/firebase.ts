import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCgNcUOxGjzSoRLiBpXhTym92GCoE_cuFA",
  authDomain: "mobile-banking-d8180.firebaseapp.com",
  projectId: "mobile-banking-d8180",
  storageBucket: "mobile-banking-d8180.firebasestorage.app",
  messagingSenderId: "415840220811",
  appId: "1:415840220811:web:45b555d08240516967c68e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
