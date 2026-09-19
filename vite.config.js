import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: ".",
  publicDir: "public",
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        dataPolicy: resolve(rootDir, "data-policy.html"),
        privacyPolicy: resolve(rootDir, "privacy-policy.html"),
        forumIndex: resolve(rootDir, "forum/index.html"),
        forumCategory: resolve(rootDir, "forum/category.html"),
        forumThread: resolve(rootDir, "forum/thread.html"),
        forumNew: resolve(rootDir, "forum/new.html"),
        forumSetup: resolve(rootDir, "forum/setup.html"),
        forumProfile: resolve(rootDir, "forum/profile.html"),
        forumUser: resolve(rootDir, "forum/user.html"),
      },
    },
  },
});
