# IRONMIND — One App. Every Fitness Journey.

Free, open-source fitness and nutrition tracker. No account, no ads, no backend. Your data stays on your device (IndexedDB) and the app works offline as a PWA.

## What's in v0.1
- Onboarding with Mifflin-St Jeor BMR/TDEE, calorie target, protein range, macros, water target (all shown with the formulas)
- Exercise library (45 exercises) with search/filters, full details, and custom exercises (create/edit/delete)
- Routine builder (reorder, sets/reps/weight/rest/notes, weekly schedule, duplicate), 6 templates
- Live workout logging per set, rest timer, overload suggestions (considers pain and low recovery), personal records
- Nutrition tracker: 6 meal sections, 61 foods (Indian-first, raw vs cooked), custom foods, repeat previous day, water
- Weight tracker with 7/30/90/180/365/all charts and 7-day average, trend-based weekly review (never reacts to one day), body measurements
- Cardio log with estimated calories (clearly labelled estimates), recovery log, analytics, JSON export/import, dark/light theme, metric/imperial
- Rule-based assistant (no AI service needed) and a fat-loss timeline planner

## Not built yet (roadmap)
Progress photos, favourite meals and recipes, calendar view and reminders, languages, optional Supabase sync, video demos, bigger food/exercise datasets, React/TypeScript port.

## Run locally
No install needed — it is plain HTML/CSS/JS. Serve the folder with any static server:

    python3 -m http.server 8000     # then open http://localhost:8000

(Opening index.html directly also works, but offline install needs http/https.)

## Tests
    node tests/calc.test.js

## Deploy free on GitHub Pages
1. Create a public repo and push this folder to `main`.
2. Repo Settings → Pages → Source: **GitHub Actions**. The included workflow deploys on every push.
3. Open `https://<your-username>.github.io/<repo>/` and use "Add to Home screen" to install.

## Structure
    calc.js     pure calculation engine (tested)
    data.js     exercises, foods, templates
    app.js      UI, storage, assistant
    sw.js       offline service worker
    tests/      calculation tests

## Data and accuracy
Food values are rounded reference values (USDA FoodData Central / IFCT-style public data) compiled for v0.1 and **may contain errors**; check them against a licensed source before relying on them, and add proper attribution when expanding the dataset. All calorie, macro and exercise-calorie numbers are estimates. This is not medical advice.

## License
MIT — see LICENSE.
