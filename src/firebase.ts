import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  setPersistence, 
  browserLocalPersistence 
} from "firebase/auth";

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {

    // Fix sessionStorage problem
    await setPersistence(auth, browserLocalPersistence);

    const result = await signInWithPopup(auth, provider);

    console.log("Login success:", result.user);

  } catch (error) {
    console.error("Google login error:", error);
  }
};
