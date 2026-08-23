# thank-snap

A Shopify app that shows a merchant-customizable survey on the Thank you page
after checkout (e.g. "How did you hear about us?"), and lets the merchant
edit the question/options and turn it on/off from the app's home page.

Built on the Shopify React Router app template, Prisma + Postgres (Supabase),
and a checkout UI extension.

## How it fits together

```
Merchant                                Customer
   │                                        │
   ▼                                        ▼
Survey page                        Thank you page
(app/routes/app.survey.tsx)        (extensions/thank-you-survey)
   │  saves Survey + Questions             │  GET  /api/survey-config
   │  (heading, description,               │       → current questions + options
   │   questions, active)                  │  POST /api/survey-response
   ▼                                       ▼       → records answers (one call, all questions)
             Postgres (Shop, Survey, Question, Order, Response)
```

- The extension is a **block-target** checkout UI extension. It doesn't
  auto-appear — a merchant has to place it on the Thank you page once via the
  checkout editor (see [Local development](#local-development) below).
- The extension can't read `shopify.app.toml` at runtime, so it talks to the
  app backend over an **absolute URL** hardcoded in
  `extensions/thank-you-survey/src/shared.tsx` (`APP_URL`), authenticated with
  a checkout session token (`shopify.sessionToken.get()` → `authenticate.public.checkout`
  on the server). This URL is the `npm run dev` tunnel URL locally, and changes
  every time you restart `npm run dev` — see the debugging playbook below.

## Data model (`prisma/schema.prisma`)

| Model      | Purpose                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------|
| `Shop`     | One row per install, keyed by `shopDomain`.                                                  |
| `Survey`   | Belongs to a `Shop`. `title`/`description` are the overall heading shown above all questions. `status` is `DRAFT`/`ACTIVE`/`ARCHIVED` — only `ACTIVE` renders to buyers. |
| `Question` | Belongs to a `Survey`. `label` is the actual question text, `type` is `SINGLE_CHOICE`/`MULTIPLE_CHOICE`/`TEXT`/`RATING`, `options` is a JSON array of strings (unused for `TEXT`/`RATING`), `position` controls display order. |
| `Order`    | Belongs to a `Shop`, keyed by `(shopId, shopifyOrderId)`. Thank you page extensions run before the order is fully finalized, so `shopifyOrderId` may be a `pending:<session id>` placeholder if the real Shopify order GID wasn't available yet at submit time. |
| `Response` | One row per **answer** (not per full submission). `submissionId` groups every answer from one sitting; links to `Order`, `Survey`, `Question`. |

This app manages a single `Survey` per shop, but that survey can have **any
number of `Question` rows** of mixed types — the admin builder
(`/app/survey`) lets merchants add/remove/reorder questions freely. The
schema would support multiple distinct surveys per shop too, but nothing in
the app currently creates more than one.

**Data note:** early versions of this app stored the question text directly
on `Survey.title` and gave the single `Question` row a placeholder
`label: "attribution"`. `getOrCreateSurvey` in `survey.server.ts` detects and
self-heals this on first load (moves the real text onto the question, resets
the survey heading to a generic default) — you shouldn't need to touch this
manually, but it explains why a fresh read after upgrading looks different
from what was last saved.

## Project structure

- `app/routes/app._index.tsx` — admin home page: status summary, the
  response-rate widget, and links to the survey builder and responses list.
- `app/routes/app.survey.tsx` — the survey builder page. Composes the
  reusable pieces in `app/components/survey/` rather than inlining the whole
  form.
- `app/routes/app.responses.tsx` — paginated table of every collected
  answer (date, order, question, answer).
- `app/components/survey/` — `TemplateCard.tsx` (one template grid card),
  `QuestionEditor.tsx` (one question's full editor card: type, text,
  required, options, reorder/remove), `OptionRow.tsx` (one answer-option
  field), and `types.ts` (the shared `QuestionDraft` UI type plus
  `blankQuestion`/`makeQuestionKey` helpers).
- `app/models/survey.server.ts` — shared find-or-create/update logic used by
  the pages above. `updateSurvey` reconciles the incoming question list
  against existing rows (update by id, create new, delete removed) rather
  than blindly replacing everything — deleting all and recreating on every
  save would cascade-delete `Response` history for every question, every
  time.
- `app/models/survey-templates.ts` — premade single-question survey presets
  shown on the builder page ("Classic attribution", "Social-first", etc.).
  `survey.server.ts`'s defaults are derived from the first entry here rather
  than duplicating the same title/options as literals in two places.
- `app/models/stats.server.ts` — the response-rate calculation (see the note
  in that file and the Protected Customer Data entry below for why it's
  measured the way it is).
- `app/models/shop.server.ts` — `findShopBySessionToken`, shared by the three
  public API routes below to turn a checkout session token into a `Shop` row.
- `app/routes/api.active-survey.tsx` — public GET, called by the extension to
  fetch the current survey and its questions. Auth: `authenticate.public.checkout`.
- `app/routes/api.survey-view.tsx` — public POST, called once the extension
  loads an active survey. Records that it was shown, independent of whether
  it's answered. Same auth.
- `app/routes/api.response.tsx` — public POST, called by the extension
  to record answers (one call per submission, covering all answered
  questions). Same auth.
- `app/shopify.server.ts` — Shopify app config (API key/secret, scopes, session storage).
- `app/db.server.ts` — Prisma client singleton.
- `prisma/schema.prisma`, `prisma/migrations/` — data model and migration history.
- `extensions/thank-you-survey/` — TypeScript, checked independently via its
  own `tsconfig.json` (`npx tsc -p extensions/thank-you-survey/tsconfig.json --noEmit`;
  the root `npm run typecheck` deliberately excludes this folder — see the
  debugging playbook).
  - `src/types.ts` — `Question`, `SurveyConfig`, and the request/response
    param types shared across the extension.
  - `src/shared.tsx` — `Survey` UI wrapper, `QuestionField` (renders the
    right control per question type — `s-choice-list` always takes a
    `values` array, even for single-select), `useStorageState` (prevents
    re-showing after submit), `fetchSurveyConfig`/`recordSurveyView`/`submitSurveyResponse`
    (session-token-authenticated fetch helpers), and the **`APP_URL` constant**.
  - `src/ThankYouPageSurvey.tsx` — the actual survey component; fetches config
    on mount, records a view, renders one `QuestionField` per question, and
    submits all answered questions together under one `submissionId`. Renders
    nothing if inactive/not configured/already submitted.
  - `shopify.extension.toml` — target (`purchase.thank-you.block.render`) and
    capabilities (`network_access`, needed for `fetch()`).

## Local development

### Prerequisites

- `.env` with `DATABASE_URL` and `DIRECT_URL` — see `.env.example` for the
  exact shape and why two URLs are needed (Supabase pooler quirks, see below).
- Node `>=20.19 <22` or `>=22.12`.

### Running

1. `npm install`
2. `npm run dev` — runs `shopify app dev`, which also runs `prisma generate`
   and `prisma migrate deploy` automatically (see `shopify.web.toml`).
3. Copy the tunnel URL the CLI prints (`Using URL: https://....trycloudflare.com`)
   into `APP_URL` in `extensions/thank-you-survey/src/shared.tsx`. **Do this
   every time you restart `npm run dev`** — the tunnel URL is ephemeral and
   the extension can't discover it on its own. If you forget, the extension
   shows a warning banner instead of silently failing.
4. In Shopify admin: **Online Store → Themes → Customize** on your theme →
   switch the page dropdown at the top from "Home page" to **Checkout** →
   select the **Thank you** tab → click into the page body → **Add app
   block** → choose **thank-you-survey**. This is a one-time setup per store;
   the placement persists across dev sessions.
5. Open the app's home page in the Shopify admin at least once (creates the
   default `Survey`/`Question` rows) and make sure "Show survey on the Thank
   you page" is on.
6. Place a test order on the dev store — the survey should appear on the
   Thank you page and submitting it should create a `Response` row.

## Debugging playbook

Real issues encountered while building this app, and how to recognize/fix them.

### `prisma migrate dev`/`deploy` hangs forever right after "Datasource ... loaded"

**Cause:** `DATABASE_URL` points at Supabase's transaction pooler (port
`6543`, PgBouncer). Prisma Migrate needs a session-level advisory lock that
PgBouncer's transaction-pooling mode doesn't support, so it hangs instead of
erroring.

**Fix:** migrations use `DIRECT_URL` (the `directUrl` in
`prisma/schema.prisma`), which must be a **session-mode** connection —
Supabase's direct host (`db.<ref>.supabase.co:5432`), or, if that's
unreachable (next item), the pooler host on port `5432` instead of `6543`.

### `P1001: Can't reach database server at db.<ref>.supabase.co:5432`

**Cause:** Supabase's direct-connection host is IPv6-only on many projects
(check with `dig db.<ref>.supabase.co AAAA` vs `A` — if only `AAAA` resolves,
this is why). Networks/sandboxes without IPv6 egress can't reach it.

**Fix:** point `DIRECT_URL` at the pooler host instead — same host as
`DATABASE_URL`, but port `5432` (session mode) instead of `6543` (transaction
mode). Session mode supports advisory locks and resolves over IPv4.

### `prisma migrate status` shows migrations that don't match on both sides

**Symptom:** it lists migrations present in the database but missing locally,
or vice versa. Happens if the database was set up from a different checkout
of this repo, or migrations were applied by hand.

**Do not** run `prisma migrate reset` reflexively — it drops all data.
Instead:

```shell
psql "$DIRECT_URL" -c '\dt public.*'          # what tables actually exist
psql "$DIRECT_URL" -c '\d "TableName"'        # compare columns against schema.prisma
```

If a table already matches `schema.prisma` exactly, record it as applied
without running SQL: `npx prisma migrate resolve --applied <migration_name>`.
For genuinely new tables, write/generate a migration
(`npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
is useful for generating the SQL) and apply it with `npx prisma migrate deploy`.

### Survey doesn't show up on the Thank you page

Three independent things all have to be true — check in this order:

1. **Block is placed in the checkout editor.** Block-target extensions never
   auto-appear on a real checkout. See step 4 under
   [Local development](#local-development). (You can skip this while
   iterating by using the CLI dev console's preview link instead — press `p`
   after `npm run dev`.)
2. **`APP_URL` in `shared.tsx` is current.** It's the `npm run dev` tunnel
   URL and changes every session. If it's stale or still the
   `https://example.com` placeholder, the extension renders a **warning
   banner**, not silence — if you see that banner, this is the fix.
3. **The survey is active.** The app home page has to have been opened at
   least once (creates default `Survey`/`Question` rows), and the "Show
   survey" switch left on. If `GET /api/survey-config` returns
   `{ "active": false }`, the extension renders nothing — by design, not a
   bug.

### `npm run typecheck`/`npm run lint` fails after `shopify app generate extension` or `shopify app build`

These commands install dependencies and regenerate
`extensions/*/shopify.d.ts` (declares the `shopify` global for whichever
module/target is configured in `shopify.extension.toml`). If you rename a
module file or change `target`, re-run `npx shopify app build` once to
regenerate the stale `.d.ts`. It's gitignored — don't hand-edit it.

### Root `npm run typecheck` reports errors inside `extensions/`

The extension is its own TypeScript project (Preact JSX pragma, its own
`@shopify/ui-extensions` types) with its own `tsconfig.json` — it must not be
swept into the root check. Root `tsconfig.json` excludes `extensions/**` for
exactly this reason; if that exclude ever gets removed, the root `tsc` run
picks up the extension's `.tsx` files under a different type-resolution
context and produces confusing, spurious errors that don't reproduce when
checking the extension in isolation
(`npx tsc -p extensions/thank-you-survey/tsconfig.json --noEmit`) — trust the
isolated check, not the root one, for extension code.

### `shopify.orderConfirmation.value` shape (checkout extension)

It's `{ order: { id: string }, number?: string, isFirstOrder: boolean }` —
`order.id` is nested under `.order`, and `number` (top-level, not nested) is
a `string`, not a `number`, and may be `undefined` for older orders. Reaching
for `.value.id` or `.value.number as number` compiles fine in plain `.jsx`
(no type checking) but is wrong at runtime — this exact mistake shipped
silently for a while before the TypeScript rewrite caught it, quietly
sending `undefined` as the order id on every submission instead of throwing.

### Two package managers in this repo (resolved, but watch for it)

This repo used to have a stray `pnpm-workspace.yaml` alongside `npm`'s
`package-lock.json`, and `node_modules` was actually a pnpm virtual store
under the hood — meaning local dependency resolution and the Docker build
path (`npm ci`) weren't guaranteed to produce the same tree. This got fixed
by deleting `node_modules` (root and `extensions/thank-you-survey`) and
`package-lock.json`, then running a plain `npm install` — everything is now
npm-hoisted and consistent. `pnpm-workspace.yaml` is still sitting in the
repo unused; harmless, but don't let it fool you into running `pnpm install`
at the root, which would recreate the same mess. Stick to npm commands only
(`npm install`, `npm run ...`).

### `nbf` claim timestamp check failed

A session/JWT token looks expired. Usually means your machine's clock is out
of sync — enable "Set time and date automatically" in your OS date/time
settings.

### `npm run dev` crashes: "This app is not approved to subscribe to webhook topics containing protected customer data"

Shopify classifies any webhook topic that can carry customer PII (e.g.
`orders/*`, `customers/*`) as **Protected Customer Data**, and requires an
approval step in the Partner Dashboard before an app can subscribe to it —
this isn't something a config change or CLI flag can grant, and it crashes
`shopify app dev` outright if you add such a topic to `shopify.app.toml`
without that approval.

This is why order tracking in this app (`app/routes/api.survey-view.tsx`)
does **not** use an `orders/create` webhook or the `read_orders` scope. It
only records the order id/number the checkout extension already has
legitimate access to via `OrderConfirmationApi` — no protected data, no
approval needed. The trade-off: the response-rate widget measures "of
buyers who saw the survey, how many answered", not "% of all store orders"
(the latter would need the approval-gated approach). If you want the full
version later, request Protected Customer Data access for your app in the
Partner Dashboard, then re-add `read_orders` to `access_scopes` and an
`orders/create` webhook subscription in `shopify.app.toml`.

## API reference

All three routes below share the same auth: `authenticate.public.checkout` —
the extension sends a session token (`shopify.sessionToken.get()`) as
`Authorization: Bearer <token>`, and the server derives the shop from the
token's `dest` claim.

### `GET /api/active-survey`

Response: `{ active, surveyId, title, description, questions }` where each
question is `{ id, label, type, options, required }`, or `{ active: false }`
if the shop has no survey yet, it's turned off, or has no questions.

### `POST /api/survey-view`

Body: `{ surveyId, orderId, orderNumber? }`.

Called once the extension successfully loads an active survey. Upserts an
`Order` row keyed by `(shopId, shopifyOrderId)` — this is the "shown to
buyer" record the response-rate widget's denominator counts. Deliberately
doesn't sync real order data (see the Protected Customer Data entry in the
debugging playbook).

### `POST /api/response`

Body: `{ surveyId, answers: [{ questionId, answerValue }], orderId?, orderNumber? }`.

Validates that the survey and every referenced question belong to the
requesting shop, upserts an `Order` row the same way as above — falling back
to a `pending:<session id>` placeholder if `orderId` wasn't available — and
inserts one `Response` row per answer, all sharing a single `submissionId`.

## Environment variables

See `.env.example` for `DATABASE_URL`/`DIRECT_URL`. Production deployment
(outside `npm run dev`) also needs `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`,
`SCOPES`, and `SHOPIFY_APP_URL` set explicitly — locally the Shopify CLI
injects these for you.

## Framework-level gotchas (generic to the Shopify React Router template)

<details>
<summary>Database tables don't exist</summary>

If you get an error like `The table "main.Session" does not exist in the
current database`, run the `setup` script in `package.json` (`prisma generate
&& prisma migrate deploy`).

</details>

<details>
<summary>Navigating/redirecting breaks an embedded app</summary>

Embedded apps must maintain the user session inside an iframe. To avoid issues:

1. Use `Link` from `react-router`. Do not use `<a>`.
2. Use `redirect` returned from `authenticate.admin`, not `redirect` from `react-router`.
3. Use `useSubmit` from `react-router`.

</details>

<details>
<summary>Webhooks: shop-specific subscriptions aren't updated</summary>

If registering webhooks in the `afterAuth` hook via `shopify.registerWebhooks`,
subscriptions may not update on their own. Prefer declaring webhooks in
`shopify.app.toml` instead — Shopify syncs them automatically on every
`npm run deploy`.

</details>

<details>
<summary>Webhooks: Admin-created webhooks fail HMAC validation</summary>

Webhook subscriptions created directly in the Shopify admin aren't signed
with your app's secret and will fail validation. Use app-specific webhooks
defined in `shopify.app.toml` instead.

</details>

<details>
<summary>Webhooks: `admin` object is undefined when triggered by the CLI</summary>

`shopify webhook trigger` sends a valid-but-nonexistent shop, so `admin` is
`undefined`. This is expected — it's only for testing that the webhook
handler itself runs, not real data flow.

</details>

<details>
<summary>Incorrect GraphQL hints in the editor</summary>

The `graphql.vscode-graphql` extension assumes queries target the Shopify
Admin API by default. If you use another API, update `.graphqlrc.ts`.

</details>

<details>
<summary>Streaming responses with `await`/`Await` don't work locally</summary>

The CLI's Cloudflare tunnel buffers the full response before sending it, so
streaming won't be visible locally (production is unaffected). Use
localhost-based development to test streaming.

</details>

<details>
<summary>Using MongoDB and Prisma</summary>

See the [Prisma SessionStorage README](https://www.npmjs.com/package/@shopify/shopify-app-session-storage-prisma#mongodb)
for MongoDB-specific caveats if you switch datasource providers.

</details>

<details>
<summary>Windows: <code>query_engine-windows.dll.node</code> is not a valid Win32 application</summary>

Set `PRISMA_CLIENT_ENGINE_TYPE=binary` to force Prisma's binary engine mode.

</details>

## Resources

- [Shopify App React Router docs](https://shopify.dev/docs/api/shopify-app-react-router)
- [Checkout UI extensions](https://shopify.dev/docs/api/checkout-ui-extensions)
- [Thank you and Order status page customization](https://shopify.dev/docs/apps/build/checkout/thank-you-order-status)
- [Polaris web components (app home)](https://shopify.dev/docs/api/app-home/polaris-web-components)
- [Prisma docs](https://www.prisma.io/docs)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
