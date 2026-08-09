import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const readJson = (fileName) => {
  try {
    return JSON.parse(readFileSync(join(root, fileName), "utf8"));
  } catch (error) {
    failures.push(`${fileName} is not valid JSON: ${error.message}`);
    return {};
  }
};

const getHeaderMap = (headers = []) =>
  new Map(headers.map((header) => [String(header.key || "").toLowerCase(), String(header.value || "")]));

const expectedCsp =
  "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.firebaseinstallations.googleapis.com https://*.gstatic.com wss://*.firebaseio.com; form-action 'self'; upgrade-insecure-requests";

const assertHeader = (headers, key, expectedValue, source) => {
  const value = getHeaderMap(headers).get(key.toLowerCase());
  if (value !== expectedValue) {
    failures.push(`${source} missing ${key}: expected "${expectedValue}", got "${value || "missing"}"`);
  }
};

const assertFirebaseHosting = () => {
  const firebaseConfig = readJson("firebase.json");
  const hosting = firebaseConfig.hosting || {};

  if (hosting.public !== "dist") {
    failures.push('firebase.json hosting.public must be "dist"');
  }

  const rewrites = Array.isArray(hosting.rewrites) ? hosting.rewrites : [];
  const hasSpaFallback = rewrites.some((rewrite) => rewrite.source === "**" && rewrite.destination === "/index.html");
  if (!hasSpaFallback) {
    failures.push("firebase.json is missing SPA fallback rewrite to /index.html");
  }

  const headers = Array.isArray(hosting.headers) ? hosting.headers : [];
  const assetHeaders = headers.find((entry) => entry.source === "/assets/**")?.headers || [];
  assertHeader(assetHeaders, "Cache-Control", "public, max-age=31536000, immutable", "firebase assets headers");

  const appHeaders = headers.find((entry) => entry.source === "**")?.headers || [];
  assertHeader(appHeaders, "X-Content-Type-Options", "nosniff", "firebase app headers");
  assertHeader(appHeaders, "X-Frame-Options", "DENY", "firebase app headers");
  assertHeader(appHeaders, "Referrer-Policy", "strict-origin-when-cross-origin", "firebase app headers");
  assertHeader(appHeaders, "Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()", "firebase app headers");
  assertHeader(appHeaders, "Content-Security-Policy", expectedCsp, "firebase app headers");
  assertHeader(appHeaders, "Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload", "firebase app headers");
};

const assertVercelHosting = () => {
  const vercelConfig = readJson("vercel.json");

  const rewrites = Array.isArray(vercelConfig.rewrites) ? vercelConfig.rewrites : [];
  const hasSpaFallback = rewrites.some((rewrite) => rewrite.source === "/(.*)" && rewrite.destination === "/index.html");
  if (!hasSpaFallback) {
    failures.push("vercel.json is missing SPA fallback rewrite to /index.html");
  }

  const headers = Array.isArray(vercelConfig.headers) ? vercelConfig.headers : [];
  const assetHeaders = headers.find((entry) => entry.source === "/assets/(.*)")?.headers || [];
  assertHeader(assetHeaders, "Cache-Control", "public, max-age=31536000, immutable", "vercel assets headers");

  const appHeaders = headers.find((entry) => entry.source === "/(.*)")?.headers || [];
  assertHeader(appHeaders, "X-Content-Type-Options", "nosniff", "vercel app headers");
  assertHeader(appHeaders, "X-Frame-Options", "DENY", "vercel app headers");
  assertHeader(appHeaders, "Referrer-Policy", "strict-origin-when-cross-origin", "vercel app headers");
  assertHeader(appHeaders, "Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()", "vercel app headers");
  assertHeader(appHeaders, "Content-Security-Policy", expectedCsp, "vercel app headers");
  assertHeader(appHeaders, "Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload", "vercel app headers");
};

const assertPublicLaunchAssets = () => {
  const requiredFiles = [
    "public/favicon.svg",
    "public/manifest.webmanifest",
    "public/og-image.svg",
    "public/robots.txt",
  ];

  requiredFiles.forEach((filePath) => {
    if (!existsSync(join(root, filePath))) {
      failures.push(`required public asset is missing: ${filePath}`);
    }
  });

  const indexHtml = readFileSync(join(root, "index.html"), "utf8");
  if (!indexHtml.includes('rel="manifest" href="/manifest.webmanifest"')) {
    failures.push("index.html does not link the web manifest");
  }
  if (!indexHtml.includes('property="og:image" content="/og-image.svg"')) {
    failures.push("index.html does not expose the social preview image");
  }
};

assertFirebaseHosting();
assertVercelHosting();
assertPublicLaunchAssets();

if (failures.length > 0) {
  console.error("Hosting check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Hosting check passed.");
