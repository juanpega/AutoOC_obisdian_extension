import * as fs from "fs";
import * as path from "path";

// Existing locations only. Callers must inspect restricted link components
// before resolving them: physical identity is not authorization to follow links.
export function physicalPath(location: string): string {
  return process.platform === "win32" ? fs.realpathSync.native(location) : fs.realpathSync(location);
}

export function samePhysicalPath(left: string, right: string): boolean {
  return path.relative(physicalPath(left), physicalPath(right)) === "";
}

export function isWithinPhysicalPath(root: string, location: string): boolean {
  const relative = path.relative(physicalPath(root), physicalPath(location));
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}
