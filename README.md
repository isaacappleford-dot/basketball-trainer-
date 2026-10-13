# CENTER PERFORMANCE

A training tracker for a basketball center. It runs an 8-week, four-day plan covering strength, speed, conditioning, post skills, rebounding, defense and recovery. It works in the browser on iPhone, tablet and desktop, keeps your data across reloads, and needs no accounts or API keys.

## Live app

**https://isaacappleford-dot.github.io/basketball-trainer-/**

Every push to `claude/center-performance-app` (or `main`) rebuilds the site with the GitHub Actions workflow in `.github/workflows/pages.yml`, which exports a static build and publishes it to GitHub Pages. On a phone, open the link and use **Share → Add to Home Screen** (Safari) or **Install app** (Chrome). Your data stays in that browser.

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
| **Onboarding** | Pre-filled profile: center / big man, 6′5″, 300 lb (optional and private), experienced, full gym + hoop + large driveway, open gym available Mon–Thu, and goals covering skills, footwork, shooting, strength, speed, conditioning and defensive mobility. You confirm it once. |
| **Dashboard** | Today's plan, or that day's choices (optional open gym, Home Court, recovery), plus the next session. Shows this week's **gym strength x/2** and **basketball-focused x/2**, open-gym attendance, Home Court sessions and basketball minutes. Also: scheduling suggestions, a weekly activity chart split into gym strength / basketball workouts / open gym / Home Court, recovery and fatigue averages with recent notes, strength progression, shooting percentages, center-skill practice totals, open-gym attendance, conditioning history, personal records and recent activity. Shows an empty state until you log real activity. |
| **Workout Plan** | Default week: **Mon Day A** (lower-body strength and power, gym) · **Tue optional open gym** (live basketball, defense, rebounding, game decisions) · **Wed unavailable** (blocked rest day: no workouts, open gym, suggestions or reminders, and nothing can be moved onto it) · **Thu your choice** (optional open gym, driveway shooting, recovery or rest) · **Fri Day B** (upper body and core, gym) · **Sat Center Skills** (optional conditioning, driveway or court) · **Sun rest**. The old speed/defense day stays as an optional, unscheduled workout. You can edit every workout (label, type, location, emphasis, exercises, sets, rep ranges, an optional weight, rest, warm-up, conditioning options), move it to any available weekday or "not scheduled", and change what each free day is for, including marking any day **Unavailable**. The page also covers the 8-week phases, repeat/deload weeks and performance-based progression suggestions. |
| **Start Workout / Active session** | Unchanged logger: sets, reps, weight, effort, rest timer, skip/substitute/add, autosave. **New:** you can pause and resume the session clock; finishing records **intensity** (light/moderate/hard), **location** (gym, home driveway, open gym, court) and **completion status** (complete or partial). The start screen offers a shorter or skipped conditioning finisher, pre-selected after hard open gym. Reduced volume is pre-selected when you accepted a "lighter" suggestion or have already played a lot of basketball that week. Basketball days link to "do a Home Court session instead". |
| **Open Gym** | Availability toggles (Mon–Thu by default); availability is never a commitment. Each day this week can be **planned, attended, skipped or replaced** (and what you did instead). Each session records duration, light/moderate/hard intensity, optional effort 1–10, full-court/half-court/drills, skills practiced (defense, rebounding, finishing, shooting, passing…), a "lots of hard running" flag and notes. You can optionally link a session to a planned basketball workout so it counts. Linking it to a **strength** workout requires explicit confirmation and only marks that workout "replaced"; it never counts as a strength session. Also shows attendance history, a chart, edit and delete. |
| **Home Court** | Driveway sessions with a ball and a hoop. Templates: center skills, shooting, footwork & defense, light shooting. The editable drill library covers form/midrange/free-throw/catch-and-shoot/movement shooting, Mikan and reverse Mikan, drop steps by side, jump hooks by hand, pivot-and-finish, rebounding and outlets, pivots, short slides, closeouts, balance and short accelerations. Each drill has instructions, a target, a completion checkbox and an optional log (makes/attempts, by hand, successful reps, reps per side, accurate/total, or completion only). A "Partner available" toggle hides partner-only drills, and everything else works solo. Sessions can be paused and resumed, survive closing the app, can count for Saturday's Center Skills, and feed shooting percentages. A **light** session counts as skill practice, not as a hard or basketball-focused session. |
| **Progress** | Date filters, exercise history (tap a point or row for the session), stacked strength + basketball consistency vs. your weekly goal, completed sets, volume, conditioning, an **open gym** section (attendance chart, light/moderate/hard split, full-court/half-court/drills), **center-skill totals**, shooting percentages, PRs and workout history. Completed sessions can be **edited** (sets, weight, reps, makes/attempts, date, duration, intensity, location, notes) or deleted. |
| **Basketball Skills** | Log skills sessions with Mikan, left/right finishes, drop steps by side, jump hooks by hand, free throws (default 20 attempts), midrange, rebounding, outlet accuracy, defensive footwork and game notes. Percentage = makes ÷ attempts × 100. Zero attempts shows "—" and is never divided. You can create custom drills, pick which metrics they track, and see per-drill history charts and personal bests. Day 4 workout logs feed these stats automatically. |
| **Conditioning** | Log bike, elliptical, treadmill, court, walking or custom sessions: date, total duration, work and recovery intervals, planned and completed rounds, effort 1–10, optional distance and notes. Shows trend charts, a filter, and edit/delete. Workout finishers are saved here automatically. |
| **Recovery** | An optional daily check-in: sleep hours and quality, energy, soreness, readiness, **perceived fatigue**, day type and notes. Every field is optional, and tapping a selected rating again clears it. Charts and a 14-day table put recovery next to gym, open gym and Home Court training. Suggestions are conservative and never diagnose anything. |
| **Exercise Library** | 48 exercises across all 11 categories, searchable and filterable. Each has instructions, sets and reps, rest, difficulty, equipment, substitutions, notes and safety reminders. You can mark favorites, add, edit or delete custom exercises, and jump to an exercise's history. |
| **Calendar** | Week and month views with planned workouts, free-day choices, open-gym availability and records, Home Court sessions, games, practices, and recovery or rest days. Per day you can: move a workout, skip it, mark it modified, **swap to a different workout** for that day, reset it to the plan, log it, do Home Court instead, plan or log open gym, or mark a recovery or rest day. A workout counts as completed only when a saved session exists or (for basketball days) a linked open gym or Home Court session does. A strength day linked to open gym shows as "replaced". Weekly summary shows strength and basketball counts. |
| **Settings** | Profile and goals, open-gym days, weekly targets (strength and basketball sessions), weekday per workout, plan start date, units, conditioning equipment, theme. JSON backup and CSV export (sets, sessions, skills, conditioning, **open gym**, recovery). Import is validated and upgrades older backups automatically. Reset requires typing `RESET`. |

### Smart weekly scheduling (suggestions only)

`src/lib/advice.ts` turns what you actually logged into suggestions. **Nothing changes until you tap an action, and every suggestion has "Keep my plan".**

- **Accumulated fatigue:** a recent check-in with fatigue ≥ 4/5, soreness ≥ 4/5 or readiness ≤ 2/5, or 2+ hard sessions in 3 days, triggers a suggestion to go lighter on, move, or turn into a recovery day the next intense session (lower body, speed or basketball) within 4 days.
- **Lower body before intensity:** if Day A falls the day before a planned open gym or basketball session, or the day after a hard open gym, the app suggests keeping it moderate or moving it to a free day.
- **Hard open gym:** full-court/hard or "lots of hard running" pre-shortens the conditioning finisher for the rest of the week (you can untick it).
- **Lots of basketball already:** ≥ 180 minutes or your basketball target already met suggests the short Center Skills version.
- **Missed sessions:** offers "Skip it" or "Reschedule to <a free, non-rest day this week>". It never moves anything automatically and never onto the rest day.
- Open gym is never scheduled for you. Weekly targets default to 2 strength + 2 basketball-focused sessions.

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
    plan/ workout/ open-gym/ home-court/ progress/ skills/ conditioning/ recovery/ library/ calendar/ settings/
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
    progression.ts          # 8-week progression engine (performance-based, never automatic)
    advice.ts               # smart weekly scheduling suggestions
    exporters.ts            # CSV export
```

**Schema v3 migration.** Saved data from v2 moves Day B from Wednesday to Friday (only if you hadn't changed its day), removes the old default Friday recovery slot, and marks Wednesday unavailable. History, open gym, Home Court sessions and calendar records are untouched. A copy of the pre-upgrade data is kept under `center-performance:v1:pre-v3`.

**Schema v2 migration.** Saved data and imported backups from the first version are upgraded automatically. All history is kept. Default workouts move to the new week only if you hadn't changed their weekday, and a copy of the pre-upgrade data is kept in localStorage under `center-performance:v1:pre-v2`.

**One source of truth.** Dashboard and progress numbers are always calculated from the saved records and never stored separately. Logged sessions keep a copy of the exercise names and targets used at the time, so editing the plan or library later doesn't change your history. The active workout is saved in the same state, so a reload or closed tab doesn't lose it.

**Moving to a database later.** `storage.ts` is the only file that reads or writes storage, and `actions.ts` is the only place that changes state. To use a server database, replace `loadState` and `saveState` with API calls, and swap the store's synchronous `setState` for an async version with optimistic updates. The record shapes in `types.ts` already have stable IDs and timestamps, so they map directly to tables or collections.

## Known limitations

- Data lives in one browser on one device. There is no sync across devices, so use Export/Import to move it.
- Timers run while the page is open. Both timers store their end time, so they catch up when you come back to a backgrounded tab. The rest timer also survives a reload. The conditioning interval timer resets on reload, but the completed rounds are already saved.
- Exercise "diagrams" are text instructions only. No external image services are used.
