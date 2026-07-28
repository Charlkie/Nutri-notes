import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "framework";
          if (id.includes("dexie")) return "storage";
          if (id.includes("date-fns")) return "dates";
          if (id.includes("@dnd-kit")) return "interactions";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("zod")) return "validation";
          return "vendor";
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Nutri Notes",
        short_name: "Nutri",
        description: "Fast, private, offline nutrition logging.",
        theme_color: "#080b0d",
        background_color: "#080b0d",
        display: "standalone",
        start_url: "./",
        orientation: "portrait-primary",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,json}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
