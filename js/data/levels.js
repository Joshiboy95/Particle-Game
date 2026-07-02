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
    description: 'Ein L-förmiges Hindernis versperrt den Weg — der Vorsprung reicht tiefer als bei der Mauer zuvor. Ein einfacher Umweg reicht hier nicht mehr.',
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
      { type: 'rect', x: 0.42, y: 0.5, width: 0.3, height: 0.2, behavior: 'kill' },
    ],
    available_tools: ['wind_jet', 'attractor', 'repulsor'],
    completion: {
      targets_required: ['t1'],
      efficiency_threshold: 0.65,
      hold_duration_seconds: 3.0,
    },
    unlocks_on_complete: null,
    hints: ['Ein steilerer Wind-Jet und ein stärkerer Attraktor als bei der Mauer nötig — der Strom muss tiefer tauchen, bevor er zurück zum Ziel kann.'],
  },
  {
    id: 4,
    name: 'Gegenwind',
    description: 'Ein ständiger Gegenwind drückt die Partikel nach links. Kombinieren Sie Ihre Werkzeuge, um ihn auszugleichen.',
    budget: 70,
    emitter_rate: 200,
    particle_lifetime: 10.0,
    ambient_force: { x: -0.08, y: 0 },
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
    hints: ['Ein einzelner Wind-Jet verliert unterwegs zu viel Schwung — platzieren Sie einen zweiten weiter stromabwärts, um den Strom erneut zu beschleunigen.'],
  },
  {
    id: 5,
    name: 'Der Engpass',
    description: 'Die Öffnung liegt nicht auf Höhe des Emitters. Lenken Sie den Strom hindurch und wieder zurück zum Ziel.',
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
      { type: 'rect', x: 0.5, y: 0.0, width: 0.04, height: 0.28, behavior: 'kill' },
      { type: 'rect', x: 0.5, y: 0.38, width: 0.04, height: 0.62, behavior: 'kill' },
    ],
    available_tools: ['wind_jet', 'attractor', 'repulsor'],
    completion: {
      targets_required: ['t1'],
      efficiency_threshold: 0.6,
      hold_duration_seconds: 3.0,
    },
    unlocks_on_complete: null,
    hints: ['Ein schräger Wind-Jet trägt den Strom durch die versetzte Lücke; ein Attraktor dahinter lenkt ihn zurück auf Zielhöhe.'],
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
  {
    // Generated by tools/level-forge (trail-first pipeline — see
    // tools/level-forge/loadouts/level8.js for the source loadout and
    // tools/level-forge/out/level-8.js for the raw pipeline output this
    // was hand-reformatted from). Obstacles form a staircase corridor
    // hugging a Wind-Jet + Attraktor + Repulsor trail's natural curve.
    id: 8,
    name: 'Die Welle',
    description: 'Drei Werkzeuge, eine durchgehende Welle: Der Strom taucht ab, schwingt zurück und muss den engen Kanal bis zum Ziel halten.',
    budget: 85,
    emitter_rate: 200,
    particle_lifetime: 10.0,
    ambient_force: { x: 0, y: 0 },
    emitters: [
      { id: 'e1', position: { x: 0.05, y: 0.5 }, direction: 0.0, spread_angle: 20.0 },
    ],
    targets: [
      { id: 't1', position: { x: 0.9, y: 0.524 }, radius: 0.045 },
    ],
    obstacles: [
      { type: 'rect', x: 0.0278, y: 0.0278, width: 0.9444, height: 0.3889, behavior: 'kill' },
      { type: 'rect', x: 0.0278, y: 0.4167, width: 0.0833, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.1667, y: 0.4167, width: 0.8056, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.2222, y: 0.4444, width: 0.6389, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.8889, y: 0.4444, width: 0.0833, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.2778, y: 0.4722, width: 0.3333, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.9444, y: 0.4722, width: 0.0278, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.3333, y: 0.5, width: 0.25, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.3889, y: 0.5278, width: 0.1667, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.0278, y: 0.5556, width: 0.0556, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.9444, y: 0.5556, width: 0.0278, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.0278, y: 0.5833, width: 0.1111, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.8056, y: 0.5833, width: 0.1667, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.0278, y: 0.6111, width: 0.1389, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.75, y: 0.6111, width: 0.2222, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.0278, y: 0.6389, width: 0.1944, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.7222, y: 0.6389, width: 0.25, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.0278, y: 0.6667, width: 0.25, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.6667, y: 0.6667, width: 0.3056, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.0278, y: 0.6944, width: 0.3056, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.6111, y: 0.6944, width: 0.3611, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.0278, y: 0.7222, width: 0.3889, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.5278, y: 0.7222, width: 0.4444, height: 0.0278, behavior: 'kill' },
      { type: 'rect', x: 0.0278, y: 0.75, width: 0.9444, height: 0.2222, behavior: 'kill' },
    ],
    available_tools: ['wind_jet', 'attractor', 'repulsor'],
    completion: {
      targets_required: ['t1'],
      efficiency_threshold: 0.58,
      hold_duration_seconds: 3.5,
    },
    unlocks_on_complete: null,
    hints: ['Ein Wind-Jet an der Quelle taucht den Strom ab, ein Attraktor schwingt ihn zurück nach oben, ein Repulsor dahinter dämpft den Schwung, bevor er das Ziel erreicht.'],
  },
];
