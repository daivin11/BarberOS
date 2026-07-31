import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router-dom")) return "react-router";
          if (id.includes("react-dom") || isReactPackage(id)) {
            return "react-vendor";
          }
          if (id.includes("firebase") || id.includes("@firebase")) {
            if (id.includes("auth")) return "firebase-auth";
            if (id.includes("firestore")) return "firebase-firestore";
            return "firebase-core";
          }
          return "vendor";
        },
      },
    },
  },
});

function isReactPackage(id) {
  return id.includes("/react/") || id.includes("\\react\\");
}
