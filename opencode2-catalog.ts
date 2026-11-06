import { resolveInteractiveCli } from "./interactive-cli";
import { assertOpenCode2, readOpenCodeOutput } from "./opencode-version";

export type CatalogKind = "models" | "agents";
type Choice = { value: string; label: string };

function parseChoices(kind: CatalogKind, output: string): Choice[] {
  const choices = new Map<string, string>();
  if (kind === "models") {
    for (const line of output.split(/\r?\n/)) {
      const id = line.trim();
      if (/^[^/\s]+\/\S+$/.test(id)) choices.set(id, id);
    }
  } else {
    const agents = JSON.parse(output);
    if (!Array.isArray(agents)) throw new Error("Expected a list of agents.");
    for (const agent of agents) {
      if (typeof agent?.id !== "string" || !agent.id || agent.hidden || agent.disabled || agent.mode === "subagent") continue;
      choices.set(agent.id, typeof agent.name === "string" && agent.name ? agent.name : agent.id);
    }
  }
  return Array.from(choices, ([value, label]) => ({ value, label }));
}

export class OpenCode2Catalog {
  private readonly lists = new Map<string, Choice[]>();
  private readonly pending = new Map<string, Promise<Choice[]>>();

  choices(path: string, cwd: string, kind: CatalogKind): Choice[] {
    return this.lists.get(JSON.stringify([path, cwd, kind])) || [];
  }

  refresh(path: string, cwd: string, kind: CatalogKind): Promise<Choice[]> {
    const key = JSON.stringify([path, cwd, kind]);
    const pending = this.pending.get(key);
    if (pending) return pending;
    const request = this.discover(path, cwd, kind, this.lists.get(key)).then(choices => {
      this.lists.set(key, choices);
      return choices;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  private async discover(path: string, cwd: string, kind: CatalogKind, previous?: Choice[]): Promise<Choice[]> {
    const bin = resolveInteractiveCli("opencode2", path);
    if (!bin) throw new Error("Set the OpenCode 2 CLI executable in AutoOC Settings.");
    await assertOpenCode2(bin);
    const args = kind === "models" ? ["models"] : ["debug", "agents"];
    const query = async () => parseChoices(kind, await readOpenCodeOutput(bin, args, cwd, 20000, 4 * 1024 * 1024));
    try {
      // CLI catalog reads do not wait for plugin activation. The first snapshot
      // may contain built-ins before project agents or connected providers appear.
      let choices: Choice[] = [];
      for (const waitMs of [0, 1000, 1200, 1800]) {
        if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
        choices = await query();
        if (choices.length && previous?.length === choices.length &&
          choices.every((choice, i) => choice.value === previous![i].value && choice.label === previous![i].label)) break;
        previous = choices;
      }
      return choices;
    } catch {
      throw new Error(`Could not read OpenCode 2 ${kind}. Check the project folder and run “${args.join(" ")}” with the OpenCode 2 executable selected in Settings.`);
    }
  }
}
