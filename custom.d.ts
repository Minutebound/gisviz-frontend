// custom.d.ts
// Place this file in the root of the frontend project (same level as tsconfig.json).
// It tells TypeScript that importing any *.css file is a valid side-effect import
// that yields no typed exports — which is exactly what `import './globals.css'` does.
// Next.js handles the actual CSS loading; TypeScript just needs to stop flagging it.

declare module '*.css' {
  const styles: { [className: string]: string }
  export default styles
}