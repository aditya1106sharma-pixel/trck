# Design brief

**Idea:** a gym logbook, not a wellness app. Ruled lines, big condensed numbers, one loud colour. It should feel like the chalk board at a serious gym.

## Rules
- One accent: signal orange. Green only means "on target", red or amber only means "over a cap". Never decorate with colour.
- No cards. Sections are separated by hairlines. No boxes inside boxes, no shadows, no gradients except the single legend bar on the body map.
- Numbers are the hero. Display font (Big Shoulders Display, condensed, tabular) for numbers and section labels; Hanken Grotesk for reading text.
- The score is a barbell that gains plates (5, 10, 15, 20, 25 kg per side). That is the one piece of illustration.
- No emoji, no icon circles, no stock imagery. Text labels in the tab bar.
- Plain words. "Over cap", "Ready", "Recovering". Never "Awesome!", never streak guilt.
- Touch: 44 px minimum, thumbs reach the tab bar and steppers. Works at 360 px, light and dark, reduced motion.
- Empty states say what to do in one sentence.

## Tokens
Defined at the top of `src/styles.css`: bg, raise, ink, mut, line, acc, ok, warn, bad, dim. Add a token only if two places need it.

## Checklist before shipping a UI change
Screenshot at 400 px in light and dark. Longest food name fits. Focus ring visible. Contrast at least 4.5:1 for text. Nothing scrolls sideways.
