export { default as iconFont } from '../../assets/fonts/app-icons.ttf';
// Single entry point for image and font assets: import them from '@/lib/assets', never from
// assets/ directly. Relative paths here keep SonarQube's "undeclared dependency" rule (S4328)
// active everywhere: it can't resolve the `@/assets/*` alias to a file and reports it as a package.
export { default as loadingScreenImage } from '../../assets/images/loading-icon.webp';
