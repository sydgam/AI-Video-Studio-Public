import type { GameToReactEvents, ReactToGameEvents } from '../../types/gameEvents';

type EventMap = Record<string, unknown>;
type Listener<Payload> = (payload: Payload) => void;

class TypedEventBus<Events extends EventMap> {
  private listeners = new Map<keyof Events, Set<Listener<Events[keyof Events]>>>();

  on<Key extends keyof Events>(event: Key, listener: Listener<Events[Key]>): () => void {
    const eventListeners = this.listeners.get(event) ?? new Set();
    eventListeners.add(listener as Listener<Events[keyof Events]>);
    this.listeners.set(event, eventListeners);
    return () => this.off(event, listener);
  }

  off<Key extends keyof Events>(event: Key, listener: Listener<Events[Key]>): void {
    const eventListeners = this.listeners.get(event);
    eventListeners?.delete(listener as Listener<Events[keyof Events]>);
    if (eventListeners?.size === 0) this.listeners.delete(event);
  }

  emit<Key extends keyof Events>(event: Key, payload: Events[Key]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const reactToGameEvents = new TypedEventBus<ReactToGameEvents>();
export const gameToReactEvents = new TypedEventBus<GameToReactEvents>();
