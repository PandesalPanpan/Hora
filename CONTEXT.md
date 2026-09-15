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

A guided Timeflow pattern with editable focus and break durations and a four-focus-round cycle. Reaching the focus milestone notifies the user but does not stop actual-time tracking; the user explicitly chooses when to finish focus and begin the break.

## Activity category

A filter that groups activities on Today. The initial categories are Focus, Leisure, Life, and Rest. Do not call an activity category a vibe.

## Activity

A selectable label for what the user plans to track through Timeflow, such as Study, Reading, or Exercise. Selecting an activity updates the ready timer so the result of the selection is immediately visible.

## Basic planned-block recurrence

A repeat pattern for a planned block that occurs every day or on selected weekdays until a specified end date. A user may change or delete only one occurrence, or that occurrence and all future occurrences. Past occurrences remain unchanged. Monthly rules and advanced exceptions are outside this term.

## Task priority order

The user-controlled order of open tasks, with the most important task at the top. It is a single manual order, not a High, Medium, or Low classification. Completed tasks do not participate in this order.

## Task focus estimate

An optional duration estimate for a task. New tasks have no estimate unless the user sets one. When a task with an estimate starts through Timeflow, the estimate becomes an optional time goal; a task without one starts with no goal.

## Completed tasks

Tasks whose work is marked complete. They are hidden from the default open-task view, shown newest first in a separate incrementally loaded view, and remain searchable by title and description or notes until deleted. A completed task may be reopened.

## Task deletion

Removal of the task record without removing completed Timeflow sessions linked to it. Historical sessions retain a snapshot of the task title for History and Reports. A brief Undo action may restore the task and its links.

## Custom activity

A user-created activity with a stable ID, name, activity category, and color. It can appear in the Today activity picker and Quick start, and may be edited, manually reordered, or archived. An edit may apply only to future use or, after explicit confirmation, update past Timeflow sessions and planned blocks linked by the same activity ID. Activity names are unique after trimming whitespace and ignoring capitalization; creating a name owned by an archived activity offers to restore that activity instead. It is not a free-form tag or a task.

## Quick start

The Today surface for starting a frequently used activity with minimal interaction. Do not call this surface Quick labels.

## Selected report day

The local calendar day currently chosen within a weekly report. Reports initially select today for the current week, allow any day in the displayed week to be selected, and use the selected day for the daily total and activity breakdown. The selected-day highlight does not mean busiest day.

## Time-log review

The post-session flow for correcting an automatically created completed Timeflow session. Saving this review updates the existing log; it does not create or deposit the session.
