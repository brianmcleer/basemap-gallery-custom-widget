// Intentionally empty compatibility file for existing installations.
//
// The widget uses classic JSX in tsconfig.json. Its editor declarations live in
// src/exb-editor-shims.d.ts and src/vendor-shims.d.ts.
//
// Do not re-export react/jsx-runtime here. A separate ambient module that does
// so can make Visual Studio read the real @types/react/jsx-runtime.d.ts through
// a pnpm junction, even with classic JSX and skipLibCheck enabled.
//
// Keep this file in the ZIP so copying an update over an older widget replaces
// the obsolete shim. Removing it only from the ZIP would leave the old file on
// disk. This file emits no JavaScript and does not change widget behavior.
