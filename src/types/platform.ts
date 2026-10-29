// A module's web version (`x.web.ts`) must export what its phone version (`x.ts`) does: TypeScript
// only reads the phone's, Metro picks the web's in a browser. Each pair is checked in
// platform-apis.ts, which fails to compile when they differ.
export type SamePlatformApi<Web extends Phone, Phone> = Web;
