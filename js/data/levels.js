// POC level data — pure JSON-shaped JS objects, schema per design doc §9.1.
// Adding a level = adding an entry here; no other code changes needed.

export const LEVEL_DATA = [
  {
    id: 1,
    name: 'Erster Kontakt',
    description: 'Freie Bahn, kein Hindernis. Nutzen Sie den Wind-Jet, um den Partikelstrom zum Ziel zu bündeln.',
    budget: 35,
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
    description: 'Eine Wand blockiert den direkten Weg. Nutzen Sie Wind-Jet und Attraktor gemeinsam, um die Partikel durch die Lücke und zurück zum Ziel zu lenken.',
    budget: 55,
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
    hints: ['Ein steiler Wind-Jet an der Quelle drückt den Strom durch die Lücke; ein Attraktor dahinter fängt ihn ab und lenkt ihn zurück zum Ziel.'],
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
  {
    id: 4,
    name: 'Gegenwind',
    description: 'Ein ständiger Gegenwind drückt die Partikel nach links. Kombinieren Sie Ihre Werkzeuge, um ihn auszugleichen.',
    budget: 70,
    emitter_rate: 200,
    particle_lifetime: 10.0,
    ambient_force: { x: -0.05, y: 0 },
    emitters: [
      { id: 'e1', position: { x: 0.05, y: 0.5 }, direction: 0.0, spread_angle: 20.0 },
    ],
    targets: [
      { id: 't1', position: { x: 0.92, y: 0.5 }, radius: 0.05 },
    ],
    obstacles: [],
    available_tools: ['wind_jet', 'attractor', 'repulsor'],
    completion: {
      targets_required: ['t1'],
      efficiency_threshold: 0.6,
      hold_duration_seconds: 3.0,
    },
    unlocks_on_complete: null,
    hints: ['Der Gegenwind schwächt jeden Schub ab — planen Sie mit etwas Reserve.'],
  },
  {
    id: 5,
    name: 'Der Engpass',
    description: 'Eine schmale Öffnung zwischen zwei Wänden verlangt präzises Funneling.',
    budget: 65,
    emitter_rate: 200,
    particle_lifetime: 10.0,
    ambient_force: { x: 0, y: 0 },
    emitters: [
      { id: 'e1', position: { x: 0.05, y: 0.5 }, direction: 0.0, spread_angle: 20.0 },
    ],
    targets: [
      { id: 't1', position: { x: 0.92, y: 0.5 }, radius: 0.045 },
    ],
    obstacles: [
      { type: 'rect', x: 0.5, y: 0.0, width: 0.04, height: 0.42, behavior: 'kill' },
      { type: 'rect', x: 0.5, y: 0.58, width: 0.04, height: 0.42, behavior: 'kill' },
    ],
    available_tools: ['wind_jet', 'attractor', 'repulsor'],
    completion: {
      targets_required: ['t1'],
      efficiency_threshold: 0.6,
      hold_duration_seconds: 3.0,
    },
    unlocks_on_complete: null,
    hints: ['Bündeln Sie den Strom kurz vor der Engstelle, damit er nicht an den Wänden verloren geht.'],
  },
  {
    id: 6,
    name: 'Zwei Quellen',
    description: 'Zwei Emitter speisen denselben Strom. Führen Sie beide zum gemeinsamen Ziel.',
    budget: 80,
    emitter_rate: 200,
    particle_lifetime: 10.0,
    ambient_force: { x: 0, y: 0 },
    emitters: [
      { id: 'e1', position: { x: 0.05, y: 0.3 }, direction: 0.0, spread_angle: 20.0 },
      { id: 'e2', position: { x: 0.05, y: 0.7 }, direction: 0.0, spread_angle: 20.0 },
    ],
    targets: [
      { id: 't1', position: { x: 0.92, y: 0.5 }, radius: 0.06 },
    ],
    obstacles: [],
    available_tools: ['wind_jet', 'attractor', 'repulsor'],
    completion: {
      targets_required: ['t1'],
      efficiency_threshold: 0.7,
      hold_duration_seconds: 3.0,
    },
    unlocks_on_complete: null,
    hints: ['Ein Attraktor in der Mitte kann beide Ströme zu einem vereinen.'],
  },
  {
    id: 7,
    name: 'Der Sturm',
    description: 'Gegenwind und ein Hindernis zugleich — nur im Zusammenspiel aller Werkzeuge erreichen Sie das Ziel.',
    budget: 90,
    emitter_rate: 200,
    particle_lifetime: 11.0,
    ambient_force: { x: -0.03, y: 0.015 },
    emitters: [
      { id: 'e1', position: { x: 0.05, y: 0.5 }, direction: 0.0, spread_angle: 20.0 },
    ],
    targets: [
      { id: 't1', position: { x: 0.92, y: 0.3 }, radius: 0.045 },
    ],
    obstacles: [
      { type: 'rect', x: 0.4, y: 0.4, width: 0.3, height: 0.05, behavior: 'kill' },
    ],
    available_tools: ['wind_jet', 'attractor', 'repulsor'],
    completion: {
      targets_required: ['t1'],
      efficiency_threshold: 0.55,
      hold_duration_seconds: 4.0,
    },
    unlocks_on_complete: null,
    hints: ['Kombinieren Sie Repulsor und Wind-Jet, um Gegenwind und Hindernis gleichzeitig zu überwinden.'],
  },
];
