const placeholderPattern = /(^your_|_here$|your_project_id|your_sender_id|your_app_id)/i;

const requiredFirebaseConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

const getInvalidFirebaseConfigKeys = (firebaseConfig) =>
  requiredFirebaseConfigKeys.filter((key) => {
    const value = firebaseConfig?.[key];

    return typeof value !== "string" || value.trim() === "" || placeholderPattern.test(value);
  });

export const validateFirebaseConfig = (firebaseConfig) => {
  const invalidKeys = getInvalidFirebaseConfigKeys(firebaseConfig);

  if (invalidKeys.length > 0) {
    throw new Error(`Firebase config invalid or missing: ${invalidKeys.join(", ")}`);
  }

  return firebaseConfig;
};

