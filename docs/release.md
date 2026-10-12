# Release process

Releases are automated with [release-please](https://github.com/googleapis/release-please) and published as signed APKs on [GitHub Releases](https://github.com/someoneinthe/dishes-cook/releases).

## How it works

1. Every merge to `main` runs the **Release** workflow. release-please reads the Conventional Commits since the last tag and opens/updates a **release PR** (`chore(main): release x.y.z`) that bumps `package.json`, `package-lock.json`, `.release-please-manifest.json` and updates `CHANGELOG.md`.
2. When you want to ship, **merge the release PR**.
3. release-please creates the tag `vX.Y.Z` and the GitHub Release with the changelog.
4. The same workflow then prebuilds the Android project, runs `gradlew assembleRelease`, signs the APK with the upload keystore, and attaches `dishes-cook-vX.Y.Z.apk` to the release.

`versionCode` is derived from the version (`1.2.3` → `1002003`), so every release installs over the previous one.

To force a specific version, add a commit to `main` with the footer `Release-As: 1.0.0`.

## One-time setup

### 1. Repository settings

- **Settings → Actions → General → Workflow permissions**: enable _Allow GitHub Actions to create and approve pull requests_ (needed for the release PR).
- **Settings → General → Pull Requests**: allow squash merging only; enable "Default to PR title for squash merge commits".
- **Settings → Environments**: create an environment named `release` (optionally restricted to `main`) and put the signing secrets below in it.
- **Branch protection on `main`**: require a PR, and require the checks _Lint, typecheck & test_ and _Conventional PR title_.

> Note: PRs opened by the default `GITHUB_TOKEN` don't trigger other workflows, so CI won't run on the release PR itself. If you make CI checks required, either merge it with admin bypass, or switch release-please to a fine-grained PAT / GitHub App token (`token:` input).

### 2. Signing keystore

Generate it once and **back it up** (password manager + offline copy). Losing it means users must uninstall to get updates.

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore dishes-cook-release.jks -alias dishes-cook \
  -keyalg RSA -keysize 4096 -validity 10000
```

Add these secrets to the `release` environment:

| Secret                      | Value                                      |
| --------------------------- | ------------------------------------------ |
| `ANDROID_KEYSTORE_BASE64`   | `base64 -i dishes-cook-release.jks`        |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password                          |
| `ANDROID_KEY_ALIAS`         | `dishes-cook`                              |
| `ANDROID_KEY_PASSWORD`      | key password (same as keystore for PKCS12) |

Never commit the keystore (`*.jks` is git-ignored).

## Installing a release

Download the APK from the release page on the phone and open it (allow "install unknown apps" for the browser once). Updates install over the existing app as long as the same keystore signs them.

## Later: Play Store / iOS

- Play Store: build an `.aab` (`gradlew bundleRelease`) and upload with the same key as upload key (Play App Signing). EAS Build/Submit is an alternative.
- iOS: needs an Apple Developer account; EAS Build is the simplest path from this setup.
