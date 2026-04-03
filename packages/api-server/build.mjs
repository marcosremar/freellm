import esbuild from "esbuild";
import { esbuildPluginPino } from "esbuild-plugin-pino";

await esbuild.build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: "dist/index.mjs",
  sourcemap: true,
  packages: "external",
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
});
