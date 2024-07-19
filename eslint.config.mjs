import mocha from "eslint-plugin-mocha";
import es from "eslint-plugin-es";
import globals from "globals";
import babelParser from "@babel/eslint-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [...compat.extends("eslint:recommended", "plugin:mocha/recommended"), {
    plugins: {
        mocha,
        es,
    },

    languageOptions: {
        globals: {
            ...globals.commonjs,
            ...globals.node,
        },

        parser: babelParser,
        ecmaVersion: 13,
        sourceType: "module",

        parserOptions: {
            requireConfigFile: false,
        },
    },

    settings: {
        es: {
            deprecatedAssertSyntax: true,
            allowImportExportEverywhere: true,
            importAssertions: true,
        },
    },

    rules: {
        "es/no-dynamic-import": "error",
    },
}];