import type { Exercise, Food, MuscleId } from './types'

// Food values are rough averages. A label value the user types always wins.

export const FOODS: Food[] = [
  { n: 'Egg', p: 6.3, f: 5, cb: 0.4, u: '1 egg', t: 'protein' },
  { n: 'Egg white', p: 3.6, f: 0.1, cb: 0.2, u: '1 white', t: 'protein' },
  { n: 'Chicken', p: 31, f: 3.6, cb: 0, u: '100 g cooked', t: 'protein', h: 1 },
  { n: 'Paneer', p: 9, f: 10.5, cb: 1.2, u: '50 g', t: 'protein', h: 1 },
  { n: 'Protein scoop', p: 24, f: 1.5, cb: 3, u: '1 serve', t: 'protein' },
  { n: 'Soya chunks', p: 15.5, f: 0.5, cb: 10, u: '30 g dry', t: 'protein', h: 1 },
  { n: 'Toned milk', p: 8, f: 7.5, cb: 12, u: '250 ml', t: 'dairy', h: 1 },
  { n: 'Curd', p: 3.5, f: 4, cb: 4.5, u: '100 g', t: 'dairy', h: 1 },
  { n: 'Cheese cube', p: 5, f: 6, cb: 1, u: '1 cube, about 25 g', t: 'fat' },
  { n: 'Bread slice', p: 3, f: 1, cb: 14, u: '1 slice', t: 'carb' },
  { n: 'Roti', p: 3, f: 2.5, cb: 18, u: '1 medium', t: 'carb' },
  { n: 'Rice', p: 4, f: 0.4, cb: 45, u: '1 cup cooked', t: 'carb' },
  { n: 'Oats', p: 5, f: 2.7, cb: 26, u: '40 g dry', t: 'carb', h: 1 },
  { n: 'Dal', p: 7, f: 4, cb: 18, u: '1 bowl', t: 'carb' },
  { n: 'Banana', p: 1.3, f: 0.4, cb: 27, u: '1 medium', t: 'carb' },
  { n: 'Peanut butter', p: 4, f: 8, cb: 3, u: '1 tbsp', t: 'fat' },
  { n: 'Roasted chana', p: 6, f: 1.7, cb: 18, u: '30 g', t: 'carb', h: 1 },
]

export const INGREDIENTS: Food[] = [
  { n: 'Onion', p: 1.2, f: 0.1, cb: 10, u: '1 medium', t: 'veg' },
  { n: 'Tomato', p: 1.1, f: 0.2, cb: 4.6, u: '1 medium', t: 'veg' },
  { n: 'Green chili', p: 0.2, f: 0, cb: 1, u: '1 chili', t: 'veg' },
  { n: 'Garlic', p: 0.2, f: 0, cb: 1, u: '1 clove', t: 'veg' },
  { n: 'Capsicum', p: 1, f: 0.3, cb: 6, u: '1 medium', t: 'veg' },
  { n: 'Mushrooms', p: 3, f: 0.3, cb: 3.3, u: '100 g', t: 'veg', h: 1 },
  { n: 'Spinach', p: 2.9, f: 0.4, cb: 3.6, u: '100 g', t: 'veg', h: 1 },
  { n: 'Mixed veg', p: 2, f: 0.3, cb: 7, u: '100 g', t: 'veg', h: 1 },
  { n: 'Cooking oil', p: 0, f: 4.5, cb: 0, u: '1 tsp', t: 'fat' },
  { n: 'Butter', p: 0, f: 4, cb: 0, u: '1 tsp', t: 'fat' },
  { n: 'Ghee', p: 0, f: 4.7, cb: 0, u: '1 tsp', t: 'fat' },
]

export const FAT_TIPS: Record<string, string> = {
  'Cooking oil': 'Measure it with a teaspoon and air fry. Each extra teaspoon is about 40 kcal.',
  Butter: 'Use half, or cook eggs in a non stick pan with no butter.',
  Ghee: 'Keep it to one teaspoon, and skip it on top of roti.',
  'Cheese cube': 'Use 1 cube, not 2. Each cube is about 6 g of fat.',
  Paneer: 'Swap half of it for tofu, chicken or egg whites.',
  'Peanut butter': 'Stick to one level tablespoon.',
  Egg: 'Try 2 whole eggs plus 2 whites instead of 4 whole. That saves about 10 g of fat.',
  'Toned milk': 'It is already the lighter milk. Check the portion size before changing it.',
  Curd: 'Switch to low fat or Greek curd.',
  Dal: 'Use a smaller tadka. Most of the fat in dal is the oil on top.',
  Roti: 'Skip the ghee. Plain roti is already low in fat.',
}

export const SUPPLEMENTS = [
  { id: 'creatine', n: 'Creatine', h: '3 to 5 g with water, any time. Easiest with breakfast.' },
  { id: 'omega', n: 'Omega 3', h: 'With a meal that has fat, like the egg breakfast.' },
  { id: 'd3k2', n: 'Vitamin D3 + K2', h: 'Same meal as omega 3.' },
  { id: 'mag', n: 'Magnesium glycinate', h: '30 to 60 min before bed. Follow the bottle label.' },
] as const

export const MUSCLES: { id: MuscleId; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'forearms', label: 'Forearms' },
  { id: 'quads', label: 'Quads' },
  { id: 'hamstrings', label: 'Hamstrings' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'calves', label: 'Calves' },
  { id: 'core', label: 'Core' },
]

export const muscleLabel = (id: string) => MUSCLES.find((m) => m.id === id)?.label ?? id

// Practical weekly set ranges for about 3 sessions a week. Starting points, not rules.
export const TARGET: Partial<Record<MuscleId, [number, number]>> = {
  chest: [10, 16], back: [10, 18], shoulders: [8, 14], biceps: [6, 14], triceps: [8, 14],
  quads: [8, 14], hamstrings: [6, 12], glutes: [6, 14], calves: [6, 12], core: [4, 10],
}

export const ROUTINE: Exercise[] = [
  { id: 'legpress', n: 'Leg press', m: { quads: 1, glutes: 0.5 }, s: 3, lo: 8, hi: 12, inc: 5,
    c: ['Feet shoulder width, mid platform. Back and hips stay flat on the pad.',
        'Lower until knees are about 90 degrees. Stop before your lower back peels off the seat.',
        'Press through the whole foot. Stop just short of locking your knees.',
        'No leg press at your centre? Do goblet squats: dumbbell at chest, sit down between your heels.'] },
  { id: 'chest', n: 'Chest press', m: { chest: 1, triceps: 0.5, shoulders: 0.5 }, s: 3, lo: 8, hi: 12, inc: 2.5,
    c: ['Set the seat so the handles sit at mid chest.',
        'Pull shoulder blades back and down and keep them there.',
        'Press until arms are nearly straight. Take 2 seconds to come back.',
        'No machine? Use a flat dumbbell bench press with the same cues.'] },
  { id: 'pulldown', n: 'Lat pulldown', m: { back: 1, biceps: 0.5, forearms: 0.5 }, s: 3, lo: 8, hi: 12, inc: 2.5,
    c: ['Grip a little wider than shoulders. Lean back slightly with chest up.',
        'Drive your elbows down and pull the bar to your upper chest.',
        'Never pull behind the neck. No swinging.',
        'Let the bar rise slowly until your arms are straight.'] },
  { id: 'row', n: 'Seated cable row', m: { back: 1, biceps: 0.5, forearms: 0.5 }, s: 3, lo: 10, hi: 12, inc: 2.5,
    c: ['Sit tall with a slight knee bend. Keep your chest up.',
        'Pull the handle to your lower ribs and squeeze shoulder blades together.',
        'Do not rock your torso back and forth.',
        'No cable row? Do one arm dumbbell rows with a hand on a bench.'] },
  { id: 'ohp', n: 'Dumbbell shoulder press', m: { shoulders: 1, triceps: 0.5 }, s: 3, lo: 8, hi: 12, inc: 2,
    c: ['Sit with back support or stand tall. Dumbbells at shoulder height, palms forward.',
        'Press up until arms are nearly straight. Keep ribs down, do not arch.',
        'Lower to about ear level with control.',
        'Weight is per dumbbell. Use one you can control for all reps.'] },
  { id: 'rdl', n: 'Romanian deadlift', m: { hamstrings: 1, glutes: 1, back: 0.5, forearms: 0.5 }, s: 3, lo: 8, hi: 12, inc: 2.5,
    c: ['Feet hip width, soft knees, dumbbells or bar in front of your thighs.',
        'Push your hips straight back. The weight slides down your legs.',
        'Keep your back flat. Lower to mid shin or until your hamstrings stretch.',
        'Drive hips forward to stand. Your knee bend should not change on the way down.'] },
  { id: 'curl', n: 'Dumbbell curl', m: { biceps: 1, forearms: 0.5 }, s: 2, lo: 10, hi: 15, inc: 2,
    c: ['Elbows pinned to your sides.', 'Curl up without swinging your torso.',
        'Lower for 2 to 3 seconds and fully straighten the arm.'] },
  { id: 'pushdown', n: 'Rope pushdown', m: { triceps: 1 }, s: 2, lo: 10, hi: 15, inc: 2.5,
    c: ['Elbows tucked at your sides, torso upright.',
        'Push the rope down and spread the ends apart at the bottom.',
        'Control it back up until your elbows reach about 90 degrees.'] },
  { id: 'crunch', n: 'Cable crunch', m: { core: 1 }, s: 2, lo: 12, hi: 15, inc: 2.5,
    c: ['Kneel under the cable with the rope at your forehead.',
        'Curl your ribs toward your hips and breathe out. Hips stay still.',
        'Move your spine, not your arms.'] },
]

export const CATALOG: Exercise[] = [
  { id: 'c_hammer', n: 'Hammer curl', m: { biceps: 1, forearms: 0.5 }, s: 2, lo: 10, hi: 15, inc: 2,
    c: ['Palms face each other the whole time, like holding a hammer.', 'Elbows pinned to your sides. No swinging.',
        'Works the brachialis and forearm too, which adds arm thickness.'] },
  { id: 'c_incline_curl', n: 'Incline dumbbell curl', m: { biceps: 1 }, s: 2, lo: 10, hi: 15, inc: 2,
    c: ['Bench at 45 to 60 degrees, arms hanging straight down behind your torso.',
        'Curl without moving your upper arm forward.', 'Use lighter weights than standing curls. The stretch is the point.'] },
  { id: 'c_overhead', n: 'Overhead triceps extension', m: { triceps: 1 }, s: 2, lo: 10, hi: 15, inc: 2.5,
    c: ['Use a cable rope or one dumbbell held with both hands.', 'Elbows point up and stay close to your head.',
        'Lower behind your head until you feel a stretch, then extend fully.',
        'Trains the long head of the triceps, the biggest part of the arm.'] },
  { id: 'c_skull', n: 'Skull crusher', m: { triceps: 1 }, s: 2, lo: 8, hi: 12, inc: 2,
    c: ['Lie on a bench with dumbbells or an EZ bar over your chest.',
        'Only your forearms move. Lower toward your forehead or just behind your head.',
        'Extend until arms are straight. Keep elbows from flaring.'] },
  { id: 'c_lateral', n: 'Lateral raise', m: { shoulders: 1 }, s: 3, lo: 12, hi: 15, inc: 1,
    c: ['Light dumbbells, slight bend in the elbows.', 'Raise out to the side up to shoulder height. Lead with your elbows.',
        'Do not shrug or swing. Lower slowly.', 'Builds the side delts, which widen your shoulders.'] },
  { id: 'c_facepull', n: 'Face pull', m: { shoulders: 1, back: 0.5 }, s: 2, lo: 12, hi: 15, inc: 2.5,
    c: ['Rope at face height. Step back so the cable is under tension.',
        'Pull toward your face with elbows high and wide.', 'Squeeze your rear delts for a second. Keep the weight light.'] },
  { id: 'c_calf', n: 'Standing calf raise', m: { calves: 1 }, s: 3, lo: 10, hi: 15, inc: 5,
    c: ['Balls of your feet on a step or machine, heels hanging off.',
        'Lower all the way for a stretch, pause, then rise as high as you can.',
        'Slow reps. Calves need full range more than heavy weight.'] },
  { id: 'c_hipthrust', n: 'Hip thrust', m: { glutes: 1, hamstrings: 0.5 }, s: 3, lo: 8, hi: 12, inc: 5,
    c: ['Upper back on a bench, feet flat, knees bent.', 'Drive through your heels. Tuck your chin and keep ribs down.',
        'Squeeze at the top for a second. Do not over-arch your lower back.'] },
  { id: 'c_legcurl', n: 'Leg curl', m: { hamstrings: 1 }, s: 3, lo: 10, hi: 15, inc: 2.5,
    c: ['Pad sits just above your heels, hips pressed into the seat or bench.', 'Curl without lifting your hips.',
        'Lower slowly. Do not let the stack drop.'] },
  { id: 'c_legext', n: 'Leg extension', m: { quads: 1 }, s: 3, lo: 10, hi: 15, inc: 2.5,
    c: ['Line your knees up with the machine pivot.', 'Extend fully and squeeze your quads at the top.',
        'Lower for 2 to 3 seconds.'] },
  { id: 'c_incline', n: 'Incline dumbbell press', m: { chest: 1, shoulders: 0.5, triceps: 0.5 }, s: 3, lo: 8, hi: 12, inc: 2,
    c: ['Bench at about 30 degrees. Shoulder blades pinched back and down.',
        'Lower to the sides of your upper chest and press up and slightly in.',
        'Higher benches shift work to your shoulders. Keep it low.'] },
  { id: 'c_pullup', n: 'Assisted pull-up', m: { back: 1, biceps: 0.5, forearms: 0.5 }, s: 3, lo: 6, hi: 10, inc: 2.5,
    c: ['Hands a little wider than shoulders, chest up.',
        'Pull your elbows down toward your ribs until your chin clears the bar.',
        'Lower under control. Reduce assistance as you get stronger.'] },
  { id: 'c_dbrow', n: 'One arm dumbbell row', m: { back: 1, biceps: 0.5, forearms: 0.5 }, s: 3, lo: 8, hi: 12, inc: 2,
    c: ['One hand and knee on a bench, back flat.', 'Pull the dumbbell to your hip, not your shoulder.',
        'Pause at the top. Log each arm as one set.'] },
  { id: 'c_goblet', n: 'Goblet squat', m: { quads: 1, glutes: 0.5 }, s: 3, lo: 8, hi: 12, inc: 2.5,
    c: ['Hold one dumbbell at your chest, elbows pointing down.', 'Feet slightly wider than shoulders. Sit down between your heels.',
        'Keep your chest up and push through your whole foot.'] },
  { id: 'c_wrist', n: 'Wrist curl', m: { forearms: 1 }, s: 2, lo: 12, hi: 20, inc: 1,
    c: ['Forearms rest on your thighs, palms up, wrists hanging over the knee.',
        'Curl your wrists up and lower slowly.', 'Do the same palms down for the top of your forearm.'] },
]

// Lift to offer when a muscle is under target.
export const SUGGEST: Partial<Record<MuscleId, string>> = {
  chest: 'c_incline', back: 'c_dbrow', shoulders: 'c_lateral', biceps: 'c_hammer', triceps: 'c_overhead',
  forearms: 'c_wrist', quads: 'c_legext', hamstrings: 'c_legcurl', glutes: 'c_hipthrust', calves: 'c_calf',
}

export const catalogItem = (id: string) => CATALOG.find((c) => c.id === id)

export const STREAK_MIN = 60
