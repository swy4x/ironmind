/* IRONMIND built-in data: exercises, foods, routine templates.
   Food values are rounded reference values per 100 g (USDA FoodData Central / IFCT-style public data).
   They are approximations — brands, recipes and cooking methods vary. Verify before relying on them. */
(function (root) {
  'use strict';

  const CATS = {
    chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
    core: 'Abs & core', quads: 'Quadriceps', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
    full: 'Full body', cardio: 'Cardio', mobility: 'Mobility & flexibility'
  };

  const S = (s) => s.split('|');
  const P = (s) => s.split(',');

  // id, name, cat, primary, secondary, equipment, difficulty, kind, style, steps, mistakes, beginnerAlt, advanced, homeAlt, sets, repMin, repMax, rest(s)
  const rows = [
    ['bench', 'Barbell Bench Press', 'chest', 'Chest', 'Triceps,Front delts', 'Barbell', 'Intermediate', 'compound', 'free',
      'Lie on the bench, eyes under the bar, feet flat, shoulder blades pinched back|Grip slightly wider than shoulders and unrack with straight arms|Lower the bar under control to mid-chest|Press up until arms are straight, wrists stacked over elbows',
      'Bouncing the bar off the chest|Flaring elbows out to 90°|Lifting hips off the bench', 'Dumbbell Bench Press', 'Paused reps, tempo reps', 'Push-up', 4, 6, 10, 150],
    ['db-bench', 'Dumbbell Bench Press', 'chest', 'Chest', 'Triceps,Front delts', 'Dumbbells', 'Beginner', 'compound', 'free',
      'Sit with dumbbells on thighs, lie back and bring them to chest level|Press up until arms are extended over the chest|Lower slowly until elbows are just below the bench|Keep wrists neutral and feet planted',
      'Letting dumbbells drift too wide|Rushing the lowering phase', 'Machine Chest Press', 'Heavier dumbbells, slower lowering', 'Push-up', 3, 8, 12, 120],
    ['incline-db', 'Incline Dumbbell Press', 'chest', 'Upper chest', 'Triceps,Front delts', 'Dumbbells', 'Intermediate', 'compound', 'free',
      'Set the bench to about 30°, dumbbells at shoulder level|Press up and slightly inward|Lower under control to a deep but comfortable stretch|Keep ribs down and back against the bench',
      'Bench set too steep (turns into a shoulder press)|Arching the lower back', 'Machine Chest Press', 'Pause at the bottom', 'Feet-elevated push-up', 3, 8, 12, 120],
    ['pushup', 'Push-up', 'chest', 'Chest', 'Triceps,Front delts,Core', 'Bodyweight', 'Beginner', 'compound', 'bodyweight',
      'Hands slightly wider than shoulders, body in a straight line from head to heels|Lower the chest toward the floor with elbows about 45° from the body|Press back up until arms are straight|Keep abs and glutes tight',
      'Sagging hips|Flaring elbows|Partial range of motion', 'Incline push-up (hands on a bench)', 'Feet-elevated, weighted or archer push-up', 'Push-up (this is the home exercise)', 3, 8, 15, 90],
    ['db-fly', 'Dumbbell Fly', 'chest', 'Chest', 'Front delts', 'Dumbbells', 'Intermediate', 'isolation', 'free',
      'Lie on a flat bench, dumbbells above the chest with a slight elbow bend|Open the arms in a wide arc until you feel a chest stretch|Squeeze the chest to bring the dumbbells back together|Keep the elbow bend constant throughout',
      'Going too heavy|Lowering too deep and straining the shoulders', 'Machine Pec Deck', 'Cable fly with a pause', 'Band chest fly', 3, 10, 15, 75],
    ['machine-chest', 'Machine Chest Press', 'chest', 'Chest', 'Triceps,Front delts', 'Machine', 'Beginner', 'compound', 'machine',
      'Adjust the seat so handles are at mid-chest height|Press handles forward until arms are nearly straight|Return slowly until you feel a stretch across the chest|Keep back flat against the pad',
      'Seat set too high or low|Shrugging the shoulders', 'This is the beginner option', 'Slow negatives, drop sets', 'Push-up', 3, 8, 12, 90],

    ['pullup', 'Pull-up', 'back', 'Lats', 'Biceps,Upper back,Forearms', 'Bodyweight', 'Advanced', 'compound', 'bodyweight',
      'Hang from a bar with an overhand grip slightly wider than shoulders|Pull your elbows down and chest toward the bar|Pause briefly at the top|Lower fully under control',
      'Kipping or swinging|Half reps|Shrugging shoulders to ears', 'Lat Pulldown or band-assisted pull-up', 'Weighted pull-ups', 'Doorframe/towel rows or band pulldown', 3, 5, 10, 120],
    ['lat-pulldown', 'Lat Pulldown', 'back', 'Lats', 'Biceps,Upper back', 'Cable', 'Beginner', 'compound', 'machine',
      'Sit with thighs secured, grip the bar slightly wider than shoulders|Lean back slightly and pull the bar to upper chest|Drive elbows down and back|Return slowly to full arm extension',
      'Pulling behind the neck|Leaning back too far and swinging', 'Band pulldown', 'Single-arm pulldown', 'Resistance-band pulldown', 3, 8, 12, 90],
    ['bb-row', 'Barbell Row', 'back', 'Upper back,Lats', 'Biceps,Rear delts,Lower back', 'Barbell', 'Intermediate', 'compound', 'free',
      'Hinge at the hips with a flat back, bar hanging below the knees|Pull the bar toward your lower ribs|Squeeze shoulder blades together|Lower with control without rounding your back',
      'Rounding the lower back|Using momentum from the legs|Standing too upright', 'Seated Cable Row', 'Pendlay row', 'Backpack or dumbbell bent-over row', 4, 6, 10, 120],
    ['cable-row', 'Seated Cable Row', 'back', 'Upper back,Lats', 'Biceps,Rear delts', 'Cable', 'Beginner', 'compound', 'machine',
      'Sit tall with feet braced and knees slightly bent|Pull the handle to your lower ribs|Squeeze shoulder blades together|Return slowly while keeping your chest up',
      'Rocking the torso|Shrugging shoulders', 'Band row', 'Single-arm row with a pause', 'Resistance-band seated row', 3, 8, 12, 90],
    ['db-row', 'One-Arm Dumbbell Row', 'back', 'Lats,Upper back', 'Biceps,Rear delts', 'Dumbbells', 'Beginner', 'compound', 'free',
      'Place one hand and knee on a bench, flat back|Pull the dumbbell to your hip, elbow close to the body|Pause and squeeze at the top|Lower slowly to a full stretch',
      'Twisting the torso|Jerking the weight', 'Chest-supported row', 'Heavier with straps', 'Water-jug or backpack row', 3, 8, 12, 90],
    ['deadlift', 'Deadlift', 'back', 'Hamstrings,Glutes,Lower back', 'Upper back,Forearms,Core', 'Barbell', 'Advanced', 'compound', 'free',
      'Stand with bar over mid-foot, hinge down and grip just outside the legs|Brace your core, flatten your back and push the floor away|Lock out hips and knees together|Lower the bar by pushing hips back, keeping it close to the legs',
      'Rounding the back|Jerking the bar off the floor|Bar drifting away from the body', 'Romanian Deadlift with light weight', 'Deficit or paused deadlift', 'Single-leg Romanian deadlift with dumbbells', 3, 3, 6, 180],

    ['ohp', 'Overhead Press', 'shoulders', 'Shoulders', 'Triceps,Upper chest,Core', 'Barbell', 'Intermediate', 'compound', 'free',
      'Bar at collarbone height, grip just outside shoulders, glutes and abs tight|Press the bar straight up, moving your head slightly back then through|Lock out overhead|Lower to the collarbone under control',
      'Leaning back excessively|Flaring ribs|Pressing the bar forward', 'Dumbbell Shoulder Press', 'Push press, strict paused press', 'Pike push-up', 3, 6, 10, 150],
    ['db-press', 'Dumbbell Shoulder Press', 'shoulders', 'Shoulders', 'Triceps,Upper chest', 'Dumbbells', 'Beginner', 'compound', 'free',
      'Sit with back supported, dumbbells at shoulder height|Press overhead until arms are straight|Lower slowly to ear level|Keep wrists stacked over elbows',
      'Arching the back|Clanging dumbbells together at the top', 'Machine shoulder press', 'Standing, single-arm press', 'Pike push-up', 3, 8, 12, 90],
    ['lat-raise', 'Dumbbell Lateral Raise', 'shoulders', 'Side delts', 'Upper traps', 'Dumbbells', 'Beginner', 'isolation', 'free',
      'Stand tall, dumbbells at sides with a slight elbow bend|Raise arms out to the sides to shoulder height|Pause briefly, lead with elbows|Lower slowly',
      'Swinging the body|Raising above shoulder height|Going too heavy', 'Cable or band lateral raise', 'Cable lateral raise, partial reps at the end', 'Water-bottle lateral raise', 3, 12, 20, 60],
    ['face-pull', 'Face Pull', 'shoulders', 'Rear delts', 'Upper back,Rotator cuff', 'Cable', 'Beginner', 'isolation', 'machine',
      'Set a rope at upper-chest height|Pull toward your face, elbows high and wide|Rotate hands outward at the end|Return slowly',
      'Pulling with the lower back|Too much weight and shrugging', 'Band face pull', 'Face pull with a pause', 'Resistance-band face pull', 3, 12, 20, 60],

    ['db-curl', 'Dumbbell Curl', 'biceps', 'Biceps', 'Forearms', 'Dumbbells', 'Beginner', 'isolation', 'free',
      'Stand tall with dumbbells at sides, palms forward|Curl up without moving the elbows forward|Squeeze at the top|Lower fully under control',
      'Swinging the torso|Half reps|Elbows drifting forward', 'Band curl', 'Incline curl, slow negatives', 'Backpack curl or band curl', 3, 8, 12, 60],
    ['bb-curl', 'Barbell Curl', 'biceps', 'Biceps', 'Forearms', 'Barbell', 'Beginner', 'isolation', 'free',
      'Hold the bar shoulder-width with palms up|Curl the bar toward the shoulders|Keep elbows pinned to your sides|Lower slowly',
      'Using hips to swing|Letting wrists bend', 'Dumbbell Curl', 'Drag curl', 'Band curl', 3, 8, 12, 60],
    ['hammer', 'Hammer Curl', 'biceps', 'Brachialis,Biceps', 'Forearms', 'Dumbbells', 'Beginner', 'isolation', 'free',
      'Hold dumbbells with palms facing each other|Curl up keeping the neutral grip|Squeeze at the top|Lower under control',
      'Swinging|Shrugging', 'Band hammer curl', 'Cross-body hammer curl', 'Water-jug hammer curl', 3, 8, 12, 60],

    ['pushdown', 'Triceps Pushdown', 'triceps', 'Triceps', '', 'Cable', 'Beginner', 'isolation', 'machine',
      'Stand facing the cable, elbows pinned to your sides|Push the handle down until arms are straight|Squeeze the triceps|Return until forearms are just past 90°',
      'Elbows flaring out|Leaning over the bar', 'Band pushdown', 'Single-arm pushdown', 'Band pushdown or bench dips', 3, 10, 15, 60],
    ['oh-tri', 'Overhead Triceps Extension', 'triceps', 'Triceps (long head)', '', 'Dumbbells', 'Intermediate', 'isolation', 'free',
      'Hold one dumbbell overhead with both hands|Lower behind your head by bending the elbows|Extend back up without flaring elbows|Keep ribs down',
      'Elbows flaring wide|Arching the back', 'Cable overhead extension', 'Single-arm version', 'Backpack overhead extension', 3, 10, 15, 60],
    ['close-pushup', 'Close-Grip Push-up', 'triceps', 'Triceps', 'Chest,Front delts', 'Bodyweight', 'Beginner', 'compound', 'bodyweight',
      'Hands about shoulder-width or slightly narrower, body straight|Lower with elbows tucked close to the ribs|Press back up fully|Keep core tight',
      'Hands too close causing wrist pain|Sagging hips', 'Incline close-grip push-up', 'Feet-elevated or weighted', 'This is the home exercise', 3, 8, 15, 75],

    ['wrist-curl', 'Wrist Curl', 'forearms', 'Forearm flexors', '', 'Dumbbells', 'Beginner', 'isolation', 'free',
      'Rest forearms on a bench, palms up, wrists off the edge|Curl the dumbbell up using only the wrists|Lower slowly to a stretch|Use light weight',
      'Going too heavy|Lifting forearms off the bench', 'Light weight, higher reps', 'Reverse wrist curl added', 'Water-bottle wrist curl', 3, 12, 20, 45],

    ['plank', 'Plank', 'core', 'Core', 'Shoulders,Glutes', 'Bodyweight', 'Beginner', 'isolation', 'bodyweight',
      'Forearms on the floor, elbows under shoulders|Body in a straight line, glutes and abs tight|Breathe steadily and hold|Stop when your form breaks (reps field = seconds/10)',
      'Sagging hips|Piking the hips up|Holding the breath', 'Knee plank', 'Weighted plank, long-lever plank', 'Plank (this is the home exercise)', 3, 3, 6, 60],
    ['crunch', 'Crunch', 'core', 'Rectus abdominis', '', 'Bodyweight', 'Beginner', 'isolation', 'bodyweight',
      'Lie on your back, knees bent, hands at your temples|Curl your ribcage toward your pelvis|Pause briefly at the top|Lower slowly',
      'Pulling on the neck|Using momentum', 'Dead Bug', 'Cable crunch', 'Crunch (home exercise)', 3, 12, 20, 45],
    ['knee-raise', 'Hanging Knee Raise', 'core', 'Lower abs', 'Hip flexors,Forearms', 'Bodyweight', 'Intermediate', 'isolation', 'bodyweight',
      'Hang from a bar with a firm grip|Tilt the pelvis and raise knees toward the chest|Lower slowly without swinging|Keep shoulders active',
      'Swinging|Only using hip flexors', 'Lying leg raise', 'Straight-leg raise', 'Lying leg raise', 3, 8, 15, 60],
    ['dead-bug', 'Dead Bug', 'core', 'Core', 'Hip flexors', 'Bodyweight', 'Beginner', 'isolation', 'bodyweight',
      'Lie on your back, arms up, knees bent at 90°|Lower the opposite arm and leg toward the floor|Keep lower back pressed down|Return and alternate',
      'Lower back arching|Moving too fast', 'Smaller range of motion', 'Add light weights', 'Dead bug (home exercise)', 3, 8, 12, 45],

    ['squat', 'Back Squat', 'quads', 'Quadriceps,Glutes', 'Hamstrings,Core,Lower back', 'Barbell', 'Intermediate', 'compound', 'free',
      'Bar across the upper back, feet shoulder-width, toes slightly out|Brace your core and sit down and back|Descend to at least parallel with knees tracking over toes|Drive up through the whole foot',
      'Knees caving in|Heels lifting|Rounding the lower back', 'Goblet Squat', 'Paused squat, front squat', 'Bodyweight squat or backpack squat', 4, 5, 8, 180],
    ['goblet', 'Goblet Squat', 'quads', 'Quadriceps,Glutes', 'Core', 'Dumbbells', 'Beginner', 'compound', 'free',
      'Hold a dumbbell at your chest, feet shoulder-width|Sit down between your hips keeping the chest tall|Reach a comfortable depth|Stand up by pushing through the floor',
      'Knees collapsing inward|Leaning forward', 'Box squat to a bench', 'Heavier weight, pauses', 'Backpack goblet squat', 3, 8, 15, 90],
    ['leg-press', 'Leg Press', 'quads', 'Quadriceps,Glutes', 'Hamstrings', 'Machine', 'Beginner', 'compound', 'machine',
      'Sit with back flat, feet shoulder-width on the platform|Lower the platform until knees are about 90°|Press up without locking knees hard|Keep hips on the seat',
      'Lower back rounding at the bottom|Locking knees violently', 'Lighter weight, shorter range', 'Single-leg press', 'Bodyweight squat', 3, 8, 15, 120],
    ['lunge', 'Walking Lunge', 'quads', 'Quadriceps,Glutes', 'Hamstrings,Core', 'Dumbbells', 'Intermediate', 'compound', 'free',
      'Stand tall, step forward into a long stride|Lower until both knees are about 90°|Push through the front foot and step into the next rep|Keep your torso upright',
      'Short steps|Front knee collapsing inward', 'Static split squat', 'Dumbbell/barbell loaded lunge', 'Bodyweight lunge', 3, 8, 12, 90],
    ['leg-ext', 'Leg Extension', 'quads', 'Quadriceps', '', 'Machine', 'Beginner', 'isolation', 'machine',
      'Sit with the pad on your lower shins|Extend your knees until legs are straight|Squeeze the quads|Lower slowly',
      'Swinging the weight|Hips lifting from the seat', 'Light weight, slow tempo', 'Single-leg extension', 'Wall sit', 3, 10, 15, 60],

    ['rdl', 'Romanian Deadlift', 'hamstrings', 'Hamstrings,Glutes', 'Lower back', 'Barbell', 'Intermediate', 'compound', 'free',
      'Stand tall holding the bar at the thighs|Push the hips back with knees softly bent|Lower until you feel a hamstring stretch, back flat|Drive the hips forward to stand',
      'Rounding the back|Bar drifting forward|Turning it into a squat', 'Dumbbell RDL', 'Single-leg RDL', 'Single-leg RDL with a backpack', 3, 8, 12, 120],
    ['leg-curl', 'Leg Curl', 'hamstrings', 'Hamstrings', 'Calves', 'Machine', 'Beginner', 'isolation', 'machine',
      'Lie or sit with the pad above the heels|Curl the pad toward your glutes|Squeeze at the top|Lower slowly',
      'Lifting hips off the pad|Using momentum', 'Light weight', 'Single-leg curl', 'Towel slider hamstring curl', 3, 10, 15, 60],

    ['hip-thrust', 'Hip Thrust', 'glutes', 'Glutes', 'Hamstrings', 'Barbell', 'Intermediate', 'compound', 'free',
      'Upper back on a bench, feet flat, bar over the hips|Drive hips up until the body is straight from shoulders to knees|Squeeze the glutes, chin tucked|Lower under control',
      'Overarching the lower back|Pushing through the toes', 'Glute Bridge', 'Single-leg or paused hip thrust', 'Glute Bridge', 3, 8, 12, 90],
    ['glute-bridge', 'Glute Bridge', 'glutes', 'Glutes', 'Hamstrings,Core', 'Bodyweight', 'Beginner', 'compound', 'bodyweight',
      'Lie on your back, knees bent, feet flat|Drive hips up squeezing the glutes|Pause at the top|Lower slowly',
      'Overarching the lower back|Pushing through the toes', 'Smaller range', 'Single-leg bridge, add weight', 'Glute bridge (home exercise)', 3, 12, 20, 60],

    ['calf-raise', 'Standing Calf Raise', 'calves', 'Calves', '', 'Machine', 'Beginner', 'isolation', 'machine',
      'Stand with balls of feet on a step or platform|Rise as high as you can|Pause at the top|Lower to a full stretch',
      'Bouncing|Short range of motion', 'Bodyweight calf raise', 'Single-leg, slow tempo', 'Bodyweight single-leg calf raise on a step', 3, 10, 20, 60],

    ['farmer', "Farmer's Carry", 'full', 'Grip,Traps,Core', 'Shoulders,Glutes', 'Dumbbells', 'Beginner', 'compound', 'free',
      'Hold heavy dumbbells at your sides|Stand tall with shoulders down and back|Walk with short controlled steps|Set down carefully',
      'Leaning to one side|Shrugging', 'Lighter weight, shorter distance', 'Heavier, uneven loads', 'Carry two filled bags', 3, 2, 4, 90],
    ['burpee', 'Burpee', 'full', 'Full body', 'Chest,Quads,Core', 'Bodyweight', 'Intermediate', 'compound', 'bodyweight',
      'Stand tall, squat and place hands on the floor|Jump or step feet back to a plank|Lower chest, press up, return feet|Jump up',
      'Sagging back in the plank|Rushing with poor form', 'Step-back burpee without push-up', 'Add push-up and tuck jump', 'Burpee (home exercise)', 3, 6, 12, 75],

    ['treadmill', 'Treadmill Walk/Run', 'cardio', 'Cardiovascular system', 'Legs', 'Cardio machine', 'Beginner', 'compound', 'machine',
      'Start with a 3–5 minute warm-up walk|Move at a pace where you can talk (easy) or speak in short sentences (moderate)|Keep posture tall, arms relaxed|Cool down for 3–5 minutes',
      'Holding the handrails|Overstriding', 'Walk at an easy pace', 'Intervals', 'Brisk walk outside', 1, 1, 1, 0],
    ['bike', 'Cycling', 'cardio', 'Cardiovascular system', 'Quads', 'Cardio machine', 'Beginner', 'compound', 'machine',
      'Adjust the seat so knees stay slightly bent at the bottom|Warm up for a few minutes|Hold a steady, sustainable effort|Cool down',
      'Seat too low|Gripping the bars tightly', 'Low resistance', 'Intervals', 'Outdoor cycling', 1, 1, 1, 0],
    ['skipping', 'Skipping Rope', 'cardio', 'Cardiovascular system', 'Calves,Shoulders', 'Other', 'Intermediate', 'compound', 'bodyweight',
      'Hold the handles at hip height|Turn with the wrists, small jumps|Land softly on the balls of the feet|Rest when form breaks',
      'Jumping too high|Big arm circles', 'Step-over without jumping', 'Double-unders', 'Skipping rope (home exercise)', 1, 1, 1, 0],

    ['cat-cow', 'Cat-Cow', 'mobility', 'Spine', 'Core', 'Bodyweight', 'Beginner', 'isolation', 'bodyweight',
      'Start on hands and knees|Round your back while exhaling|Arch your back while inhaling|Move slowly and smoothly',
      'Moving too fast|Forcing the range', 'Smaller range', 'Add thoracic rotation', 'Cat-cow (home exercise)', 2, 8, 12, 30],
    ['wgs', "World's Greatest Stretch", 'mobility', 'Hips,Thoracic spine', 'Hamstrings', 'Bodyweight', 'Beginner', 'isolation', 'bodyweight',
      'Step into a deep lunge|Place both hands inside the front foot|Rotate the chest and reach up|Switch sides',
      'Rushing|Letting the back knee drop and collapse', 'Shorter step', 'Longer holds', 'Do as is', 2, 5, 8, 30],
    ['hip-flexor', 'Hip Flexor Stretch', 'mobility', 'Hip flexors', 'Quads', 'Bodyweight', 'Beginner', 'isolation', 'bodyweight',
      'Kneel on one knee with the other foot forward|Tuck your pelvis and shift forward gently|Hold 30 seconds, breathe slowly|Switch sides',
      'Arching the lower back|Pushing into pain', 'Hold shorter', 'Add overhead reach', 'Do as is', 2, 1, 1, 30]
  ];

  const BREATH = {
    compound: 'Inhale and brace your core before the lowering phase; exhale through the hardest part of the lift.',
    isolation: 'Exhale while lifting or squeezing; inhale while lowering under control.'
  };

  const EXERCISES = rows.map((r) => {
    const eq = r[5];
    return {
      id: r[0], name: r[1], cat: r[2], primary: P(r[3]), secondary: r[4] ? P(r[4]) : [], equipment: eq, difficulty: r[6],
      kind: r[7], style: r[8], steps: S(r[9]), mistakes: S(r[10]), beginnerAlt: r[11], advanced: r[12], homeAlt: r[13],
      sets: r[14], repMin: r[15], repMax: r[16], rest: r[17],
      breathing: r[2] === 'cardio' ? 'Breathe rhythmically; at easy pace you should still be able to talk.' : BREATH[r[7]],
      safety: 'Choose a load you can control with good technique. Stop if you feel sharp, pinching or joint pain.',
      media: null
    };
  });

  // id, name, state, kcal, protein, carbs, fat, fibre, serving g, serving label, minimum diet (vegan/veg/egg/nonveg)
  const F = [
    ['rice-raw', 'White rice', 'raw', 350, 6.8, 78, 0.5, 0.6, 60, '1 portion dry (60 g)', 'vegan'],
    ['rice-cooked', 'White rice', 'cooked', 130, 2.7, 28, 0.3, 0.4, 150, '1 katori (150 g)', 'vegan'],
    ['atta-raw', 'Whole wheat flour (atta)', 'raw', 340, 12, 71, 1.7, 11, 30, '1 roti worth (30 g)', 'vegan'],
    ['roti', 'Roti / chapati (plain, whole wheat)', 'cooked', 280, 9, 52, 4, 4, 40, '1 roti (40 g)', 'vegan'],
    ['toor-raw', 'Toor dal', 'raw', 335, 22, 62, 1.5, 15, 40, '1 portion dry (40 g)', 'vegan'],
    ['dal-cooked', 'Dal (toor, plain boiled)', 'cooked', 105, 6.5, 18, 0.5, 4, 150, '1 katori (150 g)', 'vegan'],
    ['rajma-raw', 'Rajma (kidney beans)', 'raw', 333, 24, 60, 0.8, 25, 40, '1 portion dry (40 g)', 'vegan'],
    ['rajma-cooked', 'Rajma (boiled)', 'cooked', 127, 8.7, 23, 0.5, 6.4, 150, '1 katori (150 g)', 'vegan'],
    ['kala-chana-raw', 'Kala chana', 'raw', 360, 20, 61, 5, 12, 40, '1 portion dry (40 g)', 'vegan'],
    ['kala-chana-cooked', 'Kala chana (boiled)', 'cooked', 164, 9, 27, 2.6, 7.6, 150, '1 katori (150 g)', 'vegan'],
    ['white-peas-raw', 'White peas (safed vatana)', 'raw', 340, 20, 60, 1.5, 15, 40, '1 portion dry (40 g)', 'vegan'],
    ['white-peas-cooked', 'White peas (boiled)', 'cooked', 118, 8, 21, 0.4, 8, 150, '1 katori (150 g)', 'vegan'],
    ['soy-raw', 'Soy chunks', 'raw', 345, 52, 33, 0.5, 13, 30, '1 portion dry (30 g)', 'vegan'],
    ['soy-cooked', 'Soy chunks (soaked/boiled)', 'cooked', 110, 16, 10, 0.2, 4, 100, '100 g soaked', 'vegan'],
    ['paneer', 'Paneer', 'raw', 265, 18, 1.2, 20.8, 0, 100, '100 g', 'veg'],
    ['tofu', 'Tofu (firm)', 'raw', 144, 15.8, 2.8, 8.7, 2, 100, '100 g', 'vegan'],
    ['milk', 'Milk (toned)', 'raw', 58, 3.1, 4.7, 3, 0, 200, '1 glass (200 ml)', 'veg'],
    ['curd', 'Curd / dahi (whole milk)', 'raw', 60, 3.1, 4.4, 4, 0, 150, '1 katori (150 g)', 'veg'],
    ['egg-boiled', 'Egg, whole (boiled)', 'cooked', 155, 13, 1.1, 11, 0, 50, '1 egg (50 g)', 'egg'],
    ['egg-white', 'Egg white (boiled)', 'cooked', 52, 11, 0.7, 0.2, 0, 33, '1 white (33 g)', 'egg'],
    ['chicken-raw', 'Chicken breast', 'raw', 120, 22.5, 0, 2.6, 0, 150, '150 g raw', 'nonveg'],
    ['chicken-cooked', 'Chicken breast (cooked, no oil)', 'cooked', 165, 31, 0, 3.6, 0, 120, '120 g cooked', 'nonveg'],
    ['rohu', 'Fish, rohu', 'raw', 97, 16.6, 0, 1.4, 0, 150, '150 g raw', 'nonveg'],
    ['oats-raw', 'Rolled oats', 'raw', 389, 16.9, 66, 6.9, 10.6, 40, '40 g dry', 'vegan'],
    ['oats-cooked', 'Oats porridge (with water)', 'cooked', 71, 2.5, 12, 1.5, 1.7, 250, '1 bowl (250 g)', 'vegan'],
    ['poha-raw', 'Poha (flattened rice)', 'raw', 346, 6.6, 77, 1.2, 1, 50, '50 g dry', 'vegan'],
    ['poha-cooked', 'Poha (cooked, light oil)', 'cooked', 130, 2.6, 24, 2.4, 1, 200, '1 plate (200 g)', 'vegan'],
    ['idli', 'Idli', 'cooked', 150, 4.5, 31, 0.4, 1, 40, '1 idli (40 g)', 'vegan'],
    ['dosa', 'Dosa (plain)', 'cooked', 168, 3.9, 29, 3.7, 1, 90, '1 dosa (90 g)', 'vegan'],
    ['upma', 'Upma', 'cooked', 120, 3, 19, 3.5, 1.5, 200, '1 plate (200 g)', 'vegan'],
    ['banana', 'Banana', 'raw', 89, 1.1, 22.8, 0.3, 2.6, 100, '1 medium (100 g)', 'vegan'],
    ['apple', 'Apple', 'raw', 52, 0.3, 14, 0.2, 2.4, 150, '1 medium (150 g)', 'vegan'],
    ['papaya', 'Papaya', 'raw', 43, 0.5, 11, 0.3, 1.7, 150, '1 bowl (150 g)', 'vegan'],
    ['orange', 'Orange', 'raw', 47, 0.9, 12, 0.1, 2.4, 130, '1 medium (130 g)', 'vegan'],
    ['potato-boiled', 'Potato (boiled)', 'cooked', 87, 1.9, 20, 0.1, 1.8, 150, '1 medium (150 g)', 'vegan'],
    ['spinach', 'Spinach (palak)', 'raw', 23, 2.9, 3.6, 0.4, 2.2, 100, '100 g', 'vegan'],
    ['onion', 'Onion', 'raw', 40, 1.1, 9.3, 0.1, 1.7, 50, '1 small (50 g)', 'vegan'],
    ['tomato', 'Tomato', 'raw', 18, 0.9, 3.9, 0.2, 1.2, 100, '1 medium (100 g)', 'vegan'],
    ['cauliflower', 'Cauliflower (gobi)', 'raw', 25, 1.9, 5, 0.3, 2, 100, '100 g', 'vegan'],
    ['broccoli', 'Broccoli', 'raw', 34, 2.8, 6.6, 0.4, 2.6, 100, '100 g', 'vegan'],
    ['peanuts', 'Peanuts (raw)', 'raw', 567, 25.8, 16, 49, 8.5, 30, 'small handful (30 g)', 'vegan'],
    ['almonds', 'Almonds', 'raw', 579, 21, 22, 50, 12.5, 20, '~15 almonds (20 g)', 'vegan'],
    ['roasted-chana', 'Roasted chana', 'cooked', 364, 19, 61, 5.5, 17, 40, '40 g', 'vegan'],
    ['makhana', 'Makhana (fox nuts)', 'raw', 347, 9.7, 77, 0.1, 14.5, 30, '30 g', 'vegan'],
    ['chia', 'Chia seeds', 'raw', 486, 17, 42, 31, 34, 15, '1 tbsp (15 g)', 'vegan'],
    ['flax', 'Flax seeds', 'raw', 534, 18, 29, 42, 27, 10, '1 tbsp (10 g)', 'vegan'],
    ['pumpkin-seeds', 'Pumpkin seeds', 'raw', 559, 30, 11, 49, 6, 20, '20 g', 'vegan'],
    ['peanut-butter', 'Peanut butter', 'raw', 588, 25, 20, 50, 6, 16, '1 tbsp (16 g)', 'vegan'],
    ['ghee', 'Ghee', 'raw', 900, 0, 0, 100, 0, 5, '1 tsp (5 g)', 'veg'],
    ['oil', 'Cooking oil', 'raw', 884, 0, 0, 100, 0, 5, '1 tsp (5 g)', 'vegan'],
    ['sugar', 'Sugar', 'raw', 387, 0, 100, 0, 0, 5, '1 tsp (5 g)', 'vegan'],
    ['samosa', 'Samosa (fried)', 'cooked', 262, 3.5, 24, 17, 2, 70, '1 samosa (70 g)', 'vegan'],
    ['bread-white', 'White bread', 'cooked', 265, 9, 49, 3.2, 2.7, 28, '1 slice (28 g)', 'veg'],
    ['bread-wheat', 'Whole wheat bread', 'cooked', 247, 13, 41, 3.4, 7, 30, '1 slice (30 g)', 'veg'],
    ['pasta-raw', 'Pasta', 'raw', 371, 13, 75, 1.5, 3.2, 80, '80 g dry', 'vegan'],
    ['pasta-cooked', 'Pasta (boiled)', 'cooked', 158, 5.8, 31, 0.9, 1.8, 180, '1 bowl (180 g)', 'vegan'],
    ['salmon', 'Salmon', 'raw', 208, 20, 0, 13, 0, 120, '120 g raw', 'nonveg'],
    ['greek-yogurt', 'Greek yogurt (plain)', 'raw', 59, 10, 3.6, 0.4, 0, 150, '150 g', 'veg'],
    ['avocado', 'Avocado', 'raw', 160, 2, 8.5, 14.7, 6.7, 100, '½ fruit (100 g)', 'vegan'],
    ['sweet-potato', 'Sweet potato (baked)', 'cooked', 90, 2, 21, 0.2, 3.3, 150, '1 medium (150 g)', 'vegan'],
    ['whey', 'Whey protein powder (optional)', 'raw', 400, 80, 8, 6, 0, 30, '1 scoop (30 g)', 'veg']
  ];

  const SRC = 'Approx. reference values (USDA FoodData Central / IFCT-style, rounded)';
  const FOODS = F.map((r) => ({
    id: r[0], name: r[1], state: r[2], kcal: r[3], protein: r[4], carbs: r[5], fat: r[6], fibre: r[7],
    serving: r[8], servingLabel: r[9], diet: r[10], source: SRC
  }));

  // Routine templates. Each day becomes one routine.
  const ex = (id, sets, repMin, repMax, rest) => ({ exId: id, sets, repMin, repMax, kg: 0, rest, note: '' });
  const E = (id) => { const x = EXERCISES.find((e) => e.id === id); return ex(id, x.sets, x.repMin, x.repMax, x.rest); };
  const TEMPLATES = [
    { id: 'full-beginner', name: 'Full Body — Beginner (3 days)', level: 'Beginner', desc: 'Three full-body sessions per week with rest days between.',
      days: [
        { name: 'Full Body A', dow: [1], items: ['goblet', 'db-bench', 'cable-row', 'db-press', 'plank'].map(E) },
        { name: 'Full Body B', dow: [3], items: ['leg-press', 'pushup', 'lat-pulldown', 'rdl', 'dead-bug'].map(E) },
        { name: 'Full Body C', dow: [5], items: ['goblet', 'incline-db', 'db-row', 'lat-raise', 'glute-bridge'].map(E) }
      ] },
    { id: 'home-beginner', name: 'Home Workout — Bodyweight (3 days)', level: 'Beginner', desc: 'No equipment needed.',
      days: [
        { name: 'Home A', dow: [1], items: ['pushup', 'glute-bridge', 'plank', 'burpee'].map(E) },
        { name: 'Home B', dow: [3], items: ['close-pushup', 'crunch', 'dead-bug', 'calf-raise'].map(E) },
        { name: 'Home C', dow: [5], items: ['pushup', 'glute-bridge', 'plank', 'knee-raise'].map(E) }
      ] },
    { id: 'ul', name: 'Upper / Lower (4 days)', level: 'Intermediate', desc: 'Two upper and two lower sessions weekly.',
      days: [
        { name: 'Upper 1', dow: [1], items: ['bench', 'bb-row', 'ohp', 'lat-pulldown', 'db-curl', 'pushdown'].map(E) },
        { name: 'Lower 1', dow: [2], items: ['squat', 'rdl', 'leg-press', 'leg-curl', 'calf-raise'].map(E) },
        { name: 'Upper 2', dow: [4], items: ['incline-db', 'cable-row', 'db-press', 'pullup', 'hammer', 'oh-tri'].map(E) },
        { name: 'Lower 2', dow: [5], items: ['deadlift', 'lunge', 'leg-ext', 'hip-thrust', 'plank'].map(E) }
      ] },
    { id: 'ppl', name: 'Push / Pull / Legs (3–6 days)', level: 'Intermediate', desc: 'Classic split — run once or twice per week.',
      days: [
        { name: 'Push', dow: [1], items: ['bench', 'incline-db', 'ohp', 'lat-raise', 'pushdown', 'oh-tri'].map(E) },
        { name: 'Pull', dow: [3], items: ['deadlift', 'lat-pulldown', 'bb-row', 'face-pull', 'bb-curl', 'hammer'].map(E) },
        { name: 'Legs', dow: [5], items: ['squat', 'rdl', 'leg-press', 'leg-curl', 'calf-raise', 'crunch'].map(E) }
      ] },
    { id: 'bro', name: 'Body-Part Split (5 days)', level: 'Advanced', desc: 'One main muscle group per day.',
      days: [
        { name: 'Chest', dow: [1], items: ['bench', 'incline-db', 'db-fly', 'pushup'].map(E) },
        { name: 'Back', dow: [2], items: ['deadlift', 'pullup', 'bb-row', 'cable-row'].map(E) },
        { name: 'Shoulders', dow: [3], items: ['ohp', 'lat-raise', 'face-pull', 'db-press'].map(E) },
        { name: 'Arms', dow: [4], items: ['bb-curl', 'hammer', 'pushdown', 'oh-tri', 'wrist-curl'].map(E) },
        { name: 'Legs', dow: [5], items: ['squat', 'rdl', 'leg-ext', 'leg-curl', 'calf-raise'].map(E) }
      ] },
    { id: 'strength', name: 'Strength Focus (3 days)', level: 'Intermediate', desc: 'Heavy compound lifts, low reps, long rests.',
      days: [
        { name: 'Strength A', dow: [1], items: [ex('squat', 5, 3, 5, 180), ex('bench', 5, 3, 5, 180), ex('bb-row', 4, 5, 6, 150)] },
        { name: 'Strength B', dow: [3], items: [ex('deadlift', 3, 3, 5, 180), ex('ohp', 4, 4, 6, 150), ex('pullup', 4, 4, 6, 150)] },
        { name: 'Strength C', dow: [5], items: [ex('squat', 4, 4, 6, 180), ex('bench', 4, 4, 6, 180), ex('rdl', 3, 5, 8, 150)] }
      ] }
  ];

  root.IMData = { CATS, EXERCISES, FOODS, TEMPLATES, BUILT_IN_FOOD_SOURCE: SRC };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.IMData;
})(typeof window !== 'undefined' ? window : globalThis);
