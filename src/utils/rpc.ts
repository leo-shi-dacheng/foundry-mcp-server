import * as path from "path";
import * as fs from "fs/promises";
import { DEFAULT_RPC_URL, homeDir } from "../config";

export async function resolveRpcUrl(rpcUrl: string | undefined): Promise<string> {
  if (!rpcUrl) {
    return DEFAULT_RPC_URL;
  }

  if (!rpcUrl.startsWith("http")) {
    try {
      const configPath = path.join(homeDir, ".foundry", "config.toml");
      const configExists = await fs.access(configPath).then(() => true).catch(() => false);

      if (configExists) {
        const configContent = await fs.readFile(configPath, "utf8");
        const rpcMatch = new RegExp(`\\[rpc_endpoints\\][\\s\\S]*?${rpcUrl}\\s*=\\s*["']([^"']+)["']`).exec(configContent);

        if (rpcMatch && rpcMatch[1]) {
          return rpcMatch[1];
        }
      }
    } catch (error) {
      console.error("Error resolving RPC from config:", error);
    }
  }

  return rpcUrl;
}