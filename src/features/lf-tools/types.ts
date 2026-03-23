export type ChipType = "t55x7" | "t5555";

export interface LFConfig {
  divisor: number;
  bitsPerSample: number;
  decimation: number;
  averaging: boolean;
  triggerThreshold: number;
  samplesToSkip: number;
}
