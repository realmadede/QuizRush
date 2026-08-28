import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ⚠️  Replace with your own Firebase project credentials
// Firebase console → Project Settings → Your apps → SDK setup
const firebaseConfig = {
    apiKey:            "YOUR_API_KEY",
    authDomain:        "YOUR_PROJECT.firebaseapp.com",
    projectId:         "YOUR_PROJECT_ID",
    storageBucket:     "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId:             "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
