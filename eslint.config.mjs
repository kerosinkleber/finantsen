import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/**", "node_modules/**", "drizzle/**", "public/sw.js", "next-env.d.ts", "test-results/**", "playwright-report/**"] },
  ...nextVitals,
  ...nextTs,
];
export default config;
