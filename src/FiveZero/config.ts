import { FEE_PERCENT as RISK_FEE_RATE } from "@tradejs/core/constants";
import {
  BacktestPriceMode,
  Direction,
  Interval,
  StrategyConfig,
} from "@tradejs/types";

export interface FiveZeroSideConfig {
  enable: boolean;
  direction: Direction;
  minRiskRatio: number;
}

export const config = {
  ENV: "BACKTEST",
  INTERVAL: "15" as Interval,
  MAKE_ORDERS: true,
  CLOSE_OPPOSITE_POSITIONS: false,
  BACKTEST_PRICE_MODE: "open" as const,
  AI_ENABLED: false,
  AI_MODE: "llm" as const,
  ML_ENABLED: false,
  ML_THRESHOLD: 0.1,
  MIN_AI_QUALITY: 4,
  RISK_FEE_RATE,
  RISK_SLIPPAGE_BPS: 0,
  RISK_MARKET_IMPACT_BPS: 0,
  MAX_LOSS_VALUE: 10,
  MA_FAST: 14,
  MA_MEDIUM: 49,
  MA_SLOW: 50,
  OBV_SMA: 10,
  ATR: 14,
  ATR_PCT_SHORT: 7,
  ATR_PCT_LONG: 30,
  BB: 20,
  BB_STD: 2,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  FIVE_ZERO_PIVOT_LENGTH: 2,
  FIVE_ZERO_MIN_AB_XA_EXTENSION: 1.13,
  FIVE_ZERO_MAX_AB_XA_EXTENSION: 1.618,
  FIVE_ZERO_MIN_BC_AB_EXTENSION: 1.618,
  FIVE_ZERO_MAX_BC_AB_EXTENSION: 2.24,
  FIVE_ZERO_MIN_CD_BC_RETRACEMENT: 0.45,
  FIVE_ZERO_MAX_CD_BC_RETRACEMENT: 0.55,
  FIVE_ZERO_TARGET_CD_PCT: 100,
  FIVE_ZERO_STOP_CD_PCT: 10,
  FIVE_ZERO_MIN_PATTERN_HEIGHT_PCT: 0.2,
  FIVE_ZERO_MIN_PATTERN_HEIGHT_ATR: 1,
  FIVE_ZERO_ATR_PERIOD: 14,
  FIVE_ZERO_MIN_LEG_BARS: 1,
  FIVE_ZERO_MAX_PATTERN_AGE_BARS: 240,
  FIVE_ZERO_MAX_ENTRY_AFTER_D_BARS: 8,
  FIVE_ZERO_MIN_REVERSAL_DISTANCE_ATR: 0.05,
  FIVE_ZERO_MAX_REVERSAL_DISTANCE_CD_RATIO: 0.8,
  FIVE_ZERO_EXIT_ON_OPPOSITE_PATTERN: true,
  LONG: {
    enable: true,
    direction: "LONG",
    minRiskRatio: 0.7,
  },
  SHORT: {
    enable: true,
    direction: "SHORT",
    minRiskRatio: 0.7,
  },
} as const;

export type FiveZeroConfig = StrategyConfig &
  Omit<
    typeof config,
    "BACKTEST_PRICE_MODE" | "LONG" | "SHORT" | "MIN_AI_QUALITY"
  > & {
    BACKTEST_PRICE_MODE: BacktestPriceMode;
    MIN_AI_QUALITY: number;
    LONG: FiveZeroSideConfig;
    SHORT: FiveZeroSideConfig;
  };
