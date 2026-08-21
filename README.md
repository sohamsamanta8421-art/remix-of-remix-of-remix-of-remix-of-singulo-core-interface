# Remix of Remix of Remix of Singulo Core Interface

SINGULO — Production-Ready AI Voice & Gesture Operating Interface

Build a real, production-ready AI web application called SINGULO.

SINGULO is a futuristic, voice-first personal AI system with a highly advanced scientific interface. It must be a functional application, not a static mockup, animation, landing page, or UI prototype.

The application should be designed so it can actually run locally and be deployed to a production hosting platform.

---

1. CORE PRODUCT

SINGULO is an AI assistant controlled primarily through:

1. Natural voice conversation

2. Microphone input

3. Speaker/audio output

4. Hand gestures through the device camera

5. Keyboard/mouse as fallback controls

6. Optional text chat

The goal is to create an AI interface that feels like an advanced futuristic computer intelligence while remaining technically realistic and usable.

Do NOT make it a fictional "sentient AI". It is an AI software assistant with clearly defined tools, permissions, and capabilities.

---

2. VISUAL IDENTITY

The application must open into a full-screen immersive interface.

Do NOT create a conventional dashboard with cards everywhere.

The main screen should be dominated by a large central SINGULO CORE.

The visual language should be inspired by advanced scientific visualization, holographic interfaces, computational systems, astronomy, quantum concepts, orbital mechanics, circuitry and futuristic engineering.

Use the uploaded reference image as visual inspiration for the atmosphere, density, particle behavior and scientific aesthetic, but create an ORIGINAL interface rather than copying the image.

Visual characteristics

- Very dark background

- High-tech luminous interface

- Large central geometric triangle

- Dynamic particle systems

- Orbital rings

- Scientific diagrams

- Nodes and connecting lines

- Rotating geometric structures

- Data streams

- Waveforms

- Mathematical/scientific symbols

- Subtle grid structures

- Depth and parallax

- Glass/holographic effects

- Smooth animations

- Cinematic but functional appearance

Avoid excessive UI clutter.

The interface should feel like a living computational system.

---

3. SINGULO CORE

The central visual element is a large dynamic triangle.

The triangle must NOT be a static SVG decoration.

It should be an interactive real-time visual system.

Inside and around the triangle:

- particles

- orbital paths

- nodes

- energy-like pulses

- geometric structures

- scientific elements

- dynamic lines

- rotating rings

- waveform elements

The internal geometry should periodically change.

Some patterns should be deterministic while others can be procedurally generated.

The system should continuously create subtle variations so the interface never feels completely static.

---

4. AI STATES

The visual core must respond to the AI's current state.

Implement these states:

IDLE

Slow, calm animation.

The system is waiting for the user.

LISTENING

When microphone input begins:

- Core reacts to microphone amplitude

- waveform becomes visible

- particles respond subtly to voice

- interface indicates that SINGULO is listening

THINKING

When the AI is processing:

- orbital movement increases

- particles reorganize

- geometric structures evolve

- processing indicators appear

- animation should communicate computation without showing fake "thinking text"

SPEAKING

When SINGULO responds:

- waveform synchronizes with audio activity

- core pulses naturally

- particles respond to speech amplitude

EXECUTING

When SINGULO is executing a tool/action:

- show the action visually

- show progress when available

- display concise status information

ERROR

If something fails:

- show a clear but elegant error state

- explain what failed

- provide a recovery option

---

5. VOICE-FIRST INTERACTION

Voice is the primary interaction method.

The user should be able to click one microphone button and start talking.

Support:

- microphone permission handling

- speech-to-text

- natural-language conversation

- text-to-speech

- interruption of speech

- mute/unmute

- listening state

- speaking state

- error handling

- graceful fallback if microphone access is unavailable

The architecture must keep speech recognition, AI reasoning and speech synthesis modular so providers can be replaced later.

Do NOT hardcode API keys into frontend code.

All secret API keys must remain server-side/environment variables.

---

6. CONVERSATIONAL AI

Implement a real AI conversation system.

The user should be able to say things naturally, for example:

"Singulo, explain this concept."

"Search the web for the latest information."

"Summarize this document."

"Open my notes."

"Create a calculation."

"Analyze this image."

"Write code for this."

The AI should maintain conversation context within the current session.

Design the architecture so persistent memory can be added later.

---

7. TOOL-CALLING ARCHITECTURE

Do NOT connect the AI directly to arbitrary system operations.

Create a controlled tool/action layer.

Example:

AI

→ Intent Detection

→ Tool Router

→ Permission Check

→ Tool Execution

→ Result

→ AI Response

→ Voice + UI

Create a modular tool registry.

Example tool categories:

- Web search

- Calculator

- File analysis

- Text generation

- Image understanding

- Code assistance

- Notes

- Memory

- Application actions where supported

Every tool should have a clear schema.

---

8. HAND GESTURE CONTROL

Implement real hand gesture recognition using the device camera where browser support allows it.

Use a modern hand-landmark/computer-vision solution such as MediaPipe or an equivalent browser-compatible technology.

Do not fake gesture detection.

Track hand landmarks in real time.

Implement at least:

Pinch

Thumb + index finger close together.

Use pinch distance for continuous interaction.

Pinch + outward movement

Zoom in.

Pinch + inward movement

Zoom out.

Horizontal hand movement

Rotate the active 3D visual/object.

Pointing gesture

Select/highlight an interface element.

Open palm

Pause/neutral interaction.

Swipe

Navigate between interface states.

Grab/release

Grab and manipulate supported 3D objects.

Gesture detection must include smoothing/debouncing so accidental movements do not trigger commands.

---

9. GESTURE SETTINGS

Create a settings panel where the user can:

- Enable/disable camera gesture control

- Enable/disable individual gestures

- Adjust gesture sensitivity

- Adjust smoothing

- Select dominant hand

- Recalibrate gestures

- View camera permission status

Never activate the camera secretly.

Show a clear camera-active indicator.

---

10. 3D INTERACTION

Use a real-time graphics engine such as:

- Three.js

- WebGL

- React Three Fiber if appropriate

The central visual should be interactive.

The user should be able to manipulate supported visual objects using gestures and mouse/touch fallback.

Examples:

- zoom

- rotate

- pan

- select

- focus

- reset view

Use GPU-friendly rendering techniques and avoid unnecessarily expensive effects.

---

11. RESPONSIVE DESIGN

The application must work on:

- Desktop

- Laptop

- Tablet

- Mobile browser

On mobile:

- camera gesture controls should use the phone camera when permissions and browser capabilities allow

- microphone and speaker should work

- touch controls must remain available as fallback

On desktop:

- webcam gesture control

- microphone

- keyboard

- mouse

The UI must adapt intelligently instead of simply shrinking the desktop layout.

---

12. TEXT CHAT FALLBACK

Include a minimal text input.

It should not dominate the interface.

The user can type a message when:

- microphone is unavailable

- the environment is noisy

- voice is disabled

- the user prefers typing

Messages should appear in a clean futuristic conversation layer.

---

13. ACCESSIBILITY

Do not sacrifice usability for visual effects.

Include:

- keyboard navigation

- readable text

- clear focus states

- reduced-motion option

- microphone/camera status

- error messages

- usable contrast

- accessible controls

Provide a Reduced Motion setting that substantially reduces visual animation.

---

14. SETTINGS

Create a futuristic but practical settings interface.

Sections:

AI

- AI provider/model configuration

- temperature or equivalent controls if supported

- response style

Voice

- voice selection

- speech speed

- volume

- microphone selection

Gesture

- camera

- sensitivity

- smoothing

- enabled gestures

Appearance

- interface intensity

- particle density

- animation intensity

- reduced motion

Privacy

- microphone status

- camera status

- local data controls

- memory controls

---

15. MEMORY ARCHITECTURE

Create a modular memory architecture.

Separate:

Session Memory

Current conversation.

Persistent Memory

Information intentionally saved by the user.

User Preferences

Interface and behavior preferences.

The user must be able to view/delete persistent memory.

Do not silently store sensitive information.

---

16. SECURITY

Security is a priority.

Never expose:

- API keys

- secret tokens

- server credentials

in frontend JavaScript.

Use environment variables and server-side API routes.

Implement:

- input validation

- rate limiting where appropriate

- safe tool execution

- permission checks

- confirmation for destructive/high-impact actions

Never allow the AI to arbitrarily execute shell commands or delete files without an explicit permission mechanism.

---

17. ERROR HANDLING

The application must gracefully handle:

- microphone denied

- camera denied

- AI API failure

- speech recognition failure

- TTS failure

- network failure

- unsupported browser

- invalid API key

- tool failure

- timeout

- rate limit

Never leave the interface stuck in "Thinking" or "Listening".

Always provide a recoverable state.

---

18. TECH STACK

Prefer a modern production stack such as:

Frontend:

- React

- TypeScript

- Vite or Next.js

- Tailwind CSS

- Three.js / React Three Fiber

Backend:

- Node.js

- TypeScript

- API routes/server functions

AI:

- Provider-agnostic AI service layer

Voice:

- Provider-agnostic STT/TTS architecture

Computer vision:

- MediaPipe or equivalent

Storage:

- Start with local/session storage where appropriate

- Design database abstraction for future persistent storage

Do not add unnecessary dependencies.

---

19. PROJECT ARCHITECTURE

Use a clean modular architecture.

Suggested structure:

/components

/core

/ai

/voice

/gestures

/visual-engine

/tools

/memory

/api

/hooks

/services

/utils

/types

/config

Separate UI from AI logic.

Separate AI logic from tool execution.

Separate gesture detection from gesture actions.

Separate visual state from application state.

---

20. PERFORMANCE

The interface should feel extremely smooth.

Target:

- 60 FPS where hardware allows

- efficient particle rendering

- GPU acceleration

- throttled gesture processing where appropriate

- avoid unnecessary React re-renders

- lazy-load heavy modules

- clean up camera/audio resources

- stop camera streams when gesture mode is disabled

Do not sacrifice application functionality for unnecessary graphical effects.

---

21. FIRST-RUN EXPERIENCE

When the user opens SINGULO for the first time:

Show the core.

Then provide a minimal onboarding process:

1. Microphone permission

2. Optional camera permission

3. AI configuration

4. Voice test

5. Optional gesture calibration

Then enter the main interface.

Do not force a long tutorial.

---

22. MAIN SCREEN

The main screen should contain:

- SINGULO CORE in the center

- small microphone/voice control

- subtle conversation/status area

- minimal settings/control access

- camera/gesture status indicator

- optional text input

- current AI state

Everything else should remain hidden until needed.

The visual system must remain the primary focus.

---

23. REAL FUNCTIONALITY REQUIREMENT

IMPORTANT:

Do NOT build fake buttons.

Do NOT create simulated AI responses.

Do NOT create fake gesture detection.

Do NOT create fake loading animations pretending that an AI is processing.

Every visible control should either:

1. Actually work,

2. Be clearly marked as unavailable/not configured,

3. Or be disabled until its required service is configured.

If an external API is required, implement the integration structure and provide clear environment-variable configuration.

---

24. DEPLOYMENT

The project must be deployable.

Provide:

- production build configuration

- environment variable template

- README

- setup instructions

- development commands

- production build command

- deployment instructions

- API configuration instructions

The frontend must not depend on localhost-only functionality.

If a feature cannot work in a normal browser because of platform/security restrictions, clearly document that limitation and provide the closest legitimate implementation.

---

25. PWA

Make SINGULO installable as a Progressive Web App where possible.

Include:

- manifest

- icons

- responsive layout

- install support

- appropriate caching strategy

- offline fallback for static UI

AI/network-dependent functions can gracefully report when offline.

---

26. DESIGN QUALITY

The result must look like a premium futuristic engineering product.

Avoid:

- generic SaaS dashboards

- excessive cards

- random neon effects

- cheesy sci-fi text

- excessive gradients

- unnecessary buttons

- copied JARVIS/Marvel UI

- static fake holograms

The visual identity should feel like an original system called:

SINGULO

The interface should communicate:

advanced computation + science + precision + intelligence + motion + control.

---

27. DEVELOPMENT PRIORITY

Build in this order:

PHASE 1:

Functional full-screen SINGULO interface + dynamic triangle core.

PHASE 2:

Real AI conversation.

PHASE 3:

Microphone + speech recognition.

PHASE 4:

Text-to-speech + interruption.

PHASE 5:

Real hand tracking.

PHASE 6:

Gesture-controlled visual interaction.

PHASE 7:

Tool-calling architecture.

PHASE 8:

Web/file/calculation capabilities.

PHASE 9:

Memory.

PHASE 10:

Production security, performance optimization and deployment.

Do not attempt to fake all phases simultaneously.

Build a working foundation first, then extend it.

---

FINAL REQUIREMENT

The finished product should feel like the user has entered an advanced AI command environment rather than opened a normal website.

The experience should be:

OPEN → SINGULO CORE ACTIVATES → LISTEN → UNDERSTAND → THINK → ACT → RESPOND

Voice should be the primary interface.

Hand gestures should provide a secondary spatial interface.

Keyboard, mouse and touch should remain reliable fallbacks.

The system should be technically honest, production-oriented, modular, secure, responsive and deployable.

Build the application as a real software product, not a concept demo.    SINGULO — ADVANCED HAND GESTURE CONTROL SYSTEM

Build a REAL, production-ready hand gesture control system for the SINGULO AI interface.

This must NOT be a fake animation, simulated gesture system, mouse-position detector, or hardcoded demo.

The system must use the device camera and real-time computer vision to detect a user's hand, track hand landmarks, recognize gestures and hand movements, and translate them into actions inside the SINGULO interface.

The gesture system must work in real time and be modular so additional gestures can be added later.

---

1. CORE PIPELINE

Implement this complete pipeline:

CAMERA

↓

VIDEO STREAM

↓

HAND LANDMARK DETECTION

↓

LANDMARK SMOOTHING

↓

HAND POSE ANALYSIS

↓

GESTURE RECOGNITION

↓

MOVEMENT / VELOCITY ANALYSIS

↓

GESTURE STATE MACHINE

↓

COMMAND GENERATION

↓

PERMISSION / CONTEXT CHECK

↓

SINGULO ACTION

↓

VISUAL FEEDBACK

Use a modern browser-compatible hand-tracking system such as MediaPipe Hand Landmarker or an equivalent reliable solution.

Do NOT implement fake gesture detection.

---

2. CAMERA SYSTEM

Request camera permission explicitly.

Never activate the camera silently.

Provide:

- Camera permission handling

- Camera enable/disable

- Camera selection when multiple cameras exist

- Camera status indicator

- Camera unavailable state

- Browser compatibility handling

- Proper cleanup of MediaStream tracks

When gesture mode is disabled, stop unnecessary camera processing and release resources.

Display a small visual indicator such as:

GESTURE: ACTIVE

or

GESTURE: OFF

Do not show the raw camera feed by default.

Optionally provide a developer/debug mode that can show the camera feed and landmarks.

---

3. HAND TRACKING

Track at least one hand.

Preferably support two hands when hardware allows.

Track standard hand landmarks including:

- wrist

- thumb joints/tip

- index finger joints/tip

- middle finger joints/tip

- ring finger joints/tip

- pinky joints/tip

Use landmark coordinates to determine:

- finger extension

- finger bending

- palm orientation

- fingertip positions

- distances between fingers

- hand movement

- hand velocity

- hand direction

- relative movement

- pinch distance

Do not rely only on raw pixel coordinates.

Normalize coordinates so the system behaves consistently across different camera resolutions.

---

4. SMOOTHING

Raw camera landmarks can jitter.

Implement temporal smoothing.

Use an appropriate smoothing/filtering technique such as:

- exponential smoothing

- moving average

- One Euro Filter

- Kalman-style filtering where appropriate

The system must feel stable and responsive.

Avoid excessive smoothing that creates noticeable input lag.

---

5. GESTURE ENGINE

Create a dedicated gesture-recognition module.

Suggested structure:

/gestures

/detector

/recognizers

/filters

/state-machine

/actions

/types

Do not mix gesture recognition logic directly into React UI components.

Create a clean API such as:

GestureEngine.start()

GestureEngine.stop()

GestureEngine.getCurrentGesture()

GestureEngine.subscribe(callback)

GestureEngine.setSensitivity(value)

GestureEngine.setEnabled(gesture, value)

---

6. BASIC GESTURES

Implement these gestures.

A. OPEN PALM

Five fingers extended.

Meaning:

NEUTRAL / PAUSE

Use it to stop continuous manipulation.

It should NOT accidentally trigger a destructive command.

---

B. CLOSED FIST

Most fingers folded.

Meaning:

GRAB / HOLD

When an interactive 3D object is selected, fist can represent grabbing it.

---

C. POINTING

Index finger extended while other fingers are mostly folded.

Meaning:

SELECT / POINT

The index fingertip should act as a spatial pointer.

The UI should optionally display a small holographic cursor.

---

D. PINCH

Thumb and index fingertip close together.

Meaning:

PRECISION CONTROL

Calculate pinch distance continuously rather than treating pinch as only ON/OFF.

This is extremely important.

The distance between thumb and index finger should become a continuous control value.

---

E. TWO-FINGER / VICTORY

Index + middle finger extended.

Meaning:

NAVIGATION / SECONDARY MODE

Use this as a configurable gesture rather than permanently assigning one destructive action.

---

F. SWIPE

Detect a rapid directional hand movement.

Support:

LEFT

RIGHT

UP

DOWN

Swipes should be based on movement over time, not simply hand position.

Use:

- minimum displacement

- minimum velocity

- maximum gesture duration

- cooldown/debounce

to avoid accidental repeated swipes.

---

7. CONTINUOUS PINCH ZOOM

This is one of the most important SINGULO interactions.

The user should be able to perform:

PINCH → MOVE FINGERS APART → ZOOM IN

PINCH → MOVE FINGERS TOGETHER → ZOOM OUT

Do NOT implement this as:

"pinch = zoom in"

Instead calculate normalized pinch distance.

Example conceptual mapping:

small distance → zoom out state

medium distance → neutral

large distance → zoom in

Smooth the value over time.

Provide configurable:

- minimum pinch distance

- maximum pinch distance

- zoom sensitivity

- smoothing

---

8. HAND ROTATION / 3D ROTATION

Allow the user to rotate supported SINGULO 3D visual objects.

Possible interaction:

PINCH + MOVE HAND

or

GRAB + MOVE HAND

Map horizontal hand movement to horizontal object rotation.

Map vertical hand movement to vertical object rotation.

The movement must be relative.

Do not map the absolute camera position directly to object rotation.

This should feel like physically manipulating a holographic object.

---

9. SPATIAL POINTER

When the user points with the index finger:

Create an optional virtual cursor.

Map normalized fingertip coordinates to the SINGULO interface.

The cursor must be smoothed.

Implement:

- hover

- focus

- select

- drag where supported

Avoid accidental selection.

Require an intentional gesture such as:

POINT + PINCH

for precision selection.

---

10. GRAB AND DRAG

Support:

FIST / PINCH

+

HAND MOVEMENT

to manipulate compatible 3D objects.

Flow:

POINT / TARGET

↓

PINCH OR GRAB

↓

OBJECT LOCKS

↓

HAND MOVEMENT

↓

OBJECT FOLLOWS HAND

↓

RELEASE

↓

OBJECT STOPS

The selected object should visually indicate that it is being manipulated.

---

11. TWO-HAND CONTROL

If two hands are detected, enable advanced spatial controls.

Example:

LEFT HAND + RIGHT HAND

Distance between hands:

INCREASE DISTANCE

→ ZOOM IN

DECREASE DISTANCE

→ ZOOM OUT

Changing relative angle:

→ ROTATE

Moving both hands together:

→ PAN

This should only activate when both hands are confidently detected.

Avoid conflicts with single-hand gestures.

---

12. GESTURE STATE MACHINE

Do NOT execute actions directly from raw gesture classification.

Implement states such as:

IDLE

DETECTED

CONFIRMED

ACTIVE

RELEASED

COOLDOWN

Example:

PINCH DETECTED

↓

PINCH CONFIRMED

↓

PINCH ACTIVE

↓

CONTINUOUS ACTION

↓

PINCH RELEASED

↓

COOLDOWN

↓

IDLE

This prevents gesture flickering and repeated commands.

---

13. CONFIDENCE

Every gesture recognition should have a confidence score.

Example:

gesture:

PINCH

confidence:

0.94

Only activate sensitive interactions when confidence exceeds a configurable threshold.

Use hysteresis where appropriate so a gesture does not rapidly switch between:

PINCH

NOT PINCH

PINCH

NOT PINCH

because of tiny landmark changes.

---

14. GESTURE PRIORITY

Implement gesture priority.

Example:

If:

POINT + PINCH

is active,

do not simultaneously interpret the hand as:

POINT

SWIPE

GRAB

unless explicitly configured.

The gesture engine must resolve conflicts intelligently.

---

15. CONTEXT-AWARE GESTURES

Gesture meaning should depend on the current SINGULO context.

For example:

In 3D visualization mode:

PINCH + MOVE

→ zoom/manipulate

In menu navigation:

SWIPE LEFT

→ previous panel

In object selection:

POINT

→ hover

POINT + PINCH

→ select

In AI conversation mode:

OPEN PALM

→ stop/interrupt AI speech

Do not hardcode every gesture globally.

Create a command mapping layer.

---

16. VOICE + GESTURE COMBINATION

SINGULO should support multimodal commands.

Example:

User points at an object and says:

"Explain this."

System combines:

GESTURE TARGET

+

VOICE COMMAND

and understands that "this" refers to the selected object.

Another example:

User points at a visual element and says:

"Zoom into this."

Gesture provides TARGET.

Voice provides ACTION.

This should be handled through a multimodal command context.

---

17. VOICE INTERRUPTION

Allow:

OPEN PALM

to optionally interrupt SINGULO's speech.

When SINGULO is speaking:

OPEN PALM

→ STOP TTS

This must be configurable.

---

18. VISUAL FEEDBACK

Every recognized gesture should have subtle visual feedback.

Examples:

PINCH:

Show small connection between thumb and index.

POINT:

Show holographic pointer.

GRAB:

Show object interaction ring.

SWIPE:

Show directional trail.

GESTURE ACTIVE:

Show minimal status near the SINGULO CORE.

Do not clutter the interface.

The visual feedback should match the SINGULO scientific/holographic design.

---

19. SINGULO CORE REACTION

The central triangular SINGULO CORE should respond to gestures.

Examples:

PINCH:

Core contracts/expands.

ZOOM:

Core scale changes.

ROTATION:

Orbital structures rotate.

SWIPE:

Particle field reacts in swipe direction.

OPEN PALM:

Core enters calm/paused state.

GRAB:

Core produces an interaction pulse.

These are visual representations of REAL gesture events.

---

20. SENSITIVITY SETTINGS

Create a gesture settings panel.

Include:

Gesture System:

ON/OFF

Camera:

ON/OFF

Hand Count:

1 / 2

Sensitivity:

LOW / MEDIUM / HIGH

Smoothing:

LOW / MEDIUM / HIGH

Gesture Confidence:

Adjustable threshold

Zoom Sensitivity

Rotation Sensitivity

Swipe Sensitivity

Enable/disable individual gestures.

---

21. CALIBRATION

Create an optional calibration process.

The user should be able to calibrate:

- hand distance

- pinch range

- gesture sensitivity

- dominant hand

Show simple instructions.

Example:

"Move your hand naturally."

"Pinch your fingers."

"Open your palm."

"Swipe left."

Use these measurements to improve thresholds.

Do not make calibration mandatory unless absolutely necessary.

---

22. DEBUG MODE

Create a hidden/developer debug mode.

Show:

- camera frame

- hand landmarks

- landmark coordinates

- detected gesture

- confidence

- FPS

- processing time

- pinch distance

- hand velocity

- active state

- current command

This is extremely important for development and debugging.

Do not expose this clutter in normal user mode.

---

23. PERFORMANCE

The gesture system must remain responsive.

Optimize for:

- low latency

- stable FPS

- efficient landmark processing

- GPU acceleration where supported

- frame throttling where appropriate

- avoiding unnecessary React renders

Do not process every camera frame through expensive application logic if it is unnecessary.

Separate:

camera frame processing

from:

UI rendering.

---

24. MOBILE SUPPORT

On mobile browsers:

Use the device camera when supported.

Support:

- front/rear camera selection when available

- portrait and landscape

- touch fallback

- permission handling

Do not assume desktop webcam APIs.

---

25. PRIVACY

Camera processing should happen locally whenever technically possible.

Do not upload camera frames to a server merely to recognize basic gestures.

The application must clearly indicate:

CAMERA ACTIVE

and:

CAMERA OFF

When gesture mode is disabled, stop the camera stream.

---

26. SECURITY

Do not give gesture recognition direct unrestricted access to:

- shell commands

- file deletion

- account changes

- purchases

- external communications

- system administration

Gestures should produce high-level application commands.

Sensitive actions must pass through SINGULO's permission/confirmation system.

---

27. FALLBACK

If camera or hand tracking is unavailable:

SINGULO must continue working.

Fallback controls:

- mouse

- keyboard

- touch

- voice

The entire application must never become unusable because gesture control is unavailable.

---

28. COMMAND API

Create a clean command format.

Example conceptual structure:

{

type: "gesture",

gesture: "PINCH",

phase: "ACTIVE",

confidence: 0.94,

hand: "RIGHT",

position: { x, y },

delta: { x, y },

value: 0.72,

timestamp: ...

}

Then convert this into application actions through a command router.

Do NOT couple gesture detection directly to Three.js objects.

---

29. EXTENSIBILITY

Design the system so new gestures can be added without rewriting the entire application.

Future gestures may include:

- finger counting

- circular motion

- palm rotation

- finger snapping where reliable

- custom user gestures

- air-drawing

- multi-step gesture sequences

Create a registry-based architecture.

---

30. IMPORTANT IMPLEMENTATION RULES

Do NOT:

- fake gesture detection

- use arbitrary timers to pretend gestures exist

- map random mouse movement to gestures

- continuously upload camera footage

- activate camera without permission

- create laggy gesture controls

- trigger actions repeatedly from one gesture

- hardcode gesture thresholds without smoothing

- mix recognition logic with UI components

DO:

- use real hand landmarks

- use smoothing

- use confidence thresholds

- use state machines

- use cooldowns

- use relative movement

- use context-aware commands

- provide visual feedback

- provide debugging tools

- keep gesture processing modular

---

31. ACCEPTANCE TESTS

Before declaring the gesture system complete, verify:

1. Camera permission works.

2. Camera can be disabled.

3. One hand can be tracked.

4. Two hands can be tracked where supported.

5. Pinch is stable.

6. Pinch distance controls continuous zoom.

7. Hand movement controls rotation.

8. Pointing produces a stable cursor.

9. Point + pinch can select.

10. Swipe detection does not repeatedly trigger.

11. Open palm can interrupt speech if enabled.

12. Gesture confidence is visible in debug mode.

13. Camera frames are not uploaded unnecessarily.

14. Gesture processing does not freeze the UI.

15. Touch/mouse/keyboard still work when camera is unavailable.

16. Gesture settings work.

17. Gesture state transitions are stable.

18. SINGULO CORE responds visually to actual gesture events.

19. No fake gesture behavior is used.

20. Production build works without development-only APIs.

---

FINAL OBJECTIVE

The final result should make the user feel that they are physically interacting with the SINGULO computational environment.

The interaction should feel like:

LOOK

→ POINT

→ PINCH

→ MOVE

→ MANIPULATE

→ SPEAK

→ SINGULO UNDERSTANDS

→ VISUAL SYSTEM RESPONDS

The hand should function as a real spatial input device, not merely as a trigger for predefined animations.

Prioritize REAL-TIME RESPONSIVENESS, STABILITY, LOW LATENCY, PRIVACY, MODULARITY and ACTUAL FUNCTIONALITY over flashy but fake effects.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/673ef94f-4384-47a8-8a4e-2b7e2a1c0411).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
