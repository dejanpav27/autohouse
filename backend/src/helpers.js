// snake_case <-> camelCase converters
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, c => "_" + c.toLowerCase());
}

function rowToJSON(row) {
  if (!row) return null;
  const obj = {};
  for (const [k, v] of Object.entries(row)) {
    const key = snakeToCamel(k);
    // Parse JSON fields
    if (["languages", "locations", "media", "features", "sessionData"].includes(key)) {
      try { obj[key] = JSON.parse(v || "[]"); } catch { obj[key] = []; }
    } else {
      obj[key] = v;
    }
  }
  return obj;
}

function jsonToRow(obj, allowedFields) {
  const row = {};
  for (const [k, v] of Object.entries(obj)) {
    const snakeKey = camelToSnake(k);
    if (allowedFields && !allowedFields.includes(snakeKey)) continue;
    if (Array.isArray(v) || (typeof v === "object" && v !== null)) {
      row[snakeKey] = JSON.stringify(v);
    } else {
      row[snakeKey] = v;
    }
  }
  return row;
}

module.exports = { rowToJSON, jsonToRow, snakeToCamel, camelToSnake };
