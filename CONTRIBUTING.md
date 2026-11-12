# Contributing

Bug reports and ideas: open a GitHub issue. Pull requests welcome.

- Keep calculations in `calc.js` (pure functions) and add a test in `tests/calc.test.js`; run `node tests/calc.test.js`.
- Food data: cite a licensed source (USDA FoodData Central, IFCT, etc.), keep raw and cooked entries separate, values per 100 g.
- Exercises: follow the fields in `data.js`; never add medical claims.
- Never commit secrets or personal data. The app must keep working with no backend.
- Safety: no crash-diet advice, no diagnosing, no spot-reduction claims.
