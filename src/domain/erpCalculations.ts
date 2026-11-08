/**
 * CAPA DE DOMINIO PURO — CREA ARTE ERP (ECUADOR)
 * Funciones matemáticas tipadas y deterministas para cálculo de área m²,
 * estructura metálica (tubos de 6m y fuentes LED), corte láser/CNC,
 * escalas mayoristas de sublimación, conversión de bobinas PDF a m²
 * e impuestos / retenciones SRI (IVA 15%).
 */

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(Math.round(Number(value + 'e2')) + 'e-2');
}

export interface BillableAreaResult {
  rawSingleAreaM2: number;
  billableSingleAreaM2: number;
  totalRawAreaM2: number;
  totalBillableAreaM2: number;
  minAreaApplied: boolean;
}

/**
 * 1. Cálculo de área en m² con mínimo facturable por unidad o lote.
 */
export function calculateBillableAreaM2(
  widthM: number,
  heightM: number,
  quantity: number,
  minBillableAreaM2 = 0.5
): BillableAreaResult {
  const safeW = Math.max(0, widthM);
  const safeH = Math.max(0, heightM);
  const safeQty = Math.max(1, Math.floor(quantity));

  const rawSingleAreaM2 = round2(safeW * safeH);
  const minAreaApplied = rawSingleAreaM2 > 0 && rawSingleAreaM2 < minBillableAreaM2;
  const billableSingleAreaM2 = minAreaApplied ? round2(minBillableAreaM2) : rawSingleAreaM2;

  return {
    rawSingleAreaM2,
    billableSingleAreaM2,
    totalRawAreaM2: round2(rawSingleAreaM2 * safeQty),
    totalBillableAreaM2: round2(billableSingleAreaM2 * safeQty),
    minAreaApplied,
  };
}

export interface MetallicStructureBreakdown {
  totalPerimeterMeters: number;
  internalReinforcementMeters: number;
  totalLinearMeters: number;
  tubes6mRequired: number;
  ledModulesRequired: number;
  ledPowerSupplies12VRequired: number;
  estimatedStructureCostUsd: number;
  estimatedLedCostUsd: number;
}

/**
 * 2. Cálculo de estructura metálica (tubos cuadrados de 6m y fuentes LED 12V).
 * Considera marco perimetral + parantes verticales cada 1.00m + travesaño horizontal si alto > 1.20m.
 */
export function calculateMetallicStructureResources(
  widthM: number,
  heightM: number,
  quantity: number,
  isIlluminated: boolean,
  tube6mCostUsd = 14.5,
  ledModuleCostUsd = 0.65,
  powerSupplyCostUsd = 18.0
): MetallicStructureBreakdown {
  const safeW = Math.max(0.2, widthM);
  const safeH = Math.max(0.2, heightM);
  const safeQty = Math.max(1, Math.floor(quantity));

  const perimeterPerUnit = 2 * (safeW + safeH);
  const verticalCrossbarsCount = Math.max(0, Math.ceil(safeW / 1.0) - 1);
  const horizontalCrossbarsCount = safeH > 1.2 ? Math.floor(safeH / 1.2) : 0;

  const internalPerUnit =
    verticalCrossbarsCount * safeH + horizontalCrossbarsCount * safeW;

  const totalPerimeterMeters = round2(perimeterPerUnit * safeQty);
  const internalReinforcementMeters = round2(internalPerUnit * safeQty);
  const totalLinearMeters = round2(totalPerimeterMeters + internalReinforcementMeters);

  // Cada tubo comercial mide 6.00 metros lineales
  const tubes6mRequired = Math.max(1, Math.ceil(totalLinearMeters / 6));
  const totalAreaM2 = safeW * safeH * safeQty;

  // Iluminación LED: ~25 módulos inyectados 12V por m²; 1 fuente 12V 300W cada 120 módulos
  const ledModulesRequired = isIlluminated ? Math.ceil(totalAreaM2 * 25) : 0;
  const ledPowerSupplies12VRequired = isIlluminated
    ? Math.max(1, Math.ceil(ledModulesRequired / 120))
    : 0;

  const estimatedStructureCostUsd = round2(tubes6mRequired * tube6mCostUsd);
  const estimatedLedCostUsd = isIlluminated
    ? round2(
        ledModulesRequired * ledModuleCostUsd +
          ledPowerSupplies12VRequired * powerSupplyCostUsd
      )
    : 0;

  return {
    totalPerimeterMeters,
    internalReinforcementMeters,
    totalLinearMeters,
    tubes6mRequired,
    ledModulesRequired,
    ledPowerSupplies12VRequired,
    estimatedStructureCostUsd,
    estimatedLedCostUsd,
  };
}

export interface LaserCncCalculationResult {
  minutes: number;
  ratePerMinuteUsd: number;
  setupFeeUsd: number;
  totalLaserCostUsd: number;
}

/**
 * 3. Cálculo de minutos de corte/grabado Láser CO2 o Router CNC.
 */
export function calculateLaserCncCost(
  minutes: number,
  ratePerMinuteUsd = 0.6,
  setupFeeUsd = 0
): LaserCncCalculationResult {
  const safeMinutes = Math.max(1, round2(minutes));
  const safeRate = Math.max(0.05, round2(ratePerMinuteUsd));
  const safeSetup = Math.max(0, round2(setupFeeUsd));
  return {
    minutes: safeMinutes,
    ratePerMinuteUsd: safeRate,
    setupFeeUsd: safeSetup,
    totalLaserCostUsd: round2(safeMinutes * safeRate + safeSetup),
  };
}

export interface SublimationVolumeScaleResult {
  quantity: number;
  baseUnitPriceUsd: number;
  discountPct: number;
  tierLabel: 'Unitario (1–11 und)' | 'Escala Docena (12–99 und)' | 'Escala Ciento (100+ und)';
  effectiveUnitPriceUsd: number;
  lineTotalUsd: number;
}

/**
 * 4. Escalas de volumen para Sublimación y Merchandising (Unidad, Docena >= 12, Ciento >= 100).
 */
export function calculateSublimationVolumeScale(
  baseUnitPriceUsd: number,
  quantity: number
): SublimationVolumeScaleResult {
  const safeQty = Math.max(1, Math.floor(quantity));
  const safeBase = Math.max(0, baseUnitPriceUsd);

  let discountPct = 0;
  let tierLabel: SublimationVolumeScaleResult['tierLabel'] = 'Unitario (1–11 und)';

  if (safeQty >= 100) {
    discountPct = 22;
    tierLabel = 'Escala Ciento (100+ und)';
  } else if (safeQty >= 12) {
    discountPct = 12;
    tierLabel = 'Escala Docena (12–99 und)';
  }

  const effectiveUnitPriceUsd = round2(safeBase * (1 - discountPct / 100));
  return {
    quantity: safeQty,
    baseUnitPriceUsd: round2(safeBase),
    discountPct,
    tierLabel,
    effectiveUnitPriceUsd,
    lineTotalUsd: round2(effectiveUnitPriceUsd * safeQty),
  };
}

export interface RollToM2ConversionResult {
  rollWidthM: number;
  rollLengthM: number;
  rollsQuantity: number;
  singleRollAreaM2: number;
  totalConvertedStockM2: number;
  unitCostPerM2Usd: number;
}

/**
 * 5. Conversión de rollos/bobinas de factura PDF a m² de bodega.
 */
export function convertInvoiceRollToM2(
  rollWidthM: number,
  rollLengthM: number,
  rollsQuantity: number,
  totalLineUsd: number
): RollToM2ConversionResult {
  const safeW = Math.max(0.1, rollWidthM);
  const safeL = Math.max(1, rollLengthM);
  const safeQty = Math.max(1, rollsQuantity);
  const singleRollAreaM2 = round2(safeW * safeL);
  const totalConvertedStockM2 = round2(singleRollAreaM2 * safeQty);
  const unitCostPerM2Usd =
    totalConvertedStockM2 > 0 ? round2(totalLineUsd / totalConvertedStockM2) : 0;

  return {
    rollWidthM: safeW,
    rollLengthM: safeL,
    rollsQuantity: safeQty,
    singleRollAreaM2,
    totalConvertedStockM2,
    unitCostPerM2Usd,
  };
}

export interface SriTaxAndRetentionBreakdown {
  subtotal: number;
  grossSubtotal: number;
  discountAmount: number;
  taxableBase: number;
  ivaRatePct: number;
  ivaAmount: number;
  totalInvoiceUsd: number;
  retentionRentaPct: number;
  retentionRentaAmount: number;
  retentionIvaPct: number;
  retentionIvaAmount: number;
  totalRetainedUsd: number;
  netPayableAfterRetentionsUsd: number;
  netReceivableAfterRetentions: number;
}

/**
 * 6. Cálculo de IVA (15% Ecuador configurable) y Retenciones en la Fuente SRI
 * (Renta: 1.75% bienes / 2% servicios / 2.75%; IVA: 30% bienes / 70% servicios / 100%).
 */
export function calculateSriTaxesAndRetentions(
  paramsOrSubtotal:
    | {
        grossSubtotal: number;
        discountAmount?: number;
        includeIva: boolean;
        ivaRatePct?: number;
        retentionRentaPct?: number;
        retentionIvaPct?: number;
      }
    | number,
  ivaRatePctArg = 15,
  retentionRentaPctArg = 1.75,
  retentionIvaPctArg = 30
): SriTaxAndRetentionBreakdown {
  const params =
    typeof paramsOrSubtotal === 'number'
      ? {
          grossSubtotal: paramsOrSubtotal,
          discountAmount: 0,
          includeIva: ivaRatePctArg > 0,
          ivaRatePct: ivaRatePctArg,
          retentionRentaPct: retentionRentaPctArg,
          retentionIvaPct: retentionIvaPctArg,
        }
      : paramsOrSubtotal;

  const grossSubtotal = round2(Math.max(0, params.grossSubtotal));
  const discountAmount = round2(Math.max(0, params.discountAmount || 0));
  const taxableBase = round2(Math.max(0, grossSubtotal - discountAmount));
  const ivaRatePct = params.includeIva ? params.ivaRatePct ?? 15 : 0;
  const ivaAmount = round2(taxableBase * (ivaRatePct / 100));
  const totalInvoiceUsd = round2(taxableBase + ivaAmount);

  const retentionRentaPct = Math.max(0, params.retentionRentaPct || 0);
  const retentionIvaPct = Math.max(0, params.retentionIvaPct || 0);

  const retentionRentaAmount = round2(taxableBase * (retentionRentaPct / 100));
  const retentionIvaAmount = round2(ivaAmount * (retentionIvaPct / 100));
  const totalRetainedUsd = round2(retentionRentaAmount + retentionIvaAmount);
  const netPayableAfterRetentionsUsd = round2(
    Math.max(0, totalInvoiceUsd - totalRetainedUsd)
  );

  return {
    subtotal: taxableBase,
    grossSubtotal,
    discountAmount,
    taxableBase,
    ivaRatePct,
    ivaAmount,
    totalInvoiceUsd,
    retentionRentaPct,
    retentionRentaAmount,
    retentionIvaPct,
    retentionIvaAmount,
    totalRetainedUsd,
    netPayableAfterRetentionsUsd,
    netReceivableAfterRetentions: netPayableAfterRetentionsUsd,
  };
}

