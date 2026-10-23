# Release process

Releases are automated with [release-please](https://github.com/googleapis/release-please) and published as signed APKs on [GitHub Releases](https://github.com/someoneinthe/dishes-cook/releases).

## How it works

1. Every merge to `main` runs the **Release** workflow. release-please reads the Conventional Commits since the last tag and opens/updates a **release PR** (`chore(main): release x.y.z`) that bumps `package.json`, `package-lock.json`, `.release-please-manifest.json` and updates `CHANGELOG.md`.
2. When you want to ship, **merge the release PR**.
3. release-please creates the tag `vX.Y.Z` and the GitHub Release with the changelog.
4. The same workflow then prebuilds the Android project, runs `gradlew assembleRelease`, signs the APK with the upload keystore, and attaches `dishes-cook-vX.Y.Z.apk` to the release.
5. It also attaches the sync server's files (`server-files.tar.gz`, its `.sha256` and its build-provenance attestation `.sigstore.json`, which servers check and install from the latest release, see [sync.md › Updating the server](sync.md#updating-the-server)), the features page (`docs/features.md`, generated from the Gherkin scenarios by `npm run docs:features`) and the database diagram as images (`database-diagram.png` / `.svg`), rendered from `docs/database.md` with Mermaid's CLI by `scripts/render-database-diagram.sh` (run it locally with Chrome installed). CI renders it on PRs that change the diagram (artifact `database-diagram`), so the release never meets a broken rendering.

`versionCode` is derived from the version (`1.2.3` → `1002003`), so every release installs over the previous one.

To force a specific version, set `"release-as": "1.0.0"` on the package in `release-please-config.json`, and remove it once that release is out (otherwise the next release PR proposes the same version again). A `Release-As: 1.0.0` footer in a squash-merged PR's description also works, but only while it stays the last paragraph of the commit message: CodeRabbit appends its summary to the description, after it, and the footer was ignored for 1.0.0 (#118).

## One-time setup

### 1. Repository settings (already applied)

These are configured on GitHub; keep them in sync if you change workflows or job names.

- **Settings → Actions → General → Workflow permissions**: read-only default token, and _Allow GitHub Actions to create and approve pull requests_ enabled (needed for the release PR).
- **Settings → General → Pull Requests**: squash merging only, commit title = PR title, branches deleted after merge.
- **Settings → Environments**: `release` environment, deployable from `main` only; it holds the signing secrets below.
- **Settings → Rules → Rulesets → `main`**: no direct pushes, force-pushes or deletion; changes land through a squash-merged PR once **every CI job** has completed successfully **on a branch that is up to date with `main`** (rebase first, see CONTRIBUTING), so two PRs that pass separately can't break `main` together:

  | Required check                 | Workflow                                                                                      |
  | ------------------------------ | --------------------------------------------------------------------------------------------- |
  | Lint, typecheck & test         | `ci.yml` (includes the SonarQube Cloud scan)                                                  |
  | Detect native changes          | `ci.yml`                                                                                      |
  | Android build                  | `ci.yml`: debug arm64 build, skipped (= passed) when the native fingerprint was already built |
  | Conventional PR title          | `pr-title.yml`                                                                                |
  | CodeQL (javascript-typescript) | `codeql.yml`                                                                                  |
  | CodeQL (actions)               | `codeql.yml`                                                                                  |
  | CodeQL (code scanning result)  | GitHub Advanced Security                                                                      |
  | Dependency review              | `dependency-review.yml`                                                                       |

  Checks are pinned to the GitHub Actions / Advanced Security apps. **Renaming a job or workflow requires updating the ruleset**, otherwise PRs wait forever for the old name.

> Note: PRs opened by the default `GITHUB_TOKEN` don't trigger other workflows, so no checks run on the release PR. Repository admins can bypass the ruleset when merging a PR: use that for the release PR, or switch release-please to a fine-grained PAT / GitHub App token (`token:` input) so CI runs on it.

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
