export function normalizeCommandOutput(text: string): string {
  if (!text) return "";

  // Remove ANSI color/control escape sequences
  // Bytes are decoded by decodeCommandBuffer before reaching this function.
  // Re-encoding a decoded string as Latin-1 corrupts valid Unicode and Markdown.
  const cleaned = text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, "");

  return cleaned.trim();
}

export function extractTouchedFiles(trace: string): string[] {
  const files = new Set<string>();
  for (const line of trace.split(/\r?\n/)) {
    const match = line.match(/^[←→]\s+(?:Edit|Write|Read)\s+(.+)$/) || line.match(/^Index:\s+(.+)$/);
    if (match?.[1]) files.add(match[1].trim());
  }
  return [...files];
}

export function formatTaskOutput(stdout: string, stderr: string): string {
  const cleanStdout = normalizeCommandOutput(stdout);
  const cleanStderr = normalizeCommandOutput(stderr);
  const parts: string[] = [];

  if (cleanStdout) {
    parts.push(`## Response\n\n${cleanStdout}`);
  }

  const touchedFiles = extractTouchedFiles(cleanStderr);
  if (touchedFiles.length > 0) {
    parts.push(`## Touched files\n\n${touchedFiles.map((f) => `- ${f}`).join("\n")}`);
  }

  if (cleanStderr) {
    parts.push(`## OpenCode trace\n\n\`\`\`text\n${cleanStderr}\n\`\`\``);
  }

  return parts.join("\n\n---\n\n").trim();
}

export function formatLogContent(text: string): string {
  if (!text) return "";
  return normalizeCommandOutput(text).replace(/\r\n/g, "\n");
}

export function countReplacementChars(text: string): number {
  return (text.match(/�/g) || []).length;
}

export function decodeCp850(bytes: Buffer): string {
  const map: Record<number, string> = {
    0x80: "Ç", 0x81: "ü", 0x82: "é", 0x83: "â", 0x84: "ä", 0x85: "à", 0x86: "å", 0x87: "ç",
    0x88: "ê", 0x89: "ë", 0x8a: "è", 0x8b: "ï", 0x8c: "î", 0x8d: "ì", 0x8e: "Ä", 0x8f: "Å",
    0x90: "É", 0x91: "æ", 0x92: "Æ", 0x93: "ô", 0x94: "ö", 0x95: "ò", 0x96: "û", 0x97: "ù",
    0x98: "ÿ", 0x99: "Ö", 0x9a: "Ü", 0x9b: "ø", 0x9c: "£", 0x9d: "Ø", 0x9e: "×", 0x9f: "ƒ",
    0xa0: "á", 0xa1: "í", 0xa2: "ó", 0xa3: "ú", 0xa4: "ñ", 0xa5: "Ñ", 0xa6: "ª", 0xa7: "º",
    0xa8: "¿", 0xa9: "®", 0xaa: "¬", 0xab: "½", 0xac: "¼", 0xad: "¡", 0xae: "«", 0xaf: "»",
  };
  let out = "";
  for (const byte of bytes) {
    if (byte < 0x80) out += String.fromCharCode(byte);
    else out += map[byte] ?? String.fromCharCode(byte);
  }
  return out;
}

export function decodeWindows1252(bytes: Buffer): string {
  const map: Record<number, string> = {
    0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡",
    0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž",
    0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—",
    0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
  };
  let out = "";
  for (const byte of bytes) {
    if (byte < 0x80 || byte >= 0xa0) out += String.fromCharCode(byte);
    else out += map[byte] ?? "";
  }
  return out;
}

export function decodeCommandBuffer(bytes: Buffer): string {
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.toString("utf16le");
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return Buffer.from(bytes).swap16().toString("utf16le");
  }

  if (bytes.length > 4) {
    let oddNulls = 0;
    let evenNulls = 0;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        if (i % 2 === 0) evenNulls++;
        else oddNulls++;
      }
    }
    const nullRatio = (oddNulls + evenNulls) / bytes.length;
    if (nullRatio > 0.2 && oddNulls > evenNulls * 4) return bytes.toString("utf16le");
    if (nullRatio > 0.2 && evenNulls > oddNulls * 4) return Buffer.from(bytes).swap16().toString("utf16le");
  }

  const utf8 = bytes.toString("utf8");
  if (countReplacementChars(utf8) === 0) return utf8;
  const win1252 = decodeWindows1252(bytes);
  const cp850 = decodeCp850(bytes);
  return countReplacementChars(win1252) <= countReplacementChars(cp850) ? win1252 : cp850;
}
