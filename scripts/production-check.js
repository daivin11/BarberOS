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
  const publicBooking = readFileSync(join(root, "src", "pages", "PublicBooking.jsx"), "utf8");
  const authContext = readFileSync(join(root, "src", "contexts", "AuthContext.jsx"), "utf8");

  if (!publicProfilesBody.includes("resource.data.profileComplete == true")) {
    failures.push("publicProfiles public access does not require profileComplete: firestore.rules");
  }

  if (/allow\s+get\s*:\s*if\s+true/.test(publicProfilesBody)) {
    failures.push("publicProfiles get is fully public: firestore.rules");
  }

  if (publicProfilesBody.includes("allow list: if signedIn() ||")) {
    failures.push("publicProfiles authenticated list is unbounded: firestore.rules");
  }

  const accountGuardSnippets = [
    [rules, "firestore.rules", "function hasActivePublicAccount"],
    [rules, "firestore.rules", "function publicBillingMatchesUser"],
    [rules, "firestore.rules", "hasActivePublicAccount(userId)"],
    [rules, "firestore.rules", "request.resource.data.subscriptionStatus == get(/databases/$(database)/documents/users/$(profileId)).data.subscriptionStatus"],
    [authContext, "src/contexts/AuthContext.jsx", "subscriptionStatus: data.subscriptionStatus || DEFAULT_SUBSCRIPTION_STATUS"],
    [authContext, "src/contexts/AuthContext.jsx", "if (data.trialEndsAt) publicProfile.trialEndsAt = data.trialEndsAt"],
    [authContext, "src/contexts/AuthContext.jsx", "syncPublicBillingMirror"],
    [authContext, "src/contexts/AuthContext.jsx", "sync-public-billing"],
    [publicBooking, "src/pages/PublicBooking.jsx", "getAccountAccess(barberData)"],
    [publicBooking, "src/pages/PublicBooking.jsx", "agendamento online desta barbearia esta temporariamente pausado"],
  ];

  accountGuardSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`public booking account access guard is missing in ${fileName}: ${snippet}`);
    }
  });
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
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");

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

  const requiredPlanSnippets = [
    [trialExpired, "src/pages/TrialExpired.jsx", "BILLING_PLANS"],
    [trialExpired, "src/pages/TrialExpired.jsx", "selectedPlan"],
    [trialExpired, "src/pages/TrialExpired.jsx", "requestedPlan: selectedPlan"],
    [billing, "src/utils/billing.js", "BILLING_PLANS"],
    [billing, "src/utils/billing.js", "requestedPlan"],
    [rules, "firestore.rules", "validPlan(request.resource.data.requestedPlan)"],
  ];

  requiredPlanSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`billing plan selection is missing in ${fileName}: ${snippet}`);
    }
  });
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
    "validPlan(request.resource.data.requestedPlan)",
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
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");
  const dashboard = readFileSync(join(root, "src", "pages", "Dashboard.jsx"), "utf8");
  const profileSetup = readFileSync(join(root, "src", "pages", "ProfileSetup.jsx"), "utf8");
  const profileSettings = readFileSync(join(root, "src", "pages", "ProfileSettings.jsx"), "utf8");

  if (!authContext.includes("runTransaction")) {
    failures.push("profile writes are not transactional: src/contexts/AuthContext.jsx");
  }

  if (!authContext.includes("commitInitialProfile") || !authContext.includes("commitProfileUpdate")) {
    failures.push("profile transaction helpers are missing: src/contexts/AuthContext.jsx");
  }

  const slugReservationSnippets = [
    [authContext, "src/contexts/AuthContext.jsx", "publicSlugKeys"],
    [authContext, "src/contexts/AuthContext.jsx", "slug-unavailable"],
    [authContext, "src/contexts/AuthContext.jsx", "previousSlugKeyRef"],
    [rules, "firestore.rules", "match /publicSlugKeys/{slugId}"],
    [rules, "firestore.rules", "function slugKeyWillBelongTo"],
    [rules, "firestore.rules", "slugKeyWillBelongTo(request.resource.data.slug, userId)"],
    [rules, "firestore.rules", "slugKeyWillBelongTo(request.resource.data.slug, profileId)"],
    [dashboard, "src/pages/Dashboard.jsx", "slug-unavailable"],
    [profileSetup, "src/pages/ProfileSetup.jsx", "slug-unavailable"],
    [profileSettings, "src/pages/ProfileSettings.jsx", "slug-unavailable"],
  ];

  slugReservationSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`public slug reservation is missing in ${fileName}: ${snippet}`);
    }
  });

  if (authContext.includes("writeBatch")) {
    failures.push("AuthContext still uses writeBatch for profile writes instead of slug transaction");
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
    "function appointmentRootSlotMatches",
    "function cancelledAppointmentReleasesRootSlot",
    "appointmentRootSlotMatches(appointmentId)",
    "cancelledAppointmentReleasesRootSlot()",
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

  if (!appointmentCard.includes("isTerminalAppointment") || !appointmentCard.includes("disabled={isTerminal || statusLoading}")) {
    failures.push("appointment card does not lock terminal appointment actions");
  }

  if (!adminApp.includes("isTerminalAppointment(appointment)") || !adminApp.includes("isTerminalAppointment(currentAppointment)")) {
    failures.push("admin appointment flows do not block terminal appointment mutations");
  }

  const submitGuardSnippets = [
    [appointmentCard, "src/components/AppointmentCard.jsx", "statusLoading"],
    [appointmentCard, "src/components/AppointmentCard.jsx", "handleStatusChange"],
    [appointmentCard, "src/components/AppointmentCard.jsx", "Confirmando..."],
    [appointmentCard, "src/components/AppointmentCard.jsx", "if (!onUpdateAppointment || !canSaveEdit || editLoading) return"],
    [appointmentCard, "src/components/AppointmentCard.jsx", "if (!onStatusChange || cancelLoading) return"],
  ];

  submitGuardSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`appointment action submit guard is missing in ${fileName}: ${snippet}`);
    }
  });
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

  const submitGuardSnippets = [
    [schedulePage, "src/pages/Schedule.jsx", "creatingAppointment"],
    [schedulePage, "src/pages/Schedule.jsx", "confirmingPendingId"],
    [schedulePage, "src/pages/Schedule.jsx", "appointmentTimeOptions"],
    [schedulePage, "src/pages/Schedule.jsx", "selectedBarberBookedSlots"],
    [schedulePage, "src/pages/Schedule.jsx", "availableAppointmentTimeOptions"],
    [schedulePage, "src/pages/Schedule.jsx", "isTimeSlotAvailable"],
    [schedulePage, "src/pages/Schedule.jsx", "availableAppointmentTimeOptions.includes(appointmentTime)"],
    [schedulePage, "src/pages/Schedule.jsx", "Sem horarios disponiveis"],
    [schedulePage, "src/pages/Schedule.jsx", "Escolha um servico primeiro"],
    [schedulePage, "src/pages/Schedule.jsx", "handleAddAppointment"],
    [schedulePage, "src/pages/Schedule.jsx", "Criando agendamento..."],
    [schedulePage, "src/pages/Schedule.jsx", "Confirmando..."],
  ];

  submitGuardSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`schedule action submit guard is missing in ${fileName}: ${snippet}`);
    }
  });
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
  const serviceUtilsTest = readFileSync(join(root, "tests", "services.test.js"), "utf8");

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

  const duplicateGuardSnippets = [
    [adminApp, "src/AdminApp.jsx", "findDuplicateServiceByName"],
    [servicesPage, "src/pages/Services.jsx", "duplicateNewService"],
    [servicesPage, "src/pages/Services.jsx", "duplicateEditedService"],
    [servicesPage, "src/pages/Services.jsx", "savingService"],
    [servicesPage, "src/pages/Services.jsx", "editingServiceSaving"],
    [servicesPage, "src/pages/Services.jsx", "archivingService"],
    [servicesPage, "src/pages/Services.jsx", "restoringServiceId"],
    [serviceUtils, "src/utils/services.js", "normalizeServiceNameKey"],
    [serviceUtils, "src/utils/services.js", "findDuplicateServiceByName"],
    [serviceUtilsTest, "tests/services.test.js", "finds duplicate active services"],
  ];

  duplicateGuardSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`service duplicate-name guard is missing in ${fileName}: ${snippet}`);
    }
  });
};

const assertBarberContractIsBounded = () => {
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");
  const adminApp = readFileSync(join(root, "src", "AdminApp.jsx"), "utf8");
  const barbersPage = readFileSync(join(root, "src", "pages", "Barbers.jsx"), "utf8");
  const barberUtils = readFileSync(join(root, "src", "utils", "barbers.js"), "utf8");
  const barberUtilsTest = readFileSync(join(root, "tests", "barbers.test.js"), "utf8");

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

  const duplicateGuardSnippets = [
    [adminApp, "src/AdminApp.jsx", "findDuplicateBarberByName"],
    [barbersPage, "src/pages/Barbers.jsx", "duplicateBarber"],
    [barbersPage, "src/pages/Barbers.jsx", "savingBarber"],
    [barbersPage, "src/pages/Barbers.jsx", "archivingBarber"],
    [barbersPage, "src/pages/Barbers.jsx", "restoringBarberId"],
    [barberUtils, "src/utils/barbers.js", "normalizeBarberNameKey"],
    [barberUtils, "src/utils/barbers.js", "findDuplicateBarberByName"],
    [barberUtilsTest, "tests/barbers.test.js", "finds duplicate active barbers"],
  ];

  duplicateGuardSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`barber duplicate-name guard is missing in ${fileName}: ${snippet}`);
    }
  });
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

const assertWorkspaceDataExportExists = () => {
  const adminApp = readFileSync(join(root, "src", "AdminApp.jsx"), "utf8");
  const profileSettings = readFileSync(join(root, "src", "pages", "ProfileSettings.jsx"), "utf8");
  const dataExport = readFileSync(join(root, "src", "utils", "dataExport.js"), "utf8");
  const dataExportTest = readFileSync(join(root, "tests", "dataExport.test.js"), "utf8");

  const requiredSnippets = [
    [adminApp, "src/AdminApp.jsx", "auditLogs: 100"],
    [adminApp, "src/AdminApp.jsx", "workspaceData"],
    [profileSettings, "src/pages/ProfileSettings.jsx", "handleExportData"],
    [profileSettings, "src/pages/ProfileSettings.jsx", "Exportar dados"],
    [profileSettings, "src/pages/ProfileSettings.jsx", "createWorkspaceExportPayload"],
    [profileSettings, "src/pages/ProfileSettings.jsx", "Backup com dados pessoais"],
    [dataExport, "src/utils/dataExport.js", "schemaVersion"],
    [dataExport, "src/utils/dataExport.js", "createWorkspaceExportFilename"],
    [dataExport, "src/utils/dataExport.js", "containsPersonalData"],
    [dataExport, "src/utils/dataExport.js", "privacyNotice"],
    [dataExportTest, "tests/dataExport.test.js", "creates a portable workspace export"],
    [dataExportTest, "tests/dataExport.test.js", "manifest.containsPersonalData"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`workspace data export is incomplete in ${fileName}: ${snippet}`);
    }
  });
};

const assertPublicLinkReadinessGuardsSharing = () => {
  const onboarding = readFileSync(join(root, "src", "utils", "onboarding.js"), "utf8");
  const dashboardPage = readFileSync(join(root, "src", "pages", "Dashboard.jsx"), "utf8");
  const sidebar = readFileSync(join(root, "src", "components", "Sidebar.jsx"), "utf8");
  const onboardingTest = readFileSync(join(root, "tests", "onboarding.test.js"), "utf8");

  const requiredSnippets = [
    [onboarding, "src/utils/onboarding.js", "getPublicBookingReadiness"],
    [onboarding, "src/utils/onboarding.js", "getAccountAccess(profile)"],
    [onboarding, "src/utils/onboarding.js", "Regularize a assinatura para reativar o link publico"],
    [onboarding, "src/utils/onboarding.js", "servicesCount <= 0"],
    [onboarding, "src/utils/onboarding.js", "barbersCount <= 0"],
    [dashboardPage, "src/pages/Dashboard.jsx", "publicReadiness.isReady"],
    [dashboardPage, "src/pages/Dashboard.jsx", "Ajustar link"],
    [sidebar, "src/components/Sidebar.jsx", "Link em preparacao"],
    [sidebar, "src/components/Sidebar.jsx", "disabled={!publicReadiness.isReady}"],
    [onboardingTest, "tests/onboarding.test.js", "blocks public link sharing"],
    [onboardingTest, "tests/onboarding.test.js", "blocks public link sharing for inactive accounts"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`public link readiness guard is missing in ${fileName}: ${snippet}`);
    }
  });
};

const assertMobileAdminNavigationIsPersistent = () => {
  const adminApp = readFileSync(join(root, "src", "AdminApp.jsx"), "utf8");
  const sidebar = readFileSync(join(root, "src", "components", "Sidebar.jsx"), "utf8");

  const requiredSnippets = [
    [adminApp, "src/AdminApp.jsx", "pb-24 lg:pb-0"],
    [sidebar, "src/components/Sidebar.jsx", "fixed inset-x-0 bottom-0"],
    [sidebar, "src/components/Sidebar.jsx", 'aria-label="Navegacao principal"'],
    [sidebar, "src/components/Sidebar.jsx", "pb-[calc(0.75rem+env(safe-area-inset-bottom))]"],
    [sidebar, "src/components/Sidebar.jsx", "lg:hidden"],
    [sidebar, "src/components/Sidebar.jsx", "sticky top-0 z-40"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`mobile admin navigation is missing in ${fileName}: ${snippet}`);
    }
  });
};

const assertSetupDeepLinksGuideFirstRun = () => {
  const onboarding = readFileSync(join(root, "src", "utils", "onboarding.js"), "utf8");
  const profileSettings = readFileSync(join(root, "src", "pages", "ProfileSettings.jsx"), "utf8");
  const servicesPage = readFileSync(join(root, "src", "pages", "Services.jsx"), "utf8");
  const barbersPage = readFileSync(join(root, "src", "pages", "Barbers.jsx"), "utf8");
  const clientsPage = readFileSync(join(root, "src", "pages", "Clients.jsx"), "utf8");
  const schedulePage = readFileSync(join(root, "src", "pages", "Schedule.jsx"), "utf8");

  const requiredSnippets = [
    [onboarding, "src/utils/onboarding.js", "/perfil?setup=profile"],
    [onboarding, "src/utils/onboarding.js", "/servicos?setup=services"],
    [onboarding, "src/utils/onboarding.js", "/barbeiros?setup=barbers"],
    [onboarding, "src/utils/onboarding.js", "/agenda?setup=first-booking"],
    [profileSettings, "src/pages/ProfileSettings.jsx", "setupStep"],
    [profileSettings, "src/pages/ProfileSettings.jsx", "Ir para servicos"],
    [servicesPage, "src/pages/Services.jsx", "isSetupMode"],
    [servicesPage, "src/pages/Services.jsx", "Ir para equipe"],
    [barbersPage, "src/pages/Barbers.jsx", "isSetupMode"],
    [barbersPage, "src/pages/Barbers.jsx", "Ir para agenda"],
    [clientsPage, "src/pages/Clients.jsx", "isSetupMode"],
    [schedulePage, "src/pages/Schedule.jsx", "Crie um agendamento teste"],
    [schedulePage, "src/pages/Schedule.jsx", "Voltar ao dashboard"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`setup deep link guidance is missing in ${fileName}: ${snippet}`);
    }
  });
};

const assertPublicBookingRequiresPrivacyConsent = () => {
  const publicBooking = readFileSync(join(root, "src", "pages", "PublicBooking.jsx"), "utf8");
  const privacyConsent = readFileSync(join(root, "src", "utils", "privacyConsent.js"), "utf8");
  const privacyConsentTest = readFileSync(join(root, "tests", "privacyConsent.test.js"), "utf8");
  const rules = readFileSync(join(root, "firestore.rules"), "utf8");

  const requiredSnippets = [
    [publicBooking, "src/pages/PublicBooking.jsx", "privacyAccepted"],
    [publicBooking, "src/pages/PublicBooking.jsx", "isPrivacyConsentAccepted(privacyAccepted)"],
    [publicBooking, "src/pages/PublicBooking.jsx", "createPrivacyConsentSnapshot"],
    [publicBooking, "src/pages/PublicBooking.jsx", "Autorizo a barbearia"],
    [privacyConsent, "src/utils/privacyConsent.js", "PRIVACY_CONSENT_VERSION"],
    [privacyConsentTest, "tests/privacyConsent.test.js", "only treats explicit true as accepted"],
    [rules, "firestore.rules", "request.resource.data.privacyConsent == true"],
    [rules, "firestore.rules", "request.resource.data.privacyConsentAt is timestamp"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`public booking privacy consent is missing in ${fileName}: ${snippet}`);
    }
  });
};

const assertPublicBookingShowsConfirmationSummary = () => {
  const publicBooking = readFileSync(join(root, "src", "pages", "PublicBooking.jsx"), "utf8");
  const bookingConfirmation = readFileSync(join(root, "src", "utils", "bookingConfirmation.js"), "utf8");
  const bookingConfirmationTest = readFileSync(join(root, "tests", "bookingConfirmation.test.js"), "utf8");

  const requiredSnippets = [
    [publicBooking, "src/pages/PublicBooking.jsx", "bookingConfirmation"],
    [publicBooking, "src/pages/PublicBooking.jsx", "createBookingConfirmation"],
    [publicBooking, "src/pages/PublicBooking.jsx", "getBookingConfirmationLines"],
    [publicBooking, "src/pages/PublicBooking.jsx", "Seu horario esta aguardando confirmacao"],
    [publicBooking, "src/pages/PublicBooking.jsx", "Proximo passo"],
    [bookingConfirmation, "src/utils/bookingConfirmation.js", "createBookingConfirmation"],
    [bookingConfirmation, "src/utils/bookingConfirmation.js", "getBookingConfirmationLines"],
    [bookingConfirmationTest, "tests/bookingConfirmation.test.js", "formats confirmation lines"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`public booking confirmation summary is missing in ${fileName}: ${snippet}`);
    }
  });
};

const assertPendingAppointmentsHaveResponseFlow = () => {
  const adminApp = readFileSync(join(root, "src", "AdminApp.jsx"), "utf8");
  const appointmentCard = readFileSync(join(root, "src", "components", "AppointmentCard.jsx"), "utf8");
  const schedulePage = readFileSync(join(root, "src", "pages", "Schedule.jsx"), "utf8");
  const appointmentMessages = readFileSync(join(root, "src", "utils", "appointmentMessages.js"), "utf8");
  const appointmentMessagesTest = readFileSync(join(root, "tests", "appointmentMessages.test.js"), "utf8");

  const requiredSnippets = [
    [adminApp, "src/AdminApp.jsx", "createAppointmentWhatsAppMessage"],
    [appointmentCard, "src/components/AppointmentCard.jsx", "Confirmar no WhatsApp"],
    [appointmentCard, "src/components/AppointmentCard.jsx", "APPOINTMENT_STATUS.confirmed"],
    [schedulePage, "src/pages/Schedule.jsx", "Resposta pendente"],
    [schedulePage, "src/pages/Schedule.jsx", "Confirmar agora"],
    [schedulePage, "src/pages/Schedule.jsx", "Chamar no WhatsApp"],
    [appointmentMessages, "src/utils/appointmentMessages.js", "Recebemos sua solicitacao"],
    [appointmentMessagesTest, "tests/appointmentMessages.test.js", "asks for confirmation"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`pending appointment response flow is missing in ${fileName}: ${snippet}`);
    }
  });
};

const assertFinanceShowsOperationalHealth = () => {
  const financePage = readFileSync(join(root, "src", "pages", "Finance.jsx"), "utf8");
  const financeUtils = readFileSync(join(root, "src", "utils", "finance.js"), "utf8");
  const financeTest = readFileSync(join(root, "tests", "finance.test.js"), "utf8");

  const requiredSnippets = [
    [financePage, "src/pages/Finance.jsx", "Conversao financeira"],
    [financePage, "src/pages/Finance.jsx", "Receita pendente"],
    [financePage, "src/pages/Finance.jsx", "Proximos recebimentos"],
    [financePage, "src/pages/Finance.jsx", "getUpcomingRevenueAppointments"],
    [financeUtils, "src/utils/finance.js", "calculateFinanceMetrics"],
    [financeUtils, "src/utils/finance.js", "pendingRevenue"],
    [financeUtils, "src/utils/finance.js", "completionRate"],
    [financeTest, "tests/finance.test.js", "calculates realized, projected, pending and lost revenue"],
    [financeTest, "tests/finance.test.js", "calculates operational conversion rates"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`finance operational health is missing in ${fileName}: ${snippet}`);
    }
  });
};

const assertAdminDataSyncCanRetry = () => {
  const adminApp = readFileSync(join(root, "src", "AdminApp.jsx"), "utf8");

  const requiredSnippets = [
    [adminApp, "src/AdminApp.jsx", "syncRetryToken"],
    [adminApp, "src/AdminApp.jsx", "retryDataSync"],
    [adminApp, "src/AdminApp.jsx", "setSyncRetryToken((currentToken) => currentToken + 1)"],
    [adminApp, "src/AdminApp.jsx", "Tentar novamente"],
    [adminApp, "src/AdminApp.jsx", "admin_data_sync_retry"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`admin data sync retry is missing in ${fileName}: ${snippet}`);
    }
  });
};

const assertPublicBookingSubmitRespectsAvailability = () => {
  const publicBooking = readFileSync(join(root, "src", "pages", "PublicBooking.jsx"), "utf8");
  const scheduleUtils = readFileSync(join(root, "src", "utils", "schedule.js"), "utf8");
  const scheduleTest = readFileSync(join(root, "tests", "schedule.test.js"), "utf8");

  const requiredSnippets = [
    [publicBooking, "src/pages/PublicBooking.jsx", "isTimeSlotAvailable"],
    [publicBooking, "src/pages/PublicBooking.jsx", "isTimeAvailable(time)"],
    [publicBooking, "src/pages/PublicBooking.jsx", "slotsLoading"],
    [publicBooking, "src/pages/PublicBooking.jsx", "let isActive = true"],
    [publicBooking, "src/pages/PublicBooking.jsx", "setBookedSlots([])"],
    [publicBooking, "src/pages/PublicBooking.jsx", "!slotsLoading"],
    [publicBooking, "src/pages/PublicBooking.jsx", "Carregando horarios"],
    [scheduleUtils, "src/utils/schedule.js", "export const isTimeSlotAvailable"],
    [scheduleTest, "tests/schedule.test.js", "detects whether a public booking slot is still available"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`public booking submit availability guard is missing in ${fileName}: ${snippet}`);
    }
  });
};

const assertClientListSupportsWhatsAppContact = () => {
  const clientsPage = readFileSync(join(root, "src", "pages", "Clients.jsx"), "utf8");

  const requiredSnippets = [
    [clientsPage, "src/pages/Clients.jsx", "createWhatsAppUrl"],
    [clientsPage, "src/pages/Clients.jsx", "createClientWhatsAppLink"],
    [clientsPage, "src/pages/Clients.jsx", "target=\"_blank\""],
    [clientsPage, "src/pages/Clients.jsx", "WhatsApp"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`client WhatsApp contact action is missing in ${fileName}: ${snippet}`);
    }
  });
};

const assertClientActionsHaveSubmitGuards = () => {
  const clientsPage = readFileSync(join(root, "src", "pages", "Clients.jsx"), "utf8");

  const requiredSnippets = [
    [clientsPage, "src/pages/Clients.jsx", "savingClient"],
    [clientsPage, "src/pages/Clients.jsx", "archivingClient"],
    [clientsPage, "src/pages/Clients.jsx", "restoringClientId"],
    [clientsPage, "src/pages/Clients.jsx", "Salvando cliente"],
    [clientsPage, "src/pages/Clients.jsx", "Arquivando..."],
    [clientsPage, "src/pages/Clients.jsx", "Restaurando..."],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`client submit guard is missing in ${fileName}: ${snippet}`);
    }
  });
};

const assertWhatsAppTemplatesAreDomainDriven = () => {
  const whatsappPage = readFileSync(join(root, "src", "pages", "WhatsApp.jsx"), "utf8");
  const whatsappTemplates = readFileSync(join(root, "src", "utils", "whatsappTemplates.js"), "utf8");
  const whatsappTemplatesTest = readFileSync(join(root, "tests", "whatsappTemplates.test.js"), "utf8");

  const requiredSnippets = [
    [whatsappPage, "src/pages/WhatsApp.jsx", "WHATSAPP_TEMPLATES"],
    [whatsappPage, "src/pages/WhatsApp.jsx", "renderWhatsAppTemplate"],
    [whatsappTemplates, "src/utils/whatsappTemplates.js", "Pedido de avaliacao"],
    [whatsappTemplates, "src/utils/whatsappTemplates.js", "Reagendamento"],
    [whatsappTemplates, "src/utils/whatsappTemplates.js", "WHATSAPP_TEMPLATE_VARIABLES"],
    [whatsappTemplatesTest, "tests/whatsappTemplates.test.js", "keeps a useful catalog"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`WhatsApp template domain is missing in ${fileName}: ${snippet}`);
    }
  });
};

const assertLaunchMetadataIsReady = () => {
  const indexHtml = readFileSync(join(root, "index.html"), "utf8");
  const manifest = readFileSync(join(root, "public", "manifest.webmanifest"), "utf8");
  const robots = readFileSync(join(root, "public", "robots.txt"), "utf8");
  const ogImage = readFileSync(join(root, "public", "og-image.svg"), "utf8");

  const requiredSnippets = [
    [indexHtml, "index.html", 'meta name="application-name" content="BarberOS"'],
    [indexHtml, "index.html", 'property="og:image" content="/og-image.svg"'],
    [indexHtml, "index.html", 'name="twitter:card" content="summary_large_image"'],
    [manifest, "public/manifest.webmanifest", '"purpose": "any maskable"'],
    [manifest, "public/manifest.webmanifest", '"screenshots"'],
    [robots, "public/robots.txt", "Disallow: /dashboard"],
    [robots, "public/robots.txt", "Disallow: /agenda"],
    [ogImage, "public/og-image.svg", "BarberOS"],
    [ogImage, "public/og-image.svg", "1200"],
    [ogImage, "public/og-image.svg", "630"],
  ];

  requiredSnippets.forEach(([fileContent, fileName, snippet]) => {
    if (!fileContent.includes(snippet)) {
      failures.push(`launch metadata is missing in ${fileName}: ${snippet}`);
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
assertWorkspaceDataExportExists();
assertPublicLinkReadinessGuardsSharing();
assertMobileAdminNavigationIsPersistent();
assertSetupDeepLinksGuideFirstRun();
assertPublicBookingRequiresPrivacyConsent();
assertPublicBookingShowsConfirmationSummary();
assertPendingAppointmentsHaveResponseFlow();
assertFinanceShowsOperationalHealth();
assertAdminDataSyncCanRetry();
assertPublicBookingSubmitRespectsAvailability();
assertClientListSupportsWhatsAppContact();
assertClientActionsHaveSubmitGuards();
assertWhatsAppTemplatesAreDomainDriven();
assertLaunchMetadataIsReady();

if (failures.length > 0) {
  console.error("Production check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Production check passed.");
