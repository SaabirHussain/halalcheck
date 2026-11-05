import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      ".next-handoff-build/**",
      ".next-prodcheck/**",
      "node_modules/**",
      "android/**/build/**",
      "android/.gradle/**",
      "ios/**/build/**",
      "ios/DerivedData/**",
      "drizzle/meta/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
