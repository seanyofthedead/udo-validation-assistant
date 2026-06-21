// jest-dom matchers for component tests (SPEC §7 screens, IMPLEMENTATION_PLAN Wave 3).
//
// The default Vitest environment is `node` (fast; see vite.config.ts). Component
// tests opt into a DOM per file. Either add a docblock + this import at the top
// of the test file:
//
//   // @vitest-environment jsdom
//   import '@testing-library/jest-dom/vitest';
//
// ...or, once several DOM tests exist, register this file as a setupFile on a
// jsdom test project. Importing it gives `expect(...).toBeInTheDocument()` etc.
import '@testing-library/jest-dom/vitest';
