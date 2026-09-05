import { defineStrategyPlugin } from "@tradejs/core/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import type { StrategyConfig } from "@tradejs/types";
import { config as fiveZeroDefaultConfig } from "./FiveZero/config";
import { FiveZeroStrategyDefinition } from "./FiveZero/strategy";

export const strategyEntries: ValidatedStrategyRegistryEntry<any>[] = [
  FiveZeroStrategyDefinition,
];

const defaultConfigs: Record<string, StrategyConfig> = {
  FiveZero: fiveZeroDefaultConfig,
};

export const getBuiltInStrategyDefaultConfig = (
  strategyName: string,
): StrategyConfig | undefined => defaultConfigs[strategyName];

export { FiveZeroStrategyDefinition } from "./FiveZero/strategy";
export { fiveZeroDefaultConfig };
export { fiveZeroManifest } from "./FiveZero/manifest";
export { fiveZeroAiAdapter } from "./FiveZero/adapters/ai";

export default defineStrategyPlugin({ strategyEntries });
