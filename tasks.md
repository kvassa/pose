# Pose Match — MVP Build Tasks

A granular, sequential build plan. Each task is atomic and testable. Complete one, verify, then move on.

## How to use this document

- **Do one task at a time.** Don't combine. Don't skip ahead.
- **Run the test after each task.** If it fails, fix before moving on.
- **Respect "out of scope".** It's there to prevent the LLM from doing too much.
- **If a task feels too small** — good. It's a checkpoint, not a measure of effort.

Each task has:
- **Goal** — what done looks like
- **Steps** — what to do
- **Test** — how to verify
- **Out of scope** — explicit guardrails

---

# Phase 0 — Workspace Foundation

### 0.1 Initialize pnpm monorepo

**Goal:** Working pnpm workspace at repo root.

**Steps:**
1. `pnpm init` at repo root.
2. Create `pnpm-workspace.yaml` listing `apps/*`, `services/*`, `packages/*`, `supabase`.
3. Create root `tsconfig.base.json` with `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `skipLibCheck: true`.
4. Create `.gitignore` (node_modules, dist, build, .env, .env.local, .DS_Store, ios/Pods, android/build).

**Test:** `pnpm install` exits clean.

**Out of scope:** No apps, packages, or services yet.

### 0.2 Set up `packages/shared-types/`

**Goal:** Empty TS package that exports shared types.

**Steps:**
1. Create `packages/shared-types/package.json` with name `@pose-match/shared-types`, `main: "./src/index.ts"`, `types: "./src/index.ts"`.
2. Create `packages/shared-types/tsconfig.json` extending root.
3. Create `src/index.ts` with a single placeholder export: `export type Placeholder = unknown;`.

**Test:** `pnpm --filter @pose-match/shared-types exec tsc --noEmit` exits clean.

**Out of scope:** No actual types yet.

### 0.3 Define core domain types in `shared-types`

**Goal:** Canonical types for keypoints, references, captures.

**Steps:**
1. In `packages/shared-types/src/`, create `pose.ts` with:
   - `Keypoint = { x: number; y: number; z?: number; visibility: number }`
   - `PoseLandmarks = Keypoint[]` (length 33)
   - `BoundingBox = { x: number; y: number; w: number; h: number }`
2. Create `entities.ts` with:
   - `ReferenceStatus = 'processing' | 'ready' | 'failed'`
   - `Reference = { id: string; user_id: string; image_path: string; thumbnail_path: string | null; status: ReferenceStatus; keypoints: PoseLandmarks | null; bounding_box: BoundingBox | null; created_at: string }`
   - `Capture = { id: string; user_id: string; reference_id: string | null; match_score: number | null; image_path: string | null; created_at: string }`
3. Re-export from `index.ts`.

**Test:** `tsc --noEmit` clean.

**Out of scope:** No runtime code, no validation, no zod yet.

---

# Phase 1 — `pose-math` Package (Pure Logic, Test-First)

This package can be built and verified before any UI exists. Build it first.

### 1.1 Scaffold `pose-math` package

**Goal:** Empty TS package with vitest configured.

**Steps:**
1. Create `packages/pose-math/package.json` (name `@pose-match/pose-math`, depends on `@pose-match/shared-types`).
2. Add `vitest` as devDep.
3. Add scripts: `test`, `test:watch`, `typecheck`.
4. Create `src/index.ts` empty.
5. Create `tsconfig.json` extending root.

**Test:** `pnpm --filter @pose-match/pose-math test` runs (zero tests, exits 0).

**Out of scope:** No logic yet.

### 1.2 Implement `normalize.ts` — translate to hip origin

**Goal:** Function that re-centers keypoints so hip midpoint = (0,0).

**Steps:**
1. Create `src/normalize.ts` with `centerOnHip(landmarks: PoseLandmarks): PoseLandmarks`.
2. Hip midpoint = average of landmark indices 23 (left hip) and 24 (right hip) per MediaPipe spec.
3. Subtract midpoint from every keypoint's x and y.

**Test:** Write `normalize.test.ts` — feed in synthetic landmarks, assert output hip midpoint is (0,0) within 1e-6.

**Out of scope:** No scaling yet.

### 1.3 Add scale normalization

**Goal:** After centering, scale so shoulder-to-hip distance = 1.

**Steps:**
1. Add `normalize(landmarks)` in `normalize.ts` that calls `centerOnHip` then scales.
2. Scale unit = distance from hip midpoint to shoulder midpoint (avg of indices 11, 12).
3. Divide all x, y by scale unit.

**Test:** In `normalize.test.ts`, after normalize, distance from origin to shoulder midpoint = 1.0 ± 1e-6.

**Out of scope:** Don't normalize z. Don't handle missing landmarks.

### 1.4 Implement joint-angle extraction

**Goal:** `getJointAngles(landmarks)` returns angles for elbow, shoulder, hip, knee on both sides.

**Steps:**
1. Create `src/angles.ts`.
2. Define joint triplets (e.g., `left_elbow = [11, 13, 15]` for shoulder-elbow-wrist).
3. Compute angle at middle vertex using `atan2`-based vector math, return in degrees.
4. Return `Record<JointName, number>` for 8 joints (L/R × shoulder/elbow/hip/knee).

**Test:** In `angles.test.ts`, hardcode landmarks for an arm at 90° — assert elbow angle ≈ 90.

**Out of scope:** No 3D angles. No per-axis breakdown.

### 1.5 Implement `compare.ts` — overall match score

**Goal:** `comparePoses(target, live)` returns `{ score: 0-100, jointDiffs: Record<JointName, number> }`.

**Steps:**
1. Normalize both poses.
2. Compute joint angles for both.
3. `jointDiffs[joint] = abs(target - live)` in degrees.
4. `score = 100 * (1 - clamp(meanDiff / 60, 0, 1))` (60° = max penalty).

**Test:** Identical poses → score 100. 60° off on every joint → score 0. Flipped left/right of same pose → score < 50.

**Out of scope:** Don't weight joints. Don't account for visibility. Tune the constants later.

### 1.6 Implement `framing.ts` — bounding box diff

**Goal:** Compare reference bbox to live bbox, return adjustment vector.

**Steps:**
1. Create `src/framing.ts`.
2. `compareFraming(target: BoundingBox, live: BoundingBox)` returns `{ dx, dy, dScale, iou }`.
3. `dx, dy` = center delta in normalized coords (-1 to 1).
4. `dScale` = ratio of areas (>1 = live is bigger).
5. `iou` = standard IoU.

**Test:** Identical boxes → `{ dx: 0, dy: 0, dScale: 1, iou: 1 }`. Boxes side-by-side, no overlap → `iou: 0`.

**Out of scope:** No rotation, no perspective.

### 1.7 Implement `cues.ts` — diff → human cue

**Goal:** Translate joint diffs and framing diff into structured cues.

**Steps:**
1. Create `src/cues.ts`.
2. Define `Cue = { kind: 'subject' | 'camera'; target: string; direction: string; magnitude: 'small' | 'medium' | 'large' }`.
3. `generateCues(jointDiffs, framingDiff)` returns `Cue[]`, sorted by magnitude descending.
4. Joint diff > 15° = `medium`, > 30° = `large`.
5. Framing dx > 0.1 = camera-shift cue, dScale > 1.2 / < 0.83 = move closer/back.

**Test:** Feed synthetic diffs, assert top cue matches expected direction.

**Out of scope:** No natural-language strings yet — those live in the mobile app.

### 1.8 Export public API

**Goal:** Clean public surface from `index.ts`.

**Steps:**
1. Re-export `normalize`, `comparePoses`, `compareFraming`, `generateCues` from `index.ts`.
2. Re-export the `Cue` and `JointName` types.

**Test:** `pnpm --filter @pose-match/pose-math typecheck` clean. All tests still pass.

**Out of scope:** No barrel of internals.

---

# Phase 2 — Supabase Backend

### 2.1 Create Supabase project

**Goal:** Live Supabase project, credentials saved.

**Steps:**
1. Create new Supabase project via dashboard.
2. Save URL and anon key to `.env.example` at repo root with placeholder values.
3. Create local `.env` with real values (gitignored).

**Test:** `curl $SUPABASE_URL/rest/v1/` with anon key returns `{}` or similar.

**Out of scope:** No CLI setup yet.

### 2.2 Install Supabase CLI and link project

**Goal:** Local Supabase CLI linked to remote project.

**Steps:**
1. Install Supabase CLI.
2. Run `supabase init` at repo root.
3. Run `supabase link --project-ref <ref>`.

**Test:** `supabase status` shows linked project.

**Out of scope:** Don't run `supabase start` (local dev) yet.

### 2.3 Create `references` table migration

**Goal:** Migration file that creates the `references` table.

**Steps:**
1. `supabase migration new create_references`.
2. Fill in the SQL from architecture §5.1 (references table only, with index).
3. Apply: `supabase db push`.

**Test:** In Supabase dashboard, `references` table exists with all columns.

**Out of scope:** No captures table yet, no RLS yet.

### 2.4 Create `captures` table migration

**Goal:** Migration adds the captures table.

**Steps:**
1. New migration `create_captures`.
2. Add captures table SQL with index.
3. Push.

**Test:** Table visible in dashboard.

**Out of scope:** Still no RLS.

### 2.5 Add RLS policies for `references`

**Goal:** All four CRUD policies on `references`, RLS enabled.

**Steps:**
1. New migration `references_rls`.
2. Enable RLS, add 4 policies (select/insert/update/delete) per architecture §5.2.
3. Push.

**Test:** Use SQL editor as anon: insert without auth → fails. Sign in via dashboard test user → insert with own user_id succeeds, with other user_id fails.

**Out of scope:** No captures RLS yet.

### 2.6 Add RLS policies for `captures`

**Goal:** Same four policies on captures.

**Steps:** Mirror 2.5 for captures.

**Test:** Same shape of test.

**Out of scope:** Done with RLS for now.

### 2.7 Create `reference-images` storage bucket

**Goal:** Private bucket with per-user folder access.

**Steps:**
1. Create bucket `reference-images` (private) via dashboard or migration.
2. Add storage policies: users can SELECT/INSERT/UPDATE/DELETE objects where `(storage.foldername(name))[1] = auth.uid()::text`.

**Test:** With user A signed in, upload to `reference-images/<userA-id>/test.jpg` → succeeds. Upload to `reference-images/<userB-id>/test.jpg` → fails.

**Out of scope:** No captures bucket yet.

### 2.8 Create `captures` storage bucket

**Goal:** Same as 2.7 for captures.

**Test:** Same shape of test.

**Out of scope:** None.

### 2.9 Enable Realtime on `references` table

**Goal:** Realtime broadcasts on references row changes.

**Steps:**
1. In Supabase dashboard → Database → Replication, enable replication for `public.references`.

**Test:** Use Supabase dashboard's Realtime inspector — manually update a row, see the event broadcast.

**Out of scope:** No client subscription yet.

---

# Phase 3 — Pose Worker (Standalone Python Service)

Built and deployed before the mobile app touches it.

### 3.1 Scaffold Python project

**Goal:** `services/pose-worker/` with FastAPI installed.

**Steps:**
1. `services/pose-worker/pyproject.toml` with deps: `fastapi`, `uvicorn`, `mediapipe`, `pillow`, `httpx`, `pydantic`.
2. `src/main.py` with FastAPI app and `GET /health` returning `{"ok": true}`.
3. `Dockerfile` (python:3.11-slim base, install deps, run uvicorn).

**Test:** `docker build` succeeds. `docker run -p 8000:8000` then `curl localhost:8000/health` → `{"ok": true}`.

**Out of scope:** No ML yet.

### 3.2 Add MediaPipe pose extractor function

**Goal:** Pure function: bytes → `(landmarks, bbox)`.

**Steps:**
1. Create `src/extractor.py` with `extract_pose(image_bytes: bytes) -> tuple[list[Keypoint], BoundingBox] | None`.
2. Use MediaPipe Pose Landmarker heavy model.
3. Return None if no person detected.
4. Compute bbox from min/max of visible keypoints.

**Test:** Add `tests/test_extractor.py` with a real test image of a person → assert 33 keypoints returned, bbox is non-zero.

**Out of scope:** No HTTP wiring yet.

### 3.3 Add `POST /extract` endpoint

**Goal:** Endpoint accepts image URL, returns keypoints synchronously.

**Steps:**
1. Add `POST /extract` taking `{ signed_image_url: str }`.
2. Download image with httpx.
3. Pass to `extract_pose`.
4. Return `{ keypoints, bounding_box }` or 422 if no person.

**Test:** `curl -X POST localhost:8000/extract -d '{"signed_image_url": "<public test image url>"}'` returns valid keypoints.

**Out of scope:** No callback yet — just synchronous response.

### 3.4 Add async callback flow

**Goal:** Worker accepts callback URL and POSTs result back instead of returning sync.

**Steps:**
1. Change `/extract` to take `{ reference_id, signed_image_url, callback_url }`.
2. Return 202 immediately, kick off background task.
3. Background task extracts, then POSTs `{ reference_id, keypoints, bounding_box }` to callback_url. On failure, POSTs `{ reference_id, error: "..." }`.

**Test:** Run a local mock callback receiver (e.g., `python -m http.server` or webhook.site). Hit `/extract` with its URL. Verify it receives the POST with correct body.

**Out of scope:** No HMAC signing yet.

### 3.5 Add HMAC signature on callback

**Goal:** Callback POST includes `X-Signature` header, HMAC-SHA256 of body using shared secret.

**Steps:**
1. Read `CALLBACK_SECRET` from env.
2. Add header on outbound POST.

**Test:** Inspect callback receiver — `X-Signature` header present. Recompute HMAC manually, matches.

**Out of scope:** Verification side comes later.

### 3.6 Deploy worker to Railway/Fly

**Goal:** Worker reachable at a public HTTPS URL.

**Steps:**
1. Create Railway/Fly app.
2. Set `CALLBACK_SECRET` env var.
3. Deploy.

**Test:** `curl https://<deploy-url>/health` returns `{"ok": true}`.

**Out of scope:** No Supabase wiring yet.

---

# Phase 4 — Edge Functions (Wire Supabase ↔ Worker)

### 4.1 Scaffold `enqueue-pose-extraction` edge function

**Goal:** Empty deployed edge function that returns 200.

**Steps:**
1. `supabase functions new enqueue-pose-extraction`.
2. In `index.ts`, return `new Response("ok", { status: 200 })`.
3. `supabase functions deploy enqueue-pose-extraction`.

**Test:** `curl <function-url>` returns 200.

**Out of scope:** No real logic yet.

### 4.2 Implement enqueue logic

**Goal:** Function takes a `references.id`, generates signed URL, POSTs to worker.

**Steps:**
1. Read body as DB webhook payload (`record.id`).
2. Read worker URL and secret from env.
3. Use service-role client to fetch the row → get `image_path`.
4. Generate signed URL via `storage.from('reference-images').createSignedUrl(...)`.
5. POST to worker `/extract` with `{ reference_id, signed_image_url, callback_url }`.

**Test:** Manually invoke with a test reference row id → verify worker receives the request (check worker logs).

**Out of scope:** No DB trigger yet — manual invocation only.

### 4.3 Wire DB webhook trigger

**Goal:** Insert into `references` automatically calls the edge function.

**Steps:**
1. In Supabase dashboard → Database → Webhooks, create webhook on `references` insert → invokes the edge function.

**Test:** Insert a row via SQL editor with `status='processing'`. Worker logs show incoming request within seconds.

**Out of scope:** Not yet handling worker callback.

### 4.4 Scaffold `pose-worker-callback` edge function

**Goal:** Deployed function that receives worker callbacks.

**Steps:**
1. `supabase functions new pose-worker-callback`.
2. Verify HMAC signature against `CALLBACK_SECRET` env var.
3. Return 401 on bad signature, 200 otherwise.
4. Deploy.

**Test:** POST with bad signature → 401. POST with correct signature → 200.

**Out of scope:** No DB write yet.

### 4.5 Update reference row in callback

**Goal:** Callback writes keypoints + bounding_box and sets status.

**Steps:**
1. On valid signature, parse body.
2. If `error` field present → update row to `status='failed'`, `error_message=...`.
3. Else → update row with `keypoints`, `bounding_box`, `status='ready'`.

**Test:** Manually POST a successful payload → row in dashboard updates correctly. Same for failure payload.

**Out of scope:** No retry logic.

### 4.6 Update worker's callback URL to point at edge function

**Goal:** End-to-end DB → worker → DB roundtrip works.

**Steps:**
1. In `enqueue-pose-extraction`, set `callback_url` to the deployed `pose-worker-callback` URL.
2. Redeploy.

**Test:** Insert a `references` row pointing to a real uploaded image. Wait <10s. Row transitions `processing → ready` with keypoints populated. Verify by SQL query.

**Out of scope:** Mobile app still doesn't exist.

---

# Phase 5 — Mobile App Foundation

### 5.1 Init Expo managed workflow

**Goal:** `apps/mobile/` runs an empty Expo app in Expo Go (no local native builds; `android/`/`ios/` are generated by EAS via prebuild and stay out of git).

**Steps:**
1. Scaffold `apps/mobile` with `create-expo-app`, then keep it managed: no `android/`/`ios/` folders committed.
2. Configure `app.json` (name/slug/scheme, `newArchEnabled`, iOS/Android identifiers for later prebuild).
3. Configure to use the workspace TS config; add to pnpm workspace.

**Test:** `pnpm --filter mobile exec expo start` → scan QR with Expo Go on a physical phone → default screen renders.

**Out of scope:** No screens, no deps, no EAS setup.

### 5.2 Install and configure expo-router

**Goal:** File-based routing works with a single home screen.

**Steps:**
1. Install `expo-router` per docs.
2. Create `app/_layout.tsx` with `<Stack />`.
3. Create `app/index.tsx` showing a "Pose Match" header.

**Test:** App boots to a screen reading "Pose Match".

**Out of scope:** No other routes yet.

### 5.3 Install supabase-js and create client

**Goal:** Supabase client initialized from env vars.

**Steps:**
1. Install `@supabase/supabase-js`, `react-native-url-polyfill`, `@react-native-async-storage/async-storage`.
2. Create `src/supabase/client.ts` exporting initialized client (use AsyncStorage for auth persistence).
3. Add env vars via `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

**Test:** Add a temp `useEffect` on home screen calling `supabase.from('references').select('id')` and `console.log` the result. App logs `[]` (empty array, since no auth yet — RLS blocks results).

**Out of scope:** No UI yet.

### 5.4 Install Zustand, set up `authStore`

**Goal:** `authStore` mirrors Supabase auth state.

**Steps:**
1. Install `zustand`.
2. Create `src/state/authStore.ts` with `{ user: User | null, session: Session | null, setSession }`.
3. In root layout, subscribe to `supabase.auth.onAuthStateChange` and update store.

**Test:** Add a temp button "log auth state" that prints from store. With no user, prints null.

**Out of scope:** No sign-in UI yet.

### 5.5 Install React Query

**Goal:** QueryClientProvider wired in root layout.

**Steps:**
1. Install `@tanstack/react-query`.
2. Create QueryClient, wrap root layout.

**Test:** App still boots. No new behavior.

**Out of scope:** No queries yet.

---

# Phase 6 — Auth

### 6.1 Build sign-in screen

**Goal:** `app/(auth)/sign-in.tsx` with email/password form.

**Steps:**
1. Create the route group and screen.
2. Form with email + password inputs and submit button.
3. On submit: `supabase.auth.signInWithPassword`.
4. Show error inline on failure.

**Test:** With known test user, signing in updates `authStore.user`. Wrong password shows error.

**Out of scope:** No sign-up, no password reset, no OAuth.

### 6.2 Build sign-up screen

**Goal:** `app/(auth)/sign-up.tsx`, mirror of sign-in.

**Steps:** Mirror 6.1 with `signUp`.

**Test:** New email creates user. Existing email shows error.

**Out of scope:** No email verification flow customization.

### 6.3 Add auth gate in root layout

**Goal:** Unauthenticated users see sign-in; authenticated users see home.

**Steps:**
1. In `_layout.tsx`, read `authStore.session`.
2. If null, redirect to `/sign-in`. If present, allow children.

**Test:** Cold-start the app signed-out → lands on sign-in. Sign in → lands on home. Sign out → bounced back to sign-in.

**Out of scope:** No loading shimmer.

---

# Phase 7 — Reference Upload Flow

### 7.1 Add image picker to home screen

**Goal:** Tap "Add reference" → native image picker opens, picked image URI is logged.

**Steps:**
1. Install `expo-image-picker`.
2. Add a button on home that calls `launchImageLibraryAsync`.
3. `console.log` the resulting URI.

**Test:** Pick a photo, URI is logged. Cancel → no log.

**Out of scope:** No upload yet.

### 7.2 Upload picked image to Supabase Storage

**Goal:** Picked image lands in `reference-images/<user_id>/<uuid>.jpg`.

**Steps:**
1. After picker returns, generate UUID for file.
2. Read file as blob (`fetch(uri).then(r => r.blob())`).
3. `supabase.storage.from('reference-images').upload(...)`.
4. On success, log the storage path.

**Test:** After picking, file appears in Supabase Storage dashboard under user's folder.

**Out of scope:** No DB row yet.

### 7.3 Insert `references` row after upload

**Goal:** A row appears in `references` with status `processing`.

**Steps:**
1. After upload, insert row with `image_path`, `user_id`.
2. Don't wait for keypoints.
3. Log returned row.

**Test:** Row appears in dashboard. Within ~10s, status transitions to `ready` with keypoints (because phase 4 is wired).

**Out of scope:** No UI for the row yet.

### 7.4 Create `useReferences` query hook

**Goal:** React Query hook returns the user's references.

**Steps:**
1. Create `src/supabase/queries.ts` with `useReferences()` calling `supabase.from('references').select('*').order('created_at', { ascending: false })`.
2. Use stable query key.

**Test:** Mount the hook on home, render `data?.length`. Shows correct count.

**Out of scope:** No realtime yet.

### 7.5 Render reference list on home screen

**Goal:** Home shows a list of reference thumbnails with status text.

**Steps:**
1. Replace home screen body with FlatList over `useReferences().data`.
2. Each row: thumbnail (signed URL from storage), status label.
3. Empty state: "No references yet."

**Test:** After uploading, a row appears. Status text matches DB.

**Out of scope:** Tapping does nothing yet.

### 7.6 Subscribe to realtime updates on references

**Goal:** Status changes from `processing → ready` reflect in UI without manual refresh.

**Steps:**
1. In `useReferences`, on mount: `supabase.channel(...).on('postgres_changes', { event: '*', schema: 'public', table: 'references' }, ...)`.
2. On event, invalidate the React Query cache.

**Test:** Upload an image → list shows `processing` → automatically updates to `ready` within seconds, no pull-to-refresh.

**Out of scope:** No optimistic UI.

### 7.7 Create reference detail screen

**Goal:** Tapping a reference opens `app/reference/[id].tsx` showing the image and keypoints (as overlaid dots).

**Steps:**
1. Create the route.
2. Fetch single reference by id.
3. Render image full-width.
4. If keypoints exist, overlay 33 dots positioned by normalized coords.

**Test:** Tap a `ready` reference → image opens with dots on the body. Tap a `processing` reference → shows spinner.

**Out of scope:** No skeleton lines, just dots.

---

# Phase 8 — Camera Foundation

> From here on the app no longer runs in Expo Go — native modules require an **EAS development build**. JS changes still hot-reload into the dev build via Metro; new EAS builds are only needed when native deps change.

### 8.0 Configure EAS

**Goal:** EAS cloud builds produce a development build that installs on a test device.

**Steps:**
1. Create a free Expo account; `npx eas-cli login`.
2. `eas build:configure` → `eas.json` with a `development` profile (`developmentClient: true`).
3. Decide the test device: physical iPhone (requires Apple Developer Program, $99/yr) or Android emulator (free; webcam passthrough for camera testing).
4. Run `eas build --profile development` for the chosen platform and install the build.

**Test:** Dev build installs and connects to the local Metro server (`expo start --dev-client`).

**Out of scope:** No camera deps yet.

### 8.1 Install vision-camera

**Goal:** `react-native-vision-camera` v4+ installed via its Expo config plugin.

**Steps:**
1. `npx expo install react-native-vision-camera`.
2. Add the plugin to `app.json` with `cameraPermissionText` (handles Info.plist + AndroidManifest at prebuild).
3. Rebuild via `eas build --profile development`.

**Test:** New dev build boots; app still renders.

**Out of scope:** No camera UI.

### 8.2 Add camera permission flow

**Goal:** `useCameraPermissions` hook requests permission on first need.

**Steps:**
1. Create `src/camera/useCameraPermissions.ts` wrapping vision-camera's permission API.
2. Returns `{ granted: boolean, request: () => Promise<void> }`.

**Test:** Add a temp screen that calls request → native dialog appears → granted state updates.

**Out of scope:** No camera view yet.

### 8.3 Create shoot route with basic camera view

**Goal:** `app/shoot/[id].tsx` shows the live camera, full-screen.

**Steps:**
1. Create the route.
2. If permission not granted, show "Grant access" button.
3. Render `<Camera />` from vision-camera with `device={back}` and `isActive`.

**Test:** Tap a reference from home → navigate to shoot → see live camera. Background app, return → camera resumes.

**Out of scope:** No frame processor yet, no overlay.

### 8.4 Add reference thumbnail in shoot screen corner

**Goal:** Top-right corner shows the reference image small.

**Steps:**
1. Pass reference id via route param.
2. Fetch reference by id.
3. Position thumbnail absolutely in top-right.

**Test:** On shoot screen, thumbnail visible. Image matches the reference picked.

**Out of scope:** No interactivity.

---

# Phase 9 — On-Device ML

### 9.1 Add native MediaPipe module — Android

**Goal:** Local Expo Module `modules/pose-detector` exposes `detect(frame): keypoints` to JS (Kotlin side).

**Steps:**
1. `npx create-expo-module@latest --local pose-detector` (creates `apps/mobile/modules/pose-detector` with Kotlin + Swift skeletons).
2. Add MediaPipe Tasks dependency in the module's `android/build.gradle`.
3. Implement `detect(byteArray)` in Kotlin: run the pose landmarker, return 33 landmarks.
4. Rebuild via `eas build --profile development` (autolinking picks up the local module).

**Test:** From JS, `requireNativeModule('PoseDetector').detect(<test image bytes>)` returns 33 landmarks for a known image (Android dev build).

**Out of scope:** No frame processor integration.

### 9.2 Add native MediaPipe module — iOS

**Goal:** Mirror 9.1 in the Swift side of `modules/pose-detector`.

**Steps:**
1. Add MediaPipe Tasks pod to the module's podspec.
2. Implement `detect` in Swift, mirroring the Android API.
3. Rebuild via EAS.

**Test:** Same JS call works on an iOS dev build.

**Out of scope:** None.

### 9.3 Wrap native module in TS

**Goal:** Typed JS interface.

**Steps:**
1. Create `src/ml/poseLandmarker.ts` exporting `detectPose(imageBytes: Uint8Array): Promise<PoseLandmarks | null>`.
2. Type-check with shared `PoseLandmarks`.

**Test:** Same call as 9.1/9.2 but typed and via the wrapper.

**Out of scope:** No vision-camera frame processor yet.

### 9.4 Create vision-camera frame processor plugin (Android)

**Goal:** Frame processor calls MediaPipe on every frame, returns landmarks to JS via shared values.

**Steps:**
1. Create `PoseFrameProcessorPlugin.kt` inside `modules/pose-detector/android/`.
2. Convert frame to bitmap, call pose landmarker, return landmarks as `WritableMap`.
3. Register plugin; rebuild via EAS.

**Test:** In a worklet, call the plugin and `console.log` the keypoints (logged from Reanimated worklet — use `runOnJS` to log).

**Out of scope:** iOS in next task.

### 9.5 Create vision-camera frame processor plugin (iOS)

**Goal:** Mirror 9.4.

**Test:** Same.

**Out of scope:** None.

### 9.6 Wire frame processor in `CameraView`

**Goal:** Live keypoints stream into a Reanimated shared value at ~30fps.

**Steps:**
1. Create `src/state/frameState.ts` exporting `liveKeypointsSV` (`useSharedValue<PoseLandmarks | null>(null)`).
2. In `CameraView`, attach `frameProcessor` that calls plugin and writes to the shared value.

**Test:** Add a debug overlay (`<Text>`) reading from the shared value via `useDerivedValue` and `runOnJS` — shows updating keypoint count or "33".

**Out of scope:** No drawing yet.

---

# Phase 10 — Skia Overlay

### 10.1 Install Skia

**Goal:** `@shopify/react-native-skia` installed.

**Steps:** `npx expo install @shopify/react-native-skia` + rebuild via `eas build --profile development`.

**Test:** App still boots. Add a static `<Canvas><Circle /></Canvas>` in shoot screen — circle visible.

**Out of scope:** No real overlay.

### 10.2 Render live skeleton overlay

**Goal:** Live keypoints render as connected lines on top of camera.

**Steps:**
1. Create `src/overlay/SkeletonOverlay.tsx` taking `keypoints: SharedValue<PoseLandmarks | null>`.
2. Inside `<Canvas>`, draw connections (e.g., shoulder→elbow→wrist) using Skia `<Line>` components.
3. Use `useDerivedValue` to compute paths from shared value.

**Test:** Move in front of camera → skeleton tracks limbs in real time.

**Out of scope:** No target pose yet.

### 10.3 Render target skeleton in different color

**Goal:** Target pose (from reference) drawn in semi-transparent overlay.

**Steps:**
1. On shoot screen mount, load reference keypoints from query.
2. Pass to `SkeletonOverlay` as a separate static skeleton.
3. Color: bright green at 50% opacity. Live skeleton: white.

**Test:** Both skeletons render. Target stays put, live moves.

**Out of scope:** No alignment yet — they're just both drawn at their raw coordinates.

### 10.4 Project target skeleton onto live frame coordinates

**Goal:** Target skeleton scales/positions to match live person's bounding box.

**Steps:**
1. Compute live bbox from current keypoints.
2. Compute target bbox from reference keypoints.
3. Map target keypoints into live bbox space (translate + scale).
4. Draw mapped target.

**Test:** Stand in any framing → target skeleton overlays on top of live skeleton, scaled to match.

**Out of scope:** No matching score, no cues.

---

# Phase 11 — Live Comparison

### 11.1 Wire `pose-math.comparePoses` into frame processor

**Goal:** Match score computed each frame, written to shared value.

**Steps:**
1. Add `matchScoreSV` to `frameState.ts`.
2. In frame processor (or in a `useDerivedValue` reading `liveKeypointsSV` and target), call `comparePoses(target, live)`.
3. Write `score` to `matchScoreSV`.

**Test:** Add temp `<Text>` showing score → updates as you move. Match the reference pose → score climbs.

**Out of scope:** No UI badge yet.

### 11.2 Render `MatchIndicator` badge

**Goal:** Big circular badge bottom-center, shows score, color-codes (red/yellow/green).

**Steps:**
1. Create `src/overlay/MatchIndicator.tsx`.
2. Reads `matchScoreSV`.
3. <50 red, 50–84 yellow, ≥85 green.

**Test:** Badge updates fluidly as you pose. Crossing thresholds changes color.

**Out of scope:** No haptic feedback yet.

### 11.3 Compute and store live bbox

**Goal:** Live bbox available as shared value.

**Steps:**
1. In frame processor, compute bbox from keypoints.
2. Write `liveBboxSV`.

**Test:** Debug overlay shows bbox values changing as you move.

**Out of scope:** No framing UI yet.

### 11.4 Render `FramingGuide` arrows

**Goal:** Arrows on screen indicate which way to move the camera.

**Steps:**
1. Create `src/overlay/FramingGuide.tsx`.
2. Use `compareFraming` on target vs live bbox.
3. Render arrow icons (up/down/left/right/closer/back) sized by magnitude.
4. Hide when iou > 0.85.

**Test:** Stand off-center → arrow points to correct direction. Center yourself → arrow disappears.

**Out of scope:** No animations.

---

# Phase 12 — Cue System

### 12.1 Implement `cueRanker`

**Goal:** Function picks the single most important cue from a `Cue[]`.

**Steps:**
1. Create `src/guidance/cueRanker.ts`.
2. Rule: prefer subject cues with `large` magnitude > camera cues with `large` > subject medium > camera medium.
3. Add unit test.

**Test:** Vitest passes for several scenarios.

**Out of scope:** No display.

### 12.2 Add cue strings (subject)

**Goal:** Map structured cue → human string.

**Steps:**
1. Create `src/guidance/subjectCues.ts` with `cueToString(cue): string`.
2. Cover all joints × directions.

**Test:** Sample cue → expected string.

**Out of scope:** No localization.

### 12.3 Add cue strings (camera)

**Goal:** Mirror 12.2 for camera cues.

**Test:** Same.

**Out of scope:** None.

### 12.4 Render top cue on shoot screen

**Goal:** Single line of text near top showing the active cue.

**Steps:**
1. Create `src/overlay/CueBanner.tsx`.
2. Every 500ms (debounced), recompute cues from current state, pick top, render.
3. Hide when score ≥ 85.

**Test:** Pose incorrectly → cue appears matching the largest issue. Match correctly → cue hides.

**Out of scope:** No voice, no haptics.

### 12.5 Add haptic on cue change

**Goal:** Light haptic when the active cue changes.

**Steps:**
1. Install `expo-haptics`.
2. In `CueBanner`, fire a light impact on cue.target change.

**Test:** Move between bad poses → feel a tap when cue changes.

**Out of scope:** No voice.

---

# Phase 13 — Capture

### 13.1 Implement `burstBuffer`

**Goal:** Rolling buffer of last N frames with score and snapshot.

**Steps:**
1. Create `src/capture/burstBuffer.ts`.
2. Module-level array, push `{ timestamp, score }` on every frame, trim to last 30.

**Test:** Add unit test with mocked frames.

**Out of scope:** No actual photo capture yet.

### 13.2 Implement sustained-match detector

**Goal:** Hook returns `true` once `score ≥ 85` for 800ms continuous.

**Steps:**
1. Create `src/capture/useSustainedMatch.ts`.
2. Tracks shared value, sets a state flag when threshold sustained.

**Test:** Pose well for 1s → flag flips true. Break pose → flag resets.

**Out of scope:** No capture trigger yet.

### 13.3 Add manual shutter button

**Goal:** Big circle button bottom-center triggers `vision-camera.takePhoto()`.

**Steps:**
1. Add `<Pressable>` on shoot screen.
2. Call `cameraRef.current.takePhoto()`.
3. Save result URI to local state, log it.

**Test:** Tap → photo taken, URI logged.

**Out of scope:** No save to roll yet.

### 13.4 Wire auto-capture trigger

**Goal:** When `useSustainedMatch` flips true, automatically take photo (with countdown).

**Steps:**
1. On flag flip, show 3-2-1 countdown overlay.
2. After countdown, take photo if score still ≥ 85.
3. Disable for 5s after capture (to avoid double-firing).

**Test:** Hold the pose → countdown → photo taken.

**Out of scope:** No save.

### 13.5 Save photo to camera roll

**Goal:** Captured photo lands in device's photo library.

**Steps:**
1. Install `expo-media-library`.
2. Request permission.
3. After capture, call `MediaLibrary.saveToLibraryAsync(uri)`.

**Test:** Capture → photo visible in iOS Photos / Android Gallery.

**Out of scope:** No cloud sync yet.

### 13.6 Sync capture to Supabase (optional cloud save)

**Goal:** Insert a `captures` row + upload photo to `captures` bucket.

**Steps:**
1. After local save, upload photo to `captures/<user_id>/<uuid>.jpg`.
2. Insert `captures` row with `match_score` and `reference_id`.
3. Toggle in settings — for MVP, default on.

**Test:** Capture → row in `captures` table, file in storage bucket.

**Out of scope:** No library UI for captures.

### 13.7 Show post-capture review screen

**Goal:** After capture, modal shows the photo + reference side-by-side, with "Save" and "Retake".

**Steps:**
1. After capture, push modal route.
2. Show captured photo + reference image.
3. Save → dismiss; Retake → dismiss without saving (delete uploaded copy).

**Test:** Full flow: pose → countdown → capture → review → save returns to shoot screen ready for next attempt.

**Out of scope:** No editing.

---

# Phase 14 — Library Polish

### 14.1 Add captures list screen

**Goal:** `app/library/index.tsx` shows grid of past captures.

**Steps:**
1. Add tab/route.
2. Query captures, render image grid via signed URLs.

**Test:** Captures appear after sync.

**Out of scope:** No detail modal.

### 14.2 Add empty + loading states

**Goal:** Every screen has empty state copy and loading spinner.

**Steps:**
1. Home, library, reference detail.

**Test:** Fresh account → all empty states present.

**Out of scope:** No animations.

### 14.3 Add sign-out

**Goal:** Settings button → sign-out → bounces to sign-in.

**Steps:**
1. Add settings menu trigger.
2. Calls `supabase.auth.signOut()`.

**Test:** Sign out → redirected to sign-in. Sign back in → previous data reappears.

**Out of scope:** No real settings page.

---

# Phase 15 — Pre-Demo Hardening

### 15.1 Handle "no person detected" in frame processor

**Goal:** When MediaPipe returns null, overlay hides gracefully.

**Steps:**
1. In overlay components, `if (!keypoints) return null`.
2. Show "Step into frame" hint text after 2s of no detection.

**Test:** Cover camera → hint appears, no overlays. Reveal → tracking resumes.

**Out of scope:** No fallback model.

### 15.2 Handle reference processing failure

**Goal:** `failed` references show in list with retry button.

**Steps:**
1. In list, show failed status with "Retry" button.
2. Retry sets status back to `processing` and re-triggers webhook (or call edge function directly).

**Test:** Force a failure (upload non-person image) → row shows failed → retry works after fixing.

**Out of scope:** No detailed error messages.

### 15.3 Add basic onboarding screen

**Goal:** First-launch screen explains the flow in 3 cards.

**Steps:**
1. Show on first launch (gated by AsyncStorage flag).
2. 3 cards: "Pick a pose", "Get into position", "Auto-capture".

**Test:** Fresh install → onboarding. Second launch → skipped.

**Out of scope:** No video, no animations.

### 15.4 Test full end-to-end on real device

**Goal:** Smoke-test entire flow: sign up → upload reference → wait for ready → shoot → match → capture → see in library.

**Steps:** Run the flow manually on iOS and Android device. Note any bugs.

**Test:** Flow completes without crash. List bugs separately.

**Out of scope:** Don't fix bugs in this task — log them, create separate tasks.

---

# Done Criteria for MVP

- A new user can sign up, upload a Pinterest pose photo, and within ~10 seconds see it as a "ready" reference.
- Opening that reference shows a camera with an overlay of target skeleton + live skeleton.
- Match score updates in real time. Cues guide the user toward correctness.
- When the user holds the pose for ~1 second at >85% match, the app auto-captures.
- The captured photo is saved to camera roll and synced to the cloud library.

Anything beyond this is **phase 2 or later**. Scene matching, multi-image references, motion gestures, voice cues, social — all explicitly out of scope.
