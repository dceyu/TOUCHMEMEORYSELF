import type { GlobalState } from '../shared/types';

export class GlobalStateMachine {
  state: GlobalState = 'standby';
  multiplier = 1;
  private startedAt = 0;
  private releasedAt = 0;

  activate() { if (this.state === 'standby') { this.state = 'running'; this.multiplier = 1; } }
  trigger(now = performance.now()) { if (this.state !== 'final-releasing') { this.state = 'final-releasing'; this.startedAt = now; this.releasedAt = 0; } }
  reset() { this.state = 'standby'; this.multiplier = 0; this.startedAt = 0; this.releasedAt = 0; }

  update(finalHigh: boolean, releaseMs: number, now = performance.now()) {
    if (this.state !== 'final-releasing') return this.multiplier;
    const progress = Math.min(1, (now - this.startedAt) / Math.max(1, releaseMs));
    this.multiplier = 1 - progress * progress * (3 - 2 * progress);
    if (progress >= 1) {
      if (!finalHigh) this.releasedAt ||= now;
      else this.releasedAt = 0;
      if (this.releasedAt && now - this.releasedAt >= 500) this.reset();
    }
    return this.multiplier;
  }
}
