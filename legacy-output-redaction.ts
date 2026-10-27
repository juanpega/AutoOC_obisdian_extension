import * as fs from "fs";

// Read-only compatibility for known historical values. No value accessor,
// environment mapping, PIN, management or persistence API is exposed.
export class LegacyOutputRedaction {
  private values: string[] = [];
  constructor(private diagnostic: () => void) {}

  load(file: string, storage: { decryptString(value: Buffer): string } | null): void {
    const values: string[] = [];
    let unavailable = false;
    try {
      if (!fs.existsSync(file)) { this.values = []; return; }
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!Array.isArray(parsed.secrets)) throw new Error("Invalid historical store");
      for (const record of parsed.secrets) {
        try {
          if (!storage || typeof record.encryptedValue !== "string") throw new Error("Unavailable");
          const value = storage.decryptString(Buffer.from(record.encryptedValue, "base64"));
          if (value.length >= 4) values.push(value);
        } catch { unavailable = true; }
      }
      // Longest first also masks overlapping historical values completely.
      this.values = [...new Set(values)].sort((a,b) => b.length - a.length);
    } catch { unavailable = true; }
    // Never include a parse, filesystem or decryption exception in diagnostics.
    if (unavailable) this.diagnostic();
  }

  redact(text: string): string {
    for (const value of this.values) text = text.split(value).join("[secret:redacted]");
    return text;
  }
}
