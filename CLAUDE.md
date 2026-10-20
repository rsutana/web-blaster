# AGENTS.md — jci-eduverse-web (Nuxt 4)

Stack: **Nuxt 4, Vue 3, TypeScript (strict), Pinia, Tailwind v4, Three.js, GSAP.**
The SPA for EduVerse 3D, consuming `jci-eduverse-api` at `/api/v1`.

Audience: children aged roughly 4–8, their teachers, and administrators. Most
rules below exist because of that first group.

## Core rule: the browser never knows the answer

An activity instance arrives from the server with no answer key. To find out
whether an interaction was right, the client asks:

```
POST /api/v1/game/attempts/{attempt}/check   → { is_correct, correct_count, ... }
```

That request is also what records the interaction server-side, so the score is
derived from the server's own log, not from anything the page submits.

- **Never** add client-side "is this correct" logic.
- **Never** infer the answer from configuration, ordering or ids.
- `InteractionLogger` records what the learner did — no score, no verdict.

## Game engine (`app/game/`)

```
core/         GameEngine SceneManager CameraManager InputManager
              AssetManager ObjectFactory DisposalRegistry
interactions/ (folded into the activity classes)
activities/   BaseActivity + Select/Collect/Place/Order/Answer/Pair + registry
systems/      AudioManager FeedbackManager InteractionLogger
```

- **Activity classes are keyed by interaction mode, not activity type.** The
  server's twelve activity types collapse onto six ways of interacting, so
  `find` and `explore` share `SelectActivity`, and `sort`/`build`/`assemble`/
  `measure` share `PlaceActivity`. A new activity type usually needs new
  *configuration*, not a new class.
- **Educational meaning never lives in the engine.** It renders the instance and
  reports interactions. Whether a lesson is passed is decided by the API.
- **Everything allocated must be disposed.** Register geometries, materials and
  textures with `DisposalRegistry`; `GameEngine.dispose()` frees them and drops
  the WebGL context. A leak here exhausts a tablet's context budget within a few
  levels.
- **Pointer events only.** `InputManager` handles mouse, pen and touch through
  one path. Never make an interaction depend on hover — touch devices have none.

## UI rules

- **Touch targets**: every interactive control carries the `tap-target` utility
  (56×56px minimum). No exceptions on learner-facing screens.
- **Never audio-only**: anything spoken via `useAudio().speak()` must also be
  rendered on screen. Speech is an aid, not the channel.
- **Never colour-only**: success and failure carry an icon, motion and words as
  well as colour.
- **Supportive language**: learner-facing copy lives in `app/game/copy.ts`.
  No "wrong", "failed" or "game over" — `tests/copy.spec.ts` enforces it.
- **Forms gate on hydration**: use `useHydrated()` and disable submit until it is
  true. A submit during the hydration window falls through to a native form
  post, which on a sign-in form puts the password or PIN in the URL.

## Conventions

- **Components**: `components/{area}/{Name}.vue`, auto-imported as `{Area}{Name}`
  (`components/ui/AppButton.vue` → `<UiAppButton>`). 3D components are
  `.client.vue` — WebGL cannot be created during SSR.
- **State**: Pinia stores in `app/stores/`. `useGameStore` owns the level
  lifecycle (`idle → loading → intro → playing → result`).
- **API access**: only through `useApi()`, which sends credentials and the CSRF
  token. Never call `$fetch` against the API directly.
- **Errors**: `friendlyError()` turns any failure into a sentence a child can
  read; technical detail goes to the console in dev only.
- **Types**: `app/types/index.ts` mirrors the API resources one for one.
- **No WebGL is not an error**: `useWebGLSupport()` selects `GameFallback2D`,
  which plays the same instance through DOM buttons and is graded identically.

## Verify before reporting done

```bash
pnpm typecheck      # nuxt typecheck (strict)
pnpm test           # vitest unit tests
pnpm build          # production build
pnpm test:e2e       # playwright, needs the API seeded and running
```

### Run the E2E suite against the build, not the dev server

`nuxt dev` compiles routes on demand and re-optimises dependencies mid-run. A
navigation that trips either can leave the page unhydrated, and because every
sign-in button stays disabled until hydration, the failure surfaces as a
meaningless 60-second timeout rather than as anything about the app. Serve the
build instead:

```bash
pnpm build
PORT=3100 node .output/server/index.mjs &
E2E_NO_SERVER=1 E2E_BASE_URL=http://localhost:3100 pnpm exec playwright test
```

A dedicated port also keeps the run clear of any dev server already holding
`:3000` - `playwright.config.ts` sets `reuseExistingServer: true`, so it would
otherwise silently bind to whatever is there, however stale. Local CORS accepts
any `localhost` port, so no API change is needed.

A timeout under this setup is a real defect. Investigate it; do not retry it.
