/**
 * Simulated mode: a virtual Proxmark3 session with no hardware or WASM. See
 * {@link Pm3Simulator} for the engine and {@link ./virtualCard} for the card
 * model. The app switches to this when the user enables the "Simulate" toggle.
 */
export { Pm3Simulator, createPm3Simulator, type Pm3SimulatorOptions } from "./Pm3Simulator";
export {
  buildInitialCardState,
  type VirtualCardState,
  type VirtualHfCard,
  type VirtualLfCard,
} from "./virtualCard";
