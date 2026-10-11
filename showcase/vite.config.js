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
        atlas: fileURLToPath(new URL("./b.html", import.meta.url)),
        atelier: fileURLToPath(
          new URL("./atelier-traces.html", import.meta.url),
        ),
        atelierKit: fileURLToPath(
          new URL("./atelier-traces-kit.html", import.meta.url),
        ),
        topologie: fileURLToPath(
          new URL("./topologie-indices.html", import.meta.url),
        ),
        topologieKit: fileURLToPath(
          new URL("./topologie-indices-kit.html", import.meta.url),
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
