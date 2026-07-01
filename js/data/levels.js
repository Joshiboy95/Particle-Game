// POC level data — pure JSON-shaped JS objects, schema per design doc §9.1.
// Adding a level = adding an entry here; no other code changes needed.

export const LEVEL_DATA = [
  {
    id: 1,
    name: 'Erster Kontakt',
    description: 'Freie Bahn, kein Hindernis. Nutzen Sie den Wind-Jet, um den Partikelstrom zum Ziel zu bündeln.',
    budget: 30,
    emitter_rate: 200,
    particle_lifetime: 10.0,
    ambient_force: { x: 0, y: 0 },
    emitters: [
      { id: 'e1', position: { x: 0.05, y: 0.5 }, direction: 0.0, spread_angle: 20.0 },
    ],
    targets: [
      { id: 't1', position: { x: 0.92, y: 0.5 }, radius: 0.05 },
    ],
    obstacles: [],
    available_tools: ['wind_jet'],
    completion: {
      targets_required: ['t1'],
      efficiency_threshold: 0.6,
      hold_duration_seconds: 2.0,
    },
    unlocks_on_complete: 'attractor',
    hints: ['Ein Wind-Jet in Richtung Ziel bündelt den Partikelstrom.'],
  },
  {
    id: 2,
    name: 'Die Mauer',
    description: 'Eine Wand blockiert den direkten Weg. Nutzen Sie den Attraktor, um die Partikel herumzulenken.',
    budget: 50,
    emitter_rate: 200,
    particle_lifetime: 10.0,
    ambient_force: { x: 0, y: 0 },
    emitters: [
      { id: 'e1', position: { x: 0.05, y: 0.5 }, direction: 0.0, spread_angle: 20.0 },
    ],
    targets: [
      { id: 't1', position: { x: 0.92, y: 0.5 }, radius: 0.04 },
    ],
    obstacles: [
      { type: 'rect', x: 0.45, y: 0.0, width: 0.04, height: 0.65, behavior: 'kill' },
    ],
    available_tools: ['wind_jet', 'attractor'],
    completion: {
      targets_required: ['t1'],
      efficiency_threshold: 0.65,
      hold_duration_seconds: 3.0,
    },
    unlocks_on_complete: 'repulsor',
    hints: ['Ein Attraktor knapp über der Wandkante lenkt die Partikel elegant vorbei.'],
  },
  {
    id: 3,
    name: 'Das L',
    description: 'Ein L-förmiges Hindernis versperrt den Weg. Nutzen Sie den Repulsor, um den Strom von der Innenwand fernzuhalten.',
    budget: 60,
    emitter_rate: 200,
    particle_lifetime: 10.0,
    ambient_force: { x: 0, y: 0 },
    emitters: [
      { id: 'e1', position: { x: 0.05, y: 0.5 }, direction: 0.0, spread_angle: 20.0 },
    ],
    targets: [
      { id: 't1', position: { x: 0.92, y: 0.5 }, radius: 0.04 },
    ],
    obstacles: [
      { type: 'rect', x: 0.42, y: 0.0, width: 0.05, height: 0.55, behavior: 'kill' },
      { type: 'rect', x: 0.42, y: 0.5, width: 0.3, height: 0.05, behavior: 'kill' },
    ],
    available_tools: ['wind_jet', 'attractor', 'repulsor'],
    completion: {
      targets_required: ['t1'],
      efficiency_threshold: 0.65,
      hold_duration_seconds: 3.0,
    },
    unlocks_on_complete: null,
    hints: ['Der Repulsor kann genutzt werden, um den Strom weg von der L-Innenwand zu drücken.'],
  },
];
