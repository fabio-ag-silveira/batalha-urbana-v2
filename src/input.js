// "current" significa o jogador da vez (setas + espaco para quem joga sozinho ou em LAN).
const KEY_BINDINGS = {
  w: { player: 1, control: "up" },
  s: { player: 1, control: "down" },
  a: { player: 1, control: "left" },
  d: { player: 1, control: "right" },
  f: { player: 1, control: "fire" },
  i: { player: 2, control: "up" },
  k: { player: 2, control: "down" },
  j: { player: 2, control: "left" },
  l: { player: 2, control: "right" },
  h: { player: 2, control: "fire" },
  arrowup: { player: "current", control: "up" },
  arrowdown: { player: "current", control: "down" },
  arrowleft: { player: "current", control: "left" },
  arrowright: { player: "current", control: "right" },
  " ": { player: "current", control: "fire" },
};

const SHORTCUTS = ["b", "m", "n", "u"];

export class InputController {
  // resolveTarget(binding) decide no momento do aperto quem recebe a tecla;
  // a soltura vai sempre para o mesmo destino, mesmo que o turno tenha mudado.
  constructor({ resolveTarget, dispatch, onShortcut, onActivity }) {
    this.resolveTarget = resolveTarget;
    this.dispatch = dispatch;
    this.onShortcut = onShortcut;
    this.onActivity = onActivity;
    this.held = new Map();
  }

  attach(target) {
    target.addEventListener("keydown", (event) => this.handleKeyDown(event));
    target.addEventListener("keyup", (event) => this.handleKeyUp(event));
    target.addEventListener("blur", () => this.releaseAll());
  }

  isTypingTarget(event) {
    const element = event.target;
    return element instanceof HTMLElement && (element.tagName === "INPUT" || element.isContentEditable);
  }

  handleKeyDown(event) {
    if (this.isTypingTarget(event)) {
      return;
    }
    const key = event.key.toLowerCase();
    const binding = KEY_BINDINGS[key];
    if (binding || SHORTCUTS.includes(key)) {
      event.preventDefault();
    }
    this.onActivity?.();

    if (event.repeat) {
      return;
    }
    if (SHORTCUTS.includes(key)) {
      this.onShortcut(key);
      return;
    }
    if (!binding || this.held.has(key)) {
      return;
    }

    const target = this.resolveTarget(binding);
    if (target === null) {
      return;
    }
    this.held.set(key, { target, control: binding.control });
    this.dispatch(target, binding.control, true);
  }

  handleKeyUp(event) {
    const key = event.key.toLowerCase();
    const entry = this.held.get(key);
    if (!entry) {
      return;
    }
    this.held.delete(key);
    this.dispatch(entry.target, entry.control, false);
  }

  // Ao perder o foco a carga e cancelada em vez de disparar.
  releaseAll() {
    this.held.forEach((entry) => this.dispatch(entry.target, entry.control, false, { cancel: true }));
    this.held.clear();
  }
}
