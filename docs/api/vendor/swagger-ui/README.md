# Vendored Swagger UI

Third-party code used by [`docs/api/index.html`](../../index.html), the Swagger UI page published to GitHub Pages. The files are copied **unchanged** from the published npm package; do not edit them.

| | |
|---|---|
| Package | [`swagger-ui-dist`](https://www.npmjs.com/package/swagger-ui-dist) |
| Version | 5.33.0 (the same version `package-lock.json` resolves for `@nestjs/swagger`, which serves the local `/api-docs`) |
| Source | npm registry: `https://registry.npmjs.org/swagger-ui-dist/-/swagger-ui-dist-5.33.0.tgz` |
| Tarball integrity | `sha512-wpdK+m6BU5yj6pmUdMskZVTSWYG4DLglAx3sIhylloY37i8O37IrH+YEpqdXNfpaTGxILRBFzUqLF2jKqbfI7A==` |
| License | Apache-2.0, see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE) |

## Files

| File | Why it is here |
|---|---|
| `swagger-ui-bundle.js` | Swagger UI itself |
| `swagger-ui-bundle.js.LICENSE.txt` | Licenses of the libraries inside the bundle; the bundle's first line points to it |
| `swagger-ui.css` | Swagger UI styles |
| `swagger-ui.css.map` | Source map the stylesheet refers to, so browser DevTools do not report a missing file |
| `LICENSE`, `NOTICE` | Apache-2.0 license and notice of the package |

## How to update

The vendored-files step of the `CI` workflow ([`ci.yml`](../../../../.github/workflows/ci.yml)), run on every pull request, runs `npm ci` and compares every file here (except this README) byte for byte with `node_modules/swagger-ui-dist/`, and fails if a file `index.html` loads is missing. If a dependency update moves `swagger-ui-dist` to another version, that check fails until the files here are updated:

1. Check which version `package-lock.json` resolves for `node_modules/swagger-ui-dist`; the vendored copy must match it.
2. Download the tarball of that version from the npm registry and check that its SHA-512 matches the `integrity` in `package-lock.json` and in the registry (`https://registry.npmjs.org/swagger-ui-dist/<version>`).
3. Copy the files listed above from the tarball's `package/` folder over the ones here.
4. Update the version and integrity in this README, then open `docs/api/index.html` through a local static server and check that every path of the spec renders with no console errors.

## AI Usage Note

This README was drafted by Claude (Claude Code). The vendored files themselves are not AI-generated. The version, tarball URL and integrity were checked against `package-lock.json` and the npm registry, and the file hashes were compared with the published tarball. Verified by: Daryna Halytska

The note on the CI check (issue #90) was also drafted by Claude; the check was run locally against `node_modules/swagger-ui-dist` 5.33.0, both passing and failing on a deliberately changed file. Verified by: Daryna Halytska
