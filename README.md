# CENTER PERFORMANCE

A training tracker for a basketball center. It runs an 8-week, four-day plan covering strength, speed, conditioning, post skills, rebounding, defense and recovery. It works in the browser on iPhone, tablet and desktop, keeps your data across reloads, and needs no accounts or API keys.

## Quick start

Requirements: **Node.js 20.9 or newer** (tested on Node 22) and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

Production build:

```bash
npm run build
npm run start        # http://localhost:3000  (use `npm run start -- -p 4000` for another port)
```

Checks:

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint (next/core-web-vitals + typescript)
npm run check        # typecheck + lint + production build
```

To test on a phone, run `npm run dev -- -H 0.0.0.0` and open `http://<your-computer-ip>:3000` on the same Wi-Fi network.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS 4** with a small design-token system (`src/app/globals.css`)
- **Lucide** icons, **Recharts** charts
- **localStorage** persistence behind a separate data layer (see "Data and storage" below)

## Features

| Section | What it does |
|---|---|
| **Onboarding** | Pre-filled profile: 6′5″, 300 lb (optional and private), experienced, 4 days a week, full gym + court, center, 8-week plan, plus your goals and priorities. You confirm it once. |
| **Dashboard** | Today's planned workout with a Start button, plan week and phase, workouts this week vs. the goal of 4, total sessions, strength sets, conditioning sessions and intervals, consistent weeks, weekly activity chart, recovery summary with suggestions, strength improvements, shooting percentages, recent personal records, and a recent-activity list. Before any real activity is logged it shows an empty state instead. |
| **Workout Plan** | The four preloaded days (Mon lower body / Tue speed, conditioning and defense / Thu upper body and core / Sat center skills). You can edit warm-ups, exercises, sets, rep ranges, rest, order and conditioning options, and change the weekday of any day. It also shows the 8-week phases, lets you repeat a week or deload, and lists progression suggestions you accept or dismiss, each with its reason. |
| **Start Workout / Active session** | Shows the current exercise with target sets, reps, rest and load, plus your last logged performance. Steppers have large tap targets. Each set has a completed checkbox and can be edited or deleted. Effort (RPE), rest, notes and side/hand can be logged per set. The rest timer has start, pause, resume, reset and ±15 s, and starts on its own when you complete a set. You can skip, substitute (recorded) or add extra exercises. A warm-up checklist, an interval timer for conditioning, and skip/replace options for the finisher are included. The session saves after every change and survives a reload. Discarding asks for confirmation. Finishing shows a summary with editable duration, notes and an optional "modified" flag (fatigue, pain or professional guidance). You can choose reduced volume or lower-impact alternatives when you start. Weight is never required for bodyweight or skill work. Units are lb (default) or kg. |
| **Progress** | Filters for 7 days, 30 days, 8 weeks or all time. Shows per-exercise top weight and rep trends with a history table, and tapping a point or row opens the full session. Also shows completed sets by week, consistency vs. goal, weekly volume, conditioning minutes and intervals, shooting percentages by drill and day, personal records, and workout history (with delete). |
| **Basketball Skills** | Log skills sessions with Mikan, left/right finishes, drop steps by side, jump hooks by hand, free throws (default 20 attempts), midrange, rebounding, outlet accuracy, defensive footwork and game notes. Percentage = makes ÷ attempts × 100. Zero attempts shows "—" and is never divided. You can create custom drills, pick which metrics they track, and see per-drill history charts and personal bests. Day 4 workout logs feed these stats automatically. |
| **Conditioning** | Log bike, elliptical, treadmill, court, walking or custom sessions: date, total duration, work and recovery intervals, planned and completed rounds, effort 1–10, optional distance and notes. Shows trend charts, a filter, and edit/delete. Workout finishers are saved here automatically. |
| **Recovery** | One daily check-in: sleep hours and quality, energy, soreness, readiness, day type and notes. Shows trend charts and a 14-day table of recovery next to the training you logged. Suggestions are conservative (reduce volume, choose low-impact, hold progressions) and never diagnose anything. |
| **Exercise Library** | 48 exercises across all 11 categories, searchable and filterable. Each has instructions, sets and reps, rest, difficulty, equipment, substitutions, notes and safety reminders. You can mark favorites, add, edit or delete custom exercises, and jump to an exercise's history. |
| **Calendar** | Week and month views showing planned workouts, completions, rest and recovery days, games, practices and other training. You can move a workout to another date, skip it, mark it modified, reset it to the plan, or log it. A workout only counts as completed when a saved session exists. There is also a weekly completion summary. |
| **Settings** | Edit profile and goals, weekly schedule, plan start date, units, preferred conditioning equipment, and theme (dark, light or system). Export a full JSON backup or CSV files (sets, sessions, skills, conditioning, recovery). Import a backup: it is validated first, you see a preview, then confirm. Reset all data requires typing `RESET`. |

### Training logic

- **Current week** is calculated from the configurable plan start date. Repeated weeks shift the plan back by one week.
- **Progressions are suggestions only.** You confirm each one, and weight is never raised automatically.
  - Weeks 1–2 set your baseline, with no progressions.
  - Weeks 3–4 suggest adding reps inside the range. Conditioning can go from 8 to 10 rounds, but only if you completed all rounds at effort ≤ 7 and your recent readiness averages ≥ 3.5/5.
  - Weeks 5–6 suggest the smallest load increase, only when every prescribed set reached the top of the rep range with effort ≤ 8 (about 2 reps in reserve). Effort must be logged to unlock this.
  - Weeks 7–8 focus on consolidation. If readiness trends low, a deload is suggested.
  - Lifting load and conditioning volume are never progressed in the same week. Everything holds during deload weeks or after low-recovery check-ins.
- **Missed sessions** show as "missed". They are never crammed into later days automatically.
- **Personal records** only count when a session beats an *earlier logged* session (your first log is a baseline). Shooting records need at least 10 attempts in a day. No one-rep-max estimates are calculated, and there is no max testing.

## Data and storage

All data stays in this browser's `localStorage` under the key `center-performance:v1`. It is never sent anywhere. Export a backup regularly, especially before clearing site data or switching browsers.

There is no seeded history. The exercise library, skill drills and training plan are pre-filled, but every session, set, percentage, chart and record comes from activity you log.

### Code layout

```
src/
  app/                      # one route per section (all client components)
    page.tsx                # Dashboard
    plan/ workout/ progress/ skills/ conditioning/ recovery/ library/ calendar/ settings/
  components/
    AppShell.tsx            # sidebar (desktop), bottom nav + "More" sheet (mobile), onboarding gate, theme
    ui.tsx                  # design system: Button, Card, Field, NumberStepper, Segmented, Modal, Toast…
    charts.tsx              # Recharts wrappers (bar/line, validated colour palette)
    workout/                # ActiveWorkout, SetRow, RestTimer, ConditioningBlock, FinishDialog
  lib/
    types.ts                # data model: UserProfile, TrainingPlan, PlannedWorkout, Exercise, WorkoutSession,
                            # LoggedSet, SkillSession, SkillResult, ConditioningSession, RecoveryEntry,
                            # PersonalRecord (derived), CalendarEvent, ProgressionDecision
    seed.ts                 # exercise library, drills, 4-day plan, 8-week phases, default profile
    storage.ts              # persistence + backup validation (the only file that touches localStorage)
    store.ts                # useSyncExternalStore-based store; every write is saved immediately
    actions.ts              # all mutations
    metrics.ts              # derived analytics (dashboard, PRs, shooting %, weekly buckets)
    schedule.ts             # plan weeks, occurrences, moves/skips, completion matching
    progression.ts          # 8-week progression engine
    exporters.ts            # CSV export
```

**One source of truth.** Dashboard and progress numbers are always calculated from the saved records and never stored separately. Logged sessions keep a copy of the exercise names and targets used at the time, so editing the plan or library later doesn't change your history. The active workout is saved in the same state, so a reload or closed tab doesn't lose it.

**Moving to a database later.** `storage.ts` is the only file that reads or writes storage, and `actions.ts` is the only place that changes state. To use a server database, replace `loadState` and `saveState` with API calls, and swap the store's synchronous `setState` for an async version with optimistic updates. The record shapes in `types.ts` already have stable IDs and timestamps, so they map directly to tables or collections.

## Known limitations

- Data lives in one browser on one device. There is no sync across devices, so use Export/Import to move it.
- Timers run while the page is open. Both timers store their end time, so they catch up when you come back to a backgrounded tab. The rest timer also survives a reload. The conditioning interval timer resets on reload, but the completed rounds are already saved.
- Exercise "diagrams" are text instructions only. No external image services are used.
