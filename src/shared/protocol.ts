import type { ChannelTuple, SensorFrame } from './types';
import { touchTelemetrySchema } from './touch';
const clamp = (value: number) => Math.max(0, Math.min(1, value));
export function parseSensorFrame(line: string): SensorFrame | null {
  try {
    const value: unknown = JSON.parse(line);
    if (!value || typeof value !== 'object') return null;
    const frame = value as Record<string, unknown>;
    if (frame.version !== 1 || !Number.isInteger(frame.seq) || !Array.isArray(frame.channels) || frame.channels.length !== 8) return null;
    if (!frame.channels.every(item => typeof item === 'number' && Number.isFinite(item))) return null;
    const touch=frame.touch===undefined?undefined:touchTelemetrySchema.parse(frame.touch);
    return { version: 1, seq: frame.seq as number, channels: frame.channels.map(item => clamp(item as number)) as ChannelTuple, final: frame.final === 1 ? 1 : 0, ...(touch?{touch}:{}) };
  } catch { return null; }
}
