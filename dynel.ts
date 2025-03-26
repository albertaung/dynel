type Listener<T> = (data: T) => void;

/**
 * Represents a state container with value change notifications.
 * @template T The type of value stored in the state
 */
class State<T> {
  private value: T | undefined;
  /**
   * Array of callback functions to be called when value changes
   */
  setCbs: (Listener<typeof this.value>)[];
  /**
   * Creates a new State instance
   * @param initialValue Optional initial value
   */
  constructor(initialValue?: T) {
    this.value = initialValue;
    this.setCbs = [];
  }
  /**
   * Registers a callback to be called when value changes
   * @param cb Callback function receiving new and old values
   */
  onSet(cb: typeof this.setCbs[0]) {
    this.setCbs.push(cb);
  }
  /**
   * Sets a new value and triggers callbacks
   * @param newValue The new value to set
   */
  set(newValue: typeof this.value) {
    this.value = newValue;
    this.setCbs.forEach((cb) => cb(this.value));
  }
  /**
   * Gets the current value
   * @returns Current value
   */
  get() {
    return this.value;
  }
}

/**
 * Custom element for dynamic component loading and management
 */
class Dynel extends HTMLElement {
  /** Component kind identifier */
  name: string;
  /** Source template ID */
  sourceId: string;
  /** Unique identifier for this instance */
  uid: string;
  /** Root of the instance */
  root: Dynel | ShadowRoot;
  /** Controls whether the component uses Shadow DOM encapsulation */
  useShadow: boolean;

  constructor() {
    super();
    this.useShadow = false;
    this.root = this.useShadow ? this.attachShadow({ mode: "open" }) : this;
    this.uid = (Date.now() * 100 + Math.trunc(Math.random() * 10000))
      .toString();
    Dynel.registerElem(this.uid, this);
    this.name = "default-element";
    this.sourceId = "default";
  }
  /** Called when element is connected to DOM */
  connectedCallback() {
    Dynel.fetch(
      this.sourceId,
      (containerNode) => {
        this.assemble(containerNode!);
      },
    );
  }
  /**
   * Assembles component from template
   * @param containerNode The template container element
   */
  private assemble(containerNode: HTMLElement) {
    // Create a deep clone of the template container
    const clone = containerNode.cloneNode(true) as HTMLElement;
    // Map to store elements with slot attributes and their values
    const slotDump: Map<string, Element> = new Map();
    // Collect all slotted elements from the component's root
    // If no slot attribute is specified, use empty string as the slot name
    Array.from(this.root.children).forEach((elem) => {
      slotDump.set(elem.getAttribute("slot") ?? "", elem);
    });
    // Replace each <slot> element with its corresponding slotted content
    clone.querySelectorAll("slot").forEach((elem) => {
      const slotName = elem.getAttribute("name") ?? "";
      const actual = slotDump.get(slotName);
      actual && elem.replaceWith(actual);
    });
    // Clear the current root content
    this.root.replaceChildren();
    // Process script and style elements
    clone.querySelectorAll("script, style").forEach((elem) => {
      const type = elem.tagName.toLowerCase();
      if (type === "style") this.prepareStyle(elem as HTMLStyleElement);
      else if (type === "script") this.prepareScript(elem as HTMLScriptElement);
      // Create fresh element to ensure proper execution
      const temp = document.createElement(type);
      temp.textContent = elem.textContent;
      elem.replaceWith(temp);
    });
    // Replace root content with processed clone children
    this.root.replaceChildren(...Array.from(clone.children));
    // Process attributes starting with prop prefix as component properties
    Array.from(this.attributes).forEach((attr) => {
      attr.name.startsWith(Dynel.propPrefix) &&
        Dynel.setProp(
          this.uid,
          attr.name.replace(Dynel.propPrefix, ""),
          attr.value,
        );
    });
  }
  /**
   * Processes style elements by adding component name as prefix if not using Shadow DOM.
   * This allows for ref attribute selectors to be scoped to the component.
   * @param elem The style element to process
   */
  private prepareStyle(elem: HTMLStyleElement) {
    this.useShadow || (elem.textContent = (elem.textContent ?? "")
      .replaceAll(
        /(\[\s*ref\s*=\s*"(\w+)"\s*\])/g,
        `${this.name} $1`,
      ));
  }
  /**
   * Processes script elements by injecting component context (uid) into utility function calls.
   * Handles $subscribe, $prop and $ref function calls to bind them to this component instance.
   * @param elem The script element to process 
   */
  private prepareScript(elem: HTMLScriptElement) {
    elem.textContent = (elem.textContent ?? "")
      .replaceAll(
        /\$subscribe\s*\(\s*"(\w+)"/g,
        `$subscribe("${this.uid}", "$1"`,
      )
      .replaceAll(
        /(\$(prop|ref))\(\s*"(\w+)"\s*\)/g,
        `$1("${this.uid}","$3")`,
      );
  }

  /** Base URL for component templates */
  private static baseUrl: string = "/components/";
  /** File extension for component templates */
  private static extension: string = ".dynel.html";
  /** Prefix differentiating props from attributes */
  private static propPrefix: string = "@";

  public static configure(
    options: { baseUrl?: string; extension?: string; propPrefix?: string },
  ) {
    if (options.baseUrl) Dynel.baseUrl = options.baseUrl;
    if (options.extension) Dynel.extension = options.extension;
    if (options.propPrefix) Dynel.propPrefix = options.propPrefix;
  }
  /**
   * Generates a unique key from uid and name
   * @param uid Unique identifier
   * @param name Property/reference name
   */
  private static key(uid: string, name: string): string {
    return name + "." + uid;
  }
  /** Map of property states */
  private static propMap: Map<string, State<string>> = new Map();
  /**
   * Sets a property value
   * @param uid Component instance ID
   * @param propName Property name
   * @param newValue New value
   */
  private static setProp(uid: string, propName: string, newValue: any) {
    const key = Dynel.key(uid, propName);
    const state = Dynel.propMap.get(key) ?? new State();
    state.set(newValue);
    Dynel.propMap.set(key, state);
  }
  /**
   * Gets a property value
   * @param uid Component instance ID
   * @param propName Property name
   */
  private static getProp(uid: string, propName: string): any | undefined {
    const key = Dynel.key(uid, propName);
    return Dynel.propMap.get(key)?.get();
  }
  /**
   * Public method to get property value
   * @param uid Component instance ID
   * @param propName Property name
   */
  public static prop(uid: string, propName: string): any | undefined {
    return Dynel.getProp(uid, propName);
  }
  /** Map of element instances */
  private static elemMap: Map<string, Dynel> = new Map();
  /**
   * Subscribes to property changes
   * @param uid Component instance ID
   * @param propName Property name
   * @param cb Callback function
   */
  public static subscribe(uid: string, propName: string, cb: () => void) {
    const key = Dynel.key(uid, propName);
    const state = Dynel.propMap.get(key) ?? new State();
    state.onSet(() => cb());
    Dynel.propMap.set(key, state);
  }
  /**
   * Gets element by uid
   * @param uid Component instance ID
   */
  private static getElem(uid: string) {
    return Dynel.elemMap.get(uid)?.root;
  }
  /**
   * Registers element instance
   * @param uid Component instance ID
   * @param elem Element instance
   */
  private static registerElem(uid: string, elem: Dynel) {
    Dynel.elemMap.set(uid, elem);
  }
  /**
   * Gets referenced element
   * @param uid Component instance ID
   * @param refName Reference name
   */
  public static ref(uid: string, refName: string): HTMLElement | undefined {
    return Dynel.getElem(uid)?.querySelector(`[ref="${refName}"]`) ?? undefined;
  }
  /** Cache of fetched templates */
  private static fetchCache: Map<string, State<HTMLElement>> = new Map();
  /**
   * Fetches component template
   * @param kind Component kind
   * @param onResult Callback for template result
   */
  private static async fetch(
    kind: string,
    onResult: (containerNode: HTMLElement | undefined) => void,
  ) {
    const state = Dynel.fetchCache.get(kind) ?? new State();
    if (!Dynel.fetchCache.has(kind)) {
      Dynel.fetchCache.set(kind, state);
      const res = await fetch(Dynel.baseUrl + kind + Dynel.extension);
      const text = await res.text();
      const containerNode = document.createElement("div");
      containerNode.innerHTML = text;
      onResult(containerNode);
      state.set(containerNode);
    } else if (!state.get()) {
      state.onSet(onResult);
    } else {
      onResult(state.get());
    }
  }
  /** Map of event type to array of callback listeners */
  private static eventCbMap: Map<string, Listener<any>[]> = new Map();
  /**
   * Registers a callback to be called when an event is dispatched
   * @param type The event type to listen for
   * @param cb Callback function that receives the event data
   */
  public static listen(type: string, cb: Listener<any>) {
    const cbs = Dynel.eventCbMap.get(type) ?? [];
    cbs.push(cb);
    Dynel.eventCbMap.set(type, cbs);
  }
  /**
   * Dispatches an event to all registered listeners
   * @param type The event type to dispatch
   * @param data The data to pass to listeners
   */
  public static dispatch(type: string, data: any) {
    Dynel.eventCbMap.get(type)?.forEach((cb) => cb(data));
  }
  /**
   * Defines a new custom element extending Dynel
   * @param name Tag name for the custom element (must contain a hyphen)
   * @param sourceId Optional source template ID. If not provided, name is used as the source ID
   * @example
   * // Define a counter element that uses counter.dynel.html as template
   * Dynel.define('my-counter', 'counter');
   */
  public static define(name: string, sourceId?: string, useShadow?: boolean) {
    customElements.define(
      name,
      class extends Dynel {
        constructor() {
          super();
          this.name = name;
          this.sourceId = sourceId ?? name;
          this.useShadow = useShadow ?? false;
          this.root = this.useShadow
            ? this.attachShadow({ mode: "open" })
            : this;
        }
      },
    );
  }
}

const {
  prop: $prop,
  ref: $ref,
  subscribe: $subscribe,
  listen: $listen,
  dispatch: $dispatch,
  configure: $configure,
  define: $define,
} = Dynel;

$define("input-field", "input-field-cell");
$define("counter-app", "counter");

export { $configure, $dispatch, $listen, $prop, $ref, $subscribe };
