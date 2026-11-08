import { ReusableOffcut } from '../data/initialData';

export interface RollNestingEvaluation {
  rollW_M: number;
  orient: 'normal' | 'rotated';
  cols: number;
  rowsNeeded: number;
  linearMeters: number;
  totalUsedM2: number;
  usedPct: number;
  wastePct: number;
  sideScrapCm: number;
  pieceW: number;
  pieceH: number;
}

export interface SheetNestingEvaluation {
  orient: 'normal' | 'rotated';
  cols: number;
  rows: number;
  piecesPerSheet: number;
  sheetsNeeded: number;
  utilizationPct: number;
  wastePct: number;
  offcutRightCm: number;
  offcutBottomCm: number;
  pieceW: number;
  pieceH: number;
}

export interface CompatibleOffcutMatch {
  offcut: ReusableOffcut;
  orientation: 'normal' | 'rotated';
  cols: number;
  rows: number;
  maxPiecesInOffcut: number;
  coversFullOrder: boolean;
}

/**
 * Evalúa el anidado de piezas/stickers en una bobina flexible (1.05m, 1.27m, 1.52m).
 */
export function evaluateRollNesting(params: {
  rollW_M: number;
  orient: 'normal' | 'rotated';
  stickerWidthCm: number;
  stickerHeightCm: number;
  targetStickerQty: number;
  marginOposCm: number;
  gapMm: number;
}): RollNestingEvaluation {
  const {
    rollW_M,
    orient,
    stickerWidthCm,
    stickerHeightCm,
    targetStickerQty,
    marginOposCm,
    gapMm,
  } = params;
  const gapCm = gapMm / 10;
  const rollW_Cm = rollW_M * 100;
  const printableW_Cm = Math.max(1, rollW_Cm - marginOposCm * 2);
  const w = orient === 'normal' ? stickerWidthCm : stickerHeightCm;
  const h = orient === 'normal' ? stickerHeightCm : stickerWidthCm;

  const cols = Math.max(0, Math.floor((printableW_Cm + gapCm) / (w + gapCm)));
  if (cols === 0) {
    return {
      rollW_M,
      orient,
      cols: 0,
      rowsNeeded: 0,
      linearMeters: 0,
      totalUsedM2: 0,
      usedPct: 0,
      wastePct: 100,
      sideScrapCm: rollW_Cm,
      pieceW: w,
      pieceH: h,
    };
  }

  const rowsNeeded = Math.ceil(targetStickerQty / cols);
  const totalLengthCm = rowsNeeded * h + Math.max(0, rowsNeeded - 1) * gapCm + 6; // +6cm avance
  const linearMeters = Number((totalLengthCm / 100).toFixed(2));
  const totalRollAreaM2 = Number((rollW_M * linearMeters).toFixed(2));
  const netStickerAreaM2 = Number(
    ((targetStickerQty * (stickerWidthCm * stickerHeightCm)) / 10000).toFixed(2)
  );
  const usedPct =
    totalRollAreaM2 > 0
      ? Math.min(100, Number(((netStickerAreaM2 / totalRollAreaM2) * 100).toFixed(1)))
      : 0;
  const wastePct = Number((100 - usedPct).toFixed(1));
  const usedWidthCm = cols * w + (cols - 1) * gapCm;
  const sideScrapCm = Number(Math.max(0, printableW_Cm - usedWidthCm).toFixed(1));

  return {
    rollW_M,
    orient,
    cols,
    rowsNeeded,
    linearMeters,
    totalUsedM2: totalRollAreaM2,
    usedPct,
    wastePct,
    sideScrapCm,
    pieceW: w,
    pieceH: h,
  };
}

/**
 * Evalúa el despiece CNC/Láser en plancha rígida estándar 244cm x 122cm.
 */
export function evaluateSheetNesting(params: {
  orient: 'normal' | 'rotated';
  pieceWidthCm: number;
  pieceHeightCm: number;
  targetPieceQty: number;
  kerfMm: number;
  sheetW_Cm?: number;
  sheetH_Cm?: number;
}): SheetNestingEvaluation {
  const SHEET_W = params.sheetW_Cm ?? 244;
  const SHEET_H = params.sheetH_Cm ?? 122;
  const kerfCm = params.kerfMm / 10;
  const w = params.orient === 'normal' ? params.pieceWidthCm : params.pieceHeightCm;
  const h = params.orient === 'normal' ? params.pieceHeightCm : params.pieceWidthCm;

  const cols = Math.max(0, Math.floor((SHEET_W + kerfCm) / (w + kerfCm)));
  const rows = Math.max(0, Math.floor((SHEET_H + kerfCm) / (h + kerfCm)));
  const piecesPerSheet = cols * rows;

  if (piecesPerSheet === 0) {
    return {
      orient: params.orient,
      cols: 0,
      rows: 0,
      piecesPerSheet: 0,
      sheetsNeeded: 0,
      utilizationPct: 0,
      wastePct: 100,
      offcutRightCm: SHEET_W,
      offcutBottomCm: SHEET_H,
      pieceW: w,
      pieceH: h,
    };
  }

  const sheetsNeeded = Math.ceil(params.targetPieceQty / piecesPerSheet);
  const sheetAreaCm2 = SHEET_W * SHEET_H;
  const usedAreaPerSheetCm2 = piecesPerSheet * (w * h);
  const utilizationPct = Number(((usedAreaPerSheetCm2 / sheetAreaCm2) * 100).toFixed(1));
  const wastePct = Number((100 - utilizationPct).toFixed(1));

  const usedW = cols * w + Math.max(0, cols - 1) * kerfCm;
  const usedH = rows * h + Math.max(0, rows - 1) * kerfCm;

  return {
    orient: params.orient,
    cols,
    rows,
    piecesPerSheet,
    sheetsNeeded,
    utilizationPct,
    wastePct,
    offcutRightCm: Number(Math.max(0, SHEET_W - usedW).toFixed(1)),
    offcutBottomCm: Number(Math.max(0, SHEET_H - usedH).toFixed(1)),
    pieceW: w,
    pieceH: h,
  };
}

/**
 * Busca retazos reutilizables disponibles en bodega donde quepa al menos 1 pieza del trabajo actual.
 */
export function findCompatibleReusableOffcuts(params: {
  pieceWidthCm: number;
  pieceHeightCm: number;
  targetPieceQty: number;
  kerfMm: number;
  offcuts: ReusableOffcut[];
}): CompatibleOffcutMatch[] {
  const kerfCm = params.kerfMm / 10;
  const matches: CompatibleOffcutMatch[] = [];

  params.offcuts
    .filter((o) => o.status === 'Disponible')
    .forEach((offcut) => {
      const colsN = Math.max(
        0,
        Math.floor((offcut.widthCm + kerfCm) / (params.pieceWidthCm + kerfCm))
      );
      const rowsN = Math.max(
        0,
        Math.floor((offcut.heightCm + kerfCm) / (params.pieceHeightCm + kerfCm))
      );
      const fitNormal = colsN * rowsN;

      const colsR = Math.max(
        0,
        Math.floor((offcut.widthCm + kerfCm) / (params.pieceHeightCm + kerfCm))
      );
      const rowsR = Math.max(
        0,
        Math.floor((offcut.heightCm + kerfCm) / (params.pieceWidthCm + kerfCm))
      );
      const fitRotated = colsR * rowsR;

      const bestIsRotated = fitRotated > fitNormal;
      const maxPiecesInOffcut = Math.max(fitNormal, fitRotated);

      if (maxPiecesInOffcut > 0) {
        matches.push({
          offcut,
          orientation: bestIsRotated ? 'rotated' : 'normal',
          cols: bestIsRotated ? colsR : colsN,
          rows: bestIsRotated ? rowsR : rowsN,
          maxPiecesInOffcut,
          coversFullOrder: maxPiecesInOffcut >= params.targetPieceQty,
        });
      }
    });

  return matches.sort((a, b) => b.maxPiecesInOffcut - a.maxPiecesInOffcut);
}
