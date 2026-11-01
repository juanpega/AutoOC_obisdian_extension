import {readSettingsTextAsync} from './settings-writer';
import {parseCooperatively} from './cooperative-json';

export interface PanelEntry {
  id: string;
  name: string;
  status: string;
  runId?: string;
  phase?: string;
}
export interface PanelCatalog { tasks: PanelEntry[]; workflows: PanelEntry[]; }

// A committed snapshot for display only: no lease, migrations, journal recovery,
// secret store, SettingsWriter adoption or default catalog on a read failure.
export async function readPanelCatalog(file: string): Promise<PanelCatalog> {
  const text = await readSettingsTextAsync(file);
  if (text === null) throw new Error('No saved catalog is available for consultation');
  const catalog = await parseCooperatively(text);
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new Error('Cannot read the saved catalog');
  const result: PanelCatalog = {tasks: [], workflows: []};
  for (const kind of ['tasks', 'workflows'] as const) {
    const entries = catalog[kind] ?? [];
    if (!Array.isArray(entries)) throw new Error('Cannot read the saved catalog');
    for (const entry of entries) {
      if (!entry || typeof entry.id !== 'string') throw new Error('Cannot read the saved catalog');
      const binding = entry.runtimeExecution;
      result[kind].push({id: entry.id, name: typeof entry.name === 'string' ? entry.name : entry.id,
        status: typeof entry.status === 'string' ? entry.status : 'pending',
        runId: typeof binding?.runId === 'string' ? binding.runId : undefined,
        phase: typeof binding?.phase === 'string' ? binding.phase : undefined});
    }
  }
  return result;
}
