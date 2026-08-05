import { createContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../services/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  runTransaction,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { createTrialEndDate, DEFAULT_PLAN, DEFAULT_SUBSCRIPTION_STATUS } from "../utils/trial";
import { reportError, trackEvent } from "../utils/telemetry";

const AuthContext = createContext();

const normalizePublicProfile = (data = {}) => ({
  slug: data.slug || "",
  displayName: data.displayName || "",
  barbershopName: data.barbershopName || "",
  phone: data.phone || "",
  bio: data.bio || "",
  logoUrl: data.logoUrl || "",
  avatar: data.avatar || "",
  businessHours: data.businessHours || {
    start: "09:00",
    end: "18:00",
    slotInterval: 30,
  },
  blockedDates: Array.isArray(data.blockedDates) ? data.blockedDates : [],
  profileComplete: Boolean(data.profileComplete),
  updatedAt: data.updatedAt || new Date(),
});

const createInitialProfile = ({ uid, email, createdAt = new Date() }) => {
  const prefix = email.split("@")[0] || "barbeiro";
  const slug = `${slugify(prefix)}-${uid.slice(0, 6)}`;
  const displayName = email.split("@")[0].replace(/[._-]+/g, " ");

  return {
    email,
    slug,
    displayName,
    plan: DEFAULT_PLAN,
    subscriptionStatus: DEFAULT_SUBSCRIPTION_STATUS,
    profileComplete: false,
    trialEndsAt: createTrialEndDate(createdAt),
    createdAt,
  };
};

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const commitInitialProfile = async ({ uid, profile, publicProfile }) => {
  const userRef = doc(db, "users", uid);
  const publicProfileRef = doc(db, "publicProfiles", uid);
  const slugKeyRef = doc(db, "publicSlugKeys", profile.slug);
  const now = new Date();

  await runTransaction(db, async (transaction) => {
    const slugKeySnapshot = await transaction.get(slugKeyRef);
    if (slugKeySnapshot.exists() && slugKeySnapshot.data().uid !== uid) {
      throw new Error("slug-unavailable");
    }

    transaction.set(userRef, profile);
    transaction.set(publicProfileRef, publicProfile);
    transaction.set(slugKeyRef, {
      uid,
      slug: profile.slug,
      createdAt: now,
      updatedAt: now,
    });
  });
};

const commitProfileUpdate = async ({ uid, profileData, publicProfile, previousSlug }) => {
  const userRef = doc(db, "users", uid);
  const publicProfileRef = doc(db, "publicProfiles", uid);
  const nextSlug = publicProfile.slug;
  const nextSlugKeyRef = doc(db, "publicSlugKeys", nextSlug);
  const previousSlugKeyRef = previousSlug && previousSlug !== nextSlug ? doc(db, "publicSlugKeys", previousSlug) : null;
  const now = new Date();

  await runTransaction(db, async (transaction) => {
    const nextSlugKeySnapshot = await transaction.get(nextSlugKeyRef);
    if (nextSlugKeySnapshot.exists() && nextSlugKeySnapshot.data().uid !== uid) {
      throw new Error("slug-unavailable");
    }

    transaction.update(userRef, profileData);
    transaction.set(publicProfileRef, publicProfile, { merge: true });
    transaction.set(nextSlugKeyRef, {
      uid,
      slug: nextSlug,
      createdAt: now,
      updatedAt: now,
    });

    if (previousSlugKeyRef) {
      transaction.delete(previousSlugKeyRef);
    }
  });
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const loadUserProfile = async (firebaseUser) => {
    setProfileLoading(true);
    try {
      const uid = firebaseUser.uid;
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        setProfile({ id: userDoc.id, ...userDoc.data() });
      } else {
        const createdAt = new Date();
        const initialProfile = createInitialProfile({
          uid,
          email: firebaseUser.email || "barbeiro@barberos.local",
          createdAt,
        });
        await commitInitialProfile({
          uid,
          profile: initialProfile,
          publicProfile: normalizePublicProfile({
            ...initialProfile,
            updatedAt: createdAt,
          }),
        });
        setProfile({ id: uid, ...initialProfile });
        trackEvent("missing_profile_repaired", { source: "auth", action: "repair-profile" });
      }
    } catch (err) {
      reportError(err, { source: "auth", action: "load-profile" });
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadUserProfile(firebaseUser);
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const register = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const createdAt = new Date();
    const initialProfile = createInitialProfile({
      uid: userCredential.user.uid,
      email,
      createdAt,
    });

    try {
      await commitInitialProfile({
        uid: userCredential.user.uid,
        profile: initialProfile,
        publicProfile: normalizePublicProfile({
          ...initialProfile,
          updatedAt: createdAt,
        }),
      });
      setProfile({
        id: userCredential.user.uid,
        ...initialProfile,
      });
    } catch (err) {
      reportError(err, { source: "auth", action: "create-profile" });
      throw err;
    }
    trackEvent("auth_register_completed", { source: "auth", action: "register" });
    return userCredential;
  };

  const updateProfile = async (profileData) => {
    if (!user) throw new Error("Usuario nao autenticado");
    try {
      const updatedProfile = { ...(profile || {}), ...profileData };
      await commitProfileUpdate({
        uid: user.uid,
        profileData,
        previousSlug: profile?.slug || "",
        publicProfile: normalizePublicProfile({
          ...updatedProfile,
          updatedAt: profileData.updatedAt || new Date(),
        }),
      });
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      reportError(err, { source: "auth", action: "update-profile" });
      throw err;
    }
  };

  const isSlugAvailable = async (slugValue, currentUid) => {
    try {
      const usersRef = collection(db, "publicProfiles");
      const slugKeySnapshot = await getDoc(doc(db, "publicSlugKeys", slugValue));
      if (slugKeySnapshot.exists() && slugKeySnapshot.data().uid !== currentUid) {
        return false;
      }

      const slugQuery = query(usersRef, where("slug", "==", slugValue), limit(2));
      const snapshot = await getDocs(slugQuery);
      const matchingDocs = snapshot.docs.filter((doc) => doc.id !== currentUid);
      return matchingDocs.length === 0;
    } catch (err) {
      reportError(err, { source: "auth", action: "check-slug" });
      throw err;
    }
  };

  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      trackEvent("auth_login_completed", { source: "auth", action: "login" });
      return result;
    } catch (err) {
      reportError(err, { source: "auth", action: "login" });
      throw err;
    }
  };

  const logout = async () => {
    await signOut(auth);
    trackEvent("auth_logout_completed", { source: "auth", action: "logout" });
  };

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

export default AuthContext;
