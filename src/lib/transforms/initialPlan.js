function makeColumnId(prefix, value, index) {
  return `${prefix}_${String(value).replace(/[^a-z0-9]+/gi, "_")}_${index}`;
}

export function createInitialPlan(headers) {
  return {
    deleteRowConditions: [],
    columns: headers.map((header, index) => ({
      id: makeColumnId("col", header, index),
      outputName: header,
      enabled: true,
      operation: {
        type: "copy",
        source: header,
      },
    })),
  };
}

export function createBlankDerivedColumn(index) {
  return {
    id: `derived_${Date.now()}_${index}`,
    outputName: "",
    enabled: true,
    operation: {
      type: "concat",
      sources: [],
      separator: " ",
      literal: "",
    },
  };
}