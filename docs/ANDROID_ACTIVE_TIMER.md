# Android active timer controls

## Scope

Hora has one ongoing Android notification for the one active timer session. It is separate from the existing one-shot milestone alerts and planned-block reminders. The active card uses the Android system chronometer, so the notification advances from timestamps while the WebView is backgrounded or reclaimed; Hora never writes or calls Capacitor once per second.

## Native boundary

The web timer remains the primary domain model. `useTimer` writes the active session to local storage/Dexie first and then mirrors the small session snapshot through the `TimerNotification` Capacitor plugin.

The native side contains:

- `TimerNotificationPlugin` — the bridge and `timerAction` event source;
- `TimerNotificationController` — notification channels, chronometer construction, action intents, native milestone fallback, and notification dismissal handling;
- `TimerActionReceiver` — Pause, Resume, Finish, Start break, and Start focus commands;
- `TimerMilestoneReceiver` — a one-shot fallback used when a native action must reschedule a target while JavaScript is unavailable;
- `TimerDismissReceiver` — records dismissal without changing timer state;
- `TimerSnapshotRepository` — a versioned `SharedPreferences` record;
- `TimerJson` and `TimerMath` — defensive timestamp/state transformations.

No foreground service is used. The notification is system-owned, the chronometer is system-rendered, and the receivers do only event-driven state work. A service would add lifecycle and permission complexity without improving the required timer display. A future device study may revisit this if OEM behavior proves that an ongoing notification alone is insufficient.

## Continuity record and conflict rule

The native record stores only the active session, a monotonically increasing revision, update time, and pending native actions. An action contains a stable action ID, the session ID, the action timestamp, and the resulting active/completed session when needed. It does not copy the full application database.

Web sync includes the last native revision it observed, captured when each bridge operation is queued. Native rejects a web snapshot based on an older revision and returns the current snapshot. Native actions therefore win over older Dexie active state, including a stale bridge call that was waiting behind another operation. The web reconciles pending actions in timestamp/revision order before presenting the timer, persists the resulting active/completed records, and acknowledges each action only after the local write succeeds. Completion writes are ID-deduplicated by session ID, so retrying after a process death cannot create a second history row.

When the WebView is alive, the receiver emits `timerAction` immediately and the TypeScript timer applies the same action to React/Dexie. When it is unavailable, the action remains pending in `SharedPreferences` and is replayed on the next startup/foreground reconciliation.

## Notification behavior

The active notification has one stable ID and uses the quiet `iza-active-timer` channel. Flowtime uses `setUsesChronometer(true)` with a wall-clock `when` base of `currentTimeMillis - trackedSeconds`; Android renders the count-up without a timer tick. Paused Flowtime uses static text. Pomodoro focus/break uses a count-down chronometer until the phase reaches its target, then remains at an explicit reached state. Every build uses `setOngoing(true)`, `setOnlyAlertOnce(true)`, an immutable explicit action `PendingIntent`, and the Hora small icon.

Running Flowtime offers Pause and Finish. Paused Flowtime offers Resume and Finish. Pomodoro offers the same controls during a phase; after a focus/break milestone it offers Start break or Start focus plus Finish. Time passing never changes Pomodoro phase. The action itself is the explicit transition.

On Android, the native controller owns the active-session target alarm so a milestone can still update the card when JavaScript is unavailable; it cancels legacy Capacitor timer alarms for the same session. Capacitor Local Notifications remains the owner for planner reminders and for timer milestones on non-Android platforms. If Resume or an explicit Pomodoro phase transition occurs while JavaScript is unavailable, the controller schedules a native one-shot fallback alarm. The fallback checks the continuity record again before alerting, then updates the ongoing card to the reached state; it never advances Pomodoro.

The Android 16 promoted-ongoing request is applied as a progressive enhancement. The notification requests `POST_PROMOTED_NOTIFICATIONS` and promotion, but Android/user/OEM policy decides whether it is actually promoted. It uses a standard notification, no `RemoteViews`, an ongoing flag, a title, and a non-minimum-importance channel. The basic notification does not depend on promotion.

Swiping the active card away is not a timer action. The timer continues, and Hora does not immediately repost the card. The next explicit timer transition or app reopen mirrors the active state and restores the card. Android Force stop remains an OS boundary: it can block receivers and alarms until the user launches Hora again.

## Native bridge

The TypeScript wrapper in `src/features/timer/native.ts` exposes:

- `syncNativeTimer(session)`;
- `getNativeTimerState()`;
- `acknowledgeNativeTimerAction(actionId)`;
- `cancelNativeTimerMilestone(sessionId)`;
- `addNativeTimerListener(listener)`.

The bridge is Android-only and a no-op on web. React does not know about receiver classes or notification construction.
