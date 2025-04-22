import { State, Event } from "./utils.ts";
import type { Listener } from "./utils.ts";

/**
 * Component property class extending State
 */
class Prop<T> extends State<T> {}

/**
 * Custom element for dynamic component loading and management
 */
class Dynel extends HTMLElement {
  /** Component kind identifier */
  public readonly name: string;
  /** Unique identifier for this instance */
  public readonly uid: string;
  /** Source template ID */
  private sourceId: string;
  /** Root of the instance */
  private root: Dynel | ShadowRoot;
  /** Controls whether the component uses Shadow DOM encapsulation */
  private useShadow: boolean;

  constructor() {
    super();
    this.useShadow = false;
    this.root = this.useShadow ? this.attachShadow({ mode: "open" }) : this;
    this.uid = (Date.now() * 100 + Math.trunc(Math.random() * 10000))
      .toString();
    this.name = "default-element";
    this.sourceId = "default";
    Dynel.registerInstance(this.uid, this);
  }
  /** Called when element is connected to DOM */
  connectedCallback() {
    Dynel.fetch(
      this.sourceId,
      (containerNode) => {
        this.assemble(containerNode!);
        Dynel.dispatch("ready:" + this.name, this);
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
   * Processes style elements by scoping ref selectors to component
   * @param elem Style element to process
   */
  private prepareStyle(elem: HTMLStyleElement) {
    this.useShadow || (elem.textContent = (elem.textContent ?? "")
      .replaceAll(
        /(\[\s*ref\s*=\s*"(\w+)"\s*\])/g,
        `${this.name} $1`,
      )
      .replaceAll(
        "self",
        this.name,
      ));
  }
  /**
   * Injects component context into utility function calls
   * @param elem Script element to process
   */
  private prepareScript(elem: HTMLScriptElement) {
    elem.textContent = (elem.textContent ?? "")
      .replaceAll(
        /(\$(onProp|onState))\s*\(\s*"((\w+)(\-\w+)*)"/g,
        `$1("${this.uid}", "$3"`,
      )
      .replaceAll(
        /(\$(prop|ref|state))\(\s*"((\w+)(\-\w+)*)"\s*/g,
        `$1("${this.uid}","$3"`,
      );
  }

  /** Base URL for component templates */
  private static baseUrl: string = "/components/";
  /** File extension for component templates */
  private static extension: string = ".dynel.html";
  /** Prefix differentiating props from attributes */
  private static propPrefix: string = "prop-";

  /**
   * Configures Dynel settings
   * @param options Configuration options
   */
  public static configure(
    options: { baseUrl?: string; extension?: string; propPrefix?: string },
  ) {
    if (options.baseUrl) Dynel.baseUrl = options.baseUrl;
    if (options.extension) Dynel.extension = options.extension;
    if (options.propPrefix) Dynel.propPrefix = options.propPrefix;
  }
  /**
   * Generates unique key from uid and name
   * @param uid Unique identifier
   * @param name Property/reference name
   */
  private static key(uid: string, name: string): string {
    return name + "." + uid;
  }
  /**
   * Sets property value
   * @param uid Component instance ID
   * @param propName Property name
   * @param newValue New value
   */
  private static setProp(uid: string, propName: string, newValue: any) {
    const key = Dynel.key(uid, propName);
    Prop.set(key, newValue);
    Dynel.getElem(uid)?.setAttribute(
      Dynel.propPrefix + propName,
      String(newValue),
    );
  }
  /**
   * Gets property value
   * @param uid Component instance ID
   * @param propName Property name
   */
  private static getProp(uid: string, propName: string): any | undefined {
    const key = Dynel.key(uid, propName);
    return Prop.get(key);
  }
  /**
   * Gets or sets property value
   * @param uid Component instance ID
   * @param propName Property name
   * @param newValue New value (optional)
   */
  public static prop(uid: string, propName: string, newValue: any) {
    return newValue === undefined
      ? Dynel.getProp(uid, propName)
      : Dynel.setProp(uid, propName, newValue);
  }
  /**
   * Subscribes to property changes
   * @param uid Component instance ID
   * @param propName Property name
   * @param cb Callback function
   */
  public static onProp(uid: string, propName: string, cb: () => void) {
    const key = Dynel.key(uid, propName);
    Prop.subscribe(key, cb);
  }
  /**
   * Sets property value for this instance
   * @param propName Property name
   * @param newValue New value
   */
  public setProp(propName: string, newValue: any) {
    Dynel.setProp(this.uid, propName, newValue);
  }
  /**
   * Gets property value for this instance
   * @param propName Property name
   */
  public getProp(propName: string): any | undefined {
    return Dynel.getProp(this.uid, propName);
  }
  /**
   * Sets internal state value
   * @param uid Component instance ID
   * @param stateName State name
   * @param newValue New value
   */
  private static setState(uid: string, stateName: string, newValue: any) {
    const key = Dynel.key(uid, stateName);
    State.set(key, newValue);
  }
  /**
   * Gets internal state value
   * @param uid Component instance ID
   * @param stateName State name
   */
  private static getState(uid: string, stateName: string): any | undefined {
    const key = Dynel.key(uid, stateName);
    return State.get(key);
  }
  /**
   * Gets state value for this instance
   * @param stateName State name
   */
  public getState(stateName: string): any | undefined {
    return Dynel.getState(this.uid, stateName);
  }
  /**
   * Sets state value for this instance
   * @param stateName State name
   * @param newValue New value
   */
  public setState(stateName: string, newValue: any) {
    Dynel.setState(this.uid, stateName, newValue);
  }
  /**
   * Gets or sets state value
   * @param uid Component instance ID
   * @param stateName State name
   * @param newValue New value (optional)
   */
  public static state(uid: string, stateName: string, newValue: any) {
    return newValue === undefined
      ? Dynel.getState(uid, stateName)
      : Dynel.setState(uid, stateName, newValue);
  }
  /**
   * Subscribes to state changes
   * @param uid Component instance ID
   * @param stateName State name
   * @param cb Callback function
   */
  public static onState(
    uid: string,
    stateName: string,
    cb: (newValue: any) => void,
  ) {
    const key = Dynel.key(uid, stateName);
    State.subscribe(key, cb);
  }
  /**
   * Registers event listener
   * @param type Event type
   * @param cb Callback function
   */
  public static listen(type: string, cb: Listener<any>) {
    Event.addListener(type, cb);
  }
  /**
   * Dispatches event to listeners
   * @param type Event type
   * @param payload Event data
   */
  public static dispatch(type: string, payload?: any) {
    Event.trigger(type, payload);
  }
  /** Map of element instances */
  private static instanceMap: Map<string, Dynel> = new Map();
  /**
   * Gets element by uid
   * @param uid Component instance ID
   */
  private static getElem(uid: string) {
    return Dynel.instanceMap.get(uid);
  }
  /**
   * Registers element instance
   * @param uid Component instance ID
   * @param elem Element instance
   */
  private static registerInstance(uid: string, instance: Dynel) {
    Dynel.instanceMap.set(uid, instance);
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
      state.subscribe(onResult);
    } else {
      onResult(state.get());
    }
  }
  /**
   * Defines new custom element
   * @param name Tag name (must contain hyphen)
   * @param sourceId Template ID (defaults to name)
   * @param useShadow Whether to use Shadow DOM
   */
  public static define(name: string, sourceId?: string, useShadow?: boolean) {
    customElements.define(
      name,
      class extends Dynel {
        public override readonly name: string;
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
  state: $state,
  onProp: $onProp,
  onState: $onState,
  listen: $listen,
  dispatch: $dispatch,
  configure: $configure,
  define: $define,
} = Dynel;

Object.assign(globalThis, {
  $configure,
  $dispatch,
  $listen,
  $prop,
  $ref,
  $state,
  $onProp,
  $onState,
  $define,
});

export {
  $configure,
  $define,
  $dispatch,
  $listen,
  $onProp,
  $onState,
  $prop,
  $ref,
  $state,
  Dynel
};