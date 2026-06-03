import { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../services/firebase";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { createTrialEndDate } from "../utils/trial";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadUserProfile(firebaseUser.uid);
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const slugify = (value) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const generateSlug = (email, uid) => {
    const prefix = email.split("@")[0] || "barbeiro";
    return `${slugify(prefix)}-${uid.slice(0, 6)}`;
  };

  const loadUserProfile = async (uid) => {
    setProfileLoading(true);
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        setProfile({ id: userDoc.id, ...userDoc.data() });
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Error loading user profile:", err);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const register = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const slug = generateSlug(email, userCredential.user.uid);
    const displayName = email.split("@")[0].replace(/[._-]+/g, " ");
    const createdAt = new Date();
    const trialEndsAt = createTrialEndDate(createdAt);

    try {
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email,
        slug,
        displayName,
        profileComplete: false,
        trialEndsAt,
        createdAt,
      });
      setProfile({
        id: userCredential.user.uid,
        email,
        slug,
        displayName,
        profileComplete: false,
        trialEndsAt,
        createdAt,
      });
    } catch (err) {
      console.error("Error creating user profile:", err);
    }
    return userCredential;
  };

  const updateProfile = async (profileData) => {
    if (!user) throw new Error("Usuário não autenticado");
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, profileData);
      const updatedProfile = { ...(profile || {}), ...profileData };
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      console.error("Error updating profile:", err);
      throw err;
    }
  };

  const isSlugAvailable = async (slugValue, currentUid) => {
    const usersRef = collection(db, "users");
    const slugQuery = query(usersRef, where("slug", "==", slugValue));
    const snapshot = await getDocs(slugQuery);
    const matchingDocs = snapshot.docs.filter((doc) => doc.id !== currentUid);
    return matchingDocs.length === 0;
  };

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileLoading,
        register,
        login,
        logout,
        updateProfile,
        isSlugAvailable,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
