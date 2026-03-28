import mocha from "eslint-plugin-mocha";
import globals from "globals";
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

            ecmaVersion: 2025,
            sourceType: "module",
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
            // New in ESLint 10 eslint:recommended -- requires { cause: err } on re-thrown errors.
            // The codebase has ~25 violations; fixing error handling semantics is a separate concern.
            "preserve-caught-error": "warn",
        },
    },
    {
        // CJS files use CommonJS module format
        files: ["**/*.cjs"],
        languageOptions: {
            sourceType: "commonjs",
        },
    },
    {
        // Some v2 modeltypes files use ESM export syntax despite the .cjs extension;
        // they will be converted to .js in a future refactor
        files: [
            "src/models/v2/issuance-v2.modeltypes.cjs",
            "src/models/v2/program-v2.modeltypes.cjs",
            "src/models/v2/project-v2.modeltypes.cjs",
            "src/models/v2/unit-v2.modeltypes.cjs",
            "src/models/v2/validation-v2.modeltypes.cjs",
            "src/models/v2/verification-v2.modeltypes.cjs",
        ],
        languageOptions: {
            sourceType: "module",
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
        // These modules intentionally use lazy imports to avoid cycles and
        // to load optional runtime-only dependencies on-demand.
        files: [
            "src/middleware.js",
            "src/models/organizations/organizations.model.js",
            "src/models/v2/filestore-v2.model.js",
            "src/models/v2/staging-v2.model.js",
        ],
        rules: {
            "no-restricted-syntax": "off",
        },
    },
    {
        // Test-specific configuration
        files: ["tests/**/*.js", "**/*.spec.js", "**/*.test.js"],
        languageOptions: {
            globals: {
                ...globals.commonjs,
                ...globals.node,
                ...globals.mocha,
            },
        },
        rules: {
            // More lenient rules for test files
            "no-console": "off",                     // Allow console.log in tests
            "mocha/no-hooks-for-single-case": "off", // Sometimes useful in tests
        },
    }
];
