import {
  InvestmentTrade,
  PositionProjection,
  ValuationProjection,
} from './wealth.types';

export function projectPositions(
  trades: readonly InvestmentTrade[],
): readonly PositionProjection[] {
  const positions = new Map<string, PositionProjection>();
  for (const trade of trades) {
    validateTrade(trade);
    const current =
      positions.get(trade.instrumentId) ??
      emptyPosition(trade.instrumentId, trade.quantityScale);
    if (current.quantityScale !== trade.quantityScale) {
      throw new Error(
        'all trades for an instrument must use one quantity scale',
      );
    }
    if (trade.side === 'BUY') {
      positions.set(trade.instrumentId, {
        ...current,
        quantityUnits: current.quantityUnits + trade.quantityUnits,
        costBasisMinorUnits:
          current.costBasisMinorUnits + trade.totalCostMinorUnits,
      });
      continue;
    }
    if (trade.quantityUnits > current.quantityUnits) {
      throw new Error('cannot sell more than the current position');
    }
    const soldCost =
      current.quantityUnits === 0n
        ? 0n
        : (current.costBasisMinorUnits * trade.quantityUnits) /
          current.quantityUnits;
    positions.set(trade.instrumentId, {
      ...current,
      quantityUnits: current.quantityUnits - trade.quantityUnits,
      costBasisMinorUnits: current.costBasisMinorUnits - soldCost,
      realizedGainMinorUnits:
        current.realizedGainMinorUnits + trade.totalCostMinorUnits - soldCost,
    });
  }
  return [...positions.values()];
}

export function addValuation(
  position: PositionProjection,
  marketPriceMinorUnits: bigint,
): ValuationProjection {
  if (marketPriceMinorUnits < 0n)
    throw new Error('market price must not be negative');
  const marketValue =
    (position.quantityUnits * marketPriceMinorUnits) / position.quantityScale;
  return {
    ...position,
    marketValueMinorUnits: marketValue,
    unrealizedGainMinorUnits: marketValue - position.costBasisMinorUnits,
  };
}

function emptyPosition(
  instrumentId: string,
  quantityScale: bigint,
): PositionProjection {
  return {
    instrumentId,
    quantityUnits: 0n,
    quantityScale,
    costBasisMinorUnits: 0n,
    realizedGainMinorUnits: 0n,
  };
}

function validateTrade(trade: InvestmentTrade): void {
  if (!trade.instrumentId.trim()) throw new Error('instrumentId is required');
  if (trade.quantityScale <= 0n || trade.quantityUnits <= 0n) {
    throw new Error('trade quantity must be positive');
  }
  if (trade.totalCostMinorUnits < 0n) {
    throw new Error('trade cost must not be negative');
  }
}
