# Frontend trust and reproducible builds

Owner: repository maintainers. Review at the next application, dependency or
base-image update and by **2026-11-05**.

The normal `frontend/Dockerfile` uses supported Alpine CA packages with a
20261020-r0 floor in dependencies, build and runtime. The existing Node 22.23.4
image pin and application dependency lockfile remain unchanged. There is no
custom root-filtering script or bundled replacement trust store.

The package manager is pinned to pnpm 12.15.0 in the Dockerfile and package.json.
Dependency installation must honor the frozen lockfile; it no longer silently
falls back to a new resolution. Only the existing locked sharp 0.34.5 native
build is allowed. New or changed build scripts fail for review. See pnpm's
[build settings](https://pnpm.io/settings/build#allowbuilds) and
[package release metadata](https://registry.npmjs.org/pnpm/12.15.0).

Build the normal image using the frontend directory as Docker context. Before
releasing or retiring any downstream temporary trust overlay, verify the final
image's actual Node client with `scripts/check-runtime-tls.cjs` in both default
and `--use-openssl-ca` modes. Check all twelve incident endpoints plus ordinary
public HTTPS. `scripts/check-private-ca.cjs` tests unrelated private-root
acceptance and default rejection using disposable generated fixtures only.
Network failures, expired fixtures and missing results are not trust rejection.
Also validate captured incident chains, application routes and the running image
identity through the deployment owner's normal release process.

Keep the package floors and regression checks in normal upgrades. A source
merge or successful image build alone does not prove deployment. Downstream
operators retain their own immutable image identities and retirement evidence;
private deployment/recovery records do not belong in this public repository.
