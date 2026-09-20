import type { EffectValue, InputEnvelope } from '../shared/types';
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export class EnvelopeProcessor {
  private smoothed = 0;
  private envelope = 0;
  private triggered = false;

  update(raw: number, config: InputEnvelope, dtMs: number): EffectValue {
    const span = Math.max(0.0001, config.calibrationMax - config.calibrationMin);
    let normalized = clamp((raw - config.calibrationMin) / span);
    if (config.invert) normalized = 1 - normalized;
    const smoothAlpha = config.smoothingMs <= 0 ? 1 : 1 - Math.exp(-dtMs / config.smoothingMs);
    this.smoothed += (normalized - this.smoothed) * smoothAlpha;
    if (!this.triggered && this.smoothed >= config.threshold) this.triggered = true;
    if (this.triggered && this.smoothed <= config.threshold - config.hysteresis) this.triggered = false;
    const target = this.triggered ? this.smoothed : 0;
    const duration = target > this.envelope ? config.attackMs : config.releaseMs;
    const alpha = duration <= 0 ? 1 : 1 - Math.exp(-dtMs / duration);
    this.envelope += (target - this.envelope) * alpha;
    if (this.envelope < 0.0001) this.envelope = 0;
    return { raw, normalized: this.smoothed, triggered: this.triggered, envelope: this.envelope };
  }

  reset() { this.smoothed = 0; this.envelope = 0; this.triggered = false; }
}
