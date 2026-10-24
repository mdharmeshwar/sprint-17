# Task Matrix

Task Matrix is a task management application with a React and Vite frontend and a TypeScript, Express, and MongoDB API. Users can create and manage tasks, organize status and priority, and request an optional AI rewrite of a task description. AI requests go through the authenticated backend; users review a suggestion before applying it.

## Stack

- Frontend: React 18, TypeScript, Vite, React Router
- Backend: Node.js, Express 4, TypeScript
- Data and authentication: Mongoose/MongoDB, JWT bearer tokens, bcrypt
- Integrations: OpenAI server-side API and optional Stripe checkout
- Deployment: Render configuration in `render.yaml`

## Repository layout

```text
client/src/   React application and Vite configuration
server/       Express API, models, middleware, services, and tests
docs/         Project and Sprint 16 documentation
render.yaml   Render API and static-site deployment configuration
```

## Requirements

- Node.js 22 or newer and npm (required by the installed OpenAI SDK)
- MongoDB for persistent local data; without `MONGODB_URI`, the API uses its in-memory demonstration store
- An OpenAI API key only if you want to exercise live AI suggestions

## Local development

Install dependencies:

```bash
npm --prefix server install
npm --prefix client/src install
```

Create `server/.env` from `server/.env.example` and configure at least a local `JWT_SECRET`. Set `MONGODB_URI` to use MongoDB persistence. Leave it unset to use the in-memory store. To enable live suggestions, set `OPENAI_API_KEY` in the backend environment; never put it in a `VITE_` variable or frontend file.

Start the API and frontend in separate terminals from the repository root:

```bash
npm --prefix server run dev
```

```bash
npm --prefix client/src run dev
```

The API defaults to `http://localhost:5000`; Vite prints the frontend URL when it starts. The frontend API URL can be set with `VITE_API_URL`; its local fallback is `http://localhost:5000/api`.

## Environment variables

Backend variables belong in `server/.env` locally or in the server hosting environment:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Use `production` for deployed runtime behavior. |
| `PORT` | HTTP listener port; defaults to `5000`. |
| `MONGODB_URI` | MongoDB connection string. Required at production startup. |
| `JWT_SECRET` | Secret used to sign and verify bearer tokens. Required at production startup; use a long, randomly generated value. |
| `CLIENT_URL` | Comma-separated allowed frontend origins for CORS. |
| `OPENAI_API_KEY` | Server-only OpenAI credential. Required only for live AI suggestions. |
| `OPENAI_MODEL` | OpenAI model name; defaults to `gpt-4o-mini`. |
| `AI_RATE_LIMIT_MAX` | AI requests allowed per client IP per 15-minute window; defaults to `10`. |
| `LOGIN_RATE_LIMIT_MAX` | Login attempts per client IP per 15-minute window; defaults to `5` failed attempts. |
| `TRUST_PROXY_HOPS` | Number of known reverse-proxy hops to trust. Defaults to `0`; Render is configured for one hop. |
| `STRIPE_SECRET_KEY` | Optional server-side Stripe credential for checkout. |

The frontend uses `VITE_API_URL` for the API base URL, including `/api` (for example, `https://your-api-host.example/api`). Frontend-prefixed variables are included in the browser bundle and must not contain secrets. `.env` files are ignored by Git; use the example file as a variable-name reference, not as a source of production credentials.

## API overview

Routes are mounted under `/api`. Authenticated endpoints use `Authorization: Bearer <token>`.

| Method | Path | Purpose | Authentication |
| --- | --- | --- | --- |
| `GET` | `/api/health` | API health response | No |
| `POST` | `/api/auth/register` | Register a user | No |
| `POST` | `/api/auth/login` | Sign in and receive a token | No |
| `GET` | `/api/auth/me` | Read the current user | Yes |
| `GET`, `POST` | `/api/tasks` | List or create the current user's tasks | Yes |
| `GET`, `PUT`, `DELETE` | `/api/tasks/:id` | Read, partially update, or delete an owned task | Yes |
| `POST` | `/api/ai/suggest` | Suggest a clearer task description | Yes |
| `POST` | `/api/stripe/create-checkout-session` | Start optional checkout | Yes |

Task creation requires `title`, `description`, `priority`, and `status`; `dueDate` is optional. Task updates accept one or more editable fields and reject unknown properties. Priority values are `low`, `medium`, `high`, or `urgent`; status values are `todo`, `in-progress`, `done`, or `blocked`.

AI suggestion request:

```http
POST /api/ai/suggest
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{ "text": "Existing task description" }
```

Text must contain 1 to 2,000 characters. Success returns `{ "success": true, "data": { "suggestion": "..." } }`. The provider key and raw provider response are never returned to the browser. Invalid payloads return HTTP 400 with `success`, `message`, `code`, and `errors`; rate-limit responses use HTTP 429. Login and AI limits are independent, in-memory per process, and should use a shared store if the service scales to multiple instances.

## Tests and production builds

Run the backend integration tests and build both applications:

```bash
npm --prefix server test
npm --prefix server run build
npm --prefix client/src run build
```

The backend integration suite uses memory storage and a local mocked OpenAI-compatible endpoint; it does not need a paid provider request. A live AI check requires a valid backend key and an authenticated account. MongoDB-backed behavior and production deployment should also be checked in the target environment.

## Render deployment

`render.yaml` defines a Node web service for the API and a static site for the client. Its build commands are:

```bash
npm install --prefix server && npm --prefix server run build
npm install --prefix client/src && npm --prefix client/src run build
```

The API starts with `npm --prefix server run start`; the static publish directory is `client/src/dist`, with a rewrite from `/*` to `/index.html`. In the Render API service settings, configure `MONGODB_URI`, `OPENAI_API_KEY`, a strong `JWT_SECRET` (the Render template generates one), and the correct `CLIENT_URL`. Confirm the frontend's `VITE_API_URL` points to the deployed API. Production startup intentionally fails if `MONGODB_URI` or `JWT_SECRET` is missing.

The host names currently written in `render.yaml` are configuration values, not confirmation of a live deployment. Verify the deployed health route, CORS, authentication, MongoDB CRUD, rate limits, and a real AI suggestion after deployment. Do not record or publish secrets.

Production CORS allows only exact HTTPS origins listed in the backend `CLIENT_URL`; localhost origins are accepted only outside production. The Vite production build requires `VITE_API_URL` to be an HTTPS URL ending in `/api` and rejects localhost. Set it in the static site's build environment and rebuild/redeploy after changing it. A local ignored `client/src/.env` may override shell environment values during local production builds; set `VITE_API_URL` explicitly for the build or remove the local override when testing production configuration. See the Sprint 17 deployment report for the latest verified status and remaining account-level steps.

### Sprint 17 go-live status

The source is prepared for Render, but a live deployment has not been verified. During the last check, the Render hostnames configured in `render.yaml` returned HTTP 404 for both the API health endpoint and frontend. Do not treat those configured hostnames as confirmed live URLs.

Before deploying, confirm the Render service is connected to the intended GitHub repository and `main` branch. Configure `MONGODB_URI`, `JWT_SECRET`, and the exact deployed frontend origin in `CLIENT_URL` on the API service. Configure `VITE_API_URL` as the actual HTTPS API URL ending in `/api` on the static site's build environment. Set `OPENAI_API_KEY` only on the backend if live AI suggestions are enabled. Production startup requires `MONGODB_URI` and `JWT_SECRET`.

The API CORS allowlist accepts exact HTTPS public origins in production; localhost is development-only. Verify health, preflight, login, task persistence, and AI behavior after deployment. Atlas network access and persistence have not been verified. Prefer stable host egress IPs or private networking; use `0.0.0.0/0` only if required by the assignment, with restricted database credentials, and remove the broad rule when possible. See [Sprint 17 deployment report](docs/Sprint-17-Deployment.md) for verification results and the complete checklist.

The last local checks passed: backend tests and build, and frontend production build with an explicit HTTPS API URL. Backend production dependency audit reported zero vulnerabilities; frontend audit still reports two moderate React Router advisories whose automated fix is a major-version upgrade.

## Project notes

- [Sprint 17 deployment and go-live report](docs/Sprint-17-Deployment.md)
- [Sprint 16 submission and QA notes](docs/Sprint-16-Submission.md)
- [AI-assisted work log](Prompts.md)
- [Sprint plan](docs/Sprint-Plan.md)
