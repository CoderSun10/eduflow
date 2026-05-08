import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: ["node_modules/**", "dist/**"],
  },
  {
    files: ["src/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: "latest",
      globals: globals.node,
    },
    rules: {
      "no-console": "off",
    },
  },
]);
