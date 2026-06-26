import * as XLSX from "xlsx";

const SUPPORTED_EXTENSIONS = new Set(["csv", "xls", "xlsx"]);

const DATE_FORMAT_HINTS = /[ymdhs]/i;

function getExtension(fileName) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function normalizeHeader(value, index) {
  const text = String(value ?? "").trim();
  return text || `Column ${index + 1}`;
}

function makeUniqueHeaders(headerRow) {
  const seen = new Map();
  const duplicates = new Set();

  const headers = headerRow.map((value, index) => {
    const baseHeader = normalizeHeader(value, index);
    const count = seen.get(baseHeader) || 0;
    seen.set(baseHeader, count + 1);

    if (count > 0) {
      duplicates.add(baseHeader);
      return `${baseHeader} (${count + 1})`;
    }

    return baseHeader;
  });

  return { headers, duplicates: Array.from(duplicates) };
}

function isDateFormattedCell(cell) {
  if (!cell?.z || cell.t !== "n") {
    return false;
  }

  if (typeof XLSX.SSF?.is_date === "function") {
    return XLSX.SSF.is_date(cell.z);
  }

  return DATE_FORMAT_HINTS.test(cell.z);
}

function getFormattedCellValue(cell) {
  if (!cell) {
    return "";
  }

  return cell.w ?? XLSX.utils.format_cell(cell) ?? cell.v ?? "";
}

function getPreviewCellValue(cell) {
  if (!cell) {
    return "";
  }

  if (cell.t === "n") {
    return isDateFormattedCell(cell) ? getFormattedCellValue(cell) : cell.v;
  }

  if (cell.t === "b") {
    return cell.v;
  }

  return cell.v ?? getFormattedCellValue(cell);
}

function getCellMetadata(cell) {
  if (!cell) {
    return null;
  }

  return {
    value: cell.v ?? "",
    type: cell.t,
    format: cell.z,
    displayValue: getFormattedCellValue(cell),
  };
}

function readWorksheetRows(worksheet) {
  const range = worksheet["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : null;
  if (!range) {
    return [];
  }

  const rows = [];
  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const values = [];
    const metadata = [];

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[address];
      values.push(getPreviewCellValue(cell));
      metadata.push(getCellMetadata(cell));
    }

    const hasValue = values.some((value) => value !== null && value !== undefined && String(value).trim() !== "");
    if (hasValue) {
      rows.push({ values, metadata });
    }
  }

  return rows;
}

function worksheetToSheetData(worksheet, sheetName) {
  const matrix = readWorksheetRows(worksheet);

  const warnings = [];

  if (!matrix.length) {
    return {
      name: sheetName,
      headers: [],
      rows: [],
      cellMetadataRows: [],
      rowCount: 0,
      columnCount: 0,
      warnings: ["Sheet is empty."],
    };
  }

  const widestRowLength = matrix.reduce((max, row) => Math.max(max, row.values.length), 0);
  const headerRow = Array.from({ length: widestRowLength }, (_, index) => matrix[0]?.values[index] ?? "");
  const { headers, duplicates } = makeUniqueHeaders(headerRow);

  if (duplicates.length) {
    warnings.push(`Duplicate source headers were renamed: ${duplicates.join(", ")}.`);
  }

  const dataRows = matrix.slice(1);
  const rows = dataRows.map((row) => {
    return headers.reduce((record, header, index) => {
      record[header] = row.values[index] ?? "";
      return record;
    }, {});
  });

  const cellMetadataRows = dataRows.map((row) => {
    return headers.reduce((record, header, index) => {
      record[header] = row.metadata[index] ?? null;
      return record;
    }, {});
  });

  return {
    name: sheetName,
    headers,
    rows,
    cellMetadataRows,
    rowCount: rows.length,
    columnCount: headers.length,
    warnings,
  };
}

export async function parseSpreadsheetFile(file) {
  const extension = getExtension(file.name);

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported file type. Choose a CSV, XLS, or XLSX file.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false, cellNF: true, cellText: true });

  const sheets = workbook.SheetNames.map((sheetName) => {
    return worksheetToSheetData(workbook.Sheets[sheetName], extension === "csv" ? "CSV" : sheetName);
  });

  return {
    fileName: file.name,
    sheets,
  };
}

export function getSheetData(workbookData, sheetName) {
  return workbookData?.sheets.find((sheet) => sheet.name === sheetName) || null;
}