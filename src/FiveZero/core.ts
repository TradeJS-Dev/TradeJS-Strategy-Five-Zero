import { round } from "@tradejs/core/math";
import {
  buildTradeEconomics,
  isStopLossOnCorrectSide,
} from "@tradejs/strategy-kit/risk";
import type {
  CreateStrategyCore,
  IndicatorsHistorySnapshot,
  Position,
} from "@tradejs/types";
import { FiveZeroConfig } from "./config";
import { buildFiveZeroSignalContext, createFiveZeroEngine } from "./engine";
import { buildFiveZeroFigures } from "./figures";

const isOpenPosition = (position: Position | null): position is Position =>
  Boolean(
    position &&
    typeof position.price === "number" &&
    Number.isFinite(position.price) &&
    typeof position.qty === "number" &&
    Number.isFinite(position.qty) &&
    position.qty > 0 &&
    (position.direction === "LONG" || position.direction === "SHORT"),
  );

const buildFiveZeroStateKey = (config: FiveZeroConfig) =>
  JSON.stringify({
    pivotLength: config.FIVE_ZERO_PIVOT_LENGTH,
    minAbXaExtension: config.FIVE_ZERO_MIN_AB_XA_EXTENSION,
    maxAbXaExtension: config.FIVE_ZERO_MAX_AB_XA_EXTENSION,
    minBcAbExtension: config.FIVE_ZERO_MIN_BC_AB_EXTENSION,
    maxBcAbExtension: config.FIVE_ZERO_MAX_BC_AB_EXTENSION,
    minCdBcRetracement: config.FIVE_ZERO_MIN_CD_BC_RETRACEMENT,
    maxCdBcRetracement: config.FIVE_ZERO_MAX_CD_BC_RETRACEMENT,
    targetCdPct: config.FIVE_ZERO_TARGET_CD_PCT,
    stopCdPct: config.FIVE_ZERO_STOP_CD_PCT,
    minPatternHeightPct: config.FIVE_ZERO_MIN_PATTERN_HEIGHT_PCT,
    minPatternHeightAtr: config.FIVE_ZERO_MIN_PATTERN_HEIGHT_ATR,
    atrPeriod: config.FIVE_ZERO_ATR_PERIOD,
    minLegBars: config.FIVE_ZERO_MIN_LEG_BARS,
    maxPatternAgeBars: config.FIVE_ZERO_MAX_PATTERN_AGE_BARS,
    maxEntryAfterDBars: config.FIVE_ZERO_MAX_ENTRY_AFTER_D_BARS,
    minReversalDistanceAtr: config.FIVE_ZERO_MIN_REVERSAL_DISTANCE_ATR,
    maxReversalDistanceCdRatio: config.FIVE_ZERO_MAX_REVERSAL_DISTANCE_CD_RATIO,
  });

export const createFiveZeroCore: CreateStrategyCore<
  FiveZeroConfig,
  IndicatorsHistorySnapshot | undefined
> = async ({ config, data: initialData, strategyApi, indicatorsState }) => {
  const detectorState = strategyApi.createStateController<
    { engine: ReturnType<typeof createFiveZeroEngine> },
    ReturnType<ReturnType<typeof createFiveZeroEngine>["next"]>,
    ReturnType<ReturnType<typeof createFiveZeroEngine>["getState"]>
  >(
    "FiveZero",
    () => ({
      engine: createFiveZeroEngine({
        config,
        initialCandles: initialData,
      }),
    }),
    {
      configKey: buildFiveZeroStateKey(config),
      snapshot: (state) => state.engine.getState(),
    },
  );
  const lastTradeController = strategyApi.createLastTradeController({
    enabled: true,
  });
  const nextDetectorState = (
    candle: Parameters<ReturnType<typeof createFiveZeroEngine>["next"]>[0],
  ) =>
    detectorState.oncePerTimestamp(candle.timestamp, (state) =>
      state.engine.next(candle),
    );

  return async (candle) => {
    const runtimeState = nextDetectorState(candle);
    const pattern = runtimeState.pattern;
    if (!pattern) return strategyApi.skip("NO_PATTERN");

    const position = await strategyApi.getCurrentPosition();
    if (isOpenPosition(position)) {
      const oppositePattern = position.direction !== pattern.direction;
      if (
        Boolean(config.FIVE_ZERO_EXIT_ON_OPPOSITE_PATTERN) &&
        oppositePattern
      ) {
        return strategyApi.exit({
          code: "FIVE_ZERO_OPPOSITE_PATTERN_EXIT",
          direction: position.direction,
        });
      }
      return strategyApi.skip("POSITION_EXISTS");
    }

    if (lastTradeController.isInCooldown(candle.timestamp)) {
      return strategyApi.skip("DEV_TRADE_COOLDOWN");
    }

    const modeConfig =
      pattern.direction === "LONG" ? config.LONG : config.SHORT;
    if (!modeConfig.enable) return strategyApi.skip("STRATEGY_DISABLED");

    const { timestamp, currentPrice } =
      await strategyApi.getDecisionPriceContext();
    if (
      !isStopLossOnCorrectSide({
        direction: pattern.direction,
        currentPrice,
        stopLossPrice: pattern.stopLossPrice,
      })
    ) {
      return strategyApi.skip("INVALID_STOP");
    }

    const targetIsValid =
      pattern.direction === "LONG"
        ? pattern.targetPrice > currentPrice
        : pattern.targetPrice < currentPrice;
    if (!targetIsValid) return strategyApi.skip("TARGET_ALREADY_PASSED");

    const economics = buildTradeEconomics({
      entryPrice: currentPrice,
      stopLossPrice: pattern.stopLossPrice,
      takeProfitPrice: pattern.targetPrice,
      feeRate: Number(config.RISK_FEE_RATE ?? 0),
      slippageBps:
        Number(config.RISK_SLIPPAGE_BPS ?? 0) +
        Number(config.RISK_MARKET_IMPACT_BPS ?? 0),
    });
    const qty =
      economics.lossPerUnit > 0
        ? Number(config.MAX_LOSS_VALUE ?? 0) / economics.lossPerUnit
        : 0;
    if (!qty || !Number.isFinite(qty) || qty <= 0) {
      return strategyApi.skip("INVALID_QTY");
    }

    const riskRatio = economics.netRiskRatio;
    if (riskRatio <= modeConfig.minRiskRatio) {
      return strategyApi.skip(`RISK_RATIO:${round(riskRatio)}`);
    }

    const signalContext = {
      ...buildFiveZeroSignalContext({ ...pattern, close: currentPrice }),
      executionEconomics: {
        grossRiskRatio: economics.grossRiskRatio,
        netRiskRatio: economics.netRiskRatio,
        lossPerUnit: economics.lossPerUnit,
        rewardPerUnit: economics.rewardPerUnit,
      },
    };
    const indicators = indicatorsState.snapshot();
    lastTradeController.markTrade(timestamp);

    return strategyApi.entry({
      code:
        pattern.direction === "LONG"
          ? "FIVE_ZERO_BULLISH_D_CONFIRMED"
          : "FIVE_ZERO_BEARISH_D_CONFIRMED",
      direction: modeConfig.direction,
      indicators,
      additionalIndicators: { fiveZeroContext: signalContext },
      figures: buildFiveZeroFigures({
        pattern,
        entryTimestamp: timestamp,
        entryPrice: currentPrice,
      }),
      orderPlan: {
        qty,
        stopLossPrice: pattern.stopLossPrice,
        takeProfits: [{ rate: 1, price: pattern.targetPrice }],
      },
    });
  };
};
