import * as XLSX from "xlsx";

function makeOutputFileName(fileName) {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "audit-output";
  return `${baseName}-generated.xlsx`;
}

export function downloadExcel(outputRows, outputHeaders, fileName) {
  const worksheet = XLSX.utils.json_to_sheet(outputRows, { header: outputHeaders });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Generated");
  XLSX.writeFile(workbook, makeOutputFileName(fileName));
}