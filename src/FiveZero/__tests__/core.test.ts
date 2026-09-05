/** @jest-environment node */

import { createTestStateController } from "../../testUtils/stateControllerTestUtils";
import { config as DEFAULT_CONFIG } from "../config";
import { createFiveZeroCore } from "../core";
import { makeBullishFiveZeroCandles, mirrorCandles } from "./engine.test";

const makeConfig = () =>
  ({
    ...DEFAULT_CONFIG,
    FIVE_ZERO_PIVOT_LENGTH: 1,
    FIVE_ZERO_MIN_PATTERN_HEIGHT_PCT: 0,
    FIVE_ZERO_MIN_PATTERN_HEIGHT_ATR: 0,
    FIVE_ZERO_MIN_REVERSAL_DISTANCE_ATR: 0,
    FIVE_ZERO_MAX_REVERSAL_DISTANCE_CD_RATIO: 1,
    LONG: { ...DEFAULT_CONFIG.LONG, minRiskRatio: 0.5 },
    SHORT: { ...DEFAULT_CONFIG.SHORT, minRiskRatio: 0.5 },
  }) as any;

const makeIndicatorsState = () =>
  ({
    setCurrentBar: jest.fn(),
    next: jest.fn(),
    onBar: jest.fn(),
    ensureInitializedWithCurrentBar: jest.fn(),
    snapshot: jest.fn(() => ({ baseContext: {} })),
    latestNumber: jest.fn(() => undefined),
    isInitialized: jest.fn(() => true),
  }) as any;

const makeStrategyApi = ({
  marketData,
  currentPosition = null,
}: {
  marketData: any;
  currentPosition?: any;
}) =>
  ({
    skip: (code: string) => ({ kind: "skip", code }),
    getDecisionPriceContext: jest.fn(async () => ({
      timestamp: marketData.timestamp,
      currentPrice: marketData.currentPrice,
      candle: marketData.lastCandle,
    })),
    getCurrentPosition: jest.fn(async () => currentPosition),
    createLastTradeController: jest.fn(() => ({
      isInCooldown: () => false,
      markTrade: jest.fn(),
      getLastTradeTimestamp: () => null,
    })),
    createStateController: createTestStateController(),
    entry: jest.fn(async (params: any) => ({
      kind: "entry",
      code: params.code,
      entryContext: {
        strategy: "FiveZero",
        symbol: "TESTUSDT",
        interval: "15",
        direction: params.direction,
        timestamp: marketData.timestamp,
        prices: {
          currentPrice: marketData.currentPrice,
          takeProfitPrice: params.orderPlan.takeProfits[0].price,
          stopLossPrice: params.orderPlan.stopLossPrice,
          riskRatio: 1,
        },
        isConfigFromBacktest: false,
      },
      orderPlan: params.orderPlan,
      signal: {
        signalId: "five-zero-test-signal",
        strategy: "FiveZero",
        symbol: "TESTUSDT",
        interval: "15",
        direction: params.direction,
        timestamp: marketData.timestamp,
        figures: params.figures ?? {},
        prices: {
          currentPrice: marketData.currentPrice,
          takeProfitPrice: params.orderPlan.takeProfits[0].price,
          stopLossPrice: params.orderPlan.stopLossPrice,
          riskRatio: 1,
        },
        indicators: params.indicators ?? {},
        additionalIndicators: params.additionalIndicators,
      },
    })),
    exit: jest.fn(async (params: any) => ({
      kind: "exit",
      code: params.code,
      closePlan: {
        direction: params.direction,
        price: marketData.currentPrice,
        timestamp: marketData.timestamp,
      },
    })),
  }) as any;

describe("FiveZero core", () => {
  it("creates a long entry with XABCD geometry figures", async () => {
    const candles = makeBullishFiveZeroCandles();
    const currentCandle = candles[candles.length - 1]!;
    const marketData = {
      timestamp: currentCandle.timestamp,
      currentPrice: currentCandle.close,
      lastCandle: currentCandle,
    };
    const core = await createFiveZeroCore({
      config: makeConfig(),
      data: candles.slice(0, -1) as any,
      strategyApi: makeStrategyApi({ marketData }),
      indicatorsState: makeIndicatorsState(),
    });

    const result = await core(currentCandle as any, currentCandle as any);

    expect(result.kind).toBe("entry");
    expect((result as any).code).toBe("FIVE_ZERO_BULLISH_D_CONFIRMED");
    expect((result as any).entryContext.direction).toBe("LONG");
    expect((result as any).signal.figures.lines).toHaveLength(6);
    expect(
      (result as any).signal.additionalIndicators.fiveZeroContext.patternKind,
    ).toBe("bullish_five_zero");
  });

  it("exits an existing long on a bearish FiveZero", async () => {
    const candles = mirrorCandles(makeBullishFiveZeroCandles());
    const currentCandle = candles[candles.length - 1]!;
    const marketData = {
      timestamp: currentCandle.timestamp,
      currentPrice: currentCandle.close,
      lastCandle: currentCandle,
    };
    const core = await createFiveZeroCore({
      config: makeConfig(),
      data: candles.slice(0, -1) as any,
      strategyApi: makeStrategyApi({
        marketData,
        currentPosition: { direction: "LONG", price: 110, qty: 1 },
      }),
      indicatorsState: makeIndicatorsState(),
    });

    const result = await core(currentCandle as any, currentCandle as any);
    expect(result).toMatchObject({
      kind: "exit",
      code: "FIVE_ZERO_OPPOSITE_PATTERN_EXIT",
    });
  });
});
