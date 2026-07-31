import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const assetsDir = join(process.cwd(), "dist", "assets");
const budgets = {
  maxJsAssetGzipKb: 115,
  maxCssAssetGzipKb: 14,
  maxTotalJsGzipKb: 260,
};

const toKb = (bytes) => bytes / 1024;
const formatKb = (bytes) => `${toKb(bytes).toFixed(1)} kB`;

const assets = readdirSync(assetsDir)
  .map((name) => {
    const filePath = join(assetsDir, name);
    const stats = statSync(filePath);
    const content = readFileSync(filePath);

    return {
      name,
      bytes: stats.size,
      gzipBytes: gzipSync(content).length,
      type: name.endsWith(".css") ? "css" : name.endsWith(".js") ? "js" : "other",
    };
  })
  .filter((asset) => asset.type !== "other");

const failures = [];
const jsAssets = assets.filter((asset) => asset.type === "js");
const cssAssets = assets.filter((asset) => asset.type === "css");
const totalJsGzipBytes = jsAssets.reduce((total, asset) => total + asset.gzipBytes, 0);

jsAssets.forEach((asset) => {
  if (toKb(asset.gzipBytes) > budgets.maxJsAssetGzipKb) {
    failures.push(
      `${asset.name} gzip ${formatKb(asset.gzipBytes)} exceeds JS asset budget ${budgets.maxJsAssetGzipKb} kB`
    );
  }
});

cssAssets.forEach((asset) => {
  if (toKb(asset.gzipBytes) > budgets.maxCssAssetGzipKb) {
    failures.push(
      `${asset.name} gzip ${formatKb(asset.gzipBytes)} exceeds CSS asset budget ${budgets.maxCssAssetGzipKb} kB`
    );
  }
});

if (toKb(totalJsGzipBytes) > budgets.maxTotalJsGzipKb) {
  failures.push(
    `total JS gzip ${formatKb(totalJsGzipBytes)} exceeds budget ${budgets.maxTotalJsGzipKb} kB`
  );
}

if (failures.length > 0) {
  console.error("Bundle budget failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Bundle budget passed. JS gzip total: ${formatKb(totalJsGzipBytes)}. Largest JS: ${
    jsAssets.sort((first, second) => second.gzipBytes - first.gzipBytes)[0]?.name || "n/a"
  }.`
);
