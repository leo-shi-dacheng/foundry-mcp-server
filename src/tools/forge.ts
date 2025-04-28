import * as path from "path";
import * as fs from "fs/promises";
import { z } from "zod";
import { server } from "../server";
import { forgePath } from "../config";
import { checkFoundryInstalled, executeCommand } from "../utils/commands";
import { FOUNDRY_NOT_INSTALLED_ERROR } from "../config";
import { resolveRpcUrl } from "../utils/rpc";
import { ensureWorkspaceInitialized } from "../utils/workspace";

// Tool: Run Forge scripts
server.tool(
  "forge_script",
  "Run a Forge script from the workspace",
  {
    scriptPath: z.string().describe("Path to the script file (e.g., 'script/Deploy.s.sol')"),
    sig: z.string().optional().describe("Function signature to call (default: 'run()')"),
    rpcUrl: z.string().optional().describe("JSON-RPC URL (default: http://localhost:8545)"),
    broadcast: z.boolean().optional().describe("Broadcast the transactions"),
    verify: z.boolean().optional().describe("Verify the contract on Etherscan (needs API key)")
  },
  async ({ scriptPath, sig = "run()", rpcUrl, broadcast = false, verify = false }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    try {
      const workspace = await ensureWorkspaceInitialized();
      
      // Check if script exists
      const scriptFullPath = path.join(workspace, scriptPath);
      const scriptExists = await fs.access(scriptFullPath).then(() => true).catch(() => false);
      if (!scriptExists) {
        return {
          content: [{ 
            type: "text", 
            text: `Script does not exist at ${scriptFullPath}` 
          }],
          isError: true
        };
      }

      const resolvedRpcUrl = await resolveRpcUrl(rpcUrl);
      let command = `cd ${workspace} && ${forgePath} script ${scriptPath} --sig "${sig}"`;
      
      if (resolvedRpcUrl) {
        command += ` --rpc-url "${resolvedRpcUrl}"`;
      }
      
      if (broadcast) {
        command += ` --broadcast`;
      }
      
      if (verify) {
        command += ` --verify`;
      }
      
      const result = await executeCommand(command);
      
      return {
        content: [{ 
          type: "text", 
          text: result.success 
            ? `Script executed successfully:\n${result.message}` 
            : `Script execution failed: ${result.message}` 
        }],
        isError: !result.success
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error executing script: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Tool: Install dependencies for the workspace
server.tool(
  "install_dependency",
  "Install a dependency for the Forge workspace",
  {
    dependency: z.string().describe("GitHub repository to install (e.g., 'OpenZeppelin/openzeppelin-contracts')"),
    version: z.string().optional().describe("Version tag or branch to install (default: latest)")
  },
  async ({ dependency, version }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    try {
      const workspace = await ensureWorkspaceInitialized();
      
      let command = `cd ${workspace} && ${forgePath} install ${dependency} --no-commit`;
      if (version) {
        command += ` --tag ${version}`;
      }
      
      const result = await executeCommand(command);
      
      return {
        content: [{ 
          type: "text", 
          text: result.success 
            ? `Dependency installed successfully:\n${result.message}` 
            : `Failed to install dependency: ${result.message}` 
        }],
        isError: !result.success
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error installing dependency: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);