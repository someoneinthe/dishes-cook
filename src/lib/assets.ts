// Single entry point for image assets: import images from '@/lib/assets', never from assets/
// directly. Relative paths here keep SonarQube's "undeclared dependency" rule (S4328) active
// everywhere: it can't resolve the `@/assets/*` alias to an image file and reports it as a package.
export { default as loadingScreenImage } from '../../assets/images/loading-icon.webp';
