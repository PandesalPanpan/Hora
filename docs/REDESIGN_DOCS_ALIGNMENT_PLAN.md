# Redesign and requirements alignment plan

**Status:** Proposed work, not yet implemented  
**Primary design authority:** `docs/hth.docx` for Planner and Calendar behavior  
**Product authority:** `docs/ADAPTIVE_PLANNER_MASTER_PLAN.md`  
**Prepared:** September 14, 2026

## Purpose

Bring the current Iza redesign into alignment with the client-authored Planner and Calendar brief and the repository master plan. Preserve the current friendly visual character while correcting navigation, daily workflow, planner semantics, reporting accuracy, persistence, and mobile usability.

The current Planner already implements most of the client brief's visual foundation. The larger gap is that planning, tasks, and actual tracked time still feel like separate tools instead of one low-friction daily workflow.

## Product decisions to preserve

- Today remains the primary screen.
- Planned time represents intention; Timeflow sessions represent reality.
- Starting a spontaneous activity must take no more than two taps.
- Duration targets are milestones and never stop a session automatically.
- Finished sessions are logged automatically.
- Timer truth comes from persisted timestamps, not UI ticks.
- All core actions remain usable offline.
- Iza keeps its rounded geometry, cocoa outlines, peach and raspberry palette, handmade character, Poppins interface typography, and Arima wordmark.
- Gamification, streaks, productivity scores, social features, and AI scheduling remain outside the MVP.

## Current implementation that should be retained

The current Planner already provides:

- a 24-hour vertical time grid;
- hourly gridlines and half-hour markers;
- a current-time line and marker;
- Day and Week views;
- previous, Today, and next navigation;
- highlighted current and selected dates;
- week-to-day drilldown;
- visually distinct planned, completed Timeflow, and live Timeflow blocks;
- resize handles on planned blocks;
- basic planned-versus-actual overlap splitting;
- Add Block and click-on-grid creation;
- Save as planned and Start via Timeflow actions;
- a planned-versus-actual inspector;
- horizontal week scrolling on narrow phones.

These foundations should be extended instead of replaced.

## Priority 1 Daily workflow and navigation

### Redesign Today as the unified daily dashboard

Today should show, in this order:

1. Current date and tracked-time total.
2. Active session, if present.
3. Quick Activities with a one-tap start path.
4. The next planned block or today's compact schedule.
5. Recent completed Timeflow sessions.
6. A short list of unfinished tasks.

The timer remains prominent, but it should no longer consume the entire product home experience. Users should understand what they planned, what they are doing, and what actually happened without changing screens.

### Make Planner and Tasks directly discoverable

Recommended phone navigation:

- Today
- Planner
- Tasks
- Reports

Settings and profile can be reached through the header or profile control. A separate History destination is optional once Today and Reports expose completed sessions clearly.

### Acceptance criteria

- Planner and Tasks are each reachable in one tap from primary navigation.
- Today displays planned and actual records without making them look like the same record type.
- Study can still start in no more than two taps.
- The bottom navigation remains persistent and safe-area aware.
- Primary navigation controls have at least 44px interactive dimensions.

## Priority 2 Data model and local persistence

### Move rich records to Dexie and IndexedDB

Replace separate feature-owned `localStorage` collections with a local database for:

- activity presets;
- tasks;
- planned blocks;
- time sessions;
- session intervals;
- pending synchronization operations.

A small redundant active-session recovery record may remain for eventual Capacitor recovery, but IndexedDB becomes the main queryable store.

### Add explicit relationships

Add optional identifiers such as:

```text
TimeSession.taskId
TimeSession.plannedBlockId
PlannedBlock.taskId
```

Do not infer a matching plan from a similar title or nearby start time. Explicit relationships are required for accurate planned-versus-actual comparisons.

### Represent pause and resume as intervals

Store working intervals explicitly so users can inspect and correct breaks. Accumulated paused seconds may be derived for display but should not be the only historical representation.

### Acceptance criteria

- Existing local sessions, tasks, and planned blocks migrate without data loss.
- Starting, pausing, resuming, finishing, editing, and planning work offline.
- All persisted timestamps use UTC.
- Planned blocks and Timeflow sessions remain separate tables and domain types.
- Reloading or restarting restores the active session with the correct elapsed duration.

## Priority 3 Finish the client Planner interactions

### Drag to create a time range

Support dragging across empty calendar space to select a start and end time. A simple click may continue to create a one-hour default block.

On wider layouts, open the editor beside the selected time range. On phones, use a bottom sheet or full-screen editing flow so the keyboard does not obscure the form.

### Improve live-session control

Expose a direct Stop action on or immediately beside the live calendar block. Opening the inspector first should not be required. The control must remain at least 44px and must not obscure the event title or timer.

### Replace the overlap shortcut with grouped layout

Calculate overlapping event groups and assign a column to every simultaneous event. The layout must handle three or more events without stacking them on the same half of the calendar.

### Complete editing actions

Planned blocks need:

- edit title;
- edit category and color;
- edit date and start/end time;
- resize;
- move to another time or date;
- duplicate;
- delete with a short undo opportunity.

Completed Timeflow sessions need:

- edit activity;
- edit start and finish timestamps;
- edit working and paused intervals;
- link or unlink a task and planned block;
- edit note;
- delete with undo.

### Strengthen the inspector

The inspector should show:

- planned duration;
- actual tracked duration;
- start-time difference;
- finish-time difference;
- linked task or planned block;
- an explicit message when no plan is linked.

### Handle calendar edge cases

- Render cross-midnight events on every affected day.
- Keep the current-time line aligned after foreground restoration.
- Make horizontal week scrolling apparent on small phones.
- Preserve a readable seven-day layout on tablet and desktop.
- Provide keyboard alternatives to drag and resize interactions.

### Acceptance criteria

- Clicking a day in Week view opens Day view for that date.
- Clicking empty space opens creation with the expected hour.
- Dragging empty space preserves the selected start and end times.
- A live session grows from its start time to the current time and can be stopped directly.
- Three or more overlapping records remain individually readable and tappable.
- Planned-versus-actual comparisons use explicit links rather than title matching.

## Priority 4 Reports and truthful feedback

Remove or redesign:

- the day-rhythm or streak-style card;
- the hard-coded percentage change;
- encouragement that implies performance not supported by real data.

Initial reports should answer where actual time went and how it compared with the plan. Include:

- daily actual total;
- weekly actual total;
- actual time by activity;
- planned versus actual time by activity;
- planned versus actual details for linked blocks;
- a simple trend only when there is enough real historical data to calculate one.

### Acceptance criteria

- Every displayed number is derived from persisted user data.
- No streak, score, achievement, or unrequested gamification appears.
- A user can distinguish planned hours from actual tracked hours.
- Empty reports explain the first useful action directly.

## Priority 5 Visual and mobile-system alignment

### Restore the approved typography

- Use Poppins for interface text.
- Use Arima for the Iza wordmark.
- Remove remaining Hora naming from user-facing content and gradually rename internal design tokens when touching related files.

Keep the current rounded geometry, cocoa outlines, peach and raspberry palette, and friendly handmade character.

### Correct mobile touch targets

Increase the interactive hit areas for:

- duration goal buttons;
- Flowtime and Pomodoro controls;
- activity category pills;
- calendar resize handles;
- event actions and compact header controls.

Visible pills may remain visually compact if an invisible hit area provides at least 44px of interactive space without overlapping adjacent controls.

### Use the Iza character intentionally

Use the character for:

- active timer feedback;
- onboarding;
- meaningful empty states;
- target milestones;
- session completion;
- recovery after interruption.

Do not add the character to dense calendar, task, or report cards where it competes with scanning.

### Acceptance criteria

- New and changed controls have visible keyboard focus.
- Drag and animation behavior respects reduced-motion preferences.
- Relevant screens work from 320px width upward.
- Safe-area insets are respected on all edges.
- The Android keyboard does not cover required form actions.
- Day and Week views remain legible on phones and wider breakpoints.

## Priority 6 Remaining MVP capabilities

Implement after the daily workflow and data model are stable:

1. Native Capacitor goal notifications that survive WebView suspension.
2. Basic recurring fixed commitments such as classes.
3. Expanded task fields: description, editable estimate, due date, activity, and optional planned block.
4. Installable PWA manifest and service-worker behavior.
5. Basic Supabase authentication and local-first synchronization.
6. Onboarding focused on starting the first session and optionally planning the first block.

Do not add a foreground service until device testing demonstrates that persistent notification controls materially improve the experience.

## Verification plan

### Automated tests

Add or update tests for:

- data migration from existing local storage;
- timestamp-based active-session recovery;
- explicit session intervals;
- editing actual start/end times;
- explicit plan-to-session linking;
- planned-versus-actual calculations;
- drag-to-create time selection;
- resizing planned blocks;
- three-way overlaps;
- cross-midnight records;
- Week-to-Day drilldown;
- route-backed navigation;
- truthful report calculations;
- keyboard-accessible alternatives to pointer interactions.

### Visual checks

Inspect at minimum:

- 320 x 568 phone;
- 360 x 800 Android phone;
- 390 x 844 larger phone;
- one tablet breakpoint;
- one desktop breakpoint.

Review Today, active timer, Planner Day, Planner Week, quick-add, inspector, session editing, Tasks, Reports, and keyboard-open states.

### Android checks

After web changes affecting the APK:

```powershell
npm run android:sync
```

For timer and notification changes, verify:

- background and foreground transitions;
- screen lock;
- process restart;
- temporary loss of connectivity;
- goal notification delivery;
- reopening from a notification;
- active-session recovery.

### Required repository checks

```powershell
npm test
npm run lint
npm run build
```

Do not mark a phase complete while a required check is failing. Record any device-only verification that remains pending.

## Suggested implementation sequence

1. Rework navigation and Today without changing timer mathematics.
2. Introduce Dexie, migrations, domain repositories, and explicit relationships.
3. Add completed-session and planned-block editing.
4. Complete drag creation, direct live stopping, and robust overlap layout.
5. Replace report gamification and placeholder claims with real planned-versus-actual reporting.
6. Restore Poppins and Arima and complete touch-target and accessibility corrections.
7. Add native notifications and recurring fixed commitments.
8. Add PWA support, Supabase synchronization, and onboarding.

Each step should remain a usable vertical slice and should be reviewed on a real phone layout before proceeding.

## Definition of complete

This alignment plan is complete when the primary user can reliably:

- understand today's plan and actual activity from Today;
- start a spontaneous session in no more than two taps;
- create and adjust a planned block directly on the calendar;
- see a live session in the correct calendar position;
- stop it without unnecessary navigation;
- edit incorrect planned or actual times;
- compare an explicitly linked plan with the actual result;
- create and start tasks;
- trust every number in Reports;
- continue core work offline;
- recover an active session after Android suspension or restart.

