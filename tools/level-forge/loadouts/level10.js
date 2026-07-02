// Level 10 loadout — much harder than Level 9: a genuine triple-bend trail
// (three direction changes) requiring four tools across all three types.
// Deliberately built to NOT be solvable with only two elements — see the
// adversarial 2-tool search in the level-forge session notes/commit that
// confirmed no pair of tools reaches this level's efficiency threshold.
//
// Tool roles: Wind-Jet dips the stream (bend 1), Attraktor (kept at the
// Level-8/9-proven-robust strength 2.2 — see those levels' comments on why
// stronger orbits) swings it back toward the baseline (bend 2), Repulsor
// pushes it past the baseline into a second trough (bend 3), and a second
// Wind-Jet — placed with a near-omnidirectional spread (340 degrees) so it
// catches the obliquely-approaching stream regardless of entry angle —
// steers it back up toward the target (bend 4, correction). Repulsor and
// Wind-Jet are both used twice/at the edges deliberately: neither can form
// a bound orbit the way a second strong Attraktor could, so the extra bends
// come from the structurally safer tools.

module.exports = {
  id: 10,
  meta: {
    name: 'Der Zickzack',
    description: 'Vier Werkzeuge, drei Kurven: Der Strom muss durch einen engen Zickzack-Kanal gelenkt werden — mit nur zwei Elementen ist das nicht zu schaffen.',
    hints: [
      'Wind-Jet und Attraktor formen die erste Kurve, ein Repulsor die zweite. Ein zweiter, breit gefächerter Wind-Jet fängt den Strom am Ende ab und lenkt ihn zurück zum Ziel — kein einzelnes Werkzeugpaar reicht hier aus.',
    ],
  },
  loadout: [
    { type: 'wind_jet', pos: { x: 0.08, y: 0.5 }, direction: 30, spreadAngle: 90, strength: 0.35 },
    { type: 'attractor', pos: { x: 0.45, y: 0.58 }, radius: 0.25, strength: 2.2 },
    { type: 'repulsor', pos: { x: 0.78, y: 0.35 }, radius: 0.25, strength: 6 },
    { type: 'wind_jet', pos: { x: 0.83, y: 0.52 }, direction: -30, spreadAngle: 340, strength: 0.35 },
  ],
  emitter: { id: 'e1', position: { x: 0.05, y: 0.5 }, direction: 0.0, spread_angle: 20.0 },
  target: { id: 't1', position: { x: 0.92, y: 0.475 }, radius: 0.05 },
  ambientForce: { x: 0, y: 0 },
  emitterRate: 200,
  particleLifetime: 10.0,
  corridorHalfWidth: 0.06,
  gridResolution: 36,
  targetBand: [0.55, 0.9],
  budgetBuffer: 10,
  holdDurationSeconds: 3.5,
  unlocksOnComplete: null,
};
