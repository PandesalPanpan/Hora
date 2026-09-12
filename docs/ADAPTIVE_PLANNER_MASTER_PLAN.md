# Adaptive Planner — Master Plan

**Status:** In development — Sprint 1 vertical slice working locally  
**Primary user:** Student / personal productivity user  
**Product type:** Adaptive time-blocking + time-tracking planner  
**Initial platforms:** Android app + Web/PWA  
**Design file:** https://www.figma.com/design/TdEt9juay0mI1jhZttBYQE

## Implementation Snapshot — 2026-09-12

The first runnable vertical slice now exists in this repository.

Implemented:

- responsive Today screen,
- one-tap Quick Activity start for Study, Code, Exercise, and Reading,
- timestamp-based stopwatch display,
- immediate local persistence of the active session,
- active timer recovery after a reload/reopen,
- Finish → automatic completed-session logging,
- today's session timeline and tracked-time total,
- automated tests for time calculation and the start/reload/finish flow.
- Capacitor Android native project and web-to-native build/sync scripts.

Run it with:

```powershell
npm install
npm run dev
```

Verified with `npm test`, `npm run lint`, and `npm run build`.

Android packaging is configured with application ID `com.izatime.tracker`. Use `npm run android:open` after installing Android Studio and an Android SDK. Native device/emulator verification remains pending until those tools are present on the development machine.

The current development machine now has Android Studio, an Android 36 SDK, platform/build tools, and a Java 21 build runtime installed on `Y:`. The generated Capacitor project successfully produces a debug APK with `npm run android:apk`; physical-device testing remains pending.

Emulator verification is now complete: a hardware-accelerated Pixel 8 AVD using the stable Android 16/API 36 Google Play `x86_64` image boots successfully, and the Capacitor debug APK installs and launches as `com.izatime.tracker`. Use `npm run android:emulator` to start it.

This slice deliberately uses versioned browser `localStorage` rather than Dexie. It proves the local-first workflow with the smallest persistence layer; migration to IndexedDB should happen when session editing, intervals, tasks, or sync introduce richer queries and transactional writes.

Next recommended increment: Sprint 2 pause/resume intervals and optional, non-blocking duration targets.

---

## 1. Product Vision

Build a lightweight planner that combines:

- traditional time blocking,
- spontaneous task/session tracking,
- stopwatch-style timing,
- optional Pomodoro-style targets,
- automatic calendar logging,
- tasks,
- reports showing where time actually went.

The key product principle is:

> **Plan when you want. Track what actually happens. The calendar shows both.**

The system should support both structured and spontaneous behavior without forcing the user to maintain a rigid schedule.

A user should be able to:

1. Add fixed commitments such as school, appointments, or classes.
2. Create tasks that may or may not be scheduled.
3. Start an unscheduled activity immediately with one or two taps.
4. Track how long they actually spend on it.
5. Optionally set a target duration without forcing the session to stop.
6. Pause and resume the session.
7. Finish the session.
8. Automatically see the completed session placed on the day’s calendar.
9. Compare planned time against actual time.
10. Review reports such as time spent studying, programming, gaming, exercising, etc.

---

## 2. Core Product Principles

### 2.1 Low friction

Starting an activity should take as few taps as possible.

Example:

```text
Today
  ↓
Study
  ↓
Timer running
```

The system should not require the user to first create a task, project, schedule block, or timer configuration before tracking a spontaneous activity.

---

### 2.2 Flexible targets, not forced endings

A target such as:

```text
Study
Goal: 30 minutes
```

should behave as a milestone.

When the target is reached:

```text
✓ 30 minute goal reached
```

The timer continues unless the user explicitly stops it.

The user should be allowed to stay "locked in" and continue naturally.

---

### 2.3 Automatic session logging

Do not require a separate "deposit" workflow after every session.

Preferred flow:

```text
Start
  ↓
Pause / Resume
  ↓
Finish
  ↓
Automatically appears on calendar
```

The user can edit or undo the result afterward.

---

### 2.4 Planned time and actual time are different concepts

The app must clearly distinguish:

**Planned block**
- represents intention,
- may exist before the activity happens.

**Tracked session**
- represents reality,
- created from actual timing.

This distinction should remain visible in the calendar.

---

### 2.5 The timer must survive background suspension

The application must never rely on JavaScript incrementing a counter every second as the source of truth.

Bad design:

```text
timer = timer + 1 every second
```

Correct design:

```text
elapsed time =
current timestamp
- started timestamp
- paused intervals
```

If Android suspends or kills the app, the timer must still reconstruct the correct elapsed duration when reopened.

---

## 3. Target Platforms

### Phase 1

- Web browser on development PC
- Installable PWA
- Android APK through Capacitor

### Phase 2

- Improved Android native integration
- Home-screen experience
- Native notifications
- Potential Android foreground service

### Later

- Native iOS build through Capacitor if the project becomes worth paying for Apple development/distribution requirements.

Until then, iPhone can use the PWA version.

---

## 4. Recommended Technology Stack

### Frontend

- **TypeScript**
- **React**
- **Vite**
- **Tailwind CSS**
- **React Router**
- **date-fns**

### Android

- **Capacitor**
- Android Studio
- Native Android local notifications
- Custom native Capacitor plugin only if needed

### Backend

- **Supabase**
- PostgreSQL
- Supabase Auth
- Row Level Security
- Cloud synchronization

### Local/offline persistence

- IndexedDB
- Dexie

Important active-session state must be stored locally so losing connectivity or having the app suspended does not lose the session.

### Testing

- Vitest
- React Testing Library
- Playwright

### Development / project management

- Git
- GitHub
- GitHub Projects
- GitHub Issues
- Pull Requests

---

## 5. Development Environment Prerequisites

Install on the Windows development computer:

### Required immediately

- VS Code
- Git
- Node.js 22+
- npm
- Chrome or Edge
- GitHub account

Verify:

```powershell
node --version
npm --version
git --version
```

### Needed for Android development

- Android Studio
- Android SDK
- Android emulator or physical Android device
- USB cable
- Android Developer Options
- USB debugging

### Needed later

- Supabase account
- Supabase CLI if local backend development becomes useful
- Docker only if running the full Supabase stack locally

Do not install unnecessary infrastructure before the first working vertical slice.

---

## 6. Proposed Repository Structure

```text
adaptive-planner/
│
├── src/
│   ├── components/
│   ├── features/
│   │   ├── activities/
│   │   ├── timer/
│   │   ├── calendar/
│   │   ├── planner/
│   │   ├── tasks/
│   │   ├── reports/
│   │   └── settings/
│   │
│   ├── pages/
│   │   ├── Today.tsx
│   │   ├── Planner.tsx
│   │   ├── Tasks.tsx
│   │   ├── Reports.tsx
│   │   └── Settings.tsx
│   │
│   ├── lib/
│   │   ├── time.ts
│   │   ├── localDb.ts
│   │   └── supabase.ts
│   │
│   └── App.tsx
│
├── tests/
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── android/
│
├── package.json
├── capacitor.config.ts
└── README.md
```

Keep features organized by business capability instead of putting all logic directly into generic component folders.

---

## 7. Core Domain Model

The initial domain should stay small.

### 7.1 ActivityPreset

Used for one-tap tracking.

Examples:

- Study
- Programming
- Exercise
- Reading
- Gaming

Suggested fields:

```text
id
user_id
name
icon
color
is_archived
created_at
```

Do not call these "habits" yet.

Habit tracking introduces streaks, recurrence rules, missed days, and other complexity that is outside the first MVP.

---

### 7.2 Task

Represents something the user wants to accomplish.

Suggested fields:

```text
id
user_id
title
description
status
estimated_minutes
due_at
activity_id
created_at
updated_at
```

A task does not need to be scheduled.

---

### 7.3 PlannedBlock

Represents calendar intention.

Suggested fields:

```text
id
user_id
task_id
activity_id
title
starts_at
ends_at
is_fixed
recurrence_rule
created_at
updated_at
```

Examples:

- School 9:00–11:00
- Study Chapter 5 4:00–5:00
- Appointment 2:30–3:00

---

### 7.4 TimeSession

Represents actual tracked behavior.

Suggested fields:

```text
id
user_id
task_id
activity_id
started_at
finished_at
target_minutes
status
created_at
updated_at
```

Possible statuses:

```text
running
paused
completed
cancelled
```

Do not store elapsed seconds as the authoritative timer state.

---

### 7.5 SessionInterval

Used to correctly model pause/resume.

```text
id
session_id
started_at
finished_at
```

Example:

```text
Session: Study

14:00 → 14:20
14:35 → 15:10

Actual tracked time = 55 minutes
```

---

## 8. Timer Architecture

### 8.1 Source of truth

The source of truth is timestamps.

Example active state:

```json
{
  "activity": "Study",
  "status": "running",
  "startedAt": "2026-09-12T14:00:00+08:00",
  "targetMinutes": 30
}
```

The UI may visually update once per second while open, but those ticks are presentation only.

---

### 8.2 App suspension

Scenario:

```text
2:00 PM Start Study
2:03 PM Lock phone
2:30 PM Goal notification
2:47 PM Reopen app
```

Expected timer:

```text
47:00
```

The app calculates the duration from the saved timestamp.

---

### 8.3 Local persistence

Active session state must be saved immediately to local persistent storage.

Recommended local architecture:

```text
React UI
   ↓
Dexie / IndexedDB
   ↓
Supabase sync when available
```

The current running session must not exist only inside React component state.

---

### 8.4 Notifications

Android target notifications should use native Capacitor local notifications.

Example:

```text
Study goal reached
You've studied for 30 minutes.
Keep going or finish when you're ready.
```

The notification must not depend on the React WebView remaining active.

---

### 8.5 Foreground service

Do not implement this immediately.

Add a native Android foreground service only if product testing shows that the user benefits from:

- persistent active-session notification,
- lock-screen style controls,
- Pause button in the notification,
- Finish button in the notification,
- stronger Android lifecycle behavior.

Likely architecture:

```text
React
  ↓
Capacitor bridge
  ↓
small Kotlin native plugin
  ↓
Android Foreground Service
```

Do not rewrite the full app in Kotlin.

---

## 9. Main Screens

The Figma design should guide implementation.

Initial screen set:

1. Onboarding
2. Today
3. Quick Start activity selector
4. Active timer
5. Goal reached timer state
6. Session completion
7. Planner / Calendar
8. Add planned block
9. Tasks
10. Reports
11. Edit completed session
12. Activities / Settings
13. Desktop / PWA responsive layout

---

## 10. Today Screen

Today should be the primary home screen.

It should combine:

- current date,
- total tracked/focused time,
- quick activities,
- active session,
- scheduled blocks,
- actual completed sessions,
- unfinished tasks.

Example:

```text
Saturday, Sept 12

2h 18m tracked today

START SOMETHING
[Study] [Code] [Exercise] [+]

09:00  Class
10:00  Class

12:22  Study
        46 min
        Goal: 30 min ✓

16:00  Programming
        Planned
```

This screen should represent the philosophy of the whole product.

---

## 11. Planner / Calendar

The calendar must visually distinguish:

### Planned

What the user intended to do.

### Actual

What the user actually tracked.

Potential visual behavior:

```text
solid / stronger block = actual completed session
lighter / outlined block = planned session
```

The exact visual system should follow the Figma design.

Users should eventually be able to inspect differences such as:

```text
Planned: Study 7:00–8:00
Actual:  Study 7:18–8:31
```

Do not attempt sophisticated automatic rescheduling during the first MVP.

---

## 12. Reports

Reports answer:

> Where did my time actually go?

Initial reports should remain simple.

Example:

```text
THIS WEEK

Study          8h 42m
Programming    5h 10m
Class          7h 00m
Gaming         4h 18m
Exercise       2h 05m
```

Potential comparison:

```text
Study
Planned: 7h 00m
Actual:  8h 42m
```

Avoid dozens of analytics charts before user testing proves they are useful.

---

## 13. MVP Scope

### Required

- Today screen
- Quick Activities
- Stopwatch timer
- Optional duration target
- Target does not force-stop session
- Pause
- Resume
- Finish
- Automatic completed-session logging
- Edit completed session
- Planned calendar blocks
- Tasks
- Simple reports
- Local persistence
- Basic Supabase sync
- Android APK
- Responsive PWA

### Explicitly not MVP

- AI scheduling
- productivity scoring
- streak systems
- gamification
- achievements
- teams
- social features
- complex subtasks
- deep project management
- Eisenhower matrix
- advanced recurring-task engine
- automatic calendar optimization
- native iOS distribution
- dozens of analytics charts

---

# 14. Agile Development Strategy

The partner acts as the initial Product Owner / primary user.

Development should happen in small usable increments.

Recommended board:

```text
BACKLOG
   ↓
READY
   ↓
IN PROGRESS
   ↓
REVIEW
   ↓
DONE
```

Use GitHub Projects and GitHub Issues.

---

## 15. Definition of Done

A story is Done when:

- acceptance criteria pass,
- implementation is merged,
- relevant unit tests pass,
- relevant E2E tests pass,
- there is no known blocker-level bug,
- it works on the target device when device behavior matters,
- the primary user has reviewed the behavior where appropriate,
- documentation is updated if architecture or product behavior changed.

---

# 16. Sprint / Milestone Plan

## Sprint 0 — Discovery and setup

### Goal

Understand the user's real workflow and prepare the project.

### Tasks

- Review existing Figma design.
- Validate user scenarios with partner.
- Create GitHub repository.
- Configure GitHub Project.
- Scaffold React + TypeScript + Vite.
- Configure linting/testing basics.
- Define first user stories.
- Establish branch / PR workflow.

### Important discovery scenarios

Ask the partner to walk through:

- spontaneous study session,
- planned study session,
- target reached while still focused,
- forgetting to stop the timer,
- pausing for food or travel,
- switching activities,
- changing an incorrect start/end time,
- poor/no internet,
- viewing weekly totals.

---

## Sprint 1 — First vertical slice

### Goal

The user can spontaneously track an activity and see it on Today.

### Core flow

```text
Quick Activity
    ↓
Start timer
    ↓
Timer
    ↓
Finish
    ↓
Completed session on Today
```

### Initial implementation

- Today page
- Quick Activity buttons
- Start timer
- Active timer UI
- Finish
- Local persistence
- Completed session list/timeline

### Acceptance criteria

- Study can start in no more than 2 taps from Today.
- Real start timestamp is saved.
- Timer display updates while open.
- Closing/reloading does not reset the active session.
- Finishing creates a completed session.
- Completed duration is correct.
- The completed session appears on Today.
- Critical automated tests pass.

Do not add Supabase until this loop is reliable.

---

## Sprint 2 — Robust timer behavior

### Goal

Timer behaves correctly in real-world mobile conditions.

### Add

- target duration,
- target reached state,
- continue beyond target,
- pause,
- resume,
- session intervals,
- edit incorrect session times,
- recovery after browser/app restart.

### Key acceptance tests

#### Background test

```text
Start 5 minute Study
Lock phone
Wait until target
Receive notification if running as Android app
Wait 2 more minutes
Reopen
Expected elapsed ≈ 7 minutes
```

#### App suspension test

```text
Start Study
Move app to background
Return later
Elapsed time must remain correct
```

#### Process restart test

```text
Start Study
Close/restart app
Active session must restore correctly
```

#### Pause test

Paused time must not count toward actual tracked duration.

---

## Sprint 3 — Planning

### Goal

The user can plan time in advance and compare intention to reality.

### Add

- tasks,
- planned calendar blocks,
- fixed commitments,
- recurring classes/basic recurrence,
- visual planned-vs-actual distinction.

### Acceptance scenario

```text
Plan Study 7:00–8:00
Actually start 7:18
Finish 8:31

Calendar displays both intention and actual outcome clearly.
```

---

## Sprint 4 — Supabase and multi-device synchronization

### Goal

Data is backed up and usable across devices.

### Add

- Supabase project,
- authentication,
- PostgreSQL schema,
- migrations,
- Row Level Security,
- sync,
- conflict strategy,
- one active logical timer per user.

### Important rule

The local timer must remain usable if Supabase is unavailable.

Cloud connectivity must not be required for starting or finishing a session.

---

## Sprint 5 — Reports

### Goal

The user can understand how their time was actually spent.

### Add

- daily total,
- weekly total,
- totals by activity,
- planned vs actual,
- simple trend view if useful.

Keep the report useful rather than visually overloaded.

---

## Sprint 6 — Android beta

### Goal

Primary user uses the product as a real Android application.

### Add

- Capacitor
- Android platform
- Android Studio configuration
- signed development/beta APK
- native local notifications
- physical-device testing
- app lifecycle testing

### Beta testing

Partner uses the app naturally for approximately one week.

Record friction rather than immediately adding features.

Example feedback:

```text
"I forgot to stop it."
"Study takes too many taps."
"I need to fix my start time."
"I want my classes to repeat."
"This report is useless."
"I want to start from the notification."
```

Those become backlog items.

---

## Sprint 7 — Android native enhancements

Only after beta evidence.

Potential features:

- ongoing active-session notification,
- notification Pause action,
- notification Finish action,
- Android foreground service,
- app shortcuts,
- home-screen widget.

Do not add these only because they are technically interesting.

---

# 17. Initial User Stories

## Story: Quick tracking

> As a student, I want to start tracking Study quickly so spontaneous productive time does not require prior planning.

Acceptance:

- Study is available from Today.
- Start requires ≤ 2 taps.
- Session begins immediately.
- Start time is persisted.

---

## Story: Flexible target

> As a user, I want to set a 30-minute target without being forced to stop so I can continue when I am focused.

Acceptance:

- target may be optional,
- target reached state appears,
- timer continues,
- user may finish at any later point.

---

## Story: Automatic logging

> As a user, I want finishing a timed activity to automatically appear on my calendar so tracking does not create more administrative work.

Acceptance:

- finished session is saved,
- actual start and finish are preserved,
- session appears on Today/calendar,
- session can be edited afterward.

---

## Story: Pause and resume

> As a user, I want breaks excluded from tracked work time.

Acceptance:

- pause ends the current interval,
- resume starts another interval,
- elapsed tracked time equals the sum of working intervals,
- paused duration is excluded.

---

## Story: Recovery

> As a user, I want a running timer to survive the app being closed or suspended.

Acceptance:

- running session is stored persistently,
- reopening restores the session,
- elapsed duration is reconstructed from timestamps,
- no tracked time disappears.

---

# 18. Testing Strategy

## Unit tests

Focus on business logic:

- elapsed-time calculation,
- pause/resume intervals,
- target reached calculation,
- planned vs actual durations,
- time-zone/date helpers.

Example:

```text
Start 14:00
Pause 14:20
Resume 14:35
Finish 15:10

Expected actual = 55 minutes
```

---

## Component tests

Test:

- timer display,
- Quick Start,
- target state,
- Finish confirmation,
- session editing,
- Today rendering.

---

## E2E tests

Critical workflows:

```text
start activity → finish → session appears
```

```text
start → pause → resume → finish
```

```text
create planned block → view calendar
```

```text
create task → start task timer → finish
```

```text
reload during active timer → timer restores
```

---

## Physical Android tests

Some behavior cannot be proven only through browser E2E.

Manually test:

- screen locked,
- application backgrounded,
- application process removed,
- temporary loss of internet,
- Android notification delivery,
- reopening from notification,
- long-duration session.

---

# 19. Offline Strategy

Offline support is a core reliability requirement, not an optional polish feature.

The user must be able to:

- start,
- pause,
- resume,
- finish,
- edit,

without internet.

Local changes should synchronize later.

Suggested rule:

```text
Local write first
   ↓
UI confirms
   ↓
sync to Supabase afterward
```

Do not block timer actions while waiting for a server response.

---

# 20. Sync Strategy

Initial simple policy:

- locally generate UUIDs,
- timestamps are stored in UTC,
- display times in the user's local time zone,
- maintain `created_at` / `updated_at`,
- completed local operations sync to Supabase,
- conflict handling should favor explicit user edits over background sync.

More sophisticated conflict resolution can be added only when needed.

---

# 21. Security

When Supabase is introduced:

- enable Row Level Security,
- each user may access only their own records,
- never ship the Supabase service-role key to the frontend,
- environment variables must not expose privileged secrets,
- authentication state must be validated by Supabase.

This application does not require a custom backend server for the first release.

---

# 22. Performance and Battery Principles

Do not fight the operating system.

The app should:

- avoid unnecessary background work,
- reconstruct timer state from timestamps,
- use native scheduled notifications,
- persist immediately,
- avoid per-second server writes,
- avoid continuous network synchronization,
- avoid a foreground service unless it provides demonstrated user value.

---

# 23. Native Android Boundary

Stay web-first unless Android-specific behavior requires native code.

Use native code for things such as:

- local notifications,
- foreground services,
- widgets,
- app shortcuts,
- specialized lifecycle integration.

Do not implement ordinary UI/business logic twice.

Preferred ownership:

```text
React / TypeScript
- screens
- forms
- planner
- tasks
- reports
- time calculations
- sync logic

Android native
- OS integration only
```

---

# 24. Early Product Decisions

Current decisions:

1. Quick activities are called Activities / Presets, not Habits.
2. Finishing automatically logs the session.
3. Target duration does not force-stop.
4. Planned time and actual time remain separate concepts.
5. Today is the primary product screen.
6. Timer truth comes from timestamps.
7. Offline operation is required.
8. Android will be the primary native beta platform.
9. iPhone begins as PWA.
10. Native iOS distribution is postponed.
11. React + TypeScript is preferred over Flutter.
12. Capacitor is preferred for Android packaging/native bridging.
13. Supabase is introduced only after the local core loop works.
14. Foreground service is deferred until real testing justifies it.

---

# 25. Major Risks

## Timer reliability

Risk:
background suspension or process death.

Mitigation:
timestamp architecture + persistent local storage + native notification scheduling.

---

## Scope creep

Risk:
turning the app into Todoist + Google Calendar + Forest + Toggl + Notion simultaneously.

Mitigation:
protect MVP boundaries and prioritize partner feedback.

---

## Overengineering native Android

Risk:
building Kotlin services/widgets before the basic product is useful.

Mitigation:
native features only after beta evidence.

---

## Sync complexity

Risk:
multi-device edits and active timers conflict.

Mitigation:
local-first design and initially enforce one logical active session per user.

---

## Calendar complexity

Risk:
recurrence, time zones, drag/drop, rescheduling, and overlaps become a project by themselves.

Mitigation:
start with simple blocks and basic recurrence.

---

# 26. Success Criteria for the First Real Beta

The first beta is successful when the partner can use it for a normal week and reliably:

- view fixed commitments,
- start spontaneous activities,
- set optional timing goals,
- pause/resume,
- keep going after a target,
- finish a session,
- see the session automatically on Today,
- correct mistakes,
- create basic planned blocks,
- create tasks,
- see useful weekly totals,
- use the timer despite screen locking/backgrounding,
- recover the active timer after reopening,
- continue basic tracking without internet.

The strongest success signal is not feature count.

It is:

> **The user chooses to open the app during their normal day without being reminded to test it.**

---

# 27. Immediate Next Steps

When development starts:

1. Create GitHub repository.
2. Create GitHub Project board.
3. Scaffold Vite + React + TypeScript.
4. Add basic quality tooling.
5. Implement the Figma Today screen.
6. Implement Quick Activity presets.
7. Implement timestamp-based local timer.
8. Persist active session locally.
9. Implement Finish → completed session.
10. Add tests for recovery and duration calculation.
11. Let partner use the first vertical slice.
12. Adjust backlog based on observed behavior.
13. Only then proceed to pause/resume, planning, cloud sync, and Android packaging.

---

# 28. Master Rule

Whenever a new feature is proposed, ask:

> Does this make it faster to plan, easier to track what actually happened, or more useful to understand how time was spent?

If not, it probably does not belong in the current milestone.

---

## Current Recommended Direction

```text
Figma
  ↓
React + TypeScript + Vite
  ↓
Local-first timer vertical slice
  ↓
Tasks + planned blocks
  ↓
Supabase sync
  ↓
Reports
  ↓
Capacitor Android beta
  ↓
Real partner usage
  ↓
Native Android enhancements only where justified
```

This document should evolve with validated product decisions. Major architectural or product changes should be reflected here rather than being left only in chat history.
