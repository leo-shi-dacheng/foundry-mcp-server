import * as fs from "fs/promises";
import * as path from "path";
import { FOUNDRY_WORKSPACE, forgePath } from "../config";
import { executeCommand } from "./commands";

export async function ensureWorkspaceInitialized() {
  try {
    await fs.mkdir(FOUNDRY_WORKSPACE, { recursive: true });

    const isForgeProject = await fs.access(path.join(FOUNDRY_WORKSPACE, "foundry.toml"))
      .then(() => true)
      .catch(() => false);

    if (!isForgeProject) {
      await executeCommand(`cd ${FOUNDRY_WORKSPACE} && ${forgePath} init --no-git`);
    }

    return FOUNDRY_WORKSPACE;
  } catch (error) {
    console.error("Error initializing workspace:", error);
    throw error;
  }
}