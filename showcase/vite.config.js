import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  appType: "mpa",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        compare: fileURLToPath(new URL("./index.html", import.meta.url)),
        seismic: fileURLToPath(new URL("./a.html", import.meta.url)),
        seismicV2: fileURLToPath(new URL("./a-v2.html", import.meta.url)),
        seismicV3: fileURLToPath(new URL("./a-v3.html", import.meta.url)),
        terminalStory: fileURLToPath(
          new URL("./terminal-story.html", import.meta.url),
        ),
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: {},
  },
  preview: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
  },
});
