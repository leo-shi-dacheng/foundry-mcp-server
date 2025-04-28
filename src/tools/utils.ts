import { z } from "zod";
import { server } from "../server";
import { castPath } from "../config";
import { checkFoundryInstalled, executeCommand } from "../utils/commands";
import { FOUNDRY_NOT_INSTALLED_ERROR } from "../config";
import { resolveRpcUrl } from "../utils/rpc";

// Tool: Convert between units (wei, gwei, ether)
server.tool(
  "convert_eth_units",
  "Convert between Ethereum units (wei, gwei, ether)",
  {
    value: z.string().describe("Value to convert"),
    fromUnit: z.enum(["wei", "gwei", "ether"]).describe("Source unit"),
    toUnit: z.enum(["wei", "gwei", "ether"]).describe("Target unit")
  },
  async ({ value, fromUnit, toUnit }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const command = `${castPath} to-unit ${value}${fromUnit} ${toUnit}`;
    const result = await executeCommand(command);
    
    return {
      content: [{ 
        type: "text", 
        text: result.success 
          ? `${value} ${fromUnit} = ${result.message.trim()} ${toUnit}` 
          : `Conversion failed: ${result.message}` 
      }],
      isError: !result.success
    };
  }
);

// Tool: Calculate contract address
server.tool(
  "compute_address",
  "Compute the address of a contract that would be deployed by a specific address",
  {
    deployerAddress: z.string().describe("Address of the deployer"),
    nonce: z.string().optional().describe("Nonce of the transaction (default: current nonce)"),
    rpcUrl: z.string().optional().describe("JSON-RPC URL (default: http://localhost:8545)")
  },
  async ({ deployerAddress, nonce, rpcUrl }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const resolvedRpcUrl = await resolveRpcUrl(rpcUrl);
    let command = `${castPath} compute-address ${deployerAddress}`;
    
    if (nonce) {
      command += ` --nonce ${nonce}`;
    }
    
    if (resolvedRpcUrl) {
      command += ` --rpc-url "${resolvedRpcUrl}"`;
    }
    
    const result = await executeCommand(command);
    
    return {
      content: [{ 
        type: "text", 
        text: result.success 
          ? `Computed contract address:\n${result.message}` 
          : `Address computation failed: ${result.message}` 
      }],
      isError: !result.success
    };
  }
);

// Tool: Get contract bytecode size
server.tool(
  "contract_size",
  "Get the bytecode size of a deployed contract",
  {
    address: z.string().describe("Contract address"),
    rpcUrl: z.string().optional().describe("JSON-RPC URL (default: http://localhost:8545)")
  },
  async ({ address, rpcUrl }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const resolvedRpcUrl = await resolveRpcUrl(rpcUrl);
    let command = `${castPath} codesize ${address}`;
    
    if (resolvedRpcUrl) {
      command += ` --rpc-url "${resolvedRpcUrl}"`;
    }
    
    const result = await executeCommand(command);
    
    const bytes = parseInt(result.message);
    let sizeInfo = "";
    if (!isNaN(bytes)) {
      const kilobytes = bytes / 1024;
      const contractLimit = 24576; // 24KB limit for contracts
      const percentOfLimit = (bytes / contractLimit) * 100;
      
      sizeInfo = `\n\n${bytes} bytes (${kilobytes.toFixed(2)} KB)\n` +
                 `EVM Contract Size Limit: 24KB (24576 bytes)\n` +
                 `Current size is ${percentOfLimit.toFixed(2)}% of the maximum`;
    }
    
    return {
      content: [{ 
        type: "text", 
        text: result.success 
          ? `Contract bytecode size for ${address}:${sizeInfo}` 
          : `Failed to get contract size: ${result.message}` 
      }],
      isError: !result.success
    };
  }
);