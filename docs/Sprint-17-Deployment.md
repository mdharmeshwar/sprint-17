# Sprint 17 Deployment and Go-Live Report

## Audit summary

- **Architecture:** monorepo with React 18/Vite frontend in `client/src` and Express 4/TypeScript API in `server`; Mongoose connects to MongoDB using `MONGODB_URI`; JWT bearer authentication protects user/task/AI routes.
- **Frontend build:** `npm --prefix client/src run build` (`tsc -b && vite build`).
- **Backend build/start:** `npm --prefix server run build`; `npm --prefix server run start` launches the compiled `server/dist/server.js` entry point.
- **Runtime:** `.node-version` pins Node `24.22.1`; root `package.json` allows Node `>=22 <25`, meeting the installed OpenAI SDK's Node `>=22` requirement.
- **Backend environment:** `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`; optional `OPENAI_API_KEY`, `OPENAI_MODEL`, `STRIPE_SECRET_KEY`, `AI_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_MAX`, and `TRUST_PROXY_HOPS`. Production requires MongoDB and JWT configuration.
- **Frontend environment:** `VITE_API_URL`, set to the HTTPS backend base URL ending in `/api`.
- **Hosting config:** existing `render.yaml` defines API and static frontend services. API build/start commands and Vite static publish/rewrite configuration point to the current monorepo layout.
- **Git state at audit:** `main` tracks `sprint16/main`; `origin` remains `mdharmeshwar/TASK-MATRIX.git`. No Sprint 17 commit or push was made.

## Changes for production readiness

- Backend CORS now accepts exact configured origins. Production configuration must use HTTPS public origins; wildcard and localhost origins are rejected. Local loopback origins are allowed only in nonproduction mode. Requests without an `Origin` are still handled as server-to-server/API traffic and do not receive an `Access-Control-Allow-Origin` header.
- CORS credentials are disabled because the application uses bearer Authorization headers rather than cookies. Existing allowed methods and `Authorization`/`Content-Type` headers remain available.
- Vite validates `VITE_API_URL` during production builds and rejects missing, malformed, localhost, non-HTTPS, credential-bearing, or non-`/api` URLs. The browser API client retains its localhost fallback for development only.
- `.node-version` pins a Render-supported Node runtime that meets the OpenAI SDK engine requirement.
- The frontend production build reads the ignored local `client/src/.env` if present; build environments should set `VITE_API_URL` explicitly and must not inherit a localhost value.
- A non-force backend `npm audit fix` updated the vulnerable transitive `body-parser` package without a major framework upgrade.
- Backend tests cover configured CORS, preflight, untrusted origins, production localhost rejection, and existing API/auth/rate-limit behavior.

## Verification results

| Check | Result | Evidence |
| --- | --- | --- |
| Backend tests | PASS | `npm --prefix server test`; three test cases passed, including API integration and CORS. |
| Backend TypeScript build | PASS | `npm --prefix server run build`. |
| Frontend production build with API URL | PASS | `VITE_API_URL=https://taskmatrix-api.onrender.com/api npm --prefix client/src run build`. |
| Missing production API URL guard | PASS | Production build exits with the intended `VITE_API_URL must be an HTTPS API URL ending in /api` configuration error. |
| Editor diagnostics | PASS | No diagnostics in the Sprint 17 TypeScript files at time of check. |
| Backend production dependency audit | PASS | After a semver-compatible `npm --prefix server audit fix`, `npm --prefix server audit --omit=dev` reported zero vulnerabilities. |
| Frontend production dependency audit | FAIL / REVIEW | Two moderate React Router advisories were previously reported (GHSA-wrjc-x8rr-h8h6 and GHSA-337j-9hxr-rhxg). The available automated fix is a major React Router v7 upgrade and was not applied. |
| Configured Render URLs | BLOCKED | The configured API health URL and frontend URL both returned HTTP 404 during the audit. No live service was verified. |
| MongoDB Atlas connectivity/persistence | BLOCKED | Requires valid deployment service and dashboard/database access; no deployed database check was performed. |
| Live CORS/browser/auth/CRUD/AI end-to-end | BLOCKED | No live frontend/backend service was available to exercise. Local mocked-provider tests are not live integration evidence. |
| QA recording | BLOCKED | No verified production deployment or video URL was available. |

## Render setup steps

1. Use the intended GitHub repository and deploy its `main` branch. Confirm the repository is connected to the Render account; repository access was not verified from this workspace.
2. Create or update the API web service from `render.yaml` with repository root as the service root, build command `npm install --prefix server && npm --prefix server run build`, and start command `npm --prefix server run start`.
3. Add `MONGODB_URI` and a strong `JWT_SECRET` in the API service's environment. Render's blueprint generates `JWT_SECRET`; ensure the generated value is applied. Set `CLIENT_URL` to the actual deployed frontend origin. Add `OPENAI_API_KEY` only if live AI suggestions are enabled. Do not put backend secrets in the static-site environment.
4. Create/update the static site using `npm install --prefix client/src && npm --prefix client/src run build`, publish `client/src/dist`, and set its build-time `VITE_API_URL` to the real API URL ending in `/api`. Keep the SPA rewrite `/*` to `/index.html`.
5. Set `TRUST_PROXY_HOPS` only for the known Render topology as configured in the blueprint. The Render config currently sets one trusted proxy hop; verify that matches the deployed service's actual topology.
6. Deploy and verify `https://<actual-api-host>/api/health` and the actual frontend URL. The current `taskmatrix-api.onrender.com` and `taskmatrix-web.onrender.com` values returned 404 and must not be treated as live deployment URLs.
7. In browser DevTools, verify the exact frontend origin receives CORS permission, an untrusted origin does not, preflight succeeds, and no mixed-content/localhost requests occur. Exercise registration/login, a test task create/update/refresh/delete, rate limiting, and AI suggestion using a dedicated test account and designated test record only.

## MongoDB Atlas network access

Atlas network access was not inspected or changed. Prefer a hosting provider's stable outbound IP allowlist or private networking where available. If the assignment requires `0.0.0.0/0`, understand that it permits connections from every IPv4 source; use a strong unique database password, a database user with only required application permissions, TLS, and restrict the rule again when stable egress networking is available. Never paste the connection string into source code, frontend configuration, logs, or public documentation.

The local ignored `server/.env` is not tracked by Git. A MongoDB URI from it was surfaced during a prior workspace secret scan; treat its database credential as exposed and rotate it through Atlas before using it for production. No credential values are recorded here.

## Acceptance checklist

- **P0 production compilation/start configuration:** PASS locally; backend build and frontend build passed. Actual Render process startup remains BLOCKED pending service environment.
- **Dependency security:** Backend audit PASS after compatible fix; frontend audit remains REVIEW due to two moderate React Router advisories with only a major-upgrade automated fix available.
- **P1 CORS/security configuration:** PASS in source and local tests for exact allowlisting and preflight. Actual deployed-origin/browser verification is BLOCKED.
- **P1 Atlas access/persistence:** BLOCKED pending Atlas dashboard and deployed service access.
- **P2 frontend production API configuration:** PASS for build-time validation and configured-URL production build. Real backend URL is BLOCKED because the configured URL returned 404.
- **Live authentication/CRUD persistence/AI:** BLOCKED pending deployed services and credentials.
- **main branch and GitHub publication:** Existing `main` branch is present, but no Sprint 17 commit or push was made in this task.
- **Three-minute live QA demo:** BLOCKED until production services and a designated test account/data are available.