# Iza Time Tracker Repository Guide

## Product direction

Iza is a mobile-first adaptive planner for a student and personal-productivity user. It combines low-friction time tracking, optional goals, planned calendar blocks, tasks, and simple reports. The product principle is: plan when useful, track what actually happens, and show both without adding administrative work.

Read `docs/ADAPTIVE_PLANNER_MASTER_PLAN.md` before changing product behavior. Use `docs/hth.docx` as the current planner requirements brief.

## Design authority

- Build on the current client-designed UI. Preserve its rounded geometry, cocoa outlines, peach and raspberry palette, Poppins interface typography, Arima wordmark, and friendly handmade character.
- Do not replace the interface with a generic SaaS dashboard, neutral component kit, glassmorphism, or an unrelated design system.
- The Iza character is a reusable product actor. Use it for the timer, onboarding, empty states, goal milestones, completion, recovery, and short guidance where an emotional cue helps.
- Do not place the character in every card or use it as decoration. Calendar density, task scanning, and reports take priority where data is the main content.
- Keep interface copy direct, conversational, and specific. Use sentence case. Buttons must describe the result of the action.

## UX reference

Use Steve Krug's *Don't Make Me Think, Revisited* as the repository's primary usability reference. Apply its principles by making screens and controls self-evident, keeping navigation familiar and consistent, making the primary action obvious, removing unnecessary choices and copy, and testing realistic tasks on actual phone layouts.

The book guides interaction clarity; it is not a replacement visual system. When applying it, preserve Iza's product direction and client-designed visual language. If a recommendation appears to conflict with those constraints, simplify the interaction without changing Iza into a generic dashboard.

## Mobile first implementation

- Design and test from a 320px minimum width upward. The primary target is an Android phone wrapped with Capacitor.
- Respect `env(safe-area-inset-top)`, `env(safe-area-inset-right)`, `env(safe-area-inset-bottom)`, and `env(safe-area-inset-left)`.
- Prefer `100dvh` with a `100vh` fallback. Avoid layouts that depend on the browser address-bar height.
- Primary controls must be thumb reachable and at least 44px in each interactive dimension.
- Keep bottom navigation persistent on phones. Use sheets or full-screen flows for mobile editing instead of desktop-sized dialogs.
- Day view is the primary phone calendar. Week view may scroll horizontally and should preserve readable columns. Tablet and desktop layouts may progressively expose multiple panes.
- Do not make the desktop PWA a permanently enlarged phone. At wider breakpoints, use available space for complementary information while keeping the same visual language.
- Account for the Android on-screen keyboard, back button, app pause/resume, and WebView restoration.

## Frontend architecture

- Use React and TypeScript. Organize code by business capability under `src/features` and route-level experiences under `src/pages`.
- Keep shared visual components under `src/components`. Extend existing components before duplicating markup.
- Routes must be URL-backed and compatible with Capacitor. Do not rely on ephemeral component state as the only navigation source.
- Keep domain types separate from display-only types. Do not put business logic into CSS or large JSX expressions when a named helper is clearer.
- Preserve accessibility: semantic controls, visible keyboard focus, useful accessible names, reduced-motion support, and sufficient contrast.

## Timer and offline correctness

- Timestamps are authoritative. A one-second UI interval only refreshes the display.
- Active sessions must survive reload, suspension, and process restart. Never store only an incrementing elapsed counter.
- Paused time must be represented explicitly and excluded from tracked duration.
- A duration target is a milestone and must never stop a session automatically.
- Local writes happen before cloud synchronization. Starting, pausing, resuming, finishing, editing, and planning must remain usable offline.
- Browser `localStorage` is acceptable only for small prototypes. Move richer task, interval, session, and planner queries to IndexedDB through Dexie. Retain a small redundant native preference record for critical active-session recovery when Capacitor integration is introduced.
- Store persisted timestamps in UTC and render them in the user's local time zone.

## Capacitor and Android

- Keep the application web-first. Add native code only for capabilities that require it, such as local notifications, foreground services, widgets, or Android shortcuts.
- Recalculate timer state from persisted timestamps whenever the app returns to the foreground.
- Goal notifications must use Capacitor local notifications and must not depend on the WebView remaining active.
- Do not add a foreground service until device testing shows that ongoing notification controls materially improve the experience.
- After web changes that affect the APK, run `npm run android:sync`. For device-sensitive work, verify on the configured emulator in addition to browser checks.

## Scope discipline

- Favor the master plan's MVP: Today, quick activities, robust timer, planned blocks, tasks, reports, local persistence, basic sync, and Android delivery.
- Do not add gamification, streaks, productivity scores, teams, social features, advanced recurrence, or AI scheduling unless the product plan is explicitly changed.
- Planned time represents intention. Timeflow sessions represent reality. Never collapse them into one record type or one indistinguishable calendar treatment.

## Verification

- Run `npm test`, `npm run lint`, and `npm run build` after meaningful changes.
- Add or update tests for timer mathematics, persistence/recovery, routes, planned-versus-actual behavior, and critical user actions.
- Visually inspect relevant phone layouts and at least one wider breakpoint after UI changes.
- Test keyboard focus and reduced-motion behavior for new interactive components.
- Do not mark work complete when required checks are failing. Report any device-only verification that remains pending.
