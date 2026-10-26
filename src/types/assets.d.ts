// Metro resolves image imports to an asset id usable as an <Image> source, and font imports to an
// asset id expo-font loads.
declare module '*.png' {
  const source: number;
  export default source;
}

declare module '*.ttf' {
  const source: number;
  export default source;
}

declare module '*.webp' {
  const source: number;
  export default source;
}
