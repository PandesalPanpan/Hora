# Iza product glossary

## Today

The primary app destination for the current day. Today may combine the Timeflow timer, completed Timeflow sessions, planned blocks, and relevant tasks.

## Timeflow

Iza's timestamp-based tracking feature and the actual-time sessions it creates. Timeflow is a capability within Today and other relevant workflows, not the canonical name of the primary destination.

## Optional time goal

A user-selected duration milestone for an active Timeflow session. It may be added, changed, or removed while timing, and reaching it never pauses or finishes the session.

## Beta data continuity

The client beta preserves local data across in-place APK updates that use the same application ID and signing key. A manual export and import provides recovery if the app must be uninstalled. Automatic recovery after uninstall through cloud synchronization is outside the initial feedback build.

## Pomodoro

A guided Timeflow pattern with editable focus and break durations and a configurable cycle of one to eight focus rounds, defaulting to four. A duration or round field may be temporarily empty while the user replaces its value; committing the edit by blurring the field, pressing Enter, or starting focus clamps the completed value to that field's allowed range. Pausing freezes both focus and break timing across navigation, backgrounding, and reload. Reaching a focus or break milestone notifies the user but never advances or stops the session automatically; the user explicitly chooses when to continue, change phase, or finish the cycle.

## Activity category

A filter that groups activities on Today. The initial categories are Focus, Leisure, Life, and Rest. Do not call an activity category a vibe.

## Activity

A selectable label for what the user plans to track through Timeflow, such as Study, Reading, or Exercise. Selecting an activity updates the ready timer so the result of the selection is immediately visible.

## Basic planned-block recurrence

A repeat pattern for a planned block that occurs every day or on selected weekdays until a specified end date. A user may change or delete only one occurrence, or that occurrence and all future occurrences. Past occurrences remain unchanged. Monthly rules and advanced exceptions are outside this term.

## Planner collision group

Two or more planned blocks or Timeflow sessions whose actual time ranges overlap on the same local day. On narrow phone layouts, show readable event cards plus an explicit `+N more` control that opens every hidden event in the group. On wider day layouts, show every event in a separate collision lane. No event may become undiscoverable because another event overlaps it, and visual minimum heights must not be treated as additional elapsed time.

## Task priority order

The user-controlled order of open tasks, with the most important task at the top. It is a single manual order, not a High, Medium, or Low classification. Completed tasks do not participate in this order.

## Task focus estimate

An optional duration estimate for a task. New tasks have no estimate unless the user sets one. When a task with an estimate starts through Timeflow, the estimate becomes an optional time goal; a task without one starts with no goal.

## Completed tasks

Tasks whose work is marked complete. They are hidden from the default open-task view, shown newest first in a separate incrementally loaded view, and remain searchable by title and description or notes until deleted. A completed task may be reopened.

## Task deletion

Removal of the task record without removing completed Timeflow sessions linked to it. Historical sessions retain a snapshot of the task title for History and Reports. A brief Undo action may restore the task and its links.

## Character silhouette

Iza's recognizable circular head with small triangular ears attached to its upper edge, matching the original reference character rather than detached geometric decorations. The silhouette scales consistently between the full timer and compact states.

## Custom activity

A user-created activity with a stable ID, name, activity category, and color. It can appear in the Today activity picker and Quick start, and may be edited, manually reordered, moved directly between activity categories, or archived. Moving an activity into a category also sets its position within that category; changing category does not require opening the activity editor. If the activity already has linked records, a category move is not committed until the user chooses whether the change applies only to future use, updates linked historical records too, or is cancelled. An edit may likewise apply only to future use or, after explicit confirmation, update past Timeflow sessions and planned blocks linked by the same activity ID. Archiving is the activity's soft-delete behavior: archived activities remain linked to existing records, do not participate in category ordering, and appear alphabetically in a separate collapsed section. Restoring one returns it to the end of its previous category. Archived activities remain recoverable and are not permanently deleted through activity management. Activity names are unique after trimming whitespace and ignoring capitalization; creating a name owned by an archived activity offers to restore that activity instead. It is not a free-form tag or a task.

## Quick start

The low-friction action of starting the activity currently selected in Today's main timer. It is not a separate card or a synonym for recent sessions. Do not call this action Quick labels.

## Today so far

The compact Today summary that replaces the former Quick start card. It shows completed and currently active Timeflow sessions plus upcoming planned blocks, with planned intention remaining visually distinct from tracked reality. Phone layouts show a readable subset with a View full day action; starting an activity remains in the main timer rather than this summary. A completed item opens its time-log review, an active item opens the running timer, a planned item opens its Planner inspector, and View full day opens today's Planner Day view.

## Selected report day

The local calendar day currently chosen within a weekly report. Reports initially select today for the current week, allow any day in the displayed week to be selected, and use the selected day for the daily total and activity breakdown. The selected-day highlight does not mean busiest day.

## History

The date-based view of completed Timeflow sessions where a user can review and correct an existing time log, including its note. History is a subview of the Reports navigation family rather than a separate primary destination, so the Reports navigation item remains selected while History is open.

## Time-log review

The post-session flow for correcting an automatically created completed Timeflow session. Saving this review updates the existing log; it does not create or deposit the session. A no-change save preserves the recorded timestamp seconds. The default mobile editor stays minute-based, with a progressive Edit seconds control for precise correction; persisted timestamps retain the exact resulting UTC value.

## Session feeling

An optional Calm, Focused, or Tired reflection attached to a completed Timeflow session. The completion review labels the choice as optional, gives the selected feeling an unmistakable checked high-contrast state, and exposes a Clear feeling action after selection. No feeling appears selected when the stored value is empty.

## Timeflow session note

An optional note attached to a Timeflow session. It may be added or edited while tracking or during completion review and remains available from the session's Planner event and inspector on past and current dates.

## Planned-block note

An optional note attached to a planned block. It describes the intended block and remains separate from any note on a linked Timeflow session.
