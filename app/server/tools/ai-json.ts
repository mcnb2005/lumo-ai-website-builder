function stripTrailingCommas(json: string) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < json.length; index += 1) {
    const character = json[index];
    if (inString) {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }

    if (character === ",") {
      let nextIndex = index + 1;
      while (/\s/.test(json[nextIndex] || "")) nextIndex += 1;
      if (json[nextIndex] === "}" || json[nextIndex] === "]") continue;
    }
    output += character;
  }

  return output;
}

function firstJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start < 0) return "";

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return "";
}

export function extractAiJson(text: string, invalidMessage: string) {
  const candidate = firstJsonObject(text.trim());
  if (!candidate) throw new Error(invalidMessage);

  let lastError: unknown = null;
  for (const value of Array.from(
    new Set([candidate, stripTrailingCommas(candidate)])
  )) {
    try {
      return JSON.parse(value) as unknown;
    } catch (error) {
      lastError = error;
    }
  }

  const detail =
    lastError instanceof Error ? ` ${lastError.message}` : "";
  throw new Error(`${invalidMessage}${detail}`);
}
