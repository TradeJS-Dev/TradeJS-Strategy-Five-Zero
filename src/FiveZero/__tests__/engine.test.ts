/** @jest-environment node */

import { config as DEFAULT_CONFIG } from "../config";
import { createFiveZeroEngine } from "../engine";

const makeCandle = (
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
) => ({
  timestamp: 1_700_000_000_000 + index * 60_000,
  dt: new Date(1_700_000_000_000 + index * 60_000).toISOString(),
  open,
  high,
  low,
  close,
  volume: 1_000,
  turnover: close * 1_000,
});

const makeConfig = (overrides: Record<string, unknown> = {}) =>
  ({
    ...DEFAULT_CONFIG,
    FIVE_ZERO_PIVOT_LENGTH: 1,
    FIVE_ZERO_MIN_PATTERN_HEIGHT_PCT: 0,
    FIVE_ZERO_MIN_PATTERN_HEIGHT_ATR: 0,
    FIVE_ZERO_MIN_REVERSAL_DISTANCE_ATR: 0,
    FIVE_ZERO_MAX_REVERSAL_DISTANCE_CD_RATIO: 1,
    ...overrides,
  }) as any;

export const makeBullishFiveZeroCandles = () => [
  makeCandle(0, 104, 105, 102, 104),
  makeCandle(1, 102, 103, 100, 102),
  makeCandle(2, 105, 106, 104, 105),
  makeCandle(3, 108, 110, 107, 109),
  makeCandle(4, 104, 106, 103, 104),
  makeCandle(5, 100, 102, 98, 100),
  makeCandle(6, 108, 110, 107, 109),
  makeCandle(7, 120, 122, 118, 121),
  makeCandle(8, 115, 117, 113, 115),
  makeCandle(9, 111, 113, 110, 111),
  makeCandle(10, 113, 115, 112, 114),
];

export const mirrorCandles = (
  candles: ReturnType<typeof makeBullishFiveZeroCandles>,
) =>
  candles.map((candle) => ({
    ...candle,
    open: 220 - candle.open,
    high: 220 - candle.low,
    low: 220 - candle.high,
    close: 220 - candle.close,
    turnover: (220 - candle.close) * 1_000,
  }));

const makeBullishFiveZeroAtRatios = (
  abXaExtension: number,
  bcAbExtension: number,
  cdBcRetracement: number,
) => {
  const x = 100;
  const a = 110;
  const b = a - (a - x) * abXaExtension;
  const c = b + (a - b) * bcAbExtension;
  const d = c - (c - b) * cdBcRetracement;
  const xaMiddle = (x + a) / 2;
  const abMiddle = (a + b) / 2;
  const bcMiddle = (b + c) / 2;
  const cdMiddle = (c + d) / 2;
  const reversal = (c - d) * 0.25;

  return [
    makeCandle(0, x + 3, x + 4, x + 2, x + 3),
    makeCandle(1, x + 2, x + 3, x, x + 1),
    makeCandle(2, xaMiddle, xaMiddle + 1, xaMiddle - 1, xaMiddle),
    makeCandle(3, a - 2, a, a - 3, a - 1),
    makeCandle(4, abMiddle, abMiddle + 1, abMiddle - 1, abMiddle),
    makeCandle(5, b + 2, b + 3, b, b + 1),
    makeCandle(6, bcMiddle, bcMiddle + 1, bcMiddle - 1, bcMiddle),
    makeCandle(7, c - 2, c, c - 3, c - 1),
    makeCandle(8, cdMiddle, cdMiddle + 1, cdMiddle - 1, cdMiddle),
    makeCandle(9, d + 2, d + 3, d, d + 1),
    makeCandle(10, d + 1.5, d + reversal + 1, d + 1, d + reversal),
  ];
};

describe("FiveZero engine", () => {
  it("detects a bullish FiveZero after D is confirmed", () => {
    const engine = createFiveZeroEngine({ config: makeConfig() });
    const states = makeBullishFiveZeroCandles().map((candle) =>
      engine.next(candle as any),
    );
    const pattern = states[states.length - 1]?.pattern;

    expect(pattern?.kind).toBe("bullish_five_zero");
    expect(pattern?.direction).toBe("LONG");
    expect(pattern?.pivots.map((pivot) => pivot.value)).toEqual([
      100, 110, 98, 122, 110,
    ]);
    expect(pattern?.abXaExtension).toBeCloseTo(1.2);
    expect(pattern?.bcAbExtension).toBeCloseTo(2);
    expect(pattern?.cdBcRetracement).toBeCloseTo(0.5);
    expect(pattern?.reciprocalAbCdRatio).toBeCloseTo(1);
    expect(pattern?.entryAfterDBars).toBe(1);
    expect(pattern?.targetPrice).toBeCloseTo(122);
    expect(pattern?.stopLossPrice).toBeCloseTo(108.8);
  });

  it("detects the mirrored bearish FiveZero", () => {
    const engine = createFiveZeroEngine({ config: makeConfig() });
    const states = mirrorCandles(makeBullishFiveZeroCandles()).map((candle) =>
      engine.next(candle as any),
    );
    const pattern = states[states.length - 1]?.pattern;

    expect(pattern?.kind).toBe("bearish_five_zero");
    expect(pattern?.direction).toBe("SHORT");
    expect(pattern?.pivots.map((pivot) => pivot.value)).toEqual([
      120, 110, 122, 98, 110,
    ]);
    expect(pattern?.abXaExtension).toBeCloseTo(1.2);
    expect(pattern?.bcAbExtension).toBeCloseTo(2);
    expect(pattern?.cdBcRetracement).toBeCloseTo(0.5);
    expect(pattern?.targetPrice).toBeCloseTo(98);
    expect(pattern?.stopLossPrice).toBeCloseTo(111.2);
  });

  it.each([
    [1.13, 1.618, 0.45],
    [1.618, 2.24, 0.55],
  ])(
    "accepts inclusive ratio boundaries AB/XA=%p BC/AB=%p CD/BC=%p",
    (abXaExtension, bcAbExtension, cdBcRetracement) => {
      const engine = createFiveZeroEngine({ config: makeConfig() });
      const states = makeBullishFiveZeroAtRatios(
        abXaExtension,
        bcAbExtension,
        cdBcRetracement,
      ).map((candle) => engine.next(candle as any));
      const pattern = states[states.length - 1]?.pattern;

      expect(pattern?.abXaExtension).toBeCloseTo(abXaExtension);
      expect(pattern?.bcAbExtension).toBeCloseTo(bcAbExtension);
      expect(pattern?.cdBcRetracement).toBeCloseTo(cdBcRetracement);
    },
  );

  it("rejects AB/XA outside the configured extension band", () => {
    const candles = makeBullishFiveZeroCandles();
    candles[5] = makeCandle(5, 94, 96, 92, 94);
    const engine = createFiveZeroEngine({ config: makeConfig() });
    const state = candles.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("rejects BC/AB outside the configured extension band", () => {
    const candles = makeBullishFiveZeroCandles();
    candles[7] = makeCandle(7, 128, 130, 126, 129);
    candles[9] = makeCandle(9, 115, 117, 114, 115);
    candles[10] = makeCandle(10, 117, 119, 116, 118);
    const engine = createFiveZeroEngine({ config: makeConfig() });
    const state = candles.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("rejects CD/BC outside the configured 0.50 area", () => {
    const candles = makeBullishFiveZeroCandles();
    candles[9] = makeCandle(9, 108, 109, 106, 108);
    candles[10] = makeCandle(10, 108, 111, 107, 109);
    const engine = createFiveZeroEngine({ config: makeConfig() });
    const state = candles.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("emits a completed setup only once", () => {
    const engine = createFiveZeroEngine({ config: makeConfig() });
    const candles = makeBullishFiveZeroCandles();
    const detected = candles.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(detected.pattern).not.toBeNull();
    expect(engine.next(candles[candles.length - 1] as any)).toEqual(detected);
    expect(
      engine.next(makeCandle(11, 114, 116, 113, 115) as any).pattern,
    ).toBeNull();
  });

  it("rebuilds the same signal from initial candles", () => {
    const config = makeConfig();
    const candles = makeBullishFiveZeroCandles();
    const current = candles[candles.length - 1]!;
    const history = candles.slice(0, -1);
    const continuous = createFiveZeroEngine({ config });
    for (const candle of history) continuous.next(candle as any);
    const continuousState = continuous.next(current as any);

    const restored = createFiveZeroEngine({
      config,
      initialCandles: history as any,
    });
    expect(restored.next(current as any)).toEqual(continuousState);
  });
});
