// Allow TypeScript to accept CSS file imports (e.g. react-image-crop)
declare module '*.css' {
  const content: Record<string, string>
  export default content
}
