// Type-only shim: lets TypeScript language services resolve the Emotion JSX
// runtime types when the package is not visible at the node_modules root
// (pnpm layouts). No runtime effect; the build resolves the real module.
declare module '@emotion/react/jsx-runtime' {
  export * from 'react/jsx-runtime'
}
