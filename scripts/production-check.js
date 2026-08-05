import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([".git", "dist", "node_modules"]);
const checkedExtensions = new Set([
  ".js",
  ".jsx",
  ".json",
  ".html",
  ".md",
  ".txt",
  ".rules",
  ".webmanifest",
]);

const checks = [
  {
    name: "old Trimly brand",
    pattern: /\bTrimly\b/,
    paths: ["src", "public", "index.html", "README.md", "package.json"],
  },
  {
    name: "blocking browser alerts",
    pattern: /\b(alert|confirm)\s*\(/,
    paths: ["src"],
  },
  {
    name: "hardcoded Firebase API key",
    pattern: /AIza[0-9A-Za-z_-]{20,}/,
    paths: ["src", "public", "README.md", ".env.example"],
  },
  {
    name: "dangerous Firestore read/write rule",
    pattern: /allow\s+(read|write)\s*:\s*if\s+true/,
    paths: ["firestore.rules"],
  },
  {
    name: "placeholder support phone",
    pattern: /999999|000000/,
    paths: ["src", "README.md", ".env.example"],
  },
  {
    name: "mojibake or broken UTF-8 text",
    pattern: /\u00c3|\u00c2|\ufffd/,
    paths: ["src", "README.md", ".env.example"],
  },
  {
    name: "unsafe external window open",
    pattern: /window\.open\([^,\n]+,\s*["_']_blank["_']\s*\)/,
    paths: ["src"],
  },
  {
    name: "password reset without action code settings",
    pattern: /sendPasswordResetEmail\(\s*auth\s*,\s*email\.trim\(\)\s*\)/,
    paths: ["src"],
  },
];

const getExtension = (filePath) => {
  const index = filePath.lastIndexOf(".");
  return index === -1 ? "" : filePath.slice(index);
};

const listFiles = (targetPath) => {
  const absolutePath = join(root, targetPath);
  const stats = statSync(absolutePath);

  if (stats.isFile()) return [absolutePath];
  if (!stats.isDirectory()) return [];

  return readdirSync(absolutePath).flatMap((entry) => {
    if (ignoredDirectories.has(entry)) return [];
    return listFiles(join(targetPath, entry));
  });
};

const failures = [];

const findFirestoreQueriesWithoutLimit = (content) => {
  const queryMatches = [];
  let searchIndex = 0;

  while (searchIndex < content.length) {
    const start = content.indexOf("query(", searchIndex);
    if (start === -1) break;

    let depth = 0;
    let end = -1;

    for (let index = start; index < content.length; index += 1) {
      const char = content[index];
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;

      if (depth === 0) {
        end = index + 1;
        break;
      }
    }

    if (end === -1) break;

    const expression = content.slice(start, end);
    if (expression.includes("collection(db") && !expression.includes("limit(")) {
      queryMatches.push(start);
    }

    searchIndex = end;
  }

  return queryMatches;
};

const findOpeningTagsWithoutAttribute = (content, tagName, attributeName) => {
  const matches = [];
  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, "g");
  let match = pattern.exec(content);

  while (match) {
    if (!new RegExp(`\\b${attributeName}=`).test(match[0])) {
      matches.push(match.index);
    }
    match = pattern.exec(content);
  }

  return matches;
};

const findFixedOverlaysWithoutDialogRole = (content) => {
  const matches = [];
  const pattern = /<div\b[^>]*fixed inset-0[^>]*>/g;
  let match = pattern.exec(content);

  while (match) {
    const nearbyMarkup = content.slice(match.index, match.index + 500);
    if (!nearbyMarkup.includes('role="dialog"')) {
      matches.push(match.index);
    }
    match = pattern.exec(content);
  }

  return matches;
};

const assertPublicProfilesRequireCompletion = () => {
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");
  const start = rules.indexOf("match /publicProfiles/{profileId} {");
  const end = rules.indexOf("match /clients/{clientId}", start);
  const publicProfilesBody = start >= 0 && end > start ? rules.slice(start, end) : "";

  if (!publicProfilesBody.includes("resource.data.profileComplete == true")) {
    failures.push("publicProfiles public access does not require profileComplete: firestore.rules");
  }

  if (/allow\s+get\s*:\s*if\s+true/.test(publicProfilesBody)) {
    failures.push("publicProfiles get is fully public: firestore.rules");
  }

  if (publicProfilesBody.includes("allow list: if signedIn() ||")) {
    failures.push("publicProfiles authenticated list is unbounded: firestore.rules");
  }
};

const assertPublicPhoneKeysSupportReturningClients = () => {
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");
  const start = rules.indexOf("match /clientPhoneKeys/{phoneKeyId} {");
  const end = rules.indexOf("match /services/{serviceId}", start);
  const phoneKeysBody = start >= 0 && end > start ? rules.slice(start, end) : "";

  if (!phoneKeysBody.includes("hasCompletePublicProfile(resource.data.userId)")) {
    failures.push("clientPhoneKeys public get does not support returning public-booking clients: firestore.rules");
  }
};

const assertPublicBookingFiltersCompleteProfiles = () => {
  const publicBooking = readFileSync(join(root, "src", "pages", "PublicBooking.jsx"), "utf8");

  if (
    publicBooking.includes('collection(db, "publicProfiles")') &&
    !publicBooking.includes('where("profileComplete", "==", true)')
  ) {
    failures.push("public booking query does not filter profileComplete: src/pages/PublicBooking.jsx");
  }
};

const assertFirestoreRulesUseBoundedPublicText = () => {
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");
  const requiredSnippets = [
    "function validSlug",
    "validText(request.resource.data.displayName, 2, 80)",
    "validText(request.resource.data.barbershopName, 2, 80)",
    "validOptionalText(request.resource.data.bio, 500)",
    "validOptionalUrl(request.resource.data.logoUrl)",
    "validOptionalUrl(request.resource.data.avatar)",
  ];

  requiredSnippets.forEach((snippet) => {
    if (!rules.includes(snippet)) {
      failures.push(`Firestore rules missing bounded public text validation: ${snippet}`);
    }
  });
};

const assertTrialExpiredUsesBillingDomain = () => {
  const trialExpired = readFileSync(join(root, "src", "pages", "TrialExpired.jsx"), "utf8");
  const billing = readFileSync(join(root, "src", "utils", "billing.js"), "utf8");

  if (!trialExpired.includes("../utils/billing")) {
    failures.push("blocked account screen does not use billing domain helpers: src/pages/TrialExpired.jsx");
  }

  if (!trialExpired.includes("createRenewalRequestPayload")) {
    failures.push("renewal request payload is assembled outside billing helper: src/pages/TrialExpired.jsx");
  }

  if (!trialExpired.includes('doc(db, "renewalRequests", createRenewalRequestId(user.uid))')) {
    failures.push("renewal request is not idempotent per user: src/pages/TrialExpired.jsx");
  }

  if (
    !billing.includes("getBlockedAccountContent") ||
    !billing.includes("createRenewalRequestPayload") ||
    !billing.includes("createRenewalRequestId")
  ) {
    failures.push("billing domain helper is missing blocked copy or renewal payload creation: src/utils/billing.js");
  }
};

const assertBillingRulesAreServerControlled = () => {
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");
  const requiredSnippets = [
    "function validPlan",
    "function validSubscriptionStatus",
    "function validAccountStatus",
    "request.resource.data.trialEndsAt == resource.data.trialEndsAt",
    "request.resource.data.subscriptionEndsAt == resource.data.subscriptionEndsAt",
    "request.resource.data.billingUpdatedAt == resource.data.billingUpdatedAt",
    "validAccountStatus(request.resource.data.accountStatus)",
    "validPlan(request.resource.data.plan)",
    "requestId == request.auth.uid",
    "request.resource.data.timestamp is timestamp",
    "request.resource.data.createdAt is timestamp",
  ];

  requiredSnippets.forEach((snippet) => {
    if (!rules.includes(snippet)) {
      failures.push(`Firestore billing rules are not hardened: ${snippet}`);
    }
  });
};

const assertProfileWritesAreAtomic = () => {
  const authContext = readFileSync(join(root, "src", "contexts", "AuthContext.jsx"), "utf8");

  if (!authContext.includes("writeBatch")) {
    failures.push("profile writes are not batched atomically: src/contexts/AuthContext.jsx");
  }

  if (!authContext.includes("commitInitialProfile") || !authContext.includes("commitProfileUpdate")) {
    failures.push("profile batch helpers are missing: src/contexts/AuthContext.jsx");
  }

  if (/import\s*\{[^}]*\b(setDoc|updateDoc)\b[^}]*\}\s*from\s*["']firebase\/firestore["']/s.test(authContext)) {
    failures.push("AuthContext imports direct setDoc/updateDoc instead of profile batches: src/contexts/AuthContext.jsx");
  }
};

const assertAppointmentRulesValidatePayloadShape = () => {
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");
  const appointmentCard = readFileSync(join(root, "src", "components", "AppointmentCard.jsx"), "utf8");
  const adminApp = readFileSync(join(root, "src", "AdminApp.jsx"), "utf8");
  const requiredSnippets = [
    "function validDateString",
    "function validTimeString",
    "function validClientSnapshot",
    "function validServiceSnapshot",
    "function validAppointmentTiming",
    "function validBookingSlotTiming",
    "validClientSnapshot(request.resource.data.client)",
    "validServiceSnapshot(request.resource.data['service'])",
    "request.resource.data.slotIds.size() <= 16",
    "request.resource.data.slotIds[0] == request.resource.data.slotId",
    "resource.data.status in ['pending', 'confirmed']",
    "request.resource.data.clientPhone.size() <= 13",
    "request.resource.data.endMinutes > request.resource.data.startMinutes",
    "request.resource.data.endMinutes == request.resource.data.startMinutes + request.resource.data.duration",
    "validTimeString(request.resource.data.rootTime)",
  ];

  requiredSnippets.forEach((snippet) => {
    if (!rules.includes(snippet)) {
      failures.push(`Firestore appointment rules are not hardened: ${snippet}`);
    }
  });

  if (!appointmentCard.includes("isTerminalAppointment") || !appointmentCard.includes("disabled={isTerminal}")) {
    failures.push("appointment card does not lock terminal appointment actions");
  }

  if (!adminApp.includes("isTerminalAppointment(appointment)") || !adminApp.includes("isTerminalAppointment(currentAppointment)")) {
    failures.push("admin appointment flows do not block terminal appointment mutations");
  }
};
const assertAppointmentsUseDateWindow = () => {
  const adminApp = readFileSync(join(root, "src", "AdminApp.jsx"), "utf8");
  const appointmentWindow = readFileSync(join(root, "src", "utils", "appointmentWindow.js"), "utf8");
  const schedulePage = readFileSync(join(root, "src", "pages", "Schedule.jsx"), "utf8");
  const financePage = readFileSync(join(root, "src", "pages", "Finance.jsx"), "utf8");
  const dashboardPage = readFileSync(join(root, "src", "pages", "Dashboard.jsx"), "utf8");
  const dashboardCards = readFileSync(join(root, "src", "components", "DashboardCards.jsx"), "utf8");
  const appointmentCard = readFileSync(join(root, "src", "components", "AppointmentCard.jsx"), "utf8");
  const publicBooking = readFileSync(join(root, "src", "pages", "PublicBooking.jsx"), "utf8");
  const indexes = readFileSync(join(root, "firestore.indexes.json"), "utf8");

  const requiredAdminSnippets = [
    "createAppointmentDateWindow()",
    "where(\"date\", \">=\", appointmentWindow.startDate)",
    "where(\"date\", \"<=\", appointmentWindow.endDate)",
    "appointments: 700",
  ];

  requiredAdminSnippets.forEach((snippet) => {
    if (!adminApp.includes(snippet)) {
      failures.push(`appointments query is not bounded by operational date window: ${snippet}`);
    }
  });

  if (!appointmentWindow.includes("pastDays: 365") || !appointmentWindow.includes("futureDays: 180")) {
    failures.push("appointment window limits are missing: src/utils/appointmentWindow.js");
  }

  const requiredWindowUiSnippets = [
    [schedulePage, "Schedule.jsx", "min={appointmentWindow.startDate}"],
    [schedulePage, "Schedule.jsx", "max={appointmentWindow.endDate}"],
    [schedulePage, "Schedule.jsx", "isDateWithinAppointmentWindow(appointmentDate, appointmentWindow)"],
    [appointmentCard, "AppointmentCard.jsx", "isDateWithinAppointmentWindow(editDate, appointmentWindow)"],
    [appointmentCard, "AppointmentCard.jsx", "max={appointmentWindow.endDate}"],
    [financePage, "Finance.jsx", "getAppointmentWindowMonthBounds"],
    [financePage, "Finance.jsx", "isMonthWithinAppointmentWindow(selectedMonth, appointmentWindow)"],
    [financePage, "Finance.jsx", "min={startMonth}"],
    [financePage, "Finance.jsx", "max={endMonth}"],
    [dashboardPage, "Dashboard.jsx", "getAppointmentWindowLabel(appointmentWindow)"],
    [dashboardCards, "DashboardCards.jsx", "metricScopeLabel"],
    [publicBooking, "PublicBooking.jsx", "max={appointmentWindow.endDate}"],
  ];

  requiredWindowUiSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`appointment window UI guard is missing in ${fileName}: ${snippet}`);
    }
  });

  if (!indexes.includes('"fieldPath": "userId"') || !indexes.includes('"fieldPath": "date"') || !indexes.includes('"fieldPath": "time"')) {
    failures.push("appointment date-window index is missing: firestore.indexes.json");
  }
};
const assertScheduleRendersMultiSlotOccupancy = () => {
  const schedulePage = readFileSync(join(root, "src", "pages", "Schedule.jsx"), "utf8");

  if (!schedulePage.includes("overlaps(slotStart, slotEnd, appointmentStart, appointmentEnd)")) {
    failures.push("daily schedule does not render multi-slot appointments as occupied: src/pages/Schedule.jsx");
  }
};
const assertDeletionGuardsQueryActiveAppointments = () => {
  const adminApp = readFileSync(join(root, "src", "AdminApp.jsx"), "utf8");
  const barbersPage = readFileSync(join(root, "src", "pages", "Barbers.jsx"), "utf8");
  const indexes = readFileSync(join(root, "firestore.indexes.json"), "utf8");

  const requiredSnippets = [
    [adminApp, "AdminApp.jsx", "hasActiveAppointmentByField"],
    [adminApp, "AdminApp.jsx", 'hasActiveAppointmentByField("clientId", clientId)'],
    [adminApp, "AdminApp.jsx", 'hasActiveAppointmentByField("service.id", serviceId)'],
    [barbersPage, "Barbers.jsx", 'where("barberId", "==", deleteBarber.id)'],
    [barbersPage, "Barbers.jsx", 'where("status", "in", ACTIVE_APPOINTMENT_STATUSES)'],
    [indexes, "firestore.indexes.json", '"fieldPath": "clientId"'],
    [indexes, "firestore.indexes.json", '"fieldPath": "service.id"'],
    [indexes, "firestore.indexes.json", '"fieldPath": "status"'],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`active appointment deletion guard is missing in ${fileName}: ${snippet}`);
    }
  });
};
const assertServiceContractIsBounded = () => {
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");
  const adminApp = readFileSync(join(root, "src", "AdminApp.jsx"), "utf8");
  const servicesPage = readFileSync(join(root, "src", "pages", "Services.jsx"), "utf8");
  const serviceUtils = readFileSync(join(root, "src", "utils", "services.js"), "utf8");

  const requiredRuleSnippets = [
    "request.resource.data.price <= 100000",
    "request.resource.data.duration >= 15",
    "request.resource.data.duration <= 240",
  ];

  requiredRuleSnippets.forEach((snippet) => {
    if (!rules.includes(snippet)) {
      failures.push(`Firestore service rules are not bounded: ${snippet}`);
    }
  });

  if (!adminApp.includes("validateServiceInput") || !servicesPage.includes("validateServiceInput")) {
    failures.push("service validation helper is not used by admin service flow");
  }

  if (!serviceUtils.includes("priceMax: 100000") || !serviceUtils.includes("durationMax: 240")) {
    failures.push("service validation limits are missing: src/utils/services.js");
  }
};

const assertBarberContractIsBounded = () => {
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");
  const barbersPage = readFileSync(join(root, "src", "pages", "Barbers.jsx"), "utf8");
  const barberUtils = readFileSync(join(root, "src", "utils", "barbers.js"), "utf8");

  const requiredRuleSnippets = [
    "validText(request.resource.data.name, 2, 80)",
    "validOptionalText(request.resource.data.specialty, 80)",
    "validOptionalUrl(request.resource.data.avatar)",
  ];

  requiredRuleSnippets.forEach((snippet) => {
    if (!rules.includes(snippet)) {
      failures.push(`Firestore barber rules are not bounded: ${snippet}`);
    }
  });

  if (!barbersPage.includes("validateBarberInput") || !barbersPage.includes("normalizeBarberInput")) {
    failures.push("barber page does not validate team input before writing");
  }

  if (!barberUtils.includes("nameMin: 2") || !barberUtils.includes("avatarMax: 500")) {
    failures.push("barber validation limits are missing: src/utils/barbers.js");
  }
};
const assertOperationalDataUsesSoftArchive = () => {
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");
  const adminApp = readFileSync(join(root, "src", "AdminApp.jsx"), "utf8");
  const barbersPage = readFileSync(join(root, "src", "pages", "Barbers.jsx"), "utf8");
  const clientsPage = readFileSync(join(root, "src", "pages", "Clients.jsx"), "utf8");
  const servicesPage = readFileSync(join(root, "src", "pages", "Services.jsx"), "utf8");
  const publicBooking = readFileSync(join(root, "src", "pages", "PublicBooking.jsx"), "utf8");

  const requiredSnippets = [
    [rules, "firestore.rules", "function validArchiveFields"],
    [rules, "firestore.rules", "match /clients/{clientId}"],
    [rules, "firestore.rules", "match /services/{serviceId}"],
    [rules, "firestore.rules", "match /barbers/{barberId}"],
    [rules, "firestore.rules", "allow delete: if false;"],
    [rules, "firestore.rules", "'isArchived', 'archivedAt'"],
    [adminApp, "AdminApp.jsx", "transaction.update(doc(db, \"clients\", clientId)"],
    [adminApp, "AdminApp.jsx", "updateDoc(serviceRef, { isArchived: true"],
    [adminApp, "AdminApp.jsx", "!client.isArchived && !client.archivedAt"],
    [adminApp, "AdminApp.jsx", "!service.isArchived && !service.archivedAt"],
    [adminApp, "AdminApp.jsx", "isArchived: false"],
    [adminApp, "AdminApp.jsx", "const restoreClient = async"],
    [adminApp, "AdminApp.jsx", "const restoreService = async"],
    [adminApp, "AdminApp.jsx", "const restoreBarber = async"],
    [adminApp, "AdminApp.jsx", "archivedAt: deleteField()"],
    [clientsPage, "Clients.jsx", "Clientes arquivados"],
    [clientsPage, "Clients.jsx", "Restaurar cliente"],
    [servicesPage, "Services.jsx", "Servicos arquivados"],
    [servicesPage, "Services.jsx", "Restaurar servico"],
    [barbersPage, "Barbers.jsx", "Barbeiros arquivados"],
    [barbersPage, "Barbers.jsx", "Restaurar barbeiro"],
    [barbersPage, "Barbers.jsx", "updateDoc(barberRef, { isArchived: true"],
    [barbersPage, "Barbers.jsx", "isArchived: false"],
    [publicBooking, "PublicBooking.jsx", "!service.isArchived && !service.archivedAt"],
    [publicBooking, "PublicBooking.jsx", "!barber.isArchived && !barber.archivedAt"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`soft archive guard is missing in ${fileName}: ${snippet}`);
    }
  });

  if (adminApp.includes("deleteDoc")) {
    failures.push("AdminApp still imports or uses deleteDoc for operational data");
  }

  if (barbersPage.includes("deleteDoc")) {
    failures.push("Barbers page still imports or uses deleteDoc for operational data");
  }
};
const assertOperationalAuditLogsAreEnabled = () => {
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");
  const indexes = readFileSync(join(root, "firestore.indexes.json"), "utf8");
  const adminApp = readFileSync(join(root, "src", "AdminApp.jsx"), "utf8");
  const dashboardPage = readFileSync(join(root, "src", "pages", "Dashboard.jsx"), "utf8");
  const barbersPage = readFileSync(join(root, "src", "pages", "Barbers.jsx"), "utf8");

  const requiredSnippets = [
    [rules, "firestore.rules", "match /auditLogs/{auditLogId}"],
    [rules, "firestore.rules", "validAuditAction"],
    [rules, "firestore.rules", "allow update, delete: if false"],
    [indexes, "firestore.indexes.json", '"collectionGroup": "auditLogs"'],
    [indexes, "firestore.indexes.json", '"fieldPath": "createdAt"'],
    [adminApp, "AdminApp.jsx", "const recordAuditLog = useCallback"],
    [adminApp, "AdminApp.jsx", 'collection(db, "auditLogs")'],
    [adminApp, "AdminApp.jsx", "const auditLogsQuery = query"],
    [adminApp, "AdminApp.jsx", "client_archived"],
    [adminApp, "AdminApp.jsx", "appointment_status_updated"],
    [dashboardPage, "Dashboard.jsx", "Atividade recente"],
    [dashboardPage, "Dashboard.jsx", "auditLogs.slice(0, 8)"],
    [barbersPage, "Barbers.jsx", "recordAuditLog"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`operational audit log guard is missing in ${fileName}: ${snippet}`);
    }
  });
};
const assertAvailabilityContractIsBounded = () => {
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");
  const profileSettings = readFileSync(join(root, "src", "pages", "ProfileSettings.jsx"), "utf8");
  const scheduleUtils = readFileSync(join(root, "src", "utils", "schedule.js"), "utf8");

  const requiredRuleSnippets = [
    "function validBusinessHours",
    "function validBlockedDates",
    "hours.slotInterval in [15, 30, 45, 60]",
    "dates.size() <= 120",
    "validBusinessHours(request.resource.data.businessHours)",
    "validBlockedDates(request.resource.data.blockedDates)",
  ];

  requiredRuleSnippets.forEach((snippet) => {
    if (!rules.includes(snippet)) {
      failures.push(`Firestore availability rules are not bounded: ${snippet}`);
    }
  });

  if (!profileSettings.includes("validateBusinessHoursInput") || !profileSettings.includes("normalizeBlockedDates")) {
    failures.push("profile settings do not validate availability before writing");
  }

  if (!scheduleUtils.includes("slotIntervals: [15, 30, 45, 60]") || !scheduleUtils.includes("blockedDatesMax: 120")) {
    failures.push("schedule availability limits are missing: src/utils/schedule.js");
  }
};

const assertFirebaseAppCheckIsConfigurable = () => {
  const firebaseService = readFileSync(join(root, "src", "services", "firebase.js"), "utf8");
  const envExample = readFileSync(join(root, ".env.example"), "utf8");
  const readme = readFileSync(join(root, "README.md"), "utf8");

  const requiredSnippets = [
    [firebaseService, "src/services/firebase.js", "initializeAppCheck"],
    [firebaseService, "src/services/firebase.js", "ReCaptchaV3Provider"],
    [firebaseService, "src/services/firebase.js", "VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY"],
    [firebaseService, "src/services/firebase.js", "isTokenAutoRefreshEnabled: true"],
    [envExample, ".env.example", "VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY="],
    [readme, "README.md", "Firebase App Check"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`Firebase App Check is not production-configurable in ${fileName}: ${snippet}`);
    }
  });
};
for (const check of checks) {
  for (const filePath of check.paths.flatMap(listFiles)) {
    if (!checkedExtensions.has(getExtension(filePath))) continue;

    const content = readFileSync(filePath, "utf8");
    if (check.pattern.test(content)) {
      failures.push(`${check.name}: ${relative(root, filePath)}`);
    }
  }
}

for (const filePath of listFiles("src")) {
  if (!getExtension(filePath).match(/^\.jsx?$/)) continue;

  const content = readFileSync(filePath, "utf8");
  const unboundedQueries = findFirestoreQueriesWithoutLimit(content);
  if (unboundedQueries.length > 0) {
    failures.push(`Firestore query without explicit limit: ${relative(root, filePath)}`);
  }

  if (findOpeningTagsWithoutAttribute(content, "button", "type").length > 0) {
    failures.push(`button without explicit type: ${relative(root, filePath)}`);
  }

  if (findFixedOverlaysWithoutDialogRole(content).length > 0) {
    failures.push(`fixed overlay without dialog role nearby: ${relative(root, filePath)}`);
  }
}

assertPublicProfilesRequireCompletion();
assertPublicPhoneKeysSupportReturningClients();
assertPublicBookingFiltersCompleteProfiles();
assertFirestoreRulesUseBoundedPublicText();
assertTrialExpiredUsesBillingDomain();
assertBillingRulesAreServerControlled();
assertProfileWritesAreAtomic();
assertAppointmentRulesValidatePayloadShape();
assertServiceContractIsBounded();
assertScheduleRendersMultiSlotOccupancy();
assertDeletionGuardsQueryActiveAppointments();
assertOperationalDataUsesSoftArchive();
assertOperationalAuditLogsAreEnabled();
assertAppointmentsUseDateWindow();
assertAvailabilityContractIsBounded();
assertBarberContractIsBounded();
assertFirebaseAppCheckIsConfigurable();

if (failures.length > 0) {
  console.error("Production check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Production check passed.");
