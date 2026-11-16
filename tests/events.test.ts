import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/events';

describe('EventBus', () => {
  it('transmet les données aux écouteurs de l’événement', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('gros_coup', fn);
    bus.emit('gros_coup', { hits: 6 });
    bus.emit('rate', {});
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ hits: 6 });
  });

  it('désabonne via la fonction renvoyée ou off()', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    const stop = bus.on('tir_lance', a);
    bus.on('tir_lance', b);
    stop();
    bus.off('tir_lance', b);
    bus.emit('tir_lance', { angle: 1 });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('onAny reçoit le nom et les données de chaque événement', () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.onAny((name) => seen.push(name));
    bus.emit('tir_lance', { angle: 0 });
    bus.emit('victoire', { score: 10 });
    expect(seen).toEqual(['tir_lance', 'victoire']);
  });

  it('tolère un désabonnement pendant l’émission', () => {
    const bus = new EventBus();
    const late = vi.fn();
    const stop = bus.on('rate', () => stop());
    bus.on('rate', late);
    bus.emit('rate', {});
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('clear() retire tout', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('echec', fn);
    bus.onAny(fn);
    bus.clear();
    bus.emit('echec', { score: 0 });
    expect(fn).not.toHaveBeenCalled();
  });
});
