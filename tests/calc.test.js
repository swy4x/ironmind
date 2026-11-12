// Run with: node tests/calc.test.js
const assert = require('assert');
const C = require('../calc.js');

// Mifflin-St Jeor: 80kg, 175cm, 30y male = 800 + 1093.75 - 150 + 5 = 1748.75
assert.strictEqual(C.bmr('male', 80, 175, 30), 1748.75);
assert.strictEqual(C.bmr('female', 60, 165, 28), 600 + 1031.25 - 140 - 161);

// TDEE
assert.ok(Math.abs(C.tdee(1748.75, 'moderate') - 1748.75 * 1.55) < 1e-9);

// Calorie target: fat loss is -20% but never below BMR / 1200
const b = C.bmr('male', 80, 175, 30);
const t = C.tdee(b, 'sedentary');
const ct = C.calorieTarget(b, t, 'lose_fat');
assert.ok(ct.target >= b, 'deficit must not go below BMR');
const ct2 = C.calorieTarget(1400, 1700, 'lose_fat');
assert.strictEqual(ct2.target, 1400);
assert.strictEqual(ct2.floored, true);
assert.ok(C.calorieTarget(1700, 2500, 'build_muscle').target > 2500);

// Protein: 80 kg, muscle → 128–176 g (matches the spec example)
const pr = C.proteinRange(80, 'build_muscle', 'intermediate');
assert.strictEqual(pr.min, 128);
assert.strictEqual(pr.max, 176);

// Macros add up roughly to kcal
const m = C.macros(2400, 150, 80);
const kcal = m.protein * 4 + m.carbs * 4 + m.fat * 9;
assert.ok(Math.abs(kcal - 2400) < 20, 'macros should sum to calories, got ' + kcal);

// Weight trend: steady loss of 0.5 kg/week
const e = [];
for (let i = 0; i < 28; i++) {
  const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
  e.push({ date: d, kg: 80 - (0.5 / 7) * i });
}
assert.ok(Math.abs(C.weeklyRate(e) + 0.5) < 0.01);
assert.strictEqual(C.adaptiveAdvice(e, 'lose_fat').status, 'on-track');
assert.strictEqual(C.adaptiveAdvice(e.slice(0, 3), 'lose_fat').status, 'insufficient');

// One noisy day must not trigger a change with too little data
assert.strictEqual(C.adaptiveAdvice([{ date: '2026-01-01', kg: 80 }, { date: '2026-01-02', kg: 82 }], 'lose_fat').kcalChange, 0);

// Fat loss plan sanity
assert.strictEqual(C.fatLossPlan(80, 70, 4).tooFast, true);
assert.strictEqual(C.fatLossPlan(80, 72, 16).tooFast, false);

// Overload
assert.strictEqual(C.suggestOverload([{ kg: 50, reps: 12 }, { kg: 50, reps: 12 }], 8, 12).action, 'increase');
assert.strictEqual(C.suggestOverload([{ kg: 50, reps: 12 }], 8, 12, { pain: true }).action, 'reduce');
assert.strictEqual(C.suggestOverload([{ kg: 50, reps: 12 }], 8, 12, { highFatigue: true }).action, 'maintain');
assert.strictEqual(C.suggestOverload([{ kg: 50, reps: 9 }], 8, 12).action, 'maintain');

// Volume / 1RM
assert.strictEqual(C.volume([{ kg: 50, reps: 10 }, { kg: 50, reps: 8 }, { kg: 45, reps: 10 }]), 1350);
assert.ok(C.epley1RM(100, 5) > 100);

// Cardio estimate
assert.strictEqual(C.cardioKcal('Walking', 60, 70, 1), 245);

console.log('All calculation tests passed.');
