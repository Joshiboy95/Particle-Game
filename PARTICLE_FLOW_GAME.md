# Particle Flow — Spiel-Design & Technische Dokumentation

**Version:** 0.1 (Pre-POC)
**Status:** Konzeptphase — bereit zur Implementierung

---

## Inhaltsverzeichnis

1. [Spielkonzept & Vision](#1-spielkonzept--vision)
2. [Kern-Spielmechaniken](#2-kern-spielmechaniken)
3. [Tool-System](#3-tool-system)
4. [Budget- & Unlock-System](#4-budget--unlock-system)
5. [Level-Abschluss-System](#5-level-abschluss-system)
6. [Level-Katalog](#6-level-katalog)
7. [Visuelles Design](#7-visuelles-design)
8. [Technische Architektur](#8-technische-architektur)
9. [Datenschemas](#9-datenschemas)
10. [Erweiterbarkeit & Skalierung](#10-erweiterbarkeit--skalierung)
11. [POC-Scope](#11-poc-scope)
12. [Offene Entscheidungen](#12-offene-entscheidungen)

---

## 1. Spielkonzept & Vision

### Kurzbeschreibung

Particle Flow ist ein taktisches Physik-Puzzle-Spiel im Browser. Der Spieler platziert Gravitationselemente in einer laufenden Partikelfeld-Simulation, um Partikelströme von einem Emitter zu einem Zielbereich zu lenken. Das Spiel läuft kontinuierlich — kein Zeitdruck, kein "Start"-Button, keine Runden. Die Herausforderung entsteht durch knappe Ressourcen, physikalische Hindernisse und die Notwendigkeit, die richtigen Tools effizient einzusetzen.

### Ton & Atmosphäre

- Meditativ, nicht stressig
- Visuell: dunkler Hintergrund, leuchtende Partikelströme
- Spannung entsteht durch Mechaniken und Ressourcenentscheidungen, nicht durch Zeitdruck
- Jederzeit pausierbar (aber keine Simulation — der Strom läuft immer)

### Kernphilosophie

> Der Spieler beobachtet, baut, justiert — in Echtzeit. Ein guter Strom sieht aus wie eine funktionierende Maschine. Das Ziel ist nicht das Lösen eines Rätsels, sondern das Erschaffen eines fließenden Systems.

---

## 2. Kern-Spielmechaniken

### 2.1 Partikel-Lifecycle

Partikel werden kontinuierlich vom Emitter abgefeuert. Jedes Partikel hat folgende Eigenschaften:

| Eigenschaft | Beschreibung |
|---|---|
| Position (x, y) | Startposition am Emitter |
| Velocity (vx, vy) | Anfangsgeschwindigkeit mit konfigurierbarer Streuung |
| Lifetime | Maximale Lebensdauer in Sekunden (z.B. 8–12s, Level-abhängig) |
| Masse | Einheitlich oder variabel (zukünftige Erweiterung) |
| State | alive / dead / captured |

**Ein Partikel stirbt, wenn:**
- Es eine Wand oder ein Obstacle berührt
- Seine Lifetime abläuft
- Es den Bildschirmrand verlässt
- Es in eine Kill-Zone (Absorber) eintritt

**Ein Partikel wird "captured", wenn:**
- Es den Zielbereich betritt — es verschwindet und wird dem Durchsatz-Zähler hinzugefügt

### 2.2 Emitter

- Schießt konstant X Partikel pro Sekunde (konfigurierbar pro Level, z.B. 200/s)
- Emitter-Position ist fix (vom Level vorgegeben)
- Emitter-Streuwinkel ist konfigurierbar (z.B. ±15° vom Basisvektor)
- Mehrere Emitter sind in späteren Leveln möglich
- Emitter kann einen Basisvektor haben (z.B. "schießt nach rechts") oder 360°

### 2.3 Kraftfelder

Alle platzierten Tools erzeugen lokale Kraftfelder. Auf jedes lebende Partikel wird in jedem Frame die summierte Kraft aller aktiven Felder angewendet:

```
F_total(p) = sum(F_tool_i(p)) für alle platzierten Tools i
```

Die Kraft jedes Tools nimmt mit der Distanz ab (Falloff). Der genaue Falloff-Typ (linear, quadratisch, smooth) ist pro Tool-Typ definiert.

### 2.4 Obstacles

Obstacles sind statische oder dynamische geometrische Formen, die Partikel bei Berührung töten (oder, je nach Typ, reflektieren). Sie sind Teil der Level-Daten und können nicht vom Spieler platziert werden.

Obstacle-Typen:

| Typ | Verhalten | POC |
|---|---|---|
| Solid Wall | Partikel stirbt bei Kontakt | Ja |
| Reflective Wall | Partikel prallt ab (Reflexionsvektor) | Nein |
| Kill Zone | Unsichtbarer Absorber-Bereich | Nein |
| Rotating Wall | Dreht sich um einen Punkt | Nein |
| Oscillating Wall | Schwingt vor/zurück | Nein |
| One-Way Gate | Partikel nur in eine Richtung passierbar | Nein |
| Narrow Passage | Sehr enge Öffnung, erzwingt präzises Funneling | Nein |

---

## 3. Tool-System

### 3.1 Tool-Katalog

#### Wind-Jet (Strömung)

- Erzeugt eine gerichtete Kraft in einem Kegelbereich
- Einstellbar: Richtung (Winkel), Stärke, Reichweite
- Kein Falloff mit der Distanz (gleichmäßige Kraft im Kegel)
- Visuell: animierte Pfeil-Partikel zeigen die Kraftrichtung
- Kosten: 10 Punkte
- Unlock: Level 1 (Tutorial)

#### Attraktor (Anziehungspunkt)

- Zieht alle Partikel im Radius proportional zur Nähe an
- Falloff: quadratisch (stark in der Mitte, schwach am Rand)
- Kein "Tod" wenn Partikel den Mittelpunkt erreichen — Partikel fliegen tangential vorbei (Slingshot-Effekt)
- Radius und Stärke einstellbar
- Visuell: pulsierende Kreislinien nach innen
- Kosten: 20 Punkte
- Unlock: Level 2

#### Repulsor (Abstoßungspunkt)

- Stößt alle Partikel im Radius ab
- Gleiche Physik wie Attraktor, invertierte Kraft
- Geeignet als Funnel-Barriere oder Stream-Splitter
- Radius und Stärke einstellbar
- Visuell: pulsierende Kreislinien nach außen
- Kosten: 20 Punkte
- Unlock: Level 3

#### Vortex (Wirbel)

- Dreht Partikel um den Mittelpunkt (tangentiale Kraft)
- Drehrichtung: im Uhrzeigersinn oder gegen den Uhrzeigersinn (wählbar)
- Ermöglicht U-Turns und Slingshot-Bögen
- Falloff: linear
- Visuell: Spirallinien, Rotationsanzeige
- Kosten: 35 Punkte
- Unlock: Level 5

#### Deflector (Linienspiegel)

- Eine gerade Linie, Partikel werden reflektiert (kein Tod)
- Winkel frei einstellbar per Drag
- Länge begrenzt (z.B. max. 20% der Bildschirmbreite)
- Verhält sich wie eine reflektierende Wand
- Visuell: leuchtende Linie mit Richtungsindikator
- Kosten: 25 Punkte
- Unlock: Level 7

#### Portal-Paar (Teleporter)

- Zwei platzierbare Punkte: Eingang A und Ausgang B
- Partikel die durch A fliegen, erscheinen bei B mit ursprünglichem Geschwindigkeitsvektor
- Ausgangsvektor kann optional gedreht werden (konfigurierbare Rotation am Portal)
- Teures, sehr mächtiges Tool
- Visuell: verbundene Ringportale mit Farbkodierung (A/B)
- Kosten: 60 Punkte
- Unlock: Level 9

### 3.2 Tool-Interaktion

- Tools werden per Drag aus einer Toolpalette auf die Canvas gezogen
- Platzieren ist jederzeit möglich, während Partikel fließen
- Bereits platzierte Tools können per Drag verschoben werden
- Per Rechtsklick oder Hover-Menü: Stärke/Radius einstellen, Tool entfernen
- Entfernen gibt die Kosten vollständig zurück (kein Penalty)
- Tools können nicht auf Obstacles oder außerhalb der Spielfläche platziert werden

### 3.3 Zukünftige Tools (nicht im POC)

| Tool | Funktion |
|---|---|
| Delay Field | Verlangsamt Partikel in einer Zone |
| Tube / Rail | Zwingt Partikel entlang einer Linie |
| Mass Emitter | Ändert Partikel-Masse lokal (beeinflusst Falloff-Reaktion) |
| Color Filter | Nur Partikel einer bestimmten Farbe passieren |
| Boost Pad | Erhöht Partikelgeschwindigkeit in eine Richtung |
| Gravity Well | Kombinierter Attraktor + Vortex mit konfigurierbarer Mischung |

---

## 4. Budget- & Unlock-System

### 4.1 Energie-Budget

Jedes Level startet mit einem fixen Energie-Budget (EP — Energie-Punkte). Der Spieler gibt dieses Budget aus, indem er Tools platziert. Entfernte Tools geben EP zurück.

Das Budget kann **nicht** aufgespart oder zwischen Leveln übertragen werden. Es ist ein pro-Level-Ressource.

Formel für verbleibendes Budget:

```
EP_verfügbar = EP_start - sum(Kosten aller platzierten Tools)
```

Visuell: Energie-Budget wird als horizontaler Balken in der UI angezeigt, der sich beim Platzieren leert.

### 4.2 Unlock-Progression

Tools werden einmalig freigeschaltet und sind dann in allen Folge-Leveln im Tool-Pool verfügbar:

| Level | Neues Tool | Grund |
|---|---|---|
| 1 | Wind-Jet | Tutorial, einfachstes Konzept |
| 2 | Attraktor | Slingshot-Mechanik einführen |
| 3 | Repulsor | Gegenteil des Attraktors |
| 5 | Vortex | Fortgeschrittene Kurven |
| 7 | Deflector | Linienreflexion als neues Konzept |
| 9 | Portal-Paar | Mächtigstes, letztes Tool |

### 4.3 Mehrere Lösungswege

Das Budget-System erzeugt bewusst mehrere gültige Lösungsstrategien. Beispiel für Level 2 (Wand):

- **Lösung A:** Attraktor (20 EP) + Wind-Jet (10 EP) = 30 EP für einen einfachen Slingshot
- **Lösung B:** Vortex (35 EP) allein für eine elegante 180°-Kurve (nur wenn Vortex bereits freigeschaltet)
- **Lösung C:** Zwei Wind-Jets (20 EP) für einen groben Umweg über die Wand-Kante

Das Level hat eine Lösung. Der Spieler entscheidet den Weg.

---

## 5. Level-Abschluss-System

### 5.1 Durchsatz-Messung

Das Spiel misst kontinuierlich den Partikel-Durchsatz am Ziel:

- Sliding Window: rollendes 2-Sekunden-Fenster
- Gemessen: Partikel pro Sekunde die den Zielbereich betreten
- Keine absolute Zahl — prozentualer Anteil am Emitter-Output

```
Durchsatz_aktuell = (Partikel_im_Fenster / Fensterbreite_in_Sekunden)
Effizienz = Durchsatz_aktuell / Emitter_rate
```

### 5.2 Abschluss-Trigger

Level-Abschluss erfolgt wenn:
1. Effizienz >= Schwellenwert (z.B. 75% — Level-spezifisch konfigurierbar)
2. Dieser Schwellenwert wird für X Sekunden ununterbrochen gehalten (z.B. 3 Sekunden)

Bricht der Strom ab, wird der Halte-Timer zurückgesetzt. Kurze Schwankungen werden durch das Sliding Window geglättet.

Der Schwellenwert und die Haltezeit sind pro Level konfigurierbar:

```json
"completion": {
  "efficiency_threshold": 0.75,
  "hold_duration_seconds": 3.0
}
```

### 5.3 Visueller Zielkreis

Der Zielkreis kommuniziert den Fortschritt visuell:

**Füllstand (Füllung des Kreises):**
- Mappt direkt auf die aktuelle Effizienz (0%–100%)
- Zielpartikel sammeln sich sichtbar im Kreis (Partikel-Pool-Effekt)
- Wenn Effizienz sinkt, "verdunsten" Partikel langsam aus dem Kreis (Trägheit: ~1 Sekunde Verzögerung)

**Außenring:**
- Fortschrittsring zeigt den Halte-Timer (0–100% der Haltedauer)
- Füllt sich wenn Schwelle gehalten wird
- Leert sich bei Unterbrechung (mit Trägheit)

**Abschluss-Effekt:**
- Bei 100% Haltezeit: Zielkreis "explodiert" in Partikelwolke nach außen
- Partikel des Explosionseffekts folgen dem aktuellen Kraftfeld kurz nach bevor sie verblassen
- Übergangs-Screen erscheint

---

## 6. Level-Katalog

### Level-Struktur

Jedes Level wird als JSON-Datenstruktur definiert (siehe Abschnitt 9). Die Spiellogik ist Level-agnostisch.

### Level 1 — "Erster Kontakt"

- **Beschreibung:** Freie Bahn, kein Hindernis. Emitter links, Ziel rechts.
- **Ziel:** Spieler lernt den Wind-Jet und die Grundphysik.
- **Budget:** 30 EP
- **Verfügbare Tools:** Wind-Jet
- **Schwelle:** 60% Effizienz, 2s Haltezeit
- **Design-Hinweis:** Partikel können theoretisch auch ohne Tool ankommen (mit breitem Emitter-Winkel), aber das dauert lange. Der Tutorial-Text zeigt, wie ein Wind-Jet hilft.

### Level 2 — "Die Mauer"

- **Beschreibung:** Horizontale Wand blockiert den direkten Weg. Schmale Öffnung an der Wand-Kante.
- **Ziel:** Attraktor als Slingshot einführen.
- **Budget:** 50 EP
- **Verfügbare Tools:** Wind-Jet, Attraktor (NEU)
- **Schwelle:** 65% Effizienz, 3s Haltezeit
- **Lösungshinweis:** Ein Attraktor knapp über der Wand-Kante zieht den Strom nach oben, er schwingt tangential vorbei und fliegt zum Ziel.

### Level 3 — "Das L"

- **Beschreibung:** L-förmiges Hindernis. Repulsor wird eingeführt.
- **Ziel:** Repulsor als Funnel kennenlernen.
- **Budget:** 60 EP
- **Verfügbare Tools:** Wind-Jet, Attraktor, Repulsor (NEU)
- **Schwelle:** 65% Effizienz, 3s Haltezeit
- **Design-Hinweis:** Der Repulsor kann genutzt werden, um den Strom weg von der L-Innenwand zu drücken.

### Level 4 — "Gegenwind"

- **Beschreibung:** Ambient-Kraft drückt Partikel konstant nach links (globales Kraftfeld, Teil der Level-Daten).
- **Ziel:** Kraft-Kompensation mit mehreren Tools kombinieren.
- **Budget:** 70 EP
- **Verfügbare Tools:** Wind-Jet, Attraktor, Repulsor
- **Schwelle:** 60% Effizienz, 3s Haltezeit

### Level 5 — "Der Wirbel"

- **Beschreibung:** Zwei Hindernisse erzeugen eine enge S-Kurve. Vortex wird eingeführt.
- **Ziel:** Vortex für U-Turns kennenlernen.
- **Budget:** 75 EP
- **Verfügbare Tools:** Wind-Jet, Attraktor, Repulsor, Vortex (NEU)
- **Schwelle:** 65% Effizienz, 3s Haltezeit

### Level 6 — "Zwei Quellen"

- **Beschreibung:** Zwei Emitter, ein Ziel. Beide Ströme müssen zusammengeführt werden.
- **Ziel:** Ressourcen-Management mit mehreren Strömen.
- **Budget:** 80 EP
- **Verfügbare Tools:** Alle bisherigen
- **Schwelle:** 70% kombinierte Effizienz (gemessen an beiden Emittern zusammen), 3s Haltezeit

### Level 7 — "Der Spiegel"

- **Beschreibung:** Ziel liegt hinter einer geschlossenen Wand mit Öffnung im falschen Winkel. Deflector wird eingeführt.
- **Ziel:** Reflexions-Mechanik mit Winkelberechnung.
- **Budget:** 85 EP
- **Verfügbare Tools:** Alle bisherigen, Deflector (NEU)
- **Schwelle:** 65% Effizienz, 3s Haltezeit

### Level 8 — "Das Timing"

- **Beschreibung:** Rotierende Wand blockiert den Weg periodisch. Partikel müssen durch Fenster manövriert werden.
- **Ziel:** Erste dynamische Obstacle-Mechanik.
- **Budget:** 80 EP
- **Verfügbare Tools:** Alle bisherigen
- **Schwelle:** 55% Effizienz (Threshold niedriger wegen periodichem Verlust), 4s Haltezeit

### Level 9 — "Zwei Ziele"

- **Beschreibung:** Zwei Ziele müssen gleichzeitig mit ausreichendem Durchsatz befüllt werden. Portal-Paar wird eingeführt.
- **Ziel:** Stream-Splitting und Portal-Mechanik.
- **Budget:** 100 EP
- **Verfügbare Tools:** Alle, Portal-Paar (NEU)
- **Completion-Logik:** BEIDE Ziele müssen gleichzeitig die Schwelle halten
- **Schwelle:** 55% pro Ziel, 3s Haltezeit gleichzeitig

### Level 10 — "Die Maschine"

- **Beschreibung:** Boss-Level. Drei Emitter, zwei Ziele, rotierende Wände, enge Passagen. Knappe Budget.
- **Ziel:** Alle Mechaniken kombinieren.
- **Budget:** 110 EP
- **Verfügbare Tools:** Alle
- **Schwelle:** 60% pro Ziel, 5s Haltezeit gleichzeitig

---

## 7. Visuelles Design

### 7.1 Ästhetik

- Hintergrund: Sehr dunkles Blaugrau-Schwarz (#0A0C10)
- Partikel: Leuchtendes Blau-Weiß, leichte Variation in Helligkeit
- Obstacles: Dunkelgrau mit schwacher blau-weißer Kante (#1E2230, Glow-Effekt)
- Emitter: Kleiner pulsierender Punkt, strahlt Licht aus
- Zielkreis: Subtil leuchtender Ring, Füllstand-Visualisierung

### 7.2 Tool-Visualisierungen

Jedes Tool hat eine unverwechselbare visuelle Sprache:

| Tool | Visuell |
|---|---|
| Wind-Jet | Bewegliche Pfeillinie im Kegel-Bereich |
| Attraktor | Konzentrische Kreislinien die nach innen wandern |
| Repulsor | Konzentrische Kreislinien die nach außen wandern |
| Vortex | Spirallinien, Rotationsrichtung erkennbar |
| Deflector | Leuchtende Linie mit spiegelähnlichem Schimmer |
| Portal | Zwei farbkodierte Ringe (z.B. blau/orange) mit Verbindungslinie |

### 7.3 Typographie & UI

- Schrift: Figtree (Humanist Sans)
- UI-Sprache: Deutsch
- Tonalität im Spiel: formell (Sie-Form) — Level-Beschreibungen, Hinweistexte
- Dark Mode only (kein Toggle — das Spiel hat nur einen Modus)
- Akzentfarbe: Blau (kann durch Spieler-Einstellung variiert werden — zukünftige Erweiterung)

### 7.4 UI-Elemente

**Toolpalette (untere Leiste oder seitliche Leiste)**
- Zeigt alle freigeschalteten Tools
- Noch nicht freigeschaltete Tools: ausgegraut mit "Level X" Label
- Kosten des Tools wird als kleine Zahl angezeigt
- Drag-to-place direkt von der Palette

**Budget-Anzeige**
- Energie-Balken oben oder neben der Palette
- Numerisch + visuell (Balken)
- Leert sich beim Platzieren, füllt sich beim Entfernen

**Durchsatz-Anzeige**
- Kleiner Indikator nahe dem Zielkreis
- Zeigt aktuelle Partikel/s im Ziel
- Nicht zu prominent — Hauptfeedback ist der Zielkreis selbst

**Level-Info**
- Kurze Level-Beschreibung beim Start (Modal, schließt sich automatisch nach 4s oder per Klick)
- "Level X von 10"

---

## 8. Technische Architektur

### 8.1 Rendering-Stack

Das Spiel basiert auf einer GPGPU-Partikelarchitektur mit WebGL. Alle Partikelberechnungen laufen auf der GPU.

```
Haupt-Canvas (WebGL)
├── Partikel-Simulation (GPGPU Ping-Pong)
│   ├── Position-Texture A/B (float, RGBA: x, y, vx, vy)
│   ├── Metadata-Texture A/B (float, RGBA: lifetime, state, ...)
│   ├── Compute-Shader: Velocity-Update (Kräfte anwenden)
│   └── Compute-Shader: Position-Update + Boundary-Check
├── Render-Pass: Partikel als Punkte/Quads rendern
└── Render-Pass: Obstacles, Emitter, Zielkreis

Overlay-Canvas (Canvas2D)
├── Tool-Visualisierungen (Radien, Kraftlinien)
├── UI-Elemente (Budget-Balken, Durchsatzanzeige)
└── Drag-and-Drop-Interaktionen
```

### 8.2 GPGPU Ping-Pong

Die Partikelposition und -geschwindigkeit werden in zwei Textur-Paaren gespeichert (A und B). Jeder Frame:

1. Read von Texture A
2. Compute-Shader berechnet neuen Zustand
3. Write in Texture B
4. Swap A und B

Die Texturgröße bestimmt die maximale Partikelanzahl:
- 512x512 Textur = 262.144 Partikel
- 256x256 Textur = 65.536 Partikel (ausreichend für POC)

### 8.3 Kraft-Feld-Shader

Alle platzierten Tools werden als Uniform-Array an den Compute-Shader übergeben. Der Shader iteriert über alle Tools und akkumuliert die Kraft:

```glsl
// Pseudo-GLSL — vereinfacht
struct Tool {
  vec2 position;
  float type;       // 0=WindJet, 1=Attraktor, 2=Repulsor, 3=Vortex, ...
  float strength;
  float radius;
  float param1;     // Tool-spezifisch: z.B. Winkel für WindJet
  float param2;     // Tool-spezifisch: z.B. Drehrichtung für Vortex
};

uniform Tool u_tools[MAX_TOOLS];  // MAX_TOOLS = 16 (konfigurierbar)
uniform int u_tool_count;

vec2 computeForce(vec2 particlePos) {
  vec2 totalForce = vec2(0.0);
  for (int i = 0; i < u_tool_count; i++) {
    totalForce += applyTool(u_tools[i], particlePos);
  }
  return totalForce;
}
```

Neues Tool = neue Funktion `applyTool` im Shader. Der Rest der Pipeline bleibt unverändert.

### 8.4 Obstacle-Kollision

Obstacles werden als geometrische Primitive im Shader codiert:

```glsl
struct Obstacle {
  float type;      // 0=Line, 1=Circle, 2=Rect, 3=Polygon
  vec4 params;     // Typ-abhängig
  float behavior;  // 0=Kill, 1=Reflect
};

uniform Obstacle u_obstacles[MAX_OBSTACLES];
```

Kollisionsprüfung erfolgt im Compute-Shader nach dem Positionsupdate. Bei Kollision: State auf `dead` setzen oder Velocity invertieren (reflect).

### 8.5 Durchsatz-Messung (JavaScript)

Der Zielbereich wird in JS überwacht:

```javascript
class ThroughputMonitor {
  constructor(windowSeconds = 2.0) {
    this.windowMs = windowSeconds * 1000;
    this.captureTimestamps = [];  // Ringpuffer von Capture-Events
  }

  // Wird aufgerufen wenn ein Partikel das Ziel erreicht
  recordCapture(timestamp) {
    this.captureTimestamps.push(timestamp);
    // Alte Einträge entfernen
    const cutoff = timestamp - this.windowMs;
    this.captureTimestamps = this.captureTimestamps.filter(t => t > cutoff);
  }

  // Gibt Partikel/Sekunde zurück
  getCurrentRate() {
    return (this.captureTimestamps.length / this.windowMs) * 1000;
  }

  getEfficiency(emitterRate) {
    return this.getCurrentRate() / emitterRate;
  }
}
```

Die Erkennung von Partikelankünften erfolgt via GPU Readback: jeder Frame wird ein kleiner Bereich der Metadata-Texture ausgelesen (nur der Zielbereich-Pixel), um `captured`-States zu zählen. Alternativ: Transform Feedback (WebGL2) für effizienteres Counting.

### 8.6 Level-State-Machine

```
IDLE
  └──> [Level laden] ──> RUNNING
                           ├── [Threshold erreicht] ──> HOLDING
                           │                              ├── [Threshold verloren] ──> RUNNING
                           │                              └── [Haltezeit abgelaufen] ──> COMPLETE
                           └── [immer] ──> RUNNING
```

### 8.7 Dateistruktur (Single-File HTML)

Das Spiel wird als einzelne HTML-Datei ausgeliefert (konsistent mit bestehenden Projekten):

```
particle-flow.html
├── <style>       — CSS (UI, Overlays, Animationen)
├── <canvas id="gl-canvas">    — WebGL Partikel
├── <canvas id="ui-canvas">    — Canvas2D UI-Overlay
├── <script type="x-shader">   — GLSL Shader-Quellen
└── <script>
    ├── WebGL Setup & Shader-Kompilierung
    ├── GPGPU Ping-Pong Texturen
    ├── Particle System (Emitter, Lifecycle)
    ├── Tool System (Platzierung, Uniformen)
    ├── Obstacle System (Geometrie, Kollision)
    ├── Level Manager (JSON laden, State Machine)
    ├── Throughput Monitor (Sliding Window)
    ├── UI Manager (Canvas2D, Drag-and-Drop)
    └── LEVEL_DATA (alle Level-Definitionen)
```

---

## 9. Datenschemas

### 9.1 Level-Schema

```json
{
  "id": 2,
  "name": "Die Mauer",
  "description": "Eine Wand blockiert den direkten Weg. Nutzen Sie den Attraktor, um die Partikel herumzulenken.",
  "budget": 50,
  "emitter_rate": 200,
  "particle_lifetime": 10.0,
  "ambient_force": { "x": 0, "y": 0 },

  "emitters": [
    {
      "id": "e1",
      "position": { "x": 0.05, "y": 0.5 },
      "direction": 0.0,
      "spread_angle": 20.0
    }
  ],

  "targets": [
    {
      "id": "t1",
      "position": { "x": 0.92, "y": 0.5 },
      "radius": 0.04
    }
  ],

  "obstacles": [
    {
      "type": "rect",
      "x": 0.45,
      "y": 0.0,
      "width": 0.04,
      "height": 0.65,
      "behavior": "kill"
    }
  ],

  "available_tools": ["wind_jet", "attractor"],

  "completion": {
    "targets_required": ["t1"],
    "efficiency_threshold": 0.65,
    "hold_duration_seconds": 3.0
  },

  "unlocks_on_complete": "repulsor",

  "hints": [
    "Ein Attraktor knapp über der Wandkante lenkt die Partikel elegant vorbei."
  ]
}
```

### 9.2 Tool-Schema (Platzierungsstate)

```json
{
  "id": "tool_instance_001",
  "type": "attractor",
  "position": { "x": 0.48, "y": 0.28 },
  "radius": 0.12,
  "strength": 0.8,
  "params": {}
}
```

### 9.3 Tool-Definition-Schema (im Spiel-Code)

```json
{
  "type": "attractor",
  "label": "Attraktor",
  "cost": 20,
  "unlocked_at_level": 2,
  "shader_type_id": 1,
  "default_radius": 0.10,
  "default_strength": 0.7,
  "configurable": ["radius", "strength"],
  "max_per_level": null
}
```

### 9.4 Game-State-Schema (Speicherstand)

```json
{
  "version": "1.0",
  "current_level": 3,
  "completed_levels": [1, 2],
  "unlocked_tools": ["wind_jet", "attractor", "repulsor"],
  "settings": {
    "particle_count": 65536,
    "sound_enabled": true
  }
}
```

Gespeichert in `localStorage` unter dem Key `particle_flow_save`.

---

## 10. Erweiterbarkeit & Skalierung

### 10.1 Neues Tool hinzufügen

Checkliste für ein neues Tool:

1. **GLSL:** Neue `applyTool_XYZ(Tool t, vec2 pos)` Funktion im Compute-Shader
2. **GLSL:** Case in der `applyTool()` Switch-Anweisung ergänzen
3. **JS:** Neues Eintrag in `TOOL_DEFINITIONS` Array
4. **JS:** `renderToolVisual(tool, ctx)` Case für Canvas2D-Darstellung
5. **JSON:** `unlocked_at_level` und `cost` definieren
6. **CSS:** Icon/Farbe für Toolpalette

Das ist der gesamte Aufwand. Bestehende Level, Partikel-Simulation und UI benötigen keine Änderungen.

### 10.2 Neues Obstacle hinzufügen

1. **GLSL:** Kollisionsfunktion für neuen Obstacle-Typ schreiben
2. **GLSL:** Case in `checkObstacle()` ergänzen
3. **JS:** Render-Funktion für das Obstacle (Canvas2D oder WebGL-Geometrie)
4. **JSON:** Neuen Typ in Obstacle-Definitionen nutzen

### 10.3 Neues Level hinzufügen

Ausschließlich Datenpflege — kein Code:

1. Neues Level-JSON-Objekt in `LEVEL_DATA` Array einfügen
2. Obstacles, Emitter, Ziele, Budget, Schwellen definieren
3. `unlocks_on_complete` setzen

### 10.4 Globale Kraftfelder (Ambient Forces)

Level-JSON enthält `ambient_force: { x, y }`. Im Compute-Shader wird dieser Vektor zu jeder Kraft-Akkumulation addiert. Erweiterbar auf:
- Zeitabhängige Kräfte (z.B. Sinuswelle)
- Positionsabhängige Kräfte (Gravitationsfeld das die gesamte Spielfläche betrifft)
- Mehrere simultane Ambient-Felder

### 10.5 Partikel-Typen (zukünftig)

Die Metadata-Texture kann eine `mass`- oder `color_tag`-Komponente erhalten. Tools können dann typenselektiv wirken:
- Blauer Attraktor: zieht nur blaue Partikel an
- Masse-Varianz: schwere Partikel reagieren träger auf Kräfte
- Das Ziel kann gewichtet sein (blaue Partikel zählen doppelt)

### 10.6 Prozedurales Level-System (weit zukünftig)

Da Level reines JSON sind, ist ein prozeduraler Generator möglich:
- Obstacle-Platzierung per Algorithmus
- Budget-Berechnung basierend auf lösbarer Mindest-Tool-Kombination
- Seed-basierte Level (Share-Links: `?level=abc123`)

---

## 11. POC-Scope

### Ziel des POC

Ein funktionierendes, spielbares Proof-of-Concept in einer einzelnen HTML-Datei mit 3 Leveln, das die vollständige Spielarchitektur bereits sauber abbildet.

### Enthaltene Features

- GPGPU Partikel-Simulation (WebGL2, Ping-Pong Texturen)
- 3 Level (L1: frei, L2: Mauer, L3: L-Hindernis)
- 3 Tools: Wind-Jet, Attraktor, Repulsor
- Drag-and-Place Tool-Platzierung
- Tool-Radius/Stärke per Slider einstellbar
- Budget-System mit Rückerstattung
- Sliding-Window Durchsatz-Messung
- Visueller Zielkreis mit Füllstandsanimation
- Level-Abschluss-Trigger + einfacher Übergangs-Screen
- Unlock-System (Attraktor bei L2, Repulsor bei L3 freigeschaltet)
- Speicherstand in localStorage

### Explizit ausgeschlossen (aber architekturell vorbereitet)

- Kein Vortex, Deflector, Portal
- Keine Rotating/Oscillating Obstacles
- Kein Sound
- Kein Moving Target
- Kein Multi-Target-Completion
- Keine Ambient Forces
- Kein Tutorial-Overlay

### Technische Zielgröße

- 256x256 GPGPU-Textur (65.536 Partikel)
- 200 Partikel/Sekunde Emitter-Rate
- 60 FPS auf Mittelklasse-Hardware (GTX 1070 oder vergleichbar)
- Maximale Dateigröße: ~1 MB (keine externen Abhängigkeiten)

---

## 12. Offene Entscheidungen

| Thema | Optionen | Empfehlung |
|---|---|---|
| Obstacle-Visualisierung | Canvas2D oder WebGL-Geometrie | WebGL — besser ins Rendering integriert, kein Layer-Mismatch |
| GPU Readback für Capture-Detection | Readback pro Frame oder Transform Feedback | Transform Feedback (WebGL2) — effizienter, aber komplexer |
| Tool-Konfiguration im Spiel | Slider-Overlay on Hover oder separates Properties-Panel | Hover-Overlay, klein und nicht-invasiv |
| Sound | Kein Sound, ambienter Drone, reaktive Sounds | Ambienter Drone im POC optional, reaktive Sounds erst später |
| Mobile Support | Desktop-only oder Touch-Drag | Desktop-first im POC, Touch-Drag als spätere Erweiterung |
| Partikelanzahl | 65k oder 256k | 65k für POC, 256k Option per Setting |

---

*Dokument-Ende — Version 0.1*
*Erstellt für Implementierungsübergabe und Architektur-Entscheidungen*
