export const REVERSE_SYMBOL_ID_MAP: Record<number, string> = {
  101: "NSE:RELIANCE",
  102: "NSE:TCS",
  103: "NSE:HDFCBANK",
  104: "NSE:INFY",
  105: "NSE:ICICIBANK",
  106: "NSE:TATAMOTORS",
  107: "NSE:WIPRO",
  108: "NSE:SBIN",
  109: "NSE:BHARTIARTL",
  110: "NSE:ITC",
  111: "NSE:KOTAKBANK",
  112: "NSE:LT",
  113: "NSE:AXISBANK",
  114: "NSE:MARUTI",
  115: "NSE:BAJFINANCE"
};

export interface DecodedBinaryTick {
  symbol: string;
  symbolId: number;
  ltp: number;
  changePct: number;
  volumeRatio: number;
  sectorChangePct: number;
  isStale: boolean;
  tierByte: number;
  confidenceTier: "CONFIRMED" | "UNEXPLAINED" | "UNCERTAIN";
  timestamp: number;
}

/**
 * Decodes a 20-byte binary ArrayBuffer into a structured tick.
 */
export function decodeBinaryTickFrame(arrayBuffer: ArrayBuffer): DecodedBinaryTick | null {
  if (!arrayBuffer || arrayBuffer.byteLength < 20) return null;
  const view = new DataView(arrayBuffer);

  const symbolId = view.getUint16(0, false); // Big-endian
  const ltp = view.getFloat32(2, false);
  const changePct = view.getFloat32(6, false);
  const volumeRatio = view.getFloat32(10, false);
  const sectorChangePct = view.getFloat32(14, false);
  const flagsByte = view.getUint8(18);

  const isStale = (flagsByte >> 4) === 1;
  const tierByte = flagsByte & 0x0f;
  const confidenceTier: "CONFIRMED" | "UNEXPLAINED" | "UNCERTAIN" =
    tierByte === 1 ? "CONFIRMED" : tierByte === 2 ? "UNEXPLAINED" : "UNCERTAIN";

  const symbol = REVERSE_SYMBOL_ID_MAP[symbolId] || `SYM:${symbolId}`;

  return {
    symbol,
    symbolId,
    ltp: Number(ltp.toFixed(2)),
    changePct: Number(changePct.toFixed(2)),
    volumeRatio: Number(volumeRatio.toFixed(2)),
    sectorChangePct: Number(sectorChangePct.toFixed(2)),
    isStale,
    tierByte,
    confidenceTier,
    timestamp: Date.now()
  };
}
