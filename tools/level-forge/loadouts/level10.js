// Level 10 loadout — REVISION 3. Unlike every other level in this game,
// Level 10 was NOT built purely trail-first (trace physics -> corridor
// around it). It went through three iterations documented in full in
// js/data/levels.js's Level 10 comment:
//
//   1. Trail-first (like Levels 8-9) -> beaten with two Wind-Jets.
//   2. Corridor tightened around the same trail -> empirically hardened
//      (1772 adversarial trials), but still only an empirical guarantee.
//   3. THIS revision: hand-authored a hairpin trail (the safe path must
//      backtrack in x, not just bend twice) so that corridor.js's
//      buildCorridorObstacles gives an actual geometric guarantee — see
//      corridor.js's anyStraightPathExists, which exhaustively proves no
//      N-elbow straight polyline can cross it, rather than just failing to
//      find one via search.
//
// The trail below is NOT hand-picked geometry — it's the real traced path
// of this exact loadout (Wind-Jet dip -> Repulsor bounce -> Wind-Jet catch)
// against an obstacle-free field. Hand-picking idealized waypoints (a flat
// opening segment, a smooth arc) repeatedly failed: real Wind-Jet steering
// curves immediately and doesn't match an idealized straight opening,
// killing the particle against the corridor wall within the first few
// frames. Always trace the real physics, even when hand-authoring the
// overall shape.

module.exports = {
  id: 10,
  meta: {
    name: 'Der Zickzack',
    description: 'Der Strom muss einen echten Haarnadel-Kanal durchqueren — die Rückführung macht das mit nur zwei Elementen geometrisch unmöglich.',
    hints: [
      'Ein Wind-Jet leitet den Strom in eine enge Schleife; ein Repulsor am Ende der Schleife wirft ihn zurück in die Gegenrichtung. Ein zweiter, breit gefächerter Wind-Jet fängt ihn danach ab und lenkt ihn zum Ziel — die Rückführung selbst lässt sich mit nur zwei Werkzeugen nicht nachbilden.',
    ],
  },
  loadout: [
    { type: 'wind_jet', pos: { x: 0.08, y: 0.5 }, direction: 25, spreadAngle: 90, strength: 0.3 },
    { type: 'repulsor', pos: { x: 0.58, y: 0.78 }, radius: 0.25, strength: 7 },
    { type: 'wind_jet', pos: { x: 0.36, y: 0.1 }, direction: 0, spreadAngle: 340, strength: 0.4 },
  ],
  emitter: { id: 'e1', position: { x: 0.05, y: 0.5 }, direction: 0.0, spread_angle: 20.0 },
  target: { id: 't1', position: { x: 0.92, y: 0.392 }, radius: 0.05 },
  ambientForce: { x: 0, y: 0 },
  emitterRate: 200,
  particleLifetime: 10.0,
  corridorHalfWidth: 0.03,
  gridResolution: 45,
  budgetBuffer: 15,
  holdDurationSeconds: 3.5,
  unlocksOnComplete: null,
};
