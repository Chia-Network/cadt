import mocha from "eslint-plugin-mocha";
import globals from "globals";
import babelParser from "@babel/eslint-parser";
import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        plugins: {
            mocha,
        },

        languageOptions: {
            globals: {
                ...globals.commonjs,
                ...globals.node,
            },

            parser: babelParser,
            ecmaVersion: 2024, // Modern ECMAScript version
            sourceType: "module",

            parserOptions: {
                requireConfigFile: false,
                // Enable modern features
                allowImportExportEverywhere: true,
            },
        },

        rules: {
            // Use modern ESLint built-in rules instead of eslint-plugin-es
            // Restrict dynamic imports by default for architectural consistency
            "no-restricted-syntax": [
                "error",
                {
                    "selector": "ImportExpression",
                    "message": "Dynamic imports are restricted. Use static imports for better bundling and analysis. If dynamic import is absolutely necessary, add an ESLint disable comment with justification."
                }
            ],

            // Mocha rules - restore the important ones for test quality
            "mocha/no-exclusive-tests": "error",     // Prevent .only() in commits - CRITICAL
            "mocha/no-global-tests": "error",        // Ensure tests are in describe blocks
            "mocha/no-return-and-callback": "error", // Prevent async test mistakes
            "mocha/no-sibling-hooks": "error",       // Proper hook organization

            // Additional code quality rules
            "no-console": "warn",                    // Discourage console.log in production code
            "no-debugger": "error",                 // Prevent debugger statements
            "prefer-const": "error",                // Use const when possible
            "no-var": "error",                      // Use let/const instead of var
        },
    },
    {
        // Allow dynamic imports ONLY in files that need lazy loading for optional dependencies
        files: ["src/datalayer/simulator.js"],
        rules: {
            "no-restricted-syntax": "off", // Exception for log-update lazy loading
        },
    },
    {
        // Test-specific configuration
        files: ["tests/**/*.js", "**/*.spec.js", "**/*.test.js"],
        rules: {
            // More lenient rules for test files
            "no-console": "off",                     // Allow console.log in tests
            "mocha/no-hooks-for-single-case": "off", // Sometimes useful in tests
        },
    }
];
