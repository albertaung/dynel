/** Callback function type for state changes or events */
type Listener<T> = (payload: T) => void;

/**
 * State container with change notifications
 * @template T Value type stored in the state
 */
class State<T> {
  private readonly name: string;
  private value: T | undefined;
  /** Callbacks triggered on value changes */
  private setCallbacks: (Listener<typeof this.value>)[];

  /**
   * Creates a new State instance
   * @param initialValue Optional initial value
   */
  constructor(initialValue?: T, name?: string) {
    this.name = name ?? String(Date.now());
    this.value = initialValue;
    this.setCallbacks = [];
    
    State.registerInstance(this.name, this);
  }

  /**
   * Registers a state change callback
   * @param cb Callback function receiving new value
   */
  public subscribe(cb: Listener<T | undefined>) {
    this.setCallbacks.push(cb);
  }

  /**
   * Updates value and triggers callbacks
   * @param newValue New value to set
   */
  public set(newValue: typeof this.value) {
    this.value = newValue;
    this.setCallbacks.forEach((cb) => cb(this.value));
  }

  /**
   * Returns current value
   */
  public get() {
    return this.value;
  }

  /** Registry of named states */
  private static instanceMap: Map<string, State<any>> = new Map();

  /**
   * Subscribes to a named state
   * @param name State identifier
   * @param cb Callback for state changes
   */
   /**
    * Subscribes to a named state
    * @param name State identifier or callback function
    * @param cb Callback for state changes or array of states
    */
   public static subscribe(name: string, cb: Listener<any>): void;
   public static subscribe(cb: Listener<undefined>, ...states: State<any>[]): void;
   public static subscribe(part1: string | Listener<undefined>, part2?: Listener<any> | State<any>, ...part3: State<any>[]): void {
     if (typeof part1 === 'string') {
       // First overload: subscribe(name: string, cb: Listener<any>)
       const cb = part2 as Listener<any>;
       State.instanceMap.get(part1)?.subscribe(cb);
     } else {
       // Second overload: subscribe(cb: Listener<undefined>, ...states: State<any>[])
       const cb = part1;
       const states: State<any>[] = [part2 as State<any>, ...part3];
       states.forEach(s => s.subscribe(cb));
     }
   }

  /**
   * Updates a named state
   * @param name State identifier
   * @param newValue Value to set
   */
  public static set(name: string, newValue: any) {
    (
      State.instanceMap.has(name)
      ? State.instanceMap
      : State.instanceMap.set(name, new State(undefined, name))
    ).get(name)!.set(newValue);
  }

  /**
   * Gets a named state's value
   * @param name State identifier
   */
  public static get(name: string): any | undefined {
    return State.instanceMap.get(name)?.get();
  }
  
  /**
   * Registers a state in the registry
   */
  private static registerInstance(name: string, instance: State<any>) {
    State.instanceMap.set(name, instance);
  }
}

/**
 * Event system for publish-subscribe pattern
 */
class Event {
  public readonly name: string;
  private listeners: Listener<any>[];

  /**
   * Creates a named event
   * @param name Event identifier
   */
  constructor(name: string) {
    this.name = name;
    this.listeners = [];

    Event.registerInstance(this.name, this);
  }

  /**
   * Registers an event handler
   * @param listener Function called when event triggers
   */
  public addListener(listener: Listener<any>) {
    this.listeners.push(listener);
  }

  /**
   * Fires the event with optional data
   * @param payload Data passed to listeners
   */
  public trigger(payload?: any) {
    this.listeners.forEach((listener) => listener(payload));
  }

  /** Registry of named events */
  private static instanceMap: Map<string, Event> = new Map();

  /**
   * Adds listener to a named event
   * @param name Event identifier
   * @param listener Handler function
   */
  public static addListener(name: string, listener: Listener<any>) {
    (
      Event.instanceMap.has(name)
        ? Event.instanceMap
        : Event.instanceMap.set(name, new Event(name))
    ).get(name)!.addListener(listener);
  }

  /**
   * Triggers a named event
   * @param name Event identifier
   * @param payload Data passed to listeners
   */
  public static trigger(name: string, payload: any) {
    Event.instanceMap.get(name)?.trigger(payload);
  }

  /**
   * Registers an event in the registry
   */
  private static registerInstance(name: string, instance: Event) {
    Event.instanceMap.set(name, instance);
  }
}

export { State, Event };
export type { Listener};