# SINGULO — Settings Panel + Visual/Gesture Upgrade

## Goal
Ship the settings/control panel and the visual/gesture upgrade together so the app is configurable and the core feels fast, tactile, and futuristic.

## Scope

### 1. Settings Panel (`src/components/SettingsPanel.tsx`)
A slide-out panel reachable from the main header, controlled by `singuloStore.panel`.

Sections:
- **AI**: model picker, temperature slider, response style (concise/balanced/detailed).
- **Voice**: enable toggle, voice picker, speed slider, volume slider, microphone picker, auto-listen toggle.
- **Gesture**: enable toggle, camera picker, hands count, sensitivity slider, smoothing slider, confidence slider, zoom/rotation/swipe sensitivity sliders, dominant hand, pinch min/max, palm-interrupt toggle, debug toggle, per-gesture enable toggles.
- **Appearance**: intensity, particle density, animation intensity, reduced motion toggles.

All controls write directly to `settingsStore` and persist to `localStorage` via existing `updateSettings`. The panel uses existing `@/components/ui` primitives.

### 2. Gesture Engine Speed Upgrade
- `state-machine.ts`: drop `confirmFrames` from 3 → 1 and `cooldownMs` from 260 → 90.
- `engine.ts`: tighten One Euro smoothing (`smoothingAlpha` mapping adjusted), reduce frame filtering latency.
- `commands.ts`: increase zoom/rotate/pan gain multipliers so small hand motions produce larger core responses.

### 3. Visual Core — Dynamic Filament Chains
Replace the three simple orbital rings in `core-engine.ts` with procedurally generated filament chains:
- 5–7 long chains that weave around the core at varying radii.
- Each chain is a `Line` built from many small segments, not a closed circle.
- Chains connect to nearby chain nodes when close, forming a web.
- Chains pulse and flow with `uTime`, reacting to `energy`.
- Keep triangles, particle field, waveform ribbon, grid, and pointer reticle.

### 4. Two-Hand Spatial Controls
Expand `engine.ts` and `commands.ts`:
- Two-hand pinch apart/together drives zoom (already partially present; refine gain and add haptic-style pulse feedback).
- Two open palms held steady triggers a "calm/reset" pulse.
- Both fists held steady triggers a grab-and-freeze state.
- Add `twoHand` event fields where missing and route them cleanly in `commands.ts`.

### 5. Main UI Wiring
- `src/routes/index.tsx`: add a header settings button, render `<SettingsPanel />` when `panel === "settings"`, and keep the existing chat/gesture HUD.

## Files to edit/create
- `src/components/SettingsPanel.tsx` (new)
- `src/routes/index.tsx` (add button + panel render)
- `src/gestures/state-machine.ts` (speed)
- `src/gestures/engine.ts` (smoothing + two-hand refinements)
- `src/gestures/commands.ts` (gains + two-hand routing)
- `src/visual/core-engine.ts` (filament chains)

## Out of scope for this plan
- New gesture vocabularies (thumbs, claps) — kept for a follow-up.
- Backend/database changes — all state stays client-side.

## Acceptance
- Settings panel opens/closes, every control updates the store and persists.
- Gestures feel snappier; two-hand pinch zooms the core.
- Visual core shows long, glowing, connected filament chains instead of plain rings.
- Build passes and preview renders without errors.
