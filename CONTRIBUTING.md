# Contributing

## Development

Install the locked dependencies with `npm ci`. Before opening a pull request, run:

```sh
npm run check
```

The check command audits dependencies, checks formatting, lints the code, typechecks it, builds the
package, and runs tests with 100% coverage thresholds. Pull requests run this full check once on
Node.js 24 with locked Vite 8, then run only typechecking and tests with Vite 7 for compatibility.

## Temporary development dependency override

The lockfile scopes an override to `vite-plugin-singlefile@2.3.3`, replacing its `micromatch`
dependency with `picomatch@4.0.7`. This removes the vulnerable `braces` dependency associated with
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The plugin only calls
`micromatch.isMatch` for `inlinePattern`, and that method in micromatch 4 delegates directly to
picomatch. Tests exercise this API, including brace and extglob patterns and deeply nested input.
Keep the version scope and exact `vite-plugin-singlefile` development dependency in sync. Remove
the override when an upstream release no longer has the vulnerable dependency or provides a reviewed
fixed replacement. It applies only when developing this repository; it does not change consumers'
installations of `vite-plugin-singlefile`.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/), for example:

```text
feat: support custom output directories
fix: wait for the bundle to finish writing
docs: clarify escaping options
```

Commit messages are checked locally and in CI. Mark breaking changes with `!` after the type or a
`BREAKING CHANGE:` footer.

The repository accepts squash merges only, so the pull request title becomes the commit subject
and must also follow Conventional Commits. Merging requires an up-to-date branch, resolved review
threads, and passing `Quality gate` and `Conventional commits` checks. Direct pushes and force
pushes to protected branches are blocked.

## Releases

Release Please opens a version and changelog pull request from conventional commits on `main`. The
migration's breaking Conventional Commit makes the next release `2.0.0`.
Merging that release pull request creates a version tag; the release workflow validates that tag
and publishes the package with npm trusted publishing. Before the first release, an npm maintainer
must add a trusted publisher in the npm package settings with provider **GitHub Actions**, owner
`maxmeis`, repository `vite-plugin-singlefile-escaped`, and workflow filename `release-please.yml`.
The publish job uses Node 22.14 and npm 11.5.1 or newer, as required by npm OIDC publishing.
