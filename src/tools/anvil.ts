import { exec } from "child_process";
import * as os from "os";
import { z } from "zod";
import { server } from "../server";
import { execAsync } from "../utils/commands";
import { anvilPath } from "../config";
import { checkFoundryInstalled } from "../utils/commands";
import { FOUNDRY_NOT_INSTALLED_ERROR } from "../config";
import { resolveRpcUrl } from "../utils/rpc";

export async function getAnvilInfo() {
  try {
    const { stdout } = await execAsync("ps aux | grep anvil | grep -v grep");
    if (!stdout) {
      return { running: false };
    }

    const portMatch = stdout.match(/--port\s+(\d+)/);
    const port = portMatch ? portMatch[1] : "8545";

    return {
      running: true,
      port,
      url: `http://localhost:${port}`
    };
  } catch (error) {
    return { running: false };
  }
}

// Tool: Start a new Anvil instance
server.tool(
  "anvil_start",
  "Start a new Anvil instance (local Ethereum node)",
  {
    port: z.number().optional().describe("Port to listen on (default: 8545)"),
    blockTime: z.number().optional().describe("Block time in seconds (default: 0 - mine on demand)"),
    forkUrl: z.string().optional().describe("URL of the JSON-RPC endpoint to fork from"),
    forkBlockNumber: z.number().optional().describe("Block number to fork from"),
    accounts: z.number().optional().describe("Number of accounts to generate (default: 10)"),
    mnemonic: z.string().optional().describe("BIP39 mnemonic phrase to generate accounts from"),
    silent: z.boolean().optional().describe("Suppress anvil output (default: false)")
  },
  async ({ port = 8545, blockTime, forkUrl, forkBlockNumber, accounts, mnemonic, silent = false }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    // Check if anvil is already running
    const anvilInfo = await getAnvilInfo();
    if (anvilInfo.running) {
      return {
        content: [{ 
          type: "text", 
          text: `Anvil is already running on port ${anvilInfo.port}.`
        }],
        isError: true
      };
    }

    let command = `${anvilPath} --port ${port}`;
    
    if (blockTime !== undefined) {
      command += ` --block-time ${blockTime}`;
    }
    
    if (forkUrl) {
      command += ` --fork-url "${forkUrl}"`;
      
      if (forkBlockNumber !== undefined) {
        command += ` --fork-block-number ${forkBlockNumber}`;
      }
    }
    
    if (accounts !== undefined) {
      command += ` --accounts ${accounts}`;
    }
    
    if (mnemonic) {
      command += ` --mnemonic "${mnemonic}"`;
    }
    
    try {
      // Start anvil in the background
      const child = exec(command, (error, stdout, stderr) => {
        if (error && !silent) {
          console.error(`Anvil error: ${error.message}`);
        }
        if (stderr && !silent) {
          console.error(`Anvil stderr: ${stderr}`);
        }
        if (stdout && !silent) {
          console.log(`Anvil stdout: ${stdout}`);
        }
      });
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if it started successfully
      const newAnvilInfo = await getAnvilInfo();
      if (newAnvilInfo.running) {
        return {
          content: [{ 
            type: "text", 
            text: `Anvil started successfully on port ${port}. ` +
                  `RPC URL: http://localhost:${port}\n` +
                  `Process ID: ${child.pid}`
          }]
        };
      } else {
        return {
          content: [{ 
            type: "text", 
            text: `Failed to start Anvil. Check system logs for details.`
          }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error starting Anvil: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool: Stop an Anvil instance
server.tool(
  "anvil_stop",
  "Stop a running Anvil instance",
  {},
  async () => {
    const anvilInfo = await getAnvilInfo();
    if (!anvilInfo.running) {
      return {
        content: [{ 
          type: "text", 
          text: "No Anvil instance is currently running."
        }],
        isError: true
      };
    }

    try {
      // Kill the anvil process
      if (os.platform() === 'win32') {
        await execAsync('taskkill /F /IM anvil.exe');
      } else {
        await execAsync('pkill -f anvil');
      }
      
      // Check if it was stopped successfully
      await new Promise(resolve => setTimeout(resolve, 500));
      const newAnvilInfo = await getAnvilInfo();
      
      if (!newAnvilInfo.running) {
        return {
          content: [{ 
            type: "text", 
            text: "Anvil has been stopped successfully."
          }]
        };
      } else {
        return {
          content: [{ 
            type: "text", 
            text: "Failed to stop Anvil. It may still be running."
          }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error stopping Anvil: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool: Get current Anvil status
server.tool(
  "anvil_status",
  "Check if Anvil is running and get its status",
  {},
  async () => {
    const anvilInfo = await getAnvilInfo();
    
    return {
      content: [{ 
        type: "text", 
        text: anvilInfo.running
          ? `Anvil is running on port ${anvilInfo.port}. RPC URL: ${anvilInfo.url}`
          : "Anvil is not currently running."
      }]
    };
  }
);