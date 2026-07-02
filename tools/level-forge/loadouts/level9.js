// Level 9 loadout — a genuine higher-frequency, two-bend curve (not just a
// single hump like Level 8): Wind-Jet dips the stream, Attraktor swings it
// back up toward the baseline, Repulsor (placed well clear of the
// Attraktor's radius) pushes it back down a second time.
//
// IMPORTANT LESSON (kept as a comment because it cost real iteration time):
// the first version of this loadout used a stronger Attraktor (strength 3.0)
// positioned to force a *clean* double crossing of the baseline. It looked
// great under trace.js and even validate.js's fastForward-based auto-tune
// (59-68% achieved efficiency) — but a real headed playthrough plateaued
// around 20% and never completed. Root cause: strength 3.0 sits right at a
// chaotic orbit-capture threshold for the attractor (same failure mode as
// Level 8's early iteration, see js/data/levels.js's Level 8 comment) —
// fastForward's *perfectly uniform* dt stepping doesn't trigger it, but real
// gameplay's naturally jittery frame timing pushes far more of the real
// particle spread into permanent orbit than the idealized simulation
// suggested. fastForward/validate.js alone is NOT sufficient proof for
// levels with near-chaotic tool tuning — a real playthrough is mandatory.
//
// Fix: keep the Attraktor at the Level-8-proven-robust strength 2.2 (already
// verified safe against the full angular spread in real gameplay), and get
// the second bend entirely from the Repulsor instead — repulsors can't
// create bound orbits (they only ever push apart), so they're structurally
// safer to push harder without risking the same chaos.

module.exports = {
  id: 9,
  meta: {
    name: 'Doppelte Welle',
    description: 'Ein Strom mit zwei Bögen: Wind-Jet und Attraktor formen den ersten, ein kräftiger Repulsor den zweiten, bevor der Kanal zum Ziel frei wird.',
    hints: [
      'Wind-Jet und Attraktor formen den ersten Bogen wie bei der Welle zuvor; ein Repulsor weit dahinter drückt den Strom ein zweites Mal nach unten.',
    ],
  },
  loadout: [
    { type: 'wind_jet', pos: { x: 0.08, y: 0.5 }, direction: 30, spreadAngle: 90, strength: 0.35 },
    { type: 'attractor', pos: { x: 0.45, y: 0.58 }, radius: 0.25, strength: 2.2 },
    { type: 'repulsor', pos: { x: 0.78, y: 0.35 }, radius: 0.25, strength: 6 },
  ],
  emitter: { id: 'e1', position: { x: 0.05, y: 0.5 }, direction: 0.0, spread_angle: 20.0 },
  target: { id: 't1', position: { x: 0.85, y: 0.53 }, radius: 0.05 },
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
