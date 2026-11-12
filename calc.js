/* IRONMIND calculation engine — pure functions, no DOM, no storage.
   All outputs are estimates, not medical advice. */
(function (root) {
  'use strict';

  const ACTIVITY = {
    sedentary: { factor: 1.2, label: 'Sedentary (desk job, little exercise)' },
    light: { factor: 1.375, label: 'Lightly active (1–3 sessions/week)' },
    moderate: { factor: 1.55, label: 'Moderately active (3–5 sessions/week)' },
    very: { factor: 1.725, label: 'Very active (6–7 sessions/week)' },
    extreme: { factor: 1.9, label: 'Extremely active (physical job + training)' }
  };

  // adj = fraction of TDEE added (+) or removed (-)
  const GOALS = {
    build_muscle: { label: 'Build muscle', adj: 0.10 },
    lose_fat: { label: 'Lose fat', adj: -0.20 },
    gain_weight: { label: 'Gain weight', adj: 0.15 },
    maintain: { label: 'Maintain weight', adj: 0 },
    recomp: { label: 'Body recomposition', adj: -0.05 },
    strength: { label: 'Improve strength', adj: 0.05 },
    endurance: { label: 'Improve endurance', adj: 0 },
    general: { label: 'General fitness', adj: 0 }
  };

  const round = (n, d = 0) => { const m = Math.pow(10, d); return Math.round(n * m) / m; };

  /** Mifflin-St Jeor */
  function bmr(sex, kg, cm, age) {
    return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161);
  }

  function tdee(bmrValue, activity) {
    return bmrValue * (ACTIVITY[activity] ? ACTIVITY[activity].factor : 1.2);
  }

  /** Moderate, sustainable target. Never below BMR or an absolute 1200 kcal floor. */
  function calorieTarget(bmrValue, tdeeValue, goal) {
    const adj = (GOALS[goal] || GOALS.maintain).adj;
    let kcal = tdeeValue * (1 + adj);
    let floored = false;
    const floor = Math.max(1200, bmrValue);
    if (adj < 0 && kcal < floor) { kcal = floor; floored = true; }
    return { target: round(kcal), adj, floored };
  }

  /** Educational protein range in g/day. */
  function proteinRange(kg, goal, experience) {
    const high = ['build_muscle', 'lose_fat', 'recomp', 'strength', 'gain_weight'];
    let lo, hi;
    if (high.includes(goal)) { lo = 1.6; hi = 2.2; } else { lo = 1.2; hi = 1.6; }
    if (experience === 'beginner' && goal !== 'lose_fat') hi = Math.min(hi, 2.0);
    const point = goal === 'lose_fat' ? 0.75 : 0.5; // favour higher protein in a deficit
    const perKg = lo + (hi - lo) * point;
    return {
      perKgLow: lo, perKgHigh: hi,
      min: round(lo * kg), max: round(hi * kg), target: round(perKg * kg)
    };
  }

  /** Fat = max(25% kcal, 0.6 g/kg); carbs = remainder. */
  function macros(kcal, proteinG, kg) {
    const fat = Math.max((0.25 * kcal) / 9, 0.6 * kg);
    const carbs = Math.max(0, (kcal - proteinG * 4 - fat * 9) / 4);
    return { protein: round(proteinG), fat: round(fat), carbs: round(carbs), fibre: round((14 * kcal) / 1000) };
  }

  function waterTarget(kg) { return Math.round((kg * 35) / 250) * 250; } // ml

  /* ---------- weight trends ---------- */
  const dayNum = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 86400000);

  /** entries: [{date:'YYYY-MM-DD', kg}] */
  function sortEntries(entries) { return entries.slice().sort((a, b) => (a.date < b.date ? -1 : 1)); }

  function movingAverage(entries, days = 7) {
    const e = sortEntries(entries);
    return e.map((x) => {
      const d = dayNum(x.date);
      const win = e.filter((y) => dayNum(y.date) <= d && dayNum(y.date) > d - days);
      return { date: x.date, kg: x.kg, avg: win.reduce((s, y) => s + y.kg, 0) / win.length };
    });
  }

  function averageBetween(entries, fromDate, toDate) {
    const a = dayNum(fromDate), b = dayNum(toDate);
    const w = entries.filter((x) => dayNum(x.date) >= a && dayNum(x.date) <= b);
    return w.length ? w.reduce((s, y) => s + y.kg, 0) / w.length : null;
  }

  /** kg/week from linear regression over the last `windowDays`. null if not enough data. */
  function weeklyRate(entries, windowDays = 28) {
    const e = sortEntries(entries);
    if (e.length < 5) return null;
    const last = dayNum(e[e.length - 1].date);
    const w = e.filter((x) => dayNum(x.date) > last - windowDays);
    if (w.length < 5 || dayNum(w[w.length - 1].date) - dayNum(w[0].date) < 10) return null;
    const xs = w.map((x) => dayNum(x.date) - dayNum(w[0].date));
    const ys = w.map((x) => x.kg);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    return den === 0 ? null : (num / den) * 7;
  }

  /** Gradual advice — never reacts to one day's weight. */
  function adaptiveAdvice(entries, goal) {
    const rate = weeklyRate(entries);
    if (rate === null) {
      return { status: 'insufficient', rate: null, kcalChange: 0,
        message: 'Log your weight on at least 5 days across 2+ weeks to unlock trend-based advice. Daily changes are mostly water and are not meaningful on their own.' };
    }
    const cur = sortEntries(entries).slice(-1)[0].kg;
    const pct = (rate / cur) * 100;
    const r = round(rate, 2);
    if (goal === 'lose_fat' || goal === 'recomp') {
      if (pct > -0.1) return { status: 'slow', rate: r, kcalChange: -100,
        message: `Your trend is ${r} kg/week — slower than planned. Check logging accuracy first; if it's accurate for 2 more weeks, consider reducing about 100 kcal/day or adding daily steps.` };
      if (pct < -1) return { status: 'fast', rate: r, kcalChange: 100,
        message: `Your trend is ${r} kg/week — faster than the usual 0.25–1% of body weight per week. Consider adding about 100 kcal/day to protect muscle and energy.` };
      return { status: 'on-track', rate: r, kcalChange: 0, message: `On track: trend is ${r} kg/week. Keep going and review again next week.` };
    }
    if (goal === 'build_muscle' || goal === 'gain_weight' || goal === 'strength') {
      if (pct < 0.05) return { status: 'slow', rate: r, kcalChange: 100,
        message: `Your trend is ${r} kg/week — not gaining yet. If logging is accurate, consider adding about 100 kcal/day.` };
      if (pct > 0.5) return { status: 'fast', rate: r, kcalChange: -100,
        message: `Your trend is +${r} kg/week — faster than needed for lean gain. Consider trimming about 100 kcal/day to limit fat gain.` };
      return { status: 'on-track', rate: r, kcalChange: 0, message: `On track: trend is +${r} kg/week.` };
    }
    if (Math.abs(pct) > 0.25) return { status: 'drift', rate: r, kcalChange: pct > 0 ? -100 : 100,
      message: `Your weight is drifting (${r} kg/week). For maintenance, a ~100 kcal/day change ${pct > 0 ? 'down' : 'up'} may help.` };
    return { status: 'on-track', rate: r, kcalChange: 0, message: `Stable: trend is ${r} kg/week.` };
  }

  /** Timeline sanity check for a fat-loss goal. */
  function fatLossPlan(currentKg, targetKg, weeks) {
    const diff = currentKg - targetKg;
    if (diff <= 0) return { valid: false, message: 'Target weight is not below current weight.' };
    const weeklyKg = diff / weeks;
    const pct = (weeklyKg / currentKg) * 100;
    const minWeeks = Math.ceil(diff / (currentKg * 0.01));
    const kcalPerDay = round((weeklyKg * 7700) / 7);
    return {
      valid: true, weeklyKg: round(weeklyKg, 2), pctPerWeek: round(pct, 2), kcalDeficit: kcalPerDay,
      tooFast: pct > 1, minWeeks,
      message: pct > 1
        ? `That's ${round(pct, 2)}% of body weight per week — too aggressive. Plan for at least ${minWeeks} weeks.`
        : `Needs about ${round(weeklyKg, 2)} kg/week (~${kcalPerDay} kcal/day deficit). Realistic range: 0.25–1% of body weight per week.`
    };
  }

  /* ---------- training ---------- */
  const epley1RM = (kg, reps) => (reps <= 1 ? kg : kg * (1 + reps / 30));
  const volume = (sets) => sets.reduce((s, x) => s + (x.done === false ? 0 : (x.kg || 0) * (x.reps || 0)), 0);

  /**
   * Conservative progressive-overload suggestion.
   * lastSets: [{kg,reps}] working sets from the previous session.
   * flags: {pain, highFatigue}
   */
  function suggestOverload(lastSets, repMin, repMax, flags = {}) {
    const sets = (lastSets || []).filter((s) => s.kg > 0 && s.reps > 0);
    if (!sets.length) return { action: 'none', kg: null, message: 'No history yet — start light and focus on technique.' };
    const topKg = Math.max(...sets.map((s) => s.kg));
    if (flags.pain) return { action: 'reduce', kg: round(topKg * 0.9, 1),
      message: 'You flagged pain last time. Reduce the load, check technique, and stop if it persists — see a professional for lasting pain.' };
    if (flags.highFatigue) return { action: 'maintain', kg: topKg, message: 'Recovery looks low. Hold the same weight today.' };
    if (sets.every((s) => s.reps >= repMax)) {
      const inc = Math.max(1.25, round((topKg * 0.025) / 1.25) * 1.25);
      return { action: 'increase', kg: round(topKg + inc, 2),
        message: `You hit the top of the rep range on every set. If form was clean, try ${round(topKg + inc, 2)} kg.` };
    }
    if (sets.some((s) => s.reps < repMin)) return { action: 'maintain', kg: topKg,
      message: `Some sets fell below ${repMin} reps. Keep ${topKg} kg (or drop ~5%) and rebuild reps.` };
    return { action: 'maintain', kg: topKg, message: `Keep ${topKg} kg and add reps first; aim for ${repMax} on every set.` };
  }

  /* ---------- cardio ---------- */
  const MET = {
    Walking: [2.8, 3.5, 4.3], Running: [8.0, 9.8, 11.5], Treadmill: [4.3, 8.3, 10.0], Cycling: [5.8, 8.0, 10.0],
    'Stair climbing': [5.0, 8.8, 9.0], Swimming: [5.8, 8.0, 10.0], Skipping: [8.8, 11.8, 12.3], Rowing: [4.8, 7.0, 8.5],
    Sports: [4.5, 6.5, 8.5], Other: [3.5, 5.5, 7.5]
  };
  /** intensity 0 low, 1 moderate, 2 high. Rough estimate only. */
  function cardioKcal(activity, minutes, kg, intensity = 1) {
    const m = MET[activity] || MET.Other;
    return round(m[intensity] * kg * (minutes / 60));
  }

  root.Calc = { ACTIVITY, GOALS, MET, round, bmr, tdee, calorieTarget, proteinRange, macros, waterTarget,
    movingAverage, averageBetween, weeklyRate, adaptiveAdvice, fatLossPlan, epley1RM, volume, suggestOverload, cardioKcal, dayNum };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Calc;
})(typeof window !== 'undefined' ? window : globalThis);
