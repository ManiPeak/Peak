import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url))
});

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "build/**",
      "dist/**",
      "release/**",
      "out/**",
      "data/**",
      "next-env.d.ts"
    ]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // فرایند اصلی Electron ذاتاً CommonJS است
    files: ["electron/**/*.js", "electron-builder.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  },
  {
    rules: {
      // هشدارهای «unused» در فایل‌های بزرگ بیش از حد پرحرف می‌زنند؛
      // خطاهای واقعی (no-undef, no-unsafe…) همچنان فعال‌اند.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      // کد این پروژه عمداً با کامنت‌های فارسی است؛ مشکلی نیست.
      "no-console": "off",
      eqeqeq: ["error", "smart"]
    }
  }
];

export default config;