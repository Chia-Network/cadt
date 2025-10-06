import es from "eslint-plugin-es";
import globals from "globals";
import babelParser from "@babel/eslint-parser";
import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        plugins: {
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
    },
];