import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

export type LegacyMaskingFailure = "storage-unavailable" | "decryption-failed" | "invalid-store" | "unreadable-store";
export interface LegacyMaskingIssue {
  id: string;
  reason: LegacyMaskingFailure;
  acknowledged: boolean;
  dismissible: boolean;
}
interface LocalPreferences { getItem(key: string): string | null; setItem(key: string, value: string): void; }
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

// Read-only compatibility for known historical values. No value accessor,
// environment mapping, PIN, management or persistence API is exposed.
export class LegacyOutputRedaction {
  private values: string[] = [];
  private file = "";
  private issue?: {id: string; reason: LegacyMaskingFailure; contentHash?: string};
  private lastNotified?: string;
  constructor(private diagnostic: () => void, private preferences?: LocalPreferences) {}

  private preferenceKey(): string { return `autooc-legacy-masking-reviewed-v1:${digest(this.file)}`; }

  getIssue(): LegacyMaskingIssue | undefined {
    if (!this.issue) return undefined;
    let acknowledged = false;
    try { acknowledged = this.preferences?.getItem(this.preferenceKey()) === this.issue.id; } catch { /* Local preferences are optional. */ }
    return {id: this.issue.id, reason: this.issue.reason, acknowledged, dismissible: !!this.issue.contentHash};
  }

  acknowledge(id: string): void {
    const issue = this.issue;
    if (!issue || issue.id !== id || !issue.contentHash) throw new Error("The legacy credential notice changed. Try reading again before dismissing it.");
    try {
      if (digest(fs.readFileSync(this.file)) !== issue.contentHash) throw new Error("changed");
    } catch { throw new Error("The historical file changed or cannot be read. Try reading again before dismissing this reminder."); }
    try {
      if (!this.preferences) throw new Error("unavailable");
      this.preferences.setItem(this.preferenceKey(), id);
      if (this.preferences.getItem(this.preferenceKey()) !== id) throw new Error("not saved");
    } catch { throw new Error("Could not save this preference on this device. The historical file was not changed."); }
  }

  private report(reason: LegacyMaskingFailure, contentHash: string | undefined, notify: boolean): void {
    const id = digest(`${this.file}\0${reason}\0${contentHash || "unreadable"}`);
    this.issue = {id, reason, contentHash};
    const first = this.lastNotified !== id;
    this.lastNotified = id;
    if (notify && first && !this.getIssue()?.acknowledged) this.diagnostic();
  }

  load(file: string, storage: { decryptString(value: Buffer): string } | null, notify = true): void {
    const identity = path.resolve(file);
    if (identity !== this.file) { this.values = []; this.issue = undefined; this.lastNotified = undefined; this.file = identity; }
    let raw: Buffer;
    try { raw = fs.readFileSync(this.file); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") { this.values = []; this.issue = undefined; this.lastNotified = undefined; return; }
      this.report("unreadable-store", undefined, notify); return;
    }
    const contentHash = digest(raw);
    const values: string[] = [];
    let failure: LegacyMaskingFailure | undefined;
    try {
      const parsed = JSON.parse(raw.toString("utf8"));
      if (!Array.isArray(parsed.secrets)) throw new Error("Invalid historical store");
      for (const record of parsed.secrets) {
        if (typeof record?.encryptedValue !== "string") { failure = "invalid-store"; continue; }
        if (!storage || typeof storage.decryptString !== "function") { failure ||= "storage-unavailable"; continue; }
        try {
          const value = storage.decryptString(Buffer.from(record.encryptedValue, "base64"));
          if (typeof value !== "string") throw new Error("Invalid decrypted value");
          if (value.length >= 4) values.push(value);
        } catch { failure ||= "decryption-failed"; }
      }
    } catch { failure = "invalid-store"; }
    // A transient or partial read must not drop masking values already known
    // in this session. A complete successful load replaces that cache.
    this.values = [...new Set(failure ? [...this.values, ...values] : values)].sort((a,b) => b.length - a.length);
    // Never include a parse, filesystem or decryption exception in diagnostics.
    if (failure) this.report(failure, contentHash, notify);
    else { this.issue = undefined; this.lastNotified = undefined; }
  }

  redact(text: string): string {
    for (const value of this.values) text = text.split(value).join("[secret:redacted]");
    return text;
  }
}
