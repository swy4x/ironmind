/* IRONMIND app — vanilla JS, no build step. Data stays in IndexedDB on this device. */
(function () {
  'use strict';
  const { EXERCISES, FOODS, TEMPLATES, CATS } = window.IMData;
  const Calc = window.Calc;

  /* ================= helpers ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const r1 = (n) => Math.round(n * 10) / 10;
  const r0 = Math.round;
  const num = (v, d = 0) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
  const fmtDate = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
  const todayStr = () => fmtDate(new Date());
  const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return fmtDate(d); };
  const dow = (s) => new Date(s + 'T12:00:00').getDay();
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const prettyDate = (s) => new Date(s + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const GOAL = Calc.GOALS;
  const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snacks', 'Snacks'], ['pre', 'Pre-workout'], ['post', 'Post-workout']];

  /* ================= storage ================= */
  const STORES = ['kv', 'routines', 'sessions', 'customFoods', 'customExercises', 'foodLog', 'weights', 'measures', 'cardio', 'recovery', 'water'];
  const D = { settings: { units: 'metric' }, profile: null };
  STORES.forEach((s) => { if (s !== 'kv') D[s] = []; });
  const DB = {
    db: null, mem: false,
    open() {
      return new Promise((res) => {
        if (!window.indexedDB) { this.mem = true; return res(); }
        let req;
        try { req = indexedDB.open('ironmind', 1); } catch (e) { this.mem = true; return res(); }
        req.onupgradeneeded = () => STORES.forEach((s) => req.result.createObjectStore(s, { keyPath: 'id' }));
        req.onsuccess = () => { this.db = req.result; res(); };
        req.onerror = () => { this.mem = true; res(); };
      });
    },
    st(s, m) { return this.db.transaction(s, m).objectStore(s); },
    wrap(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
    all(s) { return this.mem ? Promise.resolve([]) : this.wrap(this.st(s, 'readonly').getAll()); },
    put(s, o) { return this.mem ? Promise.resolve() : this.wrap(this.st(s, 'readwrite').put(o)).catch(() => toast('Could not save — storage may be full or blocked.')); },
    del(s, id) { return this.mem ? Promise.resolve() : this.wrap(this.st(s, 'readwrite').delete(id)); },
    clear(s) { return this.mem ? Promise.resolve() : this.wrap(this.st(s, 'readwrite').clear()); }
  };
  function save(store, obj) {
    const i = D[store].findIndex((x) => x.id === obj.id);
    if (i >= 0) D[store][i] = obj; else D[store].push(obj);
    return DB.put(store, obj);
  }
  function remove(store, id) { D[store] = D[store].filter((x) => x.id !== id); return DB.del(store, id); }
  const saveKV = (id, data) => DB.put('kv', Object.assign({ id }, data));

  /* ================= state ================= */
  const S = {
    tab: 'home', wsub: 'main', psub: 'weight', nDate: todayStr(), draft: null, session: null, answer: '',
    lf: { q: '', cat: '', equip: '', diff: '' }, range: 90, pick: { for: 'draft', q: '', cat: '' }, fAdd: null, restEnd: 0
  };

  /* ================= units ================= */
  const imp = () => D.settings.units === 'imperial';
  const uW = () => (imp() ? 'lb' : 'kg');
  const uL = () => (imp() ? 'in' : 'cm');
  const toW = (kg) => (imp() ? r1(kg * 2.20462) : r1(kg));
  const fromW = (v) => (imp() ? v / 2.20462 : v);
  const toL = (cm) => (imp() ? r1(cm / 2.54) : r1(cm));
  const fromL = (v) => (imp() ? v * 2.54 : v);

  /* ================= lookups ================= */
  const allEx = () => EXERCISES.concat(D.customExercises);
  const exById = (id) => allEx().find((e) => e.id === id);
  const allFoods = () => FOODS.concat(D.customFoods);
  const foodById = (id) => allFoods().find((f) => f.id === id);
  const sortedWeights = () => D.weights.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((w) => ({ date: w.id, kg: w.kg }));
  const curKg = () => { const w = sortedWeights(); return w.length ? w[w.length - 1].kg : (D.profile ? D.profile.weightKg : 70); };

  /* ================= targets ================= */
  function targets() {
    const p = D.profile; if (!p) return null;
    const kg = curKg();
    const bmr = Calc.bmr(p.sex, kg, p.heightCm, p.age);
    const tdee = Calc.tdee(bmr, p.activity);
    const ct = Calc.calorieTarget(bmr, tdee, p.goal);
    const kcal = p.calOverride || ct.target;
    const pr = Calc.proteinRange(kg, p.goal, p.exp);
    const protein = p.proteinOverride || pr.target;
    const m = Calc.macros(kcal, protein, kg);
    return { kg, bmr: r0(bmr), tdee: r0(tdee), ct, kcal, pr, protein, carbs: m.carbs, fat: m.fat, fibre: m.fibre, water: Calc.waterTarget(kg) };
  }
  function dayTotals(date) {
    const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
    D.foodLog.filter((e) => e.date === date).forEach((e) => { t.kcal += e.kcal; t.p += e.p; t.c += e.c; t.f += e.f; t.fib += e.fib || 0; });
    return t;
  }
  const waterOn = (date) => { const w = D.water.find((x) => x.id === date); return w ? w.ml : 0; };
  const lastRecovery = () => D.recovery.slice().sort((a, b) => (a.id < b.id ? 1 : -1))[0];

  /* ================= small UI pieces ================= */
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2800); }
  function openModal(html) { $('#sheet').innerHTML = html; $('#modal').hidden = false; $('#sheet').scrollTop = 0; }
  function closeModal() { $('#modal').hidden = true; $('#sheet').innerHTML = ''; }
  function metric(label, val, target, unit, opts = {}) {
    const pct = target > 0 ? Math.min(100, (val / target) * 100) : 0;
    const over = target > 0 && val > target * 1.05 && !opts.noOver;
    const left = target - val;
    return `<div class="metric"><div class="top"><span>${esc(label)}</span><span><b>${r0(val)}</b> / ${r0(target)} ${unit} <span class="muted">· ${left >= 0 ? r0(left) + ' left' : r0(-left) + ' over'}</span></span></div>
      <div class="bar ${over ? 'over' : ''}" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${r0(val)}" aria-valuemax="${r0(target)}"><i style="width:${pct}%"></i></div></div>`;
  }
  const chips = (items, cur, act, extra = '') => `<div class="chips">${items.map(([k, l]) => `<button class="chip ${String(cur) === String(k) ? 'on' : ''}" data-act="${act}" data-k="${esc(k)}" ${extra}>${esc(l)}</button>`).join('')}</div>`;
  const sel = (name, opts, cur, attrs = '') => `<select name="${name}" ${attrs}>${opts.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const DISCLAIMER = '<p class="disclaimer">IRONMIND gives general educational estimates, not medical advice. Calorie and macro numbers are estimates. If you have a medical condition, are pregnant, under 18, or feel significant pain or concerning symptoms, stop and talk to a qualified professional.</p>';

  /* ================= charts ================= */
  function lineChart(rows, unit) {
    if (rows.length < 2) return '<p class="muted small">Log at least 2 weigh-ins in this range to see a chart.</p>';
    const W = 340, H = 170, L = 38, R = 8, T = 10, B = 22;
    const x0 = rows[0].d, x1 = rows[rows.length - 1].d;
    const ys = rows.flatMap((r) => [r.v, r.avg]);
    let y0 = Math.min(...ys), y1 = Math.max(...ys); if (y1 - y0 < 1) { y0 -= 0.5; y1 += 0.5; }
    const X = (d) => L + (x1 === x0 ? 0 : ((d - x0) / (x1 - x0)) * (W - L - R));
    const Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    const pts = rows.map((r) => `${X(r.d).toFixed(1)},${Y(r.v).toFixed(1)}`).join(' ');
    const avg = rows.map((r) => `${X(r.d).toFixed(1)},${Y(r.avg).toFixed(1)}`).join(' ');
    const dots = rows.length <= 60 ? rows.map((r) => `<circle cx="${X(r.d).toFixed(1)}" cy="${Y(r.v).toFixed(1)}" r="2.5" fill="var(--muted)"/>`).join('') : '';
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight chart">
      <line x1="${L}" x2="${W - R}" y1="${Y(y0)}" y2="${Y(y0)}" stroke="var(--line)"/><line x1="${L}" x2="${W - R}" y1="${Y(y1)}" y2="${Y(y1)}" stroke="var(--line)"/>
      <text x="2" y="${Y(y1) + 4}" font-size="10" fill="var(--muted)">${r1(y1)}</text><text x="2" y="${Y(y0) + 4}" font-size="10" fill="var(--muted)">${r1(y0)}</text>
      <polyline points="${pts}" fill="none" stroke="var(--muted)" stroke-width="1.2" opacity=".6"/>${dots}
      <polyline points="${avg}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
      <text x="${L}" y="${H - 6}" font-size="10" fill="var(--muted)">${rows[0].label}</text>
      <text x="${W - R}" y="${H - 6}" font-size="10" text-anchor="end" fill="var(--muted)">${rows[rows.length - 1].label}</text></svg>
      <p class="small muted">Grey = daily weigh-ins (${unit}). Green = 7-day average. Trust the green line.</p>`;
  }
  function barChart(vals, labels, unit, target) {
    if (!vals.length || Math.max(...vals) === 0) return '<p class="muted small">No data yet.</p>';
    const W = 340, H = 130, B = 18, T = 8;
    const max = Math.max(...vals, target || 0) * 1.1;
    const bw = (W - 10) / vals.length;
    const bars = vals.map((v, i) => { const h = (v / max) * (H - B - T); return `<rect x="${5 + i * bw + 4}" y="${H - B - h}" width="${bw - 8}" height="${h}" rx="3" fill="var(--accent)"/><text x="${5 + i * bw + bw / 2}" y="${H - 5}" font-size="9" text-anchor="middle" fill="var(--muted)">${esc(labels[i])}</text>`; }).join('');
    const tl = target ? `<line x1="0" x2="${W}" y1="${H - B - (target / max) * (H - B - T)}" y2="${H - B - (target / max) * (H - B - T)}" stroke="var(--warn)" stroke-dasharray="4 3"/>` : '';
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart in ${unit}">${tl}${bars}</svg>`;
  }

  /* ================= navigation ================= */
  const NAV = [
    ['home', 'Home', '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
    ['workout', 'Workout', '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>'],
    ['nutrition', 'Nutrition', '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 2-3 5-3 8h3v10"/>'],
    ['progress', 'Progress', '<path d="M3 20h18M6 16l4-5 4 3 5-8"/>'],
    ['profile', 'Profile', '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>']
  ];
  function renderNav() {
    $('#nav').innerHTML = NAV.map(([k, l, p]) => `<button data-act="tab" data-k="${k}" class="${S.tab === k ? 'on' : ''}" aria-label="${l}" ${S.tab === k ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>${l}</button>`).join('');
  }
  function render() {
    const y = window.scrollY;
    const v = { home: vHome, workout: vWorkout, nutrition: vNutrition, progress: vProgress, profile: vProfile }[S.tab];
    $('#view').innerHTML = (!D.profile && S.tab !== 'profile') ? vOnboard() : v();
    renderNav();
    $('#topdate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
    window.scrollTo(0, y);
  }

  /* ================= onboarding / profile form ================= */
  function profileForm(p, onboarding) {
    p = p || {};
    const eq = p.equip || ['Bodyweight only'];
    const EQUIP = ['Full gym', 'Dumbbells', 'Barbell', 'Resistance bands', 'Bodyweight only'];
    return `<form data-submit="saveProfile" autocomplete="off">
      <label>Units</label>${sel('units', [['metric', 'Metric (kg, cm)'], ['imperial', 'Imperial (lb, in)']], D.settings.units, 'data-chg="units"')}
      <div class="grid2"><div><label>Age</label><input name="age" type="number" inputmode="numeric" min="13" max="100" required value="${esc(p.age || '')}"></div>
      <div><label>Sex (for metabolic formulas)</label>${sel('sex', [['male', 'Male'], ['female', 'Female']], p.sex || 'male')}</div></div>
      <div class="grid2"><div><label>Height (${uL()})</label><input name="height" type="number" step="0.1" inputmode="decimal" required value="${p.heightCm ? toL(p.heightCm) : ''}"></div>
      <div><label>Current weight (${uW()})</label><input name="weight" type="number" step="0.1" inputmode="decimal" required value="${p.weightKg ? toW(curKg()) : ''}"></div></div>
      <label>Activity level (outside of planned workouts)</label>${sel('activity', Object.entries(Calc.ACTIVITY).map(([k, v]) => [k, v.label]), p.activity || 'light')}
      <label>Training experience</label>${sel('exp', [['beginner', 'Beginner (under 6 months)'], ['intermediate', 'Intermediate (6 months – 2 years)'], ['advanced', 'Advanced (2+ years)']], p.exp || 'beginner')}
      <label>Goal</label>${sel('goal', Object.entries(GOAL).map(([k, v]) => [k, v.label]), p.goal || 'general')}
      <label>Diet preference</label>${sel('diet', [['vegan', 'Vegan'], ['veg', 'Vegetarian'], ['egg', 'Eggetarian'], ['nonveg', 'Non-vegetarian']], p.diet || 'veg')}
      <label>Equipment available</label>${EQUIP.map((e) => `<label class="check"><input type="checkbox" name="equip" value="${e}" ${eq.includes(e) ? 'checked' : ''}> ${e}</label>`).join('')}
      <div class="grid2"><div><label>Training location</label>${sel('location', [['gym', 'Gym'], ['home', 'Home']], p.location || 'gym')}</div>
      <div><label>Time per workout (min)</label><input name="minutes" type="number" min="10" max="240" value="${esc(p.minutes || 45)}"></div></div>
      <label>Daily food budget (optional)</label><input name="budget" type="text" placeholder="e.g. ₹200" value="${esc(p.budget || '')}">
      ${onboarding ? '<p class="small muted">No account needed. Everything is stored only on this device.</p>' : ''}
      <button class="primary" style="width:100%;margin-top:14px">${onboarding ? 'Create my plan' : 'Save profile'}</button></form>`;
  }
  function vOnboard() {
    return `<h1>Welcome to IRONMIND</h1><p class="muted">Tell us a little about you and get a starting plan. You can change anything later.</p><div class="card">${profileForm(null, true)}</div>${DISCLAIMER}`;
  }

  /* ================= HOME ================= */
  function vHome() {
    const T = targets(), date = todayStr(), tot = dayTotals(date);
    const todays = D.routines.filter((r) => (r.days || []).includes(dow(date)));
    const doneToday = D.sessions.some((s) => s.date === date);
    const wk = D.sessions.filter((s) => s.date >= addDays(date, -6)).length;
    const planned = new Set(D.routines.flatMap((r) => r.days || [])).size;
    const hasW = D.weights.some((w) => w.id === date);
    const qs = [['fat', 'How should I start losing fat?'], ['protein', 'How much protein?'], ['cal', 'How many calories?'], ['train', 'What should I train today?'], ['beginner', 'Create a beginner workout'], ['stall', 'Why has my weight stopped?'], ['bench', 'Improve my bench press'], ['cardio', 'How much cardio?'], ['cheap', 'Cheap protein ideas'], ['post', 'What to eat after training?'], ['recover', 'Am I recovering?']];
    return `<h1>Today</h1>
    <div class="card"><h3>${GOAL[D.profile.goal].label} · target ${T.kcal} kcal</h3>
      ${metric('Calories', tot.kcal, T.kcal, 'kcal')}${metric('Protein', tot.p, T.protein, 'g', { noOver: true })}
      ${metric('Water', waterOn(date), T.water, 'ml', { noOver: true })}
      <div class="row wrap"><button class="sm" data-act="water" data-k="250">+250 ml</button><button class="sm" data-act="water" data-k="-250">−250 ml</button><button class="sm primary" data-act="goto" data-k="nutrition">Log food</button></div></div>
    <div class="card"><h3>Workout</h3>
      ${S.session ? `<p>You have a workout in progress.</p><button class="primary" data-act="resume">Resume workout</button>` :
        todays.length ? `<p>${doneToday ? '✅ Done for today. Optional:' : 'Scheduled today:'}</p>${todays.map((r) => `<div class="item"><span>${esc(r.name)} <span class="muted small">· ${r.items.length} exercises</span></span><button class="sm primary" data-act="startRoutine" data-id="${r.id}">Start</button></div>`).join('')}` :
        `<p class="muted">No routine scheduled today — a rest day, or pick one.</p><button data-act="goto" data-k="workout">Choose a workout</button>`}
      <p class="small muted">This week: ${wk} workout${wk === 1 ? '' : 's'}${planned ? ` of ${planned} planned days` : ''}.</p></div>
    <div class="card"><h3>Weight</h3>${hasW ? '<p class="ok">✔ Logged today.</p>' : `<div class="row"><input id="qw" type="number" step="0.1" inputmode="decimal" placeholder="Today's weight (${uW()})" aria-label="Today's weight"><button class="primary" data-act="quickWeight">Log</button></div>`}</div>
    <div class="card"><h3>Ask IRONMIND</h3><p class="small muted">Rule-based answers from your profile and logs. No internet or AI service needed.</p>
      <div class="chips" style="flex-wrap:wrap;overflow:visible">${qs.map(([k, l]) => `<button class="chip" data-act="ask" data-k="${k}">${l}</button>`).join('')}</div>
      <div id="answer">${S.answer}</div></div>${DISCLAIMER}`;
  }

  /* ================= assistant ================= */
  const P_ = (s) => `<p>${s}</p>`;
  function dietFoods() {
    const d = D.profile.diet;
    if (d === 'vegan') return 'soy chunks (about 52 g protein/100 g dry), dal + rice, chickpeas/kala chana, rajma, tofu, roasted chana, peanuts';
    if (d === 'veg') return 'soy chunks (about 52 g/100 g dry), curd and milk, paneer, dal + rice, chickpeas/kala chana, peanuts';
    if (d === 'egg') return 'eggs (about 6 g each), soy chunks, curd and milk, dal + rice, chickpeas/kala chana, peanuts';
    return 'eggs, chicken breast, fish (rohu), soy chunks, curd, dal + rice, chickpeas';
  }
  function suggestTemplateId() {
    const p = D.profile;
    if (p.location === 'home' || !p.equip.some((e) => ['Full gym', 'Dumbbells', 'Barbell'].includes(e))) return 'home-beginner';
    return p.exp === 'beginner' ? 'full-beginner' : p.exp === 'intermediate' ? 'ul' : 'bro';
  }
  const ANSWERS = {
    fat() {
      const T = targets(), tid = suggestTemplateId(), c = T.ct;
      return P_(`You're at ${toW(T.kg)} ${uW()}. A sensible start:`) + `<ol>
      <li><b>Eat about ${T.kcal} kcal/day</b> (estimated maintenance ${T.tdee}; that's a moderate ~${Math.abs(r0(c.adj * 100))}% deficit${c.floored ? ', limited by a safety floor' : ''}).</li>
      <li><b>Protein ${T.pr.min}–${T.pr.max} g/day</b> — aim for about ${T.protein} g to protect muscle.</li>
      <li><b>Lift 3–4 times a week</b> — resistance training tells your body to keep muscle while losing fat.</li>
      <li><b>Walk daily</b> (7,000–10,000 steps) plus 2–3 cardio sessions of 20–40 min as fitness allows.</li>
      <li><b>Sleep 7–9 h</b> and weigh in daily; judge progress by the 7-day average, not one morning.</li></ol>`
        + P_('Target pace: roughly 0.25–1% of body weight per week. Fat can\'t be spot-reduced from one body part.')
        + `<button class="sm primary" data-act="addTemplate" data-id="${tid}">Add a ${esc(TEMPLATES.find((t) => t.id === tid).name)}</button>`;
    },
    protein() {
      const T = targets();
      return P_(`Educational range for you: <b>${T.pr.min}–${T.pr.max} g/day</b> (${T.pr.perKgLow}–${T.pr.perKgHigh} g per kg). Your current target is <b>${T.protein} g</b>.`)
        + P_(`Spread over 4 meals that's about ${r0(T.protein / 4)} g per meal. Good sources for your diet: ${dietFoods()}.`)
        + P_('Supplements are optional — whole foods can do the job. If you have kidney disease or another medical condition, ask a doctor or dietitian before raising protein.');
    },
    cal() {
      const T = targets();
      return P_(`<b>BMR ${T.bmr} kcal</b> (Mifflin-St Jeor: energy at rest) × activity factor = <b>maintenance ≈ ${T.tdee} kcal</b>.`)
        + P_(`For your goal (${GOAL[D.profile.goal].label}) the starting target is <b>${T.kcal} kcal/day</b>. These are estimates; the app adjusts gradually from your weight trend, never from one day's weight.`);
    },
    train() {
      const date = todayStr(), r = D.routines.filter((x) => (x.days || []).includes(dow(date))), rec = lastRecovery();
      let h = r.length ? P_(`Scheduled today: <b>${r.map((x) => esc(x.name)).join(', ')}</b>. Start it from the Workout tab.`) : P_('Nothing is scheduled today. Pick a routine in the Workout tab, or take a rest day.');
      const last = D.sessions.slice().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];
      if (last) h += P_(`Your last workout was <b>${esc(last.routineName)}</b> on ${prettyDate(last.date)}. Aim to train a different muscle group or rest if it was within 24 h.`);
      if (rec && rec.fatigue >= 4) h += P_('You reported high fatigue recently — consider a lighter session or a rest day.');
      return h;
    },
    beginner() {
      const tid = suggestTemplateId();
      return P_('A beginner plan should be simple: full-body sessions 3 days a week with rest days in between, 2–3 hard sets per exercise, leaving 1–3 reps in reserve.')
        + `<button class="sm primary" data-act="addTemplate" data-id="${tid}">Add ${esc(TEMPLATES.find((t) => t.id === tid).name)}</button>`;
    },
    stall() {
      const a = Calc.adaptiveAdvice(sortedWeights(), D.profile.goal);
      return P_(esc(a.message)) + P_('Common reasons for a stall: water retention (salt, stress, new training, menstrual cycle), inaccurate food logging, a weekend calorie creep, or you\'ve simply lost weight and maintenance dropped slightly. Wait 2+ weeks of data before changing calories.');
    },
    bench() {
      const sets = [];
      D.sessions.slice().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).some((s) => { const e = s.exercises.find((x) => x.exId === 'bench'); if (e) { e.sets.filter((x) => x.done).forEach((x) => sets.push(x)); return true; } return false; });
      const o = Calc.suggestOverload(sets, 6, 10, {});
      return P_(esc(o.message)) + `<ul><li>Progress in small steps (1.25–2.5 kg) once you hit the top of your rep range with clean form.</li><li>Keep shoulder blades pinched, feet planted, bar path over the mid-chest.</li><li>Train chest 2×/week and add triceps and back work.</li><li>Sleep and protein matter as much as the program.</li></ul>`;
    },
    cardio() {
      const g = D.profile.goal, e = D.profile.exp;
      const base = g === 'lose_fat' ? '150–250 min/week of easy-to-moderate cardio plus daily steps' : g === 'endurance' ? '3–5 sessions/week with 1 longer easy session' : '150 min/week of moderate cardio (or 75 min vigorous)';
      return P_(`For your goal: <b>${base}</b>.`) + P_(e === 'beginner' ? 'Beginners: start with 10–15 minutes, add about 5 minutes per week, and keep most sessions at a conversational pace.' : 'Keep most cardio easy and place hard sessions away from heavy leg days.')
        + P_('Calories burned shown in the app are rough estimates. Don\'t automatically eat them all back.');
    },
    cheap() {
      return P_(`Budget-friendly protein for your diet: <b>${dietFoods()}</b>.`) + P_('Compare protein per rupee in your local market — dry soy chunks, dal and eggs are usually among the cheapest. Protein powder is optional, not required.');
    },
    post() {
      const d = D.profile.diet;
      const ex = d === 'nonveg' ? 'eggs or chicken with rice/roti' : d === 'egg' ? 'egg bhurji with roti, or curd with banana' : d === 'veg' ? 'paneer/dal with rice, or curd with banana and peanuts' : 'dal-rice, soy chunks with roti, or chana with fruit';
      return P_('Aim for about 20–40 g protein plus some carbohydrate within a few hours after training — the total for the day matters more than exact timing.') + P_(`Ideas: ${ex}. Drink water.`);
    },
    recover() {
      const rec = D.recovery.slice().sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, 7);
      if (!rec.length) return P_('Log sleep, soreness and fatigue in Progress → Recovery, and I\'ll review it here.');
      const sleep = rec.filter((r) => r.sleep).reduce((s, r, _, a) => s + r.sleep / a.length, 0);
      const fat = rec.reduce((s, r) => s + (r.fatigue || 0), 0) / rec.length;
      return P_(`Average sleep over the last ${rec.length} logs: <b>${r1(sleep)} h</b>; average fatigue ${r1(fat)}/5.`) + P_(sleep < 7 ? 'Sleep is under 7 h — that is the first thing to fix for recovery.' : fat >= 3.5 ? 'Fatigue is high — consider a deload week or an extra rest day.' : 'Recovery looks reasonable. Keep at least 1–2 rest days per week.') + P_('If you have sharp or persistent pain, stop that exercise and see a professional.');
    }
  };

  /* ================= WORKOUT ================= */
  function vWorkout() {
    if (S.wsub === 'library') return vLibrary();
    if (S.wsub === 'editor') return vEditor();
    if (S.wsub === 'session') return vSession();
    if (S.wsub === 'history') return vHistory();
    return `<h1>Workout</h1>
    ${S.session ? `<div class="card"><b>Workout in progress:</b> ${esc(S.session.routineName)}<br><button class="primary" style="margin-top:8px" data-act="resume">Resume</button></div>` : ''}
    <div class="row wrap"><button class="primary" data-act="newRoutine">+ New routine</button><button data-act="wsub" data-k="library">Exercise library</button><button data-act="wsub" data-k="history">History</button><button data-act="quickSession">Empty workout</button></div>
    <h2>My routines</h2>
    ${D.routines.length ? D.routines.map((r) => `<div class="card"><div class="row between"><b>${esc(r.name)}</b><span class="small muted">${r.items.length} exercises</span></div>
      <div class="small muted">${(r.days || []).length ? (r.days || []).slice().sort().map((d) => DAYS[d]).join(' · ') : 'Not scheduled'}</div>
      <div class="small muted">${r.items.slice(0, 4).map((i) => esc((exById(i.exId) || { name: '?' }).name)).join(', ')}${r.items.length > 4 ? '…' : ''}</div>
      <div class="row wrap" style="margin-top:8px"><button class="sm primary" data-act="startRoutine" data-id="${r.id}">Start</button><button class="sm" data-act="editRoutine" data-id="${r.id}">Edit</button><button class="sm" data-act="dupRoutine" data-id="${r.id}">Duplicate</button><button class="sm danger" data-act="delRoutine" data-id="${r.id}">Delete</button></div></div>`).join('') : '<p class="muted">No routines yet. Create one or add a template below.</p>'}
    <h2>Templates</h2>
    ${TEMPLATES.map((t) => `<div class="card"><div class="row between"><b>${esc(t.name)}</b><span class="badge">${t.level}</span></div><p class="small muted">${esc(t.desc)}</p><button class="sm" data-act="addTemplate" data-id="${t.id}">Add to my routines</button></div>`).join('')}`;
  }

  function exRow(e, act, extra = '') {
    return `<div class="item"><div class="grow"><b>${esc(e.name)}</b>${e.custom ? ' <span class="badge acc">custom</span>' : ''}<div class="small muted">${esc(CATS[e.cat] || e.cat)} · ${esc(e.equipment)} · ${esc(e.difficulty)}</div></div><button class="sm" data-act="${act}" data-id="${e.id}" ${extra}>${act === 'exInfo' ? 'Details' : 'Add'}</button></div>`;
  }
  function filterEx(f) {
    const q = (f.q || '').toLowerCase().trim();
    return allEx().filter((e) => (!f.cat || e.cat === f.cat) && (!f.equip || e.equipment === f.equip) && (!f.diff || e.difficulty === f.diff) &&
      (!q || (e.name + ' ' + e.primary.join(' ') + ' ' + e.secondary.join(' ') + ' ' + e.equipment).toLowerCase().includes(q)));
  }
  function libResults() {
    const l = filterEx(S.lf);
    return l.length ? l.map((e) => exRow(e, 'exInfo')).join('') : '<p class="muted">No exercises match.</p>';
  }
  function vLibrary() {
    const equips = [...new Set(allEx().map((e) => e.equipment))].sort();
    return `<div class="row between"><h1>Exercise library</h1><button class="sm" data-act="wsub" data-k="main">← Back</button></div>
    <input type="search" placeholder="Search name, muscle or equipment" aria-label="Search exercises" value="${esc(S.lf.q)}" data-inp="libq">
    <div class="grid3" style="margin-top:8px">
      ${sel('cat', [['', 'All muscles']].concat(Object.entries(CATS)), S.lf.cat, 'data-chg="libf" data-f="cat" aria-label="Muscle group"')}
      ${sel('equip', [['', 'All equipment']].concat(equips.map((e) => [e, e])), S.lf.equip, 'data-chg="libf" data-f="equip" aria-label="Equipment"')}
      ${sel('diff', [['', 'Any level'], ['Beginner', 'Beginner'], ['Intermediate', 'Intermediate'], ['Advanced', 'Advanced'], ['Custom', 'Custom']], S.lf.diff, 'data-chg="libf" data-f="diff" aria-label="Difficulty"')}</div>
    <div class="row" style="margin:10px 0"><button class="primary sm" data-act="exForm" data-id="">+ Create custom exercise</button></div>
    <div class="card" id="libres">${libResults()}</div>`;
  }
  function exDetail(e) {
    const li = (a) => `<ol>${a.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
    return `<div class="row between"><h1>${esc(e.name)}</h1><button class="sm" data-act="closeModal">Close</button></div>
    <p><span class="badge">${esc(CATS[e.cat] || e.cat)}</span> <span class="badge">${esc(e.difficulty)}</span> <span class="badge">${esc(e.kind)}</span> <span class="badge">${esc(e.style)}</span> <span class="badge">${esc(e.equipment)}</span></p>
    <div class="kv"><span>Primary</span><b>${esc(e.primary.join(', '))}</b></div>${e.secondary.length ? `<div class="kv"><span>Secondary</span><b>${esc(e.secondary.join(', '))}</b></div>` : ''}
    <div class="kv"><span>Suggested</span><b>${e.sets} × ${e.repMin === e.repMax ? e.repMin : e.repMin + '–' + e.repMax}, rest ${e.rest}s</b></div>
    <h3>Starting position</h3><p>${esc(e.steps[0])}</p><h3>Execution</h3>${li(e.steps.slice(1))}
    <h3>Breathing</h3><p>${esc(e.breathing)}</p>${e.mistakes.length ? `<h3>Common mistakes</h3><ul>${e.mistakes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <h3>Safety</h3><p>${esc(e.safety)}</p>
    ${e.beginnerAlt ? `<div class="kv"><span>Beginner alternative</span><b>${esc(e.beginnerAlt)}</b></div>` : ''}${e.advanced ? `<div class="kv"><span>Advanced variation</span><b>${esc(e.advanced)}</b></div>` : ''}${e.homeAlt ? `<div class="kv"><span>Home alternative</span><b>${esc(e.homeAlt)}</b></div>` : ''}
    <p class="small muted">Video/animation: not included yet — contributors can add media to <code>exercise-media/</code>.</p>
    ${e.custom ? `<div class="row"><button data-act="exForm" data-id="${e.id}">Edit</button><button class="danger" data-act="delEx" data-id="${e.id}">Delete</button></div>` : ''}`;
  }
  function exFormHtml(e) {
    e = e || {};
    return `<div class="row between"><h1>${e.id ? 'Edit' : 'New'} exercise</h1><button class="sm" data-act="closeModal">Cancel</button></div>
    <form data-submit="saveEx"><input type="hidden" name="id" value="${esc(e.id || '')}">
    <label>Name</label><input name="name" required maxlength="60" value="${esc(e.name || '')}">
    <label>Category</label>${sel('cat', Object.entries(CATS), e.cat || 'chest')}
    <label>Primary muscles (comma separated)</label><input name="primary" value="${esc((e.primary || []).join(', '))}">
    <label>Equipment</label><input name="equipment" value="${esc(e.equipment || 'Bodyweight')}">
    <label>Instructions (one step per line)</label><textarea name="steps">${esc((e.steps || []).join('\n'))}</textarea>
    <div class="grid3"><div><label>Sets</label><input name="sets" type="number" min="1" max="10" value="${e.sets || 3}"></div><div><label>Min reps</label><input name="repMin" type="number" min="1" max="100" value="${e.repMin || 8}"></div><div><label>Max reps</label><input name="repMax" type="number" min="1" max="100" value="${e.repMax || 12}"></div></div>
    <label>Rest (seconds)</label><input name="rest" type="number" min="0" max="600" value="${e.rest == null ? 90 : e.rest}">
    <button class="primary" style="width:100%;margin-top:14px">Save exercise</button></form>`;
  }

  /* ----- routine editor ----- */
  function vEditor() {
    const d = S.draft;
    return `<div class="row between"><h1>${d.isNew ? 'New routine' : 'Edit routine'}</h1><button class="sm" data-act="cancelEdit">Cancel</button></div>
    <div class="card"><label>Routine name</label><input data-bind="draft.name" value="${esc(d.name)}" maxlength="50" aria-label="Routine name">
    <label>Schedule (repeat weekly)</label><div class="chips">${DAYS.map((n, i) => `<button class="chip ${d.days.includes(i) ? 'on' : ''}" data-act="toggleDay" data-k="${i}">${n}</button>`).join('')}</div></div>
    ${d.items.map((it, i) => { const e = exById(it.exId) || { name: 'Unknown' }; return `<div class="card"><div class="row between"><b>${esc(e.name)}</b><div class="row"><button class="sm" data-act="mvItem" data-i="${i}" data-k="-1" aria-label="Move up">↑</button><button class="sm" data-act="mvItem" data-i="${i}" data-k="1" aria-label="Move down">↓</button><button class="sm danger" data-act="rmItem" data-i="${i}" aria-label="Remove">✕</button></div></div>
      <div class="grid3"><div><label>Sets</label><input type="number" min="1" max="12" data-bind="draft.items.${i}.sets" value="${it.sets}"></div><div><label>Reps min</label><input type="number" min="1" data-bind="draft.items.${i}.repMin" value="${it.repMin}"></div><div><label>Reps max</label><input type="number" min="1" data-bind="draft.items.${i}.repMax" value="${it.repMax}"></div></div>
      <div class="grid2"><div><label>Target weight (${uW()})</label><input type="number" step="0.5" data-w="1" data-bind="draft.items.${i}.kg" value="${it.kg ? toW(it.kg) : ''}"></div><div><label>Rest (s)</label><input type="number" data-bind="draft.items.${i}.rest" value="${it.rest}"></div></div>
      <label>Notes</label><input data-bind="draft.items.${i}.note" value="${esc(it.note || '')}" maxlength="120"></div>`; }).join('')}
    <div class="row wrap"><button data-act="openPick" data-k="draft">+ Add exercise</button><button class="primary" data-act="saveRoutine">Save routine</button></div>`;
  }
  function pickResults() {
    const q = S.pick.q.toLowerCase();
    const l = allEx().filter((e) => (!S.pick.cat || e.cat === S.pick.cat) && (!q || (e.name + ' ' + e.primary.join(' ')).toLowerCase().includes(q))).slice(0, 80);
    return l.map((e) => exRow(e, 'pickEx')).join('') || '<p class="muted">No matches.</p>';
  }
  function pickHtml() {
    return `<div class="row between"><h1>Add exercise</h1><button class="sm" data-act="closeModal">Done</button></div>
    <input type="search" placeholder="Search exercises" aria-label="Search exercises" data-inp="pickq" value="${esc(S.pick.q)}">
    ${sel('cat', [['', 'All muscles']].concat(Object.entries(CATS)), S.pick.cat, 'data-chg="pickcat" style="margin-top:8px" aria-label="Muscle group"')}
    <div id="pickres" style="margin-top:8px">${pickResults()}</div>
    <p class="small muted">Can't find it? Create a custom exercise in Workout → Exercise library.</p>`;
  }

  /* ----- live session ----- */
  function lastPerf(exId, beforeTs) {
    const ss = D.sessions.filter((s) => s.startedAt < beforeTs && s.exercises.some((e) => e.exId === exId)).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    if (!ss.length) return null;
    const e = ss[0].exercises.find((x) => x.exId === exId);
    return { sets: e.sets.filter((s) => s.done), pain: e.pain, date: ss[0].date };
  }
  function buildSessionEx(it, ts) {
    const e = exById(it.exId); if (!e) return null;
    const lp = lastPerf(it.exId, ts);
    const topKg = lp && lp.sets.length ? Math.max(...lp.sets.map((s) => s.kg)) : 0;
    const kg = it.kg || topKg || 0;
    const sets = [];
    for (let i = 0; i < (it.sets || 3); i++) sets.push({ kg, reps: (lp && lp.sets[i] && lp.sets[i].reps) || it.repMin || 8, done: false });
    return { exId: it.exId, name: e.name, repMin: it.repMin || 8, repMax: it.repMax || 12, rest: it.rest == null ? 90 : it.rest, note: it.note || '', sets, skipped: false, pain: false };
  }
  function startSession(name, items) {
    const ts = new Date().toISOString();
    S.session = { id: uid(), date: todayStr(), routineName: name, startedAt: ts, exercises: items.map((i) => buildSessionEx(i, ts)).filter(Boolean) };
    persistSession(); S.wsub = 'session'; S.tab = 'workout'; render();
  }
  const persistSession = () => saveKV('activeSession', { session: S.session });
  function overloadFor(se) {
    const lp = lastPerf(se.exId, S.session.startedAt); if (!lp) return null;
    const rec = lastRecovery();
    const recent = rec && rec.id >= addDays(todayStr(), -2) && rec.fatigue >= 4;
    return Calc.suggestOverload(lp.sets, se.repMin, se.repMax, { pain: lp.pain, highFatigue: recent });
  }
  function vSession() {
    const s = S.session; if (!s) { S.wsub = 'main'; return vWorkout(); }
    return `<div class="row between"><h1>${esc(s.routineName)}</h1><button class="sm" data-act="wsub" data-k="main">Minimise</button></div>
    ${s.exercises.map((se, i) => { const o = overloadFor(se); const lp = lastPerf(se.exId, s.startedAt);
      return `<div class="card" style="${se.skipped ? 'opacity:.5' : ''}"><div class="row between"><b>${esc(se.name)}</b><button class="sm" data-act="exInfoId" data-id="${se.exId}">Info</button></div>
      <div class="small muted">Target ${se.sets.length} × ${se.repMin}–${se.repMax} · rest ${se.rest}s${se.note ? ' · ' + esc(se.note) : ''}</div>
      ${lp && lp.sets.length ? `<div class="small muted">Last (${prettyDate(lp.date)}): ${lp.sets.map((x) => toW(x.kg) + '×' + x.reps).join(', ')}</div>` : ''}
      ${o && o.action !== 'none' ? `<div class="small ${o.action === 'increase' ? 'ok' : o.action === 'reduce' ? 'warn' : 'muted'}">💡 ${esc(o.message)}</div>` : ''}
      <div class="small muted" style="display:grid;grid-template-columns:28px 1fr 1fr 44px;gap:8px;margin-top:8px"><span>Set</span><span style="text-align:center">${uW()}</span><span style="text-align:center">Reps</span><span></span></div>
      ${se.sets.map((st, j) => `<div class="setrow ${st.done ? 'done' : ''}"><span class="muted">${j + 1}</span>
        <input type="number" step="0.5" inputmode="decimal" aria-label="Weight set ${j + 1}" data-bind="session.exercises.${i}.sets.${j}.kg" data-w="1" data-persist="1" value="${st.kg ? toW(st.kg) : ''}">
        <input type="number" inputmode="numeric" aria-label="Reps set ${j + 1}" data-bind="session.exercises.${i}.sets.${j}.reps" data-persist="1" value="${st.reps || ''}">
        <button class="chk" data-act="toggleSet" data-i="${i}" data-j="${j}" aria-label="Mark set ${j + 1} done" aria-pressed="${st.done}">✓</button></div>`).join('')}
      <label class="check"><input type="checkbox" data-bind="session.exercises.${i}.pain" data-persist="1" ${se.pain ? 'checked' : ''}> I felt pain or had a technique problem</label>
      ${se.pain ? '<div class="small warn">If pain is sharp or persistent, stop this exercise and consider seeing a professional.</div>' : ''}
      <div class="row wrap" style="margin-top:6px"><button class="sm" data-act="addSet" data-i="${i}">+ Set</button><button class="sm" data-act="skipEx" data-i="${i}">${se.skipped ? 'Unskip' : 'Skip'}</button><button class="sm danger" data-act="rmSessEx" data-i="${i}">Remove</button></div></div>`; }).join('')}
    <div class="row wrap"><button data-act="openPick" data-k="session">+ Add exercise</button><button class="primary" data-act="finish">Finish workout</button><button class="danger" data-act="discard">Discard</button></div>`;
  }
  function finishSession() {
    const s = S.session, prs = [];
    s.exercises.forEach((se) => {
      if (se.skipped) return;
      const done = se.sets.filter((x) => x.done && x.kg >= 0 && x.reps > 0);
      if (!done.length) return;
      const prior = D.sessions.filter((x) => x.startedAt < s.startedAt).flatMap((x) => x.exercises.filter((e) => e.exId === se.exId).flatMap((e) => e.sets.filter((t) => t.done)));
      const best = prior.reduce((m, t) => Math.max(m, Calc.epley1RM(t.kg, t.reps)), 0);
      const mine = done.reduce((m, t) => Math.max(m, Calc.epley1RM(t.kg, t.reps)), 0);
      if (prior.length && mine > best + 0.01 && mine > 0) { const t = done.slice().sort((a, b) => Calc.epley1RM(b.kg, b.reps) - Calc.epley1RM(a.kg, a.reps))[0]; prs.push({ name: se.name, kg: t.kg, reps: t.reps }); }
    });
    const exs = s.exercises.filter((e) => e.sets.some((x) => x.done));
    if (!exs.length) { toast('Mark at least one set done (✓) before finishing.'); return; }
    const vol = exs.reduce((v, e) => v + Calc.volume(e.sets.filter((x) => x.done)), 0);
    const sets = exs.reduce((v, e) => v + e.sets.filter((x) => x.done).length, 0);
    const rec = { id: s.id, date: s.date, routineName: s.routineName, startedAt: s.startedAt, endedAt: new Date().toISOString(), exercises: s.exercises, volume: vol, sets, prs, completed: true };
    save('sessions', rec); DB.del('kv', 'activeSession'); S.session = null; S.wsub = 'main'; S.restEnd = 0; $('#restbar').hidden = true;
    const mins = Math.max(1, r0((new Date(rec.endedAt) - new Date(rec.startedAt)) / 60000));
    openModal(`<h1>Workout complete 💪</h1><div class="grid3"><div class="stat"><b>${sets}</b>sets</div><div class="stat"><b>${r0(toW(vol))}</b>${uW()} volume</div><div class="stat"><b>${mins}</b>min</div></div>
      ${prs.length ? `<h2>New personal records 🏆</h2>${prs.map((p) => `<div class="item"><span>${esc(p.name)}</span><b>${toW(p.kg)} ${uW()} × ${p.reps}</b></div>`).join('')}` : '<p class="muted">Keep stacking sessions — progress shows over weeks.</p>'}
      <p class="small muted">Record how recovered you feel in Progress → Recovery.</p><button class="primary" style="width:100%" data-act="closeModal">Done</button>`);
    render();
  }
  function vHistory() {
    const l = D.sessions.slice().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    return `<div class="row between"><h1>History</h1><button class="sm" data-act="wsub" data-k="main">← Back</button></div>
    ${l.length ? l.map((s) => `<div class="card"><div class="row between"><b>${esc(s.routineName)}</b><span class="muted small">${prettyDate(s.date)}</span></div>
      <div class="small muted">${s.sets} sets · ${r0(toW(s.volume))} ${uW()} volume${s.prs && s.prs.length ? ` · 🏆 ${s.prs.length} PR` : ''}</div>
      <div class="small">${s.exercises.filter((e) => e.sets.some((x) => x.done)).map((e) => `${esc(e.name)}: ${e.sets.filter((x) => x.done).map((x) => toW(x.kg) + '×' + x.reps).join(', ')}`).join('<br>')}</div>
      <button class="sm danger" style="margin-top:6px" data-act="delSession" data-id="${s.id}">Delete</button></div>`).join('') : '<p class="muted">No workouts logged yet.</p>'}`;
  }

  /* ================= NUTRITION ================= */
  function vNutrition() {
    const T = targets(), date = S.nDate, tot = dayTotals(date), isToday = date === todayStr();
    return `<h1>Nutrition</h1>
    <div class="row between"><button class="sm" data-act="nday" data-k="-1" aria-label="Previous day">‹</button><b>${isToday ? 'Today' : prettyDate(date)}</b><button class="sm" data-act="nday" data-k="1" aria-label="Next day">›</button></div>
    <div class="card">${metric('Calories', tot.kcal, T.kcal, 'kcal')}${metric('Protein', tot.p, T.protein, 'g', { noOver: true })}${metric('Carbs', tot.c, T.carbs, 'g', { noOver: true })}${metric('Fat', tot.f, T.fat, 'g', { noOver: true })}${metric('Fibre', tot.fib, T.fibre, 'g', { noOver: true })}${metric('Water', waterOn(date), T.water, 'ml', { noOver: true })}
    <div class="row wrap"><button class="sm" data-act="water" data-k="250">+250 ml</button><button class="sm" data-act="water" data-k="-250">−250 ml</button></div></div>
    ${MEALS.map(([k, l]) => { const es = D.foodLog.filter((e) => e.date === date && e.meal === k); const kc = es.reduce((a, e) => a + e.kcal, 0);
      return `<div class="card"><div class="row between"><b>${l}</b><span class="muted small">${r0(kc)} kcal</span></div>
      ${es.map((e) => `<div class="item"><div class="grow">${esc(e.name)}<div class="small muted">${r0(e.grams)} g · ${r0(e.kcal)} kcal · P ${r1(e.p)} C ${r1(e.c)} F ${r1(e.f)}</div></div><button class="sm" data-act="editFood" data-id="${e.id}" aria-label="Edit">✎</button><button class="sm danger" data-act="delFood" data-id="${e.id}" aria-label="Delete">✕</button></div>`).join('')}
      <div class="row wrap" style="margin-top:8px"><button class="sm primary" data-act="addFood" data-k="${k}">+ Add food</button><button class="sm" data-act="repeatMeal" data-k="${k}">Repeat from previous day</button></div></div>`; }).join('')}
    <p class="small muted">Tip: food values are approximate reference data. Weigh raw foods raw and cooked foods cooked — they differ a lot (e.g. dry rice ≈ 350 kcal/100 g, cooked ≈ 130).</p>${DISCLAIMER}`;
  }
  function foodResults() {
    const q = (S.fAdd.q || '').toLowerCase().trim();
    const l = allFoods().filter((f) => !q || (f.name + ' ' + f.state).toLowerCase().includes(q)).slice(0, 60);
    return l.map((f) => `<div class="item"><div class="grow"><b>${esc(f.name)}</b> <span class="badge">${f.state}</span>${f.id.startsWith('c-') ? ' <span class="badge acc">custom</span>' : ''}<div class="small muted">${f.kcal} kcal · P ${f.protein} C ${f.carbs} F ${f.fat} per 100 g</div></div><button class="sm" data-act="pickFood" data-id="${f.id}">Select</button></div>`).join('') || '<p class="muted">No match — create a custom food.</p>';
  }
  function foodSearchHtml() {
    return `<div class="row between"><h1>Add food</h1><button class="sm" data-act="closeModal">Cancel</button></div>
    <input type="search" placeholder="Search e.g. dal, roti, paneer" aria-label="Search foods" data-inp="foodq" value="${esc(S.fAdd.q || '')}">
    <button class="sm" style="margin:8px 0" data-act="customFood">+ Create custom food</button><div id="foodres">${foodResults()}</div>`;
  }
  function macrosFor(f, g) { const k = g / 100; return { kcal: f.kcal * k, p: f.protein * k, c: f.carbs * k, f: f.fat * k, fib: (f.fibre || 0) * k }; }
  function foodQtyHtml(f, grams, editingId) {
    const m = macrosFor(f, grams);
    return `<div class="row between"><h1>${esc(f.name)}</h1><button class="sm" data-act="closeModal">Cancel</button></div>
    <p><span class="badge">${f.state}</span> <span class="badge">${esc(f.source || 'Custom')}</span></p>
    <form data-submit="saveFood"><div class="grid2"><div><label>Grams</label><input name="grams" type="number" step="1" min="1" required value="${grams}" data-inp="qty" id="gq"></div>
    <div><label>Portions (${esc(f.servingLabel || f.serving + ' g')})</label><input name="portions" type="number" step="0.25" min="0.25" value="${r1(grams / f.serving)}" data-inp="portions" id="pq"></div></div>
    <div class="card" id="fprev">${prevHtml(m)}</div><input type="hidden" name="foodId" value="${f.id}"><input type="hidden" name="editId" value="${editingId || ''}">
    <button class="primary" style="width:100%">${editingId ? 'Save changes' : 'Add to ' + (MEALS.find((x) => x[0] === S.fAdd.meal) || [0, 'meal'])[1]}</button></form>`;
  }
  const prevHtml = (m) => `<div class="grid3"><div class="stat"><b>${r0(m.kcal)}</b>kcal</div><div class="stat"><b>${r1(m.p)}</b>protein g</div><div class="stat"><b>${r1(m.c)}</b>carbs g</div></div><div class="small muted">Fat ${r1(m.f)} g · Fibre ${r1(m.fib)} g</div>`;
  function customFoodHtml() {
    return `<div class="row between"><h1>Custom food</h1><button class="sm" data-act="closeModal">Cancel</button></div>
    <form data-submit="saveCustomFood"><label>Name</label><input name="name" required maxlength="60">
    <label>State</label>${sel('state', [['cooked', 'Cooked'], ['raw', 'Raw']], 'cooked')}
    <p class="small muted">Values per 100 g:</p>
    <div class="grid2"><div><label>Calories</label><input name="kcal" type="number" step="0.1" min="0" required></div><div><label>Protein (g)</label><input name="protein" type="number" step="0.1" min="0" required></div>
    <div><label>Carbs (g)</label><input name="carbs" type="number" step="0.1" min="0" required></div><div><label>Fat (g)</label><input name="fat" type="number" step="0.1" min="0" required></div>
    <div><label>Fibre (g)</label><input name="fibre" type="number" step="0.1" min="0" value="0"></div><div><label>Serving size (g)</label><input name="serving" type="number" min="1" value="100"></div></div>
    <button class="primary" style="width:100%;margin-top:14px">Save food</button></form>`;
  }

  /* ================= PROGRESS ================= */
  function vProgress() {
    const subs = [['weight', 'Weight'], ['body', 'Body'], ['cardio', 'Cardio'], ['recovery', 'Recovery'], ['analytics', 'Analytics']];
    return `<h1>Progress</h1>${chips(subs, S.psub, 'psub')}${{ weight: pWeight, body: pBody, cardio: pCardio, recovery: pRecovery, analytics: pAnalytics }[S.psub]()}`;
  }
  function pWeight() {
    const ws = sortedWeights(), today = todayStr(), T = targets();
    const rangeOpts = [[7, '7d'], [30, '30d'], [90, '90d'], [180, '6m'], [365, '1y'], [0, 'All']];
    const cutoff = S.range ? addDays(today, -S.range) : '0000';
    const ma = Calc.movingAverage(ws, 7).filter((r) => r.date >= cutoff);
    const rows = ma.map((r) => ({ d: Calc.dayNum(r.date), v: toW(r.kg), avg: toW(r.avg), label: r.date.slice(5) }));
    const cur = ws.length ? ws[ws.length - 1].kg : null, prev = ws.length > 1 ? ws[ws.length - 2].kg : null;
    const wa = Calc.averageBetween(ws, addDays(today, -6), today), ma30 = Calc.averageBetween(ws, addDays(today, -29), today);
    const start = ws.length ? ws[0].kg : null, target = D.profile.targetKg;
    let prog = '';
    if (target && start != null && cur != null && start !== target) { const p = Math.max(0, Math.min(100, ((start - cur) / (start - target)) * 100)); prog = `<div class="kv"><span>Progress to target (${toW(target)} ${uW()})</span><b>${r0(p)}%</b></div><div class="bar"><i style="width:${p}%"></i></div>`; }
    const adv = Calc.adaptiveAdvice(ws, D.profile.goal);
    return `<div class="card"><div class="row"><input id="wv" type="number" step="0.1" inputmode="decimal" placeholder="Weight (${uW()})" aria-label="Weight" value="${cur != null && !D.weights.find((w) => w.id === today) ? '' : cur != null ? toW(cur) : ''}"><input id="wd" type="date" value="${today}" max="${today}" aria-label="Date" style="max-width:160px"><button class="primary" data-act="logWeight">Log</button></div></div>
    <div class="grid2"><div class="stat"><b>${cur != null ? toW(cur) : '–'}</b>current ${uW()}</div><div class="stat"><b>${prev != null ? toW(prev) : '–'}</b>previous</div>
    <div class="stat"><b>${wa != null ? toW(wa) : '–'}</b>7-day avg</div><div class="stat"><b>${ma30 != null ? toW(ma30) : '–'}</b>30-day avg</div></div>
    ${cur != null && start != null ? `<div class="kv"><span>Change since first entry</span><b>${r1(toW(cur) - toW(start)) > 0 ? '+' : ''}${r1(toW(cur) - toW(start))} ${uW()}</b></div>` : ''}${prog}
    <div class="card" style="margin-top:12px">${chips(rangeOpts, S.range, 'range')}${lineChart(rows, uW())}</div>
    <div class="card"><h3>Weekly review</h3><p>${esc(adv.message)}</p>${adv.kcalChange ? `<div class="row wrap"><button class="sm" data-act="applyKcal" data-k="${adv.kcalChange}">Apply ${adv.kcalChange > 0 ? '+' : ''}${adv.kcalChange} kcal to my target</button></div>` : ''}<p class="small muted">Scale weight is one signal. Also check measurements, photos in the mirror, strength and energy.</p></div>
    <h3>Entries</h3>${ws.slice().reverse().slice(0, 14).map((w) => `<div class="item"><span>${prettyDate(w.date)}</span><span><b>${toW(w.kg)} ${uW()}</b> <button class="sm danger" data-act="delWeight" data-id="${w.date}" aria-label="Delete entry">✕</button></span></div>`).join('') || '<p class="muted">No entries yet.</p>'}`;
  }
  const BODY = [['waist', 'Waist'], ['chest', 'Chest'], ['arms', 'Arms'], ['forearms', 'Forearms'], ['thighs', 'Thighs'], ['calves', 'Calves'], ['neck', 'Neck'], ['hips', 'Hips']];
  function pBody() {
    const ms = D.measures.slice().sort((a, b) => (a.id < b.id ? -1 : 1)), last = ms[ms.length - 1], first = ms[0];
    return `<div class="card"><h3>Add measurements (${uL()}) — optional</h3><form data-submit="saveMeasure"><div class="grid2">${BODY.map(([k, l]) => `<div><label>${l}</label><input name="${k}" type="number" step="0.1" inputmode="decimal"></div>`).join('')}</div><button class="primary" style="width:100%;margin-top:12px">Save today's measurements</button></form>
    <p class="small muted">Treated as sensitive: stored only on this device, never uploaded.</p></div>
    ${last ? `<div class="card"><h3>Latest (${prettyDate(last.id)}) vs first (${prettyDate(first.id)})</h3>${BODY.filter(([k]) => last[k]).map(([k, l]) => { const d = first[k] ? r1(toL(last[k]) - toL(first[k])) : null; return `<div class="kv"><span>${l}</span><b>${toL(last[k])} ${uL()}${d != null && ms.length > 1 ? ` <span class="muted">(${d > 0 ? '+' : ''}${d})</span>` : ''}</b></div>`; }).join('')}<button class="sm danger" data-act="delMeasures" style="margin-top:8px">Delete all measurements</button></div>` : ''}
    <p class="small muted">Progress photos aren't in this version yet. Until then, take them in your phone's gallery with a consistent pose and lighting.</p>`;
  }
  function pCardio() {
    const date = todayStr(), wkStart = addDays(date, -6), wk = D.cardio.filter((c) => c.date >= wkStart);
    const mins = wk.reduce((s, c) => s + c.min, 0), target = D.settings.cardioWeeklyMin || 150;
    const acts = Object.keys(Calc.MET);
    return `<div class="card"><h3>Log cardio / activity</h3><form data-submit="saveCardio">
    <label>Activity</label>${sel('activity', acts.map((a) => [a, a]), 'Walking')}
    <div class="grid2"><div><label>Minutes</label><input name="min" type="number" min="1" max="600" required></div><div><label>Distance (km, optional)</label><input name="km" type="number" step="0.01" min="0"></div>
    <div><label>Intensity</label>${sel('intensity', [['0', 'Easy'], ['1', 'Moderate'], ['2', 'Hard']], '1')}</div><div><label>Steps (optional)</label><input name="steps" type="number" min="0"></div></div>
    <button class="primary" style="width:100%;margin-top:12px">Log activity</button></form></div>
    <div class="card"><h3>This week</h3>${metric('Cardio minutes', mins, target, 'min', { noOver: true })}
    <div class="row"><label style="margin:0">Weekly target (min)</label><input type="number" min="0" max="2000" style="max-width:100px" data-chg="cardioTarget" value="${target}"></div>
    <p class="small muted">${D.profile.exp === 'beginner' ? 'Beginner? Increase total weekly time by about 10% per week.' : 'Keep most cardio easy; place hard sessions away from heavy leg days.'} Estimated calories are rough — don't automatically eat them back.</p></div>
    ${D.cardio.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 15).map((c) => `<div class="item"><div class="grow">${esc(c.activity)} · ${c.min} min${c.km ? ' · ' + c.km + ' km' : ''}${c.km ? ' · ' + r1(c.min / c.km) + ' min/km' : ''}<div class="small muted">${prettyDate(c.date)} · ~${c.kcal} kcal (estimate)${c.steps ? ' · ' + c.steps + ' steps' : ''}</div></div><button class="sm danger" data-act="delCardio" data-id="${c.id}">✕</button></div>`).join('')}`;
  }
  function pRecovery() {
    const date = todayStr(), cur = D.recovery.find((r) => r.id === date) || {};
    const sw = D.sessions.filter((s) => s.date >= addDays(date, -6)).length;
    return `<div class="card"><h3>How are you today?</h3><form data-submit="saveRecovery">
    <div class="grid3"><div><label>Sleep (h)</label><input name="sleep" type="number" step="0.25" min="0" max="24" value="${cur.sleep || ''}"></div>
    <div><label>Soreness (1–5)</label>${sel('soreness', [1, 2, 3, 4, 5].map((n) => [n, n]), cur.soreness || 2)}</div><div><label>Fatigue (1–5)</label>${sel('fatigue', [1, 2, 3, 4, 5].map((n) => [n, n]), cur.fatigue || 2)}</div></div>
    <button class="primary" style="width:100%;margin-top:12px">Save</button></form></div>
    <div class="card"><b>${sw}</b> workout${sw === 1 ? '' : 's'} in the last 7 days. ${sw >= 6 ? '<span class="warn">Consider at least one full rest day.</span>' : 'Rest days are when muscle repairs and gets stronger.'}</div>
    <div class="card"><h3>Recovery basics</h3><ul><li>Sleep 7–9 hours.</li><li>Take 1–2 rest days weekly; add a lighter week every 6–8 weeks.</li><li>Eat enough protein and drink water through the day.</li><li>Muscle soreness fades in a few days; sharp, joint or persistent pain is different — stop that exercise and seek medical guidance.</li></ul></div>
    ${D.recovery.slice().sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, 10).map((r) => `<div class="item"><span>${prettyDate(r.id)}</span><span class="small">😴 ${r.sleep || '–'} h · sore ${r.soreness} · fatigue ${r.fatigue}</span></div>`).join('')}`;
  }
  function pAnalytics() {
    const date = todayStr(), T = targets();
    const w7 = D.sessions.filter((s) => s.date >= addDays(date, -6)), w30 = D.sessions.filter((s) => s.date >= addDays(date, -29));
    const planned = D.routines.reduce((n, r) => n + (r.days || []).length, 0);
    const vols = [], labs = [];
    for (let i = 7; i >= 0; i--) { const a = addDays(date, -6 - i * 7), b = addDays(date, -i * 7); vols.push(r0(toW(D.sessions.filter((s) => s.date >= a && s.date <= b).reduce((v, s) => v + s.volume, 0)))); labs.push(b.slice(5)); }
    const days7 = [...Array(7)].map((_, i) => addDays(date, -6 + i));
    const cal = days7.map((d) => r0(dayTotals(d).kcal)), pro = days7.map((d) => r0(dayTotals(d).p));
    const lab7 = days7.map((d) => DAYS[dow(d)]);
    const sleeps = D.recovery.filter((r) => r.sleep && r.id >= addDays(date, -13)).sort((a, b) => (a.id < b.id ? -1 : 1));
    const prs = {}; D.sessions.forEach((s) => s.exercises.forEach((e) => e.sets.filter((x) => x.done).forEach((x) => { const v = Calc.epley1RM(x.kg, x.reps); if (!prs[e.name] || v > prs[e.name].v) prs[e.name] = { v, kg: x.kg, reps: x.reps }; })));
    const prl = Object.entries(prs).sort((a, b) => b[1].v - a[1].v).slice(0, 10);
    const totSets = w30.reduce((n, s) => n + s.sets, 0);
    return `<div class="grid2"><div class="stat"><b>${w7.length}${planned ? '/' + planned : ''}</b>workouts this week</div><div class="stat"><b>${w30.length}</b>last 30 days</div><div class="stat"><b>${totSets}</b>sets (30 d)</div><div class="stat"><b>${D.sessions.length}</b>total workouts</div></div>
    <div class="card"><h3>Weekly training volume (${uW()}, 8 weeks)</h3>${barChart(vols, labs, uW())}</div>
    <div class="card"><h3>Calories — last 7 days</h3>${barChart(cal, lab7, 'kcal', T.kcal)}<p class="small muted">Dashed line = target.</p></div>
    <div class="card"><h3>Protein — last 7 days (g)</h3>${barChart(pro, lab7, 'g', T.protein)}</div>
    <div class="card"><h3>Sleep — last 14 days</h3>${sleeps.length ? barChart(sleeps.map((s) => s.sleep), sleeps.map((s) => s.id.slice(8)), 'h', 8) : '<p class="muted small">No sleep logged yet.</p>'}</div>
    <div class="card"><h3>Estimated 1RM by exercise</h3>${prl.length ? prl.map(([n, v]) => `<div class="kv"><span>${esc(n)}</span><b>${toW(v.v)} ${uW()} <span class="muted small">(${toW(v.kg)}×${v.reps})</span></b></div>`).join('') : '<p class="muted small">Log workouts to see strength estimates.</p>'}</div>
    <div class="row wrap"><button data-act="exportData">Export all data (JSON)</button></div>`;
  }

  /* ================= PROFILE ================= */
  function vProfile() {
    if (!D.profile) return vOnboard();
    const T = targets(), p = D.profile, plan = S.plan;
    return `<h1>Profile</h1>
    <div class="card"><h3>Your numbers (estimates)</h3>
    <div class="kv"><span>BMR (Mifflin-St Jeor)</span><b>${T.bmr} kcal</b></div><div class="kv"><span>Maintenance (TDEE)</span><b>${T.tdee} kcal</b></div>
    <div class="kv"><span>Calorie target</span><b>${T.kcal} kcal${p.calOverride ? ' (custom)' : ''}</b></div>
    <div class="kv"><span>Protein range</span><b>${T.pr.min}–${T.pr.max} g</b></div><div class="kv"><span>Protein target</span><b>${T.protein} g${p.proteinOverride ? ' (custom)' : ''}</b></div>
    <div class="kv"><span>Carbs / Fat</span><b>${T.carbs} g / ${T.fat} g</b></div><div class="kv"><span>Water</span><b>${T.water} ml</b></div>
    <details><summary class="small muted" style="cursor:pointer;margin-top:8px">How these are calculated</summary><p class="small muted">BMR = 10×kg + 6.25×cm − 5×age ${p.sex === 'male' ? '+ 5' : '− 161'}. TDEE = BMR × activity factor (${Calc.ACTIVITY[p.activity].factor}). Goal adjusts calories (${GOAL[p.goal].label}: ${GOAL[p.goal].adj >= 0 ? '+' : ''}${r0(GOAL[p.goal].adj * 100)}%), never below BMR or 1,200 kcal for deficits. Protein = ${T.pr.perKgLow}–${T.pr.perKgHigh} g/kg. Fat = max(25% of calories, 0.6 g/kg); carbs = the rest. These are estimates; real needs vary by person.</p></details>
    <form data-submit="saveTargets"><div class="grid2"><div><label>Custom calories (blank = auto)</label><input name="cal" type="number" min="1000" max="6000" value="${p.calOverride || ''}"></div><div><label>Custom protein g (blank = auto)</label><input name="pro" type="number" min="20" max="400" value="${p.proteinOverride || ''}"></div></div><button class="sm" style="margin-top:8px">Save targets</button></form></div>
    <div class="card"><h3>Fat-loss planner</h3><form data-submit="plan"><div class="grid2"><div><label>Target weight (${uW()})</label><input name="target" type="number" step="0.1" required value="${p.targetKg ? toW(p.targetKg) : ''}"></div><div><label>Timeline (weeks)</label><input name="weeks" type="number" min="1" max="200" required value="${esc((plan && plan.weeks) || 12)}"></div></div><button class="sm" style="margin-top:8px">Calculate</button></form>${plan ? plan.html : ''}</div>
    <div class="card"><h3>Edit profile</h3>${profileForm(p, false)}</div>
    <div class="card"><h3>Settings</h3><label>Theme</label>${sel('theme', [['', 'System default'], ['dark', 'Dark'], ['light', 'Light']], localStorage.getItem('im_theme') || '', 'data-chg="theme"')}</div>
    <div class="card"><h3>Your data</h3><p class="small muted">Everything is stored on this device only. Nothing is uploaded. Clearing browser data erases it — export a backup regularly.</p>
    <div class="row wrap"><button data-act="exportData">Export backup</button><label class="btn" style="margin:0;cursor:pointer">Import backup<input type="file" accept="application/json" data-chg="importData" hidden></label><button class="danger" data-act="wipe">Delete all data</button></div></div>
    <div class="card"><h3>About</h3><p class="small muted">IRONMIND is free and open source. Food values are approximate reference data; verify before relying on them. Cloud sync, progress photos, favourite meals/recipes, reminders and languages are planned.</p></div>${DISCLAIMER}`;
  }

  /* ================= actions ================= */
  function tickRest() {
    const bar = $('#restbar');
    const left = Math.ceil((S.restEnd - Date.now()) / 1000);
    if (S.restEnd && left > 0) { bar.hidden = false; bar.innerHTML = `<span>Rest ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span><button data-act="skipRest">Skip</button>`; }
    else if (S.restEnd) { S.restEnd = 0; bar.hidden = true; toast('Rest over — next set 💪'); try { navigator.vibrate && navigator.vibrate(200); } catch (e) { /* ignore */ } }
  }
  setInterval(tickRest, 500);

  function setPath(obj, path, val) { const k = path.split('.'); let o = obj; for (let i = 0; i < k.length - 1; i++) o = o[k[i]]; o[k[k.length - 1]] = val; }
  function formObj(form) { const fd = new FormData(form), o = {}; for (const [k, v] of fd.entries()) { if (o[k] === undefined) o[k] = v; else if (Array.isArray(o[k])) o[k].push(v); else o[k] = [o[k], v]; } return o; }
  function updatePrev() { if (!S.fAdd || !S.fAdd.food) return; const g = num($('#gq') && $('#gq').value); const el = $('#fprev'); if (el) el.innerHTML = prevHtml(macrosFor(S.fAdd.food, g)); }

  function download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

  const ACT = {
    tab(el) { S.tab = el.dataset.k; if (S.tab !== 'workout' || S.wsub === 'editor') { /* keep */ } render(); window.scrollTo(0, 0); },
    goto(el) { S.tab = el.dataset.k; render(); window.scrollTo(0, 0); },
    closeModal() { closeModal(); },
    water(el) { const d = S.tab === 'nutrition' ? S.nDate : todayStr(); const cur = waterOn(d); save('water', { id: d, ml: Math.max(0, cur + num(el.dataset.k)) }); render(); },
    quickWeight() { const v = num($('#qw').value); if (!validW(v)) return; logW(todayStr(), fromW(v)); render(); toast('Weight logged'); },
    ask(el) { S.answer = `<div class="card" style="background:var(--card2)">${ANSWERS[el.dataset.k]()}</div>`; render(); },
    addTemplate(el) {
      const t = TEMPLATES.find((x) => x.id === el.dataset.id); if (!t) return;
      t.days.forEach((d) => save('routines', { id: uid(), name: d.name + ' — ' + t.name.split(' — ')[0].split(' (')[0], days: d.dow.slice(), items: d.items.map((i) => Object.assign({}, i)) }));
      toast('Added ' + t.days.length + ' routine' + (t.days.length > 1 ? 's' : '')); S.tab = 'workout'; S.wsub = 'main'; render();
    },
    wsub(el) { S.wsub = el.dataset.k; render(); window.scrollTo(0, 0); },
    newRoutine() { S.draft = { id: uid(), name: 'My routine', days: [], items: [], isNew: true }; S.wsub = 'editor'; render(); },
    editRoutine(el) { const r = D.routines.find((x) => x.id === el.dataset.id); S.draft = JSON.parse(JSON.stringify(r)); S.draft.isNew = false; S.wsub = 'editor'; render(); },
    dupRoutine(el) { const r = JSON.parse(JSON.stringify(D.routines.find((x) => x.id === el.dataset.id))); r.id = uid(); r.name += ' (copy)'; r.days = []; save('routines', r); render(); toast('Duplicated'); },
    delRoutine(el) { if (confirm('Delete this routine?')) { remove('routines', el.dataset.id); render(); } },
    cancelEdit() { S.draft = null; S.wsub = 'main'; render(); },
    toggleDay(el) { const d = num(el.dataset.k), a = S.draft.days; const i = a.indexOf(d); if (i >= 0) a.splice(i, 1); else a.push(d); render(); },
    mvItem(el) { const i = num(el.dataset.i), k = num(el.dataset.k), a = S.draft.items; if (i + k < 0 || i + k >= a.length) return; [a[i], a[i + k]] = [a[i + k], a[i]]; render(); },
    rmItem(el) { S.draft.items.splice(num(el.dataset.i), 1); render(); },
    saveRoutine() { const d = S.draft; if (!d.name.trim()) { toast('Give the routine a name'); return; } if (!d.items.length) { toast('Add at least one exercise'); return; } delete d.isNew; save('routines', d); S.draft = null; S.wsub = 'main'; render(); toast('Routine saved'); },
    openPick(el) { S.pick = { for: el.dataset.k, q: '', cat: '' }; openModal(pickHtml()); },
    pickEx(el) {
      const e = exById(el.dataset.id); if (!e) return;
      if (S.pick.for === 'draft') S.draft.items.push({ exId: e.id, sets: e.sets, repMin: e.repMin, repMax: e.repMax, kg: 0, rest: e.rest, note: '' });
      else { const se = buildSessionEx({ exId: e.id, sets: e.sets, repMin: e.repMin, repMax: e.repMax, kg: 0, rest: e.rest }, S.session.startedAt); S.session.exercises.push(se); persistSession(); }
      toast('Added ' + e.name); render();
    },
    exInfo(el) { openModal(exDetail(exById(el.dataset.id))); },
    exInfoId(el) { openModal(exDetail(exById(el.dataset.id))); },
    exForm(el) { openModal(exFormHtml(el.dataset.id ? exById(el.dataset.id) : null)); },
    delEx(el) { if (confirm('Delete this custom exercise?')) { remove('customExercises', el.dataset.id); closeModal(); render(); } },
    startRoutine(el) { if (S.session && !confirm('Replace the workout in progress?')) return; const r = D.routines.find((x) => x.id === el.dataset.id); startSession(r.name, r.items); },
    quickSession() { if (S.session && !confirm('Replace the workout in progress?')) return; startSession('Quick workout', []); },
    resume() { S.tab = 'workout'; S.wsub = 'session'; render(); },
    toggleSet(el) {
      const se = S.session.exercises[num(el.dataset.i)], st = se.sets[num(el.dataset.j)];
      st.done = !st.done; persistSession();
      if (st.done && se.rest > 0) { S.restEnd = Date.now() + se.rest * 1000; tickRest(); }
      render();
    },
    skipRest() { S.restEnd = 0; $('#restbar').hidden = true; },
    addSet(el) { const se = S.session.exercises[num(el.dataset.i)], l = se.sets[se.sets.length - 1] || { kg: 0, reps: se.repMin }; se.sets.push({ kg: l.kg, reps: l.reps, done: false }); persistSession(); render(); },
    skipEx(el) { const se = S.session.exercises[num(el.dataset.i)]; se.skipped = !se.skipped; persistSession(); render(); },
    rmSessEx(el) { S.session.exercises.splice(num(el.dataset.i), 1); persistSession(); render(); },
    finish() { finishSession(); },
    discard() { if (confirm('Discard this workout? Logged sets will be lost.')) { S.session = null; DB.del('kv', 'activeSession'); S.wsub = 'main'; S.restEnd = 0; $('#restbar').hidden = true; render(); } },
    delSession(el) { if (confirm('Delete this workout from history?')) { remove('sessions', el.dataset.id); render(); } },
    nday(el) { S.nDate = addDays(S.nDate, num(el.dataset.k)); render(); },
    addFood(el) { S.fAdd = { meal: el.dataset.k, q: '', food: null }; openModal(foodSearchHtml()); },
    customFood() { openModal(customFoodHtml()); },
    pickFood(el) { const f = foodById(el.dataset.id); S.fAdd.food = f; openModal(foodQtyHtml(f, f.serving, '')); },
    editFood(el) { const e = D.foodLog.find((x) => x.id === el.dataset.id); const f = foodById(e.foodId) || { id: e.foodId, name: e.name, state: e.state || '', kcal: e.grams ? (e.kcal / e.grams) * 100 : 0, protein: (e.p / e.grams) * 100, carbs: (e.c / e.grams) * 100, fat: (e.f / e.grams) * 100, fibre: ((e.fib || 0) / e.grams) * 100, serving: 100, servingLabel: '100 g' }; S.fAdd = { meal: e.meal, q: '', food: f }; openModal(foodQtyHtml(f, e.grams, e.id)); },
    delFood(el) { remove('foodLog', el.dataset.id); render(); },
    repeatMeal(el) {
      const k = el.dataset.k, prevDate = addDays(S.nDate, -1);
      const es = D.foodLog.filter((e) => e.date === prevDate && e.meal === k);
      if (!es.length) { toast('Nothing logged for this meal on the previous day'); return; }
      es.forEach((e) => save('foodLog', Object.assign({}, e, { id: uid(), date: S.nDate }))); render(); toast('Copied ' + es.length + ' item(s)');
    },
    psub(el) { S.psub = el.dataset.k; render(); },
    range(el) { S.range = num(el.dataset.k); render(); },
    logWeight() { const v = num($('#wv').value), d = $('#wd').value || todayStr(); if (!validW(v)) return; if (d > todayStr()) { toast('Date is in the future'); return; } logW(d, fromW(v)); render(); toast('Weight logged'); },
    delWeight(el) { remove('weights', el.dataset.id); render(); },
    applyKcal(el) { const T = targets(); D.profile.calOverride = Math.max(1200, T.kcal + num(el.dataset.k)); saveKV('profile', D.profile); toast('Target is now ' + D.profile.calOverride + ' kcal'); render(); },
    delMeasures() { if (confirm('Delete all body measurements?')) { D.measures.slice().forEach((m) => remove('measures', m.id)); render(); } },
    delCardio(el) { remove('cardio', el.dataset.id); render(); },
    exportData() { const out = { app: 'IRONMIND', version: 1, exportedAt: new Date().toISOString(), profile: D.profile, settings: D.settings }; STORES.filter((s) => s !== 'kv').forEach((s) => { out[s] = D[s]; }); download('ironmind-backup-' + todayStr() + '.json', JSON.stringify(out, null, 2)); },
    wipe() { if (!confirm('Delete ALL your IRONMIND data from this device? This cannot be undone.')) return; Promise.all(STORES.map((s) => DB.clear(s))).then(() => { try { localStorage.removeItem('im_theme'); } catch (e) { /* ignore */ } location.reload(); }); }
  };

  function validW(v) { if (!(v > 0) || fromW(v) < 25 || fromW(v) > 350) { toast('Please enter a realistic weight'); return false; } return true; }
  function logW(date, kg) { save('weights', { id: date, kg: Math.round(kg * 100) / 100 }); }

  const CHG = {
    units(el) { D.settings.units = el.value; saveKV('settings', D.settings); render(); },
    libf(el) { S.lf[el.dataset.f] = el.value; $('#libres').innerHTML = libResults(); },
    pickcat(el) { S.pick.cat = el.value; $('#pickres').innerHTML = pickResults(); },
    theme(el) { try { if (el.value) localStorage.setItem('im_theme', el.value); else localStorage.removeItem('im_theme'); } catch (e) { /* ignore */ } if (el.value) document.documentElement.setAttribute('data-theme', el.value); else document.documentElement.removeAttribute('data-theme'); },
    cardioTarget(el) { D.settings.cardioWeeklyMin = Math.max(0, num(el.value, 150)); saveKV('settings', D.settings); render(); },
    importData(el) {
      const f = el.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const j = JSON.parse(rd.result);
          if (j.app !== 'IRONMIND') throw new Error('not an IRONMIND backup');
          if (!confirm('Replace current data with this backup?')) return;
          Promise.all(STORES.map((s) => DB.clear(s))).then(async () => {
            if (j.profile) await saveKV('profile', j.profile);
            if (j.settings) await saveKV('settings', j.settings);
            for (const s of STORES.filter((x) => x !== 'kv')) for (const o of (j[s] || [])) if (o && o.id) await DB.put(s, o);
            location.reload();
          });
        } catch (e) { toast('That file is not a valid IRONMIND backup'); }
      };
      rd.readAsText(f);
    }
  };
  const INP = {
    libq(el) { S.lf.q = el.value; $('#libres').innerHTML = libResults(); },
    pickq(el) { S.pick.q = el.value; $('#pickres').innerHTML = pickResults(); },
    foodq(el) { S.fAdd.q = el.value; $('#foodres').innerHTML = foodResults(); },
    qty() { const f = S.fAdd.food; const g = num($('#gq').value); $('#pq').value = r1(g / f.serving); updatePrev(); },
    portions() { const f = S.fAdd.food; $('#gq').value = r0(num($('#pq').value) * f.serving); updatePrev(); }
  };

  const SUBMIT = {
    saveProfile(form, o) {
      const age = num(o.age), h = fromL(num(o.height)), w = fromW(num(o.weight));
      if (age < 13 || age > 100) return toast('Age must be between 13 and 100');
      if (h < 100 || h > 250) return toast('Please enter a realistic height');
      if (w < 25 || w > 350) return toast('Please enter a realistic weight');
      const old = D.profile || {};
      const equip = [].concat(o.equip || []);
      D.profile = Object.assign({}, old, { age, sex: o.sex, heightCm: Math.round(h * 10) / 10, weightKg: Math.round(w * 10) / 10, activity: o.activity, exp: o.exp, goal: o.goal, diet: o.diet, equip: equip.length ? equip : ['Bodyweight only'], location: o.location, minutes: num(o.minutes, 45), budget: o.budget || '' });
      saveKV('profile', D.profile);
      const ws = sortedWeights();
      if (!ws.length || Math.abs(ws[ws.length - 1].kg - w) > 0.05) logW(todayStr(), w);
      if (age < 18) toast('Under 18? Please check training and nutrition plans with a doctor or parent.');
      else toast('Profile saved');
      S.tab = old.age ? 'profile' : 'home'; render();
    },
    saveTargets(form, o) { D.profile.calOverride = o.cal ? num(o.cal) : null; D.profile.proteinOverride = o.pro ? num(o.pro) : null; saveKV('profile', D.profile); toast('Targets saved'); render(); },
    plan(form, o) {
      const T = targets(), tk = fromW(num(o.target)), weeks = num(o.weeks, 12), p = Calc.fatLossPlan(T.kg, tk, weeks);
      if (p.valid) { D.profile.targetKg = Math.round(tk * 10) / 10; saveKV('profile', D.profile); }
      const target = p.valid ? Math.max(T.tdee - p.kcalDeficit, Math.max(1200, T.bmr)) : 0;
      const html = !p.valid ? `<p class="warn">${esc(p.message)}</p>` : `<p class="${p.tooFast ? 'warn' : ''}">${esc(p.message)}</p>
        <div class="kv"><span>Maintenance</span><b>${T.tdee} kcal</b></div><div class="kv"><span>Suggested intake</span><b>${p.tooFast ? 'use a longer timeline' : r0(target) + ' kcal'}</b></div>
        <div class="kv"><span>Protein</span><b>${T.pr.min}–${T.pr.max} g</b></div><div class="kv"><span>Strength training</span><b>3–4 days/week</b></div><div class="kv"><span>Cardio</span><b>150–250 min/week + daily steps</b></div>
        <div class="kv"><span>Expected range</span><b>${r1(toW(T.kg * 0.0025))}–${r1(toW(T.kg * 0.01))} ${uW()}/week</b></div>
        <p class="small muted">Fat can't be spot-reduced. No crash diets: very large deficits cost muscle and energy. Reassess weekly using 7-day averages.</p>`;
      S.plan = { weeks, html }; render();
    },
    saveEx(form, o) {
      const steps = (o.steps || '').split('\n').map((x) => x.trim()).filter(Boolean);
      const e = { id: o.id || 'c-' + uid(), name: o.name.trim(), cat: o.cat, primary: (o.primary || '').split(',').map((x) => x.trim()).filter(Boolean), secondary: [], equipment: o.equipment || 'Bodyweight', difficulty: 'Custom', kind: 'compound', style: 'free',
        steps: steps.length ? steps : ['Perform with controlled technique.'], mistakes: [], beginnerAlt: '', advanced: '', homeAlt: '', sets: num(o.sets, 3), repMin: num(o.repMin, 8), repMax: Math.max(num(o.repMin, 8), num(o.repMax, 12)), rest: num(o.rest, 90),
        breathing: 'Breathe steadily; exhale on effort.', safety: 'Use a load you can control. Stop if you feel sharp or joint pain.', custom: true };
      save('customExercises', e); closeModal(); render(); toast('Exercise saved');
    },
    saveFood(form, o) {
      const f = foodById(o.foodId) || S.fAdd.food, g = num(o.grams);
      if (!(g > 0)) return toast('Enter the amount in grams');
      const m = macrosFor(f, g);
      const base = { foodId: f.id, name: f.name, state: f.state, grams: g, kcal: r1(m.kcal), p: r1(m.p), c: r1(m.c), f: r1(m.f), fib: r1(m.fib) };
      if (o.editId) { const old = D.foodLog.find((x) => x.id === o.editId); save('foodLog', Object.assign({}, old, base)); }
      else save('foodLog', Object.assign({ id: uid(), date: S.nDate, meal: S.fAdd.meal }, base));
      closeModal(); render();
    },
    saveCustomFood(form, o) {
      const f = { id: 'c-' + uid(), name: o.name.trim(), state: o.state, kcal: num(o.kcal), protein: num(o.protein), carbs: num(o.carbs), fat: num(o.fat), fibre: num(o.fibre), serving: Math.max(1, num(o.serving, 100)), servingLabel: num(o.serving, 100) + ' g', diet: 'vegan', source: 'Custom (entered by you)' };
      save('customFoods', f); S.fAdd.food = f; openModal(foodQtyHtml(f, f.serving, ''));
    },
    saveMeasure(form, o) {
      const rec = { id: todayStr() }; let any = false;
      BODY.forEach(([k]) => { const v = num(o[k]); if (v > 0) { rec[k] = Math.round(fromL(v) * 10) / 10; any = true; } });
      if (!any) return toast('Enter at least one measurement');
      const old = D.measures.find((m) => m.id === rec.id); save('measures', Object.assign({}, old, rec)); render(); toast('Saved');
    },
    saveCardio(form, o) {
      const min = num(o.min); if (!(min > 0)) return toast('Enter minutes');
      const kcal = Calc.cardioKcal(o.activity, min, curKg(), num(o.intensity, 1));
      save('cardio', { id: uid(), date: todayStr(), activity: o.activity, min, km: num(o.km) || 0, intensity: num(o.intensity, 1), steps: num(o.steps) || 0, kcal }); render(); toast('Logged (~' + kcal + ' kcal, estimate)');
    },
    saveRecovery(form, o) { save('recovery', { id: todayStr(), sleep: num(o.sleep) || 0, soreness: num(o.soreness, 2), fatigue: num(o.fatigue, 2) }); render(); toast('Saved'); }
  };

  /* ================= event wiring ================= */
  document.addEventListener('click', (e) => {
    if (e.target.id === 'modal') { closeModal(); return; }
    const el = e.target.closest('[data-act]'); if (!el) return;
    const fn = ACT[el.dataset.act]; if (fn) fn(el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.bind) {
      let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? 0 : num(el.value)) : el.value;
      if (el.dataset.w && typeof v === 'number') v = fromW(v);
      setPath(S, el.dataset.bind, v);
      if (el.dataset.persist) { persistSession(); if (el.type === 'checkbox') render(); }
    }
    if (el.dataset.chg && CHG[el.dataset.chg]) CHG[el.dataset.chg](el);
  });
  document.addEventListener('input', (e) => { const el = e.target; if (el.dataset.inp && INP[el.dataset.inp]) INP[el.dataset.inp](el); });
  document.addEventListener('submit', (e) => {
    const f = e.target; if (!f.dataset.submit) return;
    e.preventDefault(); SUBMIT[f.dataset.submit](f, formObj(f));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

  /* ================= boot ================= */
  async function boot() {
    await DB.open();
    try {
      for (const s of STORES) {
        const rows = await DB.all(s);
        if (s === 'kv') {
          rows.forEach((r) => {
            if (r.id === 'profile') { const { id, ...rest } = r; D.profile = rest; }
            if (r.id === 'settings') { const { id, ...rest } = r; D.settings = Object.assign({ units: 'metric' }, rest); }
            if (r.id === 'activeSession') S.session = r.session;
          });
        } else D[s] = rows;
      }
    } catch (err) { toast('Could not read saved data on this device.'); }
    render();
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.IRONMIND_DEBUG = { D, S };
  boot();
})();
