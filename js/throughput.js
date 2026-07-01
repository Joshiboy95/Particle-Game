// Sliding-window throughput monitor, per doc §8.5. One instance per target.

export class ThroughputMonitor {
  constructor(windowSeconds = 2.0) {
    this.windowMs = windowSeconds * 1000;
    this.captureTimestamps = [];
  }

  recordCapture(timestamp) {
    this.captureTimestamps.push(timestamp);
    const cutoff = timestamp - this.windowMs;
    while (this.captureTimestamps.length && this.captureTimestamps[0] <= cutoff) {
      this.captureTimestamps.shift();
    }
  }

  // Drops stale entries even if no capture happened this frame, so the
  // rate decays back to 0 once the stream stops arriving.
  prune(now) {
    const cutoff = now - this.windowMs;
    while (this.captureTimestamps.length && this.captureTimestamps[0] <= cutoff) {
      this.captureTimestamps.shift();
    }
  }

  getCurrentRate() {
    return (this.captureTimestamps.length / this.windowMs) * 1000;
  }

  getEfficiency(emitterRate) {
    return this.getCurrentRate() / emitterRate;
  }
}
