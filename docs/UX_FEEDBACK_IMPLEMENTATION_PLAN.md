# UX feedback implementation plan

> Follow-up from installed-app review: reserve timer space for the selected-activity status, add breathing room below activity selection, and present Today rows with the History timeline's note-and-duration hierarchy.
>
> Version tracking follow-up: expose a URL-backed “What’s new” screen from Your gentle corner and begin a structured, newest-first release history with version 0.1.0.

## Outcome

Make activity selection, activity organization, History access, time-log correction, and Pomodoro editing self-evident on a 320px Android layout without replacing Iza's existing visual language.

## Design direction

- Colors: cocoa `#5c3b36`, raspberry `#b92f60`, action pink `#d9547c`, rose `#ffdde3`, paper `#fff9f6`, and peach `#ffc8b3`.
- Type: Poppins for interface hierarchy and Arima for the Iza wordmark.
- Layout: use compact section headers with contextual icon actions, tactile outlined rows for navigation and disclosure, and bottom sheets for editing and confirmations.
- Interaction: keep category filtering separate from activity selection; use direct manipulation for organization; preserve a visible keyboard/touch alternative for every drag action.

```text
Today                         Manage activities
Choose an activity      [sliders]  Activities             [x]
Filter activities                 Focus
[Focus] [Leisure] [Life]          [grip] Study          [menu]
Showing Leisure activities        [grip] Reading        [menu]
[Reading] [Games] [Music]         Leisure        <- drop target
```

The distinctive element remains Iza's friendly timer and handmade palette. Supporting controls become quieter and more structured so they do not compete with the timer.

## Execution phases

1. [x] Activity data and organization
   - Add a transactional cross-category move operation.
   - Prompt for future-only, update-existing, or cancel when linked records exist.
   - Group active activities by category, add touch/pen/mouse drag handles, overflow actions, and a collapsed archived section.
   - Keep archive as recoverable soft deletion.

2. [x] Today and Pomodoro clarity
   - Label category controls as filters and the timer chip as the selected activity.
   - Integrate Manage activities and View full day as contextual icon/button actions.
   - Allow temporarily empty Pomodoro fields and clamp on blur, Enter, or Start focus.

3. [x] History and correction access
   - Add an Overview and History switch within the Reports navigation family.
   - Keep Reports selected on the History route.
   - Replace the large History date field with a seven-day strip and compact date picker.
   - Let completed Planner events open the existing time-log editor.
   - Replace the underlined seconds link with an integrated disclosure row.

4. [x] Spacing, accessibility, and verification
   - Correct sheet header/action and History section spacing.
   - Preserve 44px targets, focus visibility, reduced motion, safe areas, and URL-backed navigation.
   - Add regression tests, then run tests, lint, build, Android sync, and responsive visual checks.
