import { createCostIsolatedStrategyConfigParser } from "@tradejs/strategy-kit/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import { config as DEFAULT_CONFIG, FiveZeroConfig } from "./config";
import { createFiveZeroCore } from "./core";
import { fiveZeroManifest } from "./manifest";

export const FiveZeroStrategyDefinition: ValidatedStrategyRegistryEntry<FiveZeroConfig> =
  {
    defaults: DEFAULT_CONFIG,
    parseConfig: createCostIsolatedStrategyConfigParser({
      strategyName: "FiveZero",
      defaults: DEFAULT_CONFIG,
    }),
    createCore: createFiveZeroCore,
    manifest: fiveZeroManifest,
  };
