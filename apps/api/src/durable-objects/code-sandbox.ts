import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env.js";

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

const MAX_OUTPUT_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
// The container stops after this long without activity, so idle users don't pay for it.
const IDLE_TIMEOUT_MS = 5 * 60_000;

function decode(buf: ArrayBuffer): string {
  const text = new TextDecoder().decode(buf.slice(0, MAX_OUTPUT_BYTES));
  return buf.byteLength > MAX_OUTPUT_BYTES ? `${text}\n…[truncated]` : text;
}

// One sandbox per user (addressed by user id). Runs untrusted, model-generated
// JavaScript in a Cloudflare-managed Debian + Node.js container with no Internet access.
export class CodeSandbox extends DurableObject<Env["Bindings"]> {
  private get container(): Container {
    const container = this.ctx.container;
    if (!container) throw new Error("No container is configured for CodeSandbox");
    return container;
  }

  async run(code: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<SandboxResult> {
    const container = this.container;
    if (!container.running) {
      container.start({
        image: "cloudflare/debian-trixie",
        entrypoint: ["sleep", "infinity"],
        instance: "lite",
        enableInternet: false,
      });
      await container.setInactivityTimeout(IDLE_TIMEOUT_MS);
    }

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const proc = await container.exec(["node", "-e", code], {
        cwd: "/tmp",
        signal: abort.signal,
      });
      const output = await proc.output();
      return {
        stdout: decode(output.stdout),
        stderr: decode(output.stderr),
        exitCode: output.exitCode,
        timedOut: false,
      };
    } catch (err) {
      if (abort.signal.aborted) {
        return {
          stdout: "",
          stderr: `Timed out after ${timeoutMs}ms`,
          exitCode: null,
          timedOut: true,
        };
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
