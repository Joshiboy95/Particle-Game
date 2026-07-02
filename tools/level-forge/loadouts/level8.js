// Level 8 loadout — first worked example for the level-forge pipeline.
// Wind-Jet dips the stream down, Attraktor curves it back up, Repulsor
// gives it a second, gentler bend before it settles toward the target —
// a genuine single-hump wave using all three tool types (Repulsor's first
// real use in the game). Tuned so all three of the emitter's angular-spread
// edges (not just the centerline) behave consistently — see the iteration
// history in this session for why the attractor strength landed at 2.2
// rather than the initially-tried 3.2+ (too strong, orbited the -10° edge
// particle instead of a fly-by).

module.exports = {
  id: 8,
  meta: {
    name: 'Die Welle',
    description: 'Drei Werkzeuge, eine durchgehende Welle: Der Strom taucht ab, schwingt zurück und muss den engen Kanal bis zum Ziel halten.',
    hints: [
      'Ein Wind-Jet an der Quelle taucht den Strom ab, ein Attraktor schwingt ihn zurück nach oben, ein Repulsor dahinter dämpft den Schwung, bevor er das Ziel erreicht.',
    ],
  },
  loadout: [
    { type: 'wind_jet', pos: { x: 0.08, y: 0.5 }, direction: 30, spreadAngle: 90, strength: 0.35 },
    { type: 'attractor', pos: { x: 0.45, y: 0.58 }, radius: 0.25, strength: 2.2 },
    { type: 'repulsor', pos: { x: 0.72, y: 0.42 }, radius: 0.18, strength: 4 },
  ],
  emitter: { id: 'e1', position: { x: 0.05, y: 0.5 }, direction: 0.0, spread_angle: 20.0 },
  target: { id: 't1', position: { x: 0.9, y: 0.524 }, radius: 0.045 },
  ambientForce: { x: 0, y: 0 },
  emitterRate: 200,
  particleLifetime: 10.0,
  corridorHalfWidth: 0.06,
  gridResolution: 36,
  targetBand: [0.65, 0.95],
  budgetBuffer: 10,
  holdDurationSeconds: 3.5,
  unlocksOnComplete: null,
};
