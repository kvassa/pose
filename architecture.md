# Pose Match — Architecture

A mobile AR app that takes a reference photo (Pinterest pose, etc.) and overlays it onto a live camera feed, guiding both subject and photographer into the matching shot.

This document is the full system architecture: client app, ML pipeline, Supabase backend, state management, and end-to-end data flow.

---

## 1. Product Recap

The wedge: **"I have THIS specific photo and I want THIS specific shot."** Not generic pose suggestions — exact recreation.

Two failure modes the app must independently diagnose:

1. **Subject guidance** — is the person in the right shape? (limb positions, head tilt, body orientation)
2. **Camera guidance** — is the lens in the right place? (framing, height, distance, angle)

You can be perfectly posed with the camera in the wrong spot, or vice versa. The app needs to tell you which one is off.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Mobile framework** | React Native + Expo (bare workflow) | Single codebase; bare workflow needed for native ML modules |
| **Camera** | `react-native-vision-camera` v4+ | Frame processors run on the UI thread, no JS-bridge overhead |
| **On-device ML** | MediaPipe Pose Landmarker (lite) via native bridge | 30fps on mid-range phones, 33 keypoints, Apache 2.0 |
| **AR overlay** | `@shopify/react-native-skia` | GPU-accelerated 2D drawing for the live overlay |
| **Client state** | Zustand (UI/session) + Reanimated shared values (per-frame) | Per-frame data must not cross the JS bridge |
| **Backend** | **Supabase** (Postgres + Auth + Storage + Realtime) | Collapses 3 services into one; RLS handles authz |
| **Pose worker** | Python (FastAPI + MediaPipe heavy) on Railway/Fly | Heavy model variant for accurate one-shot reference extraction |
| **Job trigger** | Supabase Edge Function or DB trigger → worker webhook | Replaces a dedicated API server for v1 |

The principle: **ML and rendering run on-device**. Supabase handles auth/db/storage. A single Python worker handles reference keypoint extraction.

---

## 3. Top-Level Folder Structure

```
pose-match/
├── apps/
│   ├── mobile/                    # React Native app
│   └── web/                       # Marketing site (Next.js, optional v0)
├── services/
│   └── pose-worker/               # Python keypoint extraction worker
├── packages/
│   ├── shared-types/              # TS types shared client ↔ worker
│   ├── pose-math/                 # Pure TS, pose comparison & guidance logic
│   └── eslint-config/
├── supabase/
│   ├── migrations/                # SQL schema migrations
│   ├── functions/                 # Edge functions (Deno/TS)
│   └── config.toml
├── infra/
│   └── docker/
├── .github/workflows/
└── package.json                   # pnpm workspace root
```

Monorepo via pnpm workspaces. The `pose-math` package is pure TS, no native deps, runs in both the RN app (live matching) and the worker (validation).

---

## 4. Mobile App (`apps/mobile/`)

```
apps/mobile/
├── app/                           # Expo Router (file-based routing)
│   ├── _layout.tsx                # Root layout, providers (Supabase, React Query)
│   ├── index.tsx                  # Home / reference picker
│   ├── (auth)/
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── reference/
│   │   ├── [id].tsx               # Reference detail / preview
│   │   └── new.tsx                # Upload new reference
│   ├── shoot/
│   │   └── [id].tsx               # THE camera screen — main feature
│   └── library/
│       └── index.tsx              # Saved references + captured shots
│
├── src/
│   ├── camera/
│   │   ├── CameraView.tsx         # Wraps react-native-vision-camera
│   │   ├── frameProcessor.ts      # Per-frame ML + comparison, writes shared values
│   │   └── useCameraPermissions.ts
│   │
│   ├── ml/
│   │   ├── poseLandmarker.ts      # JS interface to native MediaPipe module
│   │   ├── PoseModule.kt          # Android native bridge
│   │   ├── PoseModule.swift       # iOS native bridge
│   │   └── types.ts               # Keypoint, PoseResult types
│   │
│   ├── overlay/
│   │   ├── SkeletonOverlay.tsx    # Skia canvas: target + live skeleton
│   │   ├── FramingGuide.tsx       # Bounding box + directional arrows
│   │   ├── MatchIndicator.tsx     # Score badge, green/yellow/red state
│   │   └── ReferenceThumbnail.tsx # Corner preview of reference image
│   │
│   ├── guidance/
│   │   ├── subjectCues.ts         # "raise left arm", "tilt head right"
│   │   ├── cameraCues.ts          # "step back", "lower phone"
│   │   ├── voiceCues.ts           # TTS for hands-free photographer mode
│   │   └── cueRanker.ts           # Picks the single most important cue
│   │
│   ├── capture/
│   │   ├── autoCapture.ts         # Trigger shutter when match sustained
│   │   ├── burstBuffer.ts         # Rolling buffer of last N frames
│   │   └── saveShot.ts            # Camera roll + Supabase Storage sync
│   │
│   ├── state/
│   │   ├── sessionStore.ts        # Zustand: current shoot session
│   │   ├── libraryStore.ts        # Zustand: cached references, captures
│   │   ├── authStore.ts           # Zustand: Supabase user, session
│   │   └── frameState.ts          # Reanimated shared values (per-frame)
│   │
│   ├── supabase/
│   │   ├── client.ts              # Supabase client init
│   │   ├── references.ts          # CRUD via supabase-js
│   │   ├── captures.ts
│   │   ├── storage.ts             # Upload / signed URLs
│   │   ├── realtime.ts            # Subscribe to reference status changes
│   │   └── queries.ts             # React Query hooks wrapping supabase-js
│   │
│   └── lib/
│       ├── theme.ts
│       └── analytics.ts
│
├── ios/
├── android/
├── assets/
└── package.json
```

### Key files explained

**`src/camera/frameProcessor.ts`** — runs on the UI thread for every camera frame (~30fps). Calls `poseLandmarker` for live keypoints, hands them to `pose-math` for comparison, writes results to Reanimated shared values. **Never touches React state.**

**`src/ml/poseLandmarker.ts`** — TS interface; real work happens in `PoseModule.kt` / `PoseModule.swift`, which load the MediaPipe `.task` model and process frame buffers natively.

**`src/overlay/`** — pure rendering. Reads from shared values, draws via Skia. Stateless components.

**`src/guidance/cueRanker.ts`** — at any moment 8 things might be wrong. The ranker surfaces the **one** highest-impact cue. Showing all of them paralyzes the user.

**`src/state/frameState.ts`** — Reanimated `useSharedValue`s for current keypoints, target keypoints, match score, active cue.

**`src/supabase/realtime.ts`** — subscribes to `references` row changes so the UI updates the moment the worker finishes keypoint extraction. No polling.

---

## 5. Supabase Backend

No dedicated API server in v1. The mobile app talks to Supabase directly. Authorization is enforced via RLS.

### 5.1 Database Schema (`supabase/migrations/`)

```sql
-- Users come from auth.users (Supabase Auth manages this)

create table public.references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,        -- Supabase Storage path
  thumbnail_path text,
  status text not null default 'processing',  -- 'processing' | 'ready' | 'failed'
  keypoints jsonb,                 -- 33 MediaPipe landmarks
  bounding_box jsonb,              -- normalized x,y,w,h
  scene_tags text[],               -- phase 3
  error_message text,
  created_at timestamptz default now()
);

create table public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference_id uuid references public.references(id) on delete set null,
  match_score int,
  image_path text,                 -- optional cloud sync
  created_at timestamptz default now()
);

create index on public.references (user_id, created_at desc);
create index on public.captures (user_id, created_at desc);
```

### 5.2 Row-Level Security

Users can only see and modify their own rows. This is the entire authz layer.

```sql
alter table public.references enable row level security;
alter table public.captures   enable row level security;

create policy "users read own references"
  on public.references for select
  using (auth.uid() = user_id);

create policy "users insert own references"
  on public.references for insert
  with check (auth.uid() = user_id);

create policy "users update own references"
  on public.references for update
  using (auth.uid() = user_id);

create policy "users delete own references"
  on public.references for delete
  using (auth.uid() = user_id);

-- Same four policies for captures
```

### 5.3 Storage Buckets

Two buckets, both private with RLS-style policies:

- `reference-images` — original uploads from users
- `captures` — optional cloud-synced shots

Each user can only read/write objects under their own `user_id/...` path prefix. Thumbnails are generated by Supabase Storage's built-in image transform (no separate worker needed).

### 5.4 Edge Functions (`supabase/functions/`)

Three functions, all Deno/TypeScript:

```
supabase/functions/
├── enqueue-pose-extraction/
│   └── index.ts                   # Triggered on reference insert; calls worker webhook
├── pose-worker-callback/
│   └── index.ts                   # Worker posts results here; updates references row
└── _shared/
    └── auth.ts
```

**`enqueue-pose-extraction`** — fires via DB webhook when a `references` row is inserted with `status = 'processing'`. Generates a signed URL for the image and POSTs it to the pose-worker.

**`pose-worker-callback`** — the worker calls this when extraction completes. Validates the worker's signature, updates the row with keypoints + bounding box, sets `status = 'ready'`. Realtime then pushes the change to the client automatically.

---

## 6. Pose Worker (`services/pose-worker/`)

```
services/pose-worker/
├── src/
│   ├── main.py                    # FastAPI app
│   ├── extractor.py               # MediaPipe Pose (heavy variant)
│   ├── scene_classifier.py        # Phase 3
│   └── callback.py                # POST results back to Supabase
├── models/                        # MediaPipe .task files
├── Dockerfile
└── pyproject.toml
```

**Endpoint:** `POST /extract` — accepts `{ reference_id, signed_image_url, callback_url, signature }`. Downloads the image, runs heavy MediaPipe pose extraction, computes the bounding box, posts results to the callback URL.

**Why server-side, not on-device?** Reference extraction is a one-time job per image and benefits from accuracy. The heavy model is too slow for live use but fine for one-shot. The on-device lite model is what runs at 30fps for live matching.

Hosted on Railway or Fly. Stateless. Scales horizontally.

---

## 7. Shared Pose Math (`packages/pose-math/`)

The brain of the matching logic. Pure TypeScript, no dependencies. Used by both mobile (live) and the worker (validation).

```
packages/pose-math/
├── src/
│   ├── normalize.ts               # Translation/scale-invariant keypoints
│   ├── compare.ts                 # Per-joint angle deltas, match score
│   ├── framing.ts                 # Bounding box IoU, framing diff
│   ├── cues.ts                    # Diffs → human-readable cues
│   └── index.ts
└── package.json
```

**`normalize.ts`** — keypoints arrive in pixel coords. Normalize so a small person far away and a large person close up can be compared. Hip midpoint = origin, shoulder-to-hip distance = unit scale.

**`compare.ts`** — for each joint angle in the target (shoulder, elbow, hip, knee, etc.), compute the delta from the live pose. Returns score 0–100 and per-joint diff map.

**`framing.ts`** — bounding box position + scale comparison. Outputs directional vector for camera adjustment.

**`cues.ts`** — takes the diff map and emits ranked cues like `{ type: 'subject', joint: 'left_elbow', direction: 'raise', magnitude: 'large' }`. The mobile `cueRanker` decides which to surface.

This package being shared means the worker can validate uploaded references ("is there actually a person in this pose?") using the exact logic the client uses for live matching.

---

## 8. State Management

Three distinct tiers — getting these wrong is the most common way AR apps tank framerate.

### Tier 1: Per-frame state — Reanimated shared values

Touched ~30x/second. Cannot go through React.

- Current frame's keypoints
- Match score
- Active cue
- Live bounding box

Lives in `src/state/frameState.ts`. Read by Skia overlays via `useDerivedValue`. Written by the frame processor.

### Tier 2: Session state — Zustand

Touched on user actions, not per-frame.

- Active reference (id, image URL, target keypoints)
- Shoot mode (selfie vs photographer)
- Capture settings (auto-capture on/off, burst on/off)
- Burst buffer (last N captured frames)

Lives in `src/state/sessionStore.ts`. Cleared on leaving the shoot screen.

### Tier 3: Persistent state — Zustand + AsyncStorage + Supabase

- Auth: user, session (managed by `supabase-js`, mirrored into `authStore`)
- Library: references and captures, cached locally, source of truth in Postgres
- Realtime updates flow in via Supabase Realtime subscriptions

Lives in `src/state/libraryStore.ts`, `src/state/authStore.ts`. React Query (`src/supabase/queries.ts`) wraps `supabase-js` calls for caching and optimistic updates.

---

## 9. End-to-End Data Flow

What happens when a user wants to recreate a Pinterest pose:

1. **Upload reference.** User picks an image. Mobile uploads directly to Supabase Storage at `reference-images/{user_id}/{uuid}.jpg`. Then inserts a `references` row with `status = 'processing'`.
2. **Edge function fires.** DB webhook triggers `enqueue-pose-extraction`. It generates a signed URL and POSTs to the pose-worker.
3. **Worker extracts keypoints.** Pulls image, runs MediaPipe heavy, computes bounding box, POSTs to `pose-worker-callback`.
4. **Callback updates row.** Edge function writes keypoints + bounding_box, sets `status = 'ready'`.
5. **Realtime pushes to client.** Mobile is subscribed; UI updates instantly. Target keypoints land in `sessionStore`.
6. **User opens shoot screen.** `CameraView` mounts, vision-camera frame processor starts.
7. **Per-frame loop (30fps).** Frame processor → `poseLandmarker` (lite) returns live keypoints → `pose-math.compare()` against target → results written to shared values.
8. **Overlay renders.** Skia reads shared values, draws target skeleton, live skeleton, framing arrows, match badge — GPU only, no React re-renders.
9. **Cue ranker fires.** Every ~500ms (debounced), picks highest-priority cue, triggers haptic + optional voice.
10. **Match sustained.** When score stays >85 for 800ms, `autoCapture` triggers shutter, pulls best frame from `burstBuffer`, saves to camera roll and (optionally) syncs to `captures` storage bucket + table.
11. **Done.** Session state cleared, user lands on review screen.

---

## 10. Phasing

- **Phase 1 — pose-only.** Extract keypoints from reference, overlay skeleton on live cam, directional cues for subject and camera. Single image, no environment awareness.
- **Phase 2 — framing.** Bounding box framing check; camera guidance becomes precise.
- **Phase 3 — environment.** Scene/background matching. Multi-image input with best-fit selection.
- **Phase 4 — motion gestures.** Hands-free for the photographer.

---

## 11. Deliberately Out of Scope for v1

- Scene/environment matching (phase 3)
- Multi-person poses
- Voice cues for hands-free mode (phase 4)
- Social / sharing / feed
- Real-time collaboration (photographer's phone + subject's phone synced)
- Web app (marketing site only)

---

## 12. Open Architectural Questions

Worth deciding before serious code, but flagging here rather than guessing:

- **Frame processor language.** vision-camera supports JS Worklets; for max perf the entire ML call could be a native frame processor plugin. Start in Worklet, profile, drop to native if needed.
- **Cue ranker location.** Currently in `guidance/`, called from a debounced effect reading shared values. Alternative: run inside the frame processor itself. First is simpler, second is lower-latency. Default to simpler.
- **Auto-capture confidence.** What sustained match threshold + duration produces the best UX? 85 score for 800ms is a starting guess, not a tuned value. Will need real users.
- **Selfie vs photographer mode default.** Two different UX flows. Most aesthetic Pinterest shots are taken by someone else, so photographer-first is the likely default.
- **Failure mode UX.** When a reference is impossible to match in the current environment (wrong lighting, missing prop, indoor vs outdoor), the app needs to fail gracefully. TBD what that looks like.
- **Lock-in risk.** Supabase RLS + Edge Functions don't port. If we outgrow Supabase, we're rewriting. Acceptable for an MVP; revisit at scale.

---

## 13. The Architecture in One Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Mobile App (RN)                        │
│                                                             │
│  Camera → Frame Processor → MediaPipe Lite (native)        │
│                ↓                                            │
│         pose-math (compare)                                 │
│                ↓                                            │
│      Reanimated Shared Values  →  Skia Overlay             │
│                ↓                                            │
│          Cue Ranker → Haptics / Voice                      │
└─────────────────────────────────────────────────────────────┘
         │                                    ↑
         │ supabase-js                        │ Realtime
         ↓                                    │
┌─────────────────────────────────────────────────────────────┐
│                         Supabase                            │
│                                                             │
│  Auth   │   Postgres (RLS)   │   Storage   │   Realtime    │
│              │                                              │
│              │ DB webhook on insert                         │
│              ↓                                              │
│   Edge Fn: enqueue-pose-extraction ──────────┐             │
│                                              │             │
│   Edge Fn: pose-worker-callback  ←───────────┼─────┐       │
└──────────────────────────────────────────────┼─────┼───────┘
                                               ↓     │
                                  ┌────────────────────────┐
                                  │   Pose Worker (Python) │
                                  │   FastAPI + MediaPipe  │
                                  │       (Railway/Fly)    │
                                  └────────────────────────┘
```
