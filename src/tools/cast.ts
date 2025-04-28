import { z } from "zod";
import { server } from "../server";
import { castPath } from "../config";
import { checkFoundryInstalled, executeCommand } from "../utils/commands";
import { FOUNDRY_NOT_INSTALLED_ERROR } from "../config";
import { resolveRpcUrl } from "../utils/rpc";
import * as fs from "fs/promises";

// Tool: Call a contract function (read-only)
server.tool(
  "cast_call",
  "Call a contract function (read-only)",
  {
    contractAddress: z.string().describe("Address of the contract"),
    functionSignature: z.string().describe("Function signature (e.g., 'balanceOf(address)')"),
    args: z.array(z.string()).optional().describe("Function arguments"),
    rpcUrl: z.string().optional().describe("JSON-RPC URL (default: http://localhost:8545)"),
    blockNumber: z.string().optional().describe("Block number (e.g., 'latest', 'earliest', or a number)"),
    from: z.string().optional().describe("Address to perform the call as")
  },
  async ({ contractAddress, functionSignature, args = [], rpcUrl, blockNumber, from }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const resolvedRpcUrl = await resolveRpcUrl(rpcUrl);
    let command = `${castPath} call ${contractAddress} "${functionSignature}"`;
    
    if (args.length > 0) {
      command += " " + args.join(" ");
    }
    
    if (resolvedRpcUrl) {
      command += ` --rpc-url "${resolvedRpcUrl}"`;
    }
    
    if (blockNumber) {
      command += ` --block ${blockNumber}`;
    }
    
    if (from) {
      command += ` --from ${from}`;
    }
    
    const result = await executeCommand(command);
    
    let formattedOutput = result.message;
    if (result.success) {
      // Try to detect arrays and format them better
      if (formattedOutput.includes('\n') && !formattedOutput.includes('Error')) {
        formattedOutput = formattedOutput.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('\n');
      }
    }
    
    return {
      content: [{ 
        type: "text", 
        text: result.success 
          ? `Call to ${contractAddress}.${functionSignature.split('(')[0]} result:\n${formattedOutput}` 
          : `Call failed: ${result.message}` 
      }],
      isError: !result.success
    };
  }
);

// Tool: Send a transaction to a contract function
server.tool(
  "cast_send",
  "Send a transaction to a contract function",
  {
    contractAddress: z.string().describe("Address of the contract"),
    functionSignature: z.string().describe("Function signature (e.g., 'transfer(address,uint256)')"),
    args: z.array(z.string()).optional().describe("Function arguments"),
    from: z.string().optional().describe("Sender address or private key"),
    value: z.string().optional().describe("Ether value to send with the transaction (in wei)"),
    rpcUrl: z.string().optional().describe("JSON-RPC URL (default: http://localhost:8545)"),
    gasLimit: z.string().optional().describe("Gas limit for the transaction"),
    gasPrice: z.string().optional().describe("Gas price for the transaction (in wei)"),
    confirmations: z.number().optional().describe("Number of confirmations to wait for")
  },
  async ({ contractAddress, functionSignature, args = [], from, value, rpcUrl, gasLimit, gasPrice, confirmations }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const resolvedRpcUrl = await resolveRpcUrl(rpcUrl);
    const privateKey = process.env.PRIVATE_KEY;
    let command = `${castPath} send ${contractAddress} "${functionSignature}" --private-key ${[privateKey]}`;
    
    if (args.length > 0) {
      command += " " + args.join(" ");
    }
    
    if (from) {
      command += ` --from ${from}`;
    }
    
    if (value) {
      command += ` --value ${value}`;
    }
    
    if (resolvedRpcUrl) {
      command += ` --rpc-url "${resolvedRpcUrl}"`;
    }
    
    if (gasLimit) {
      command += ` --gas-limit ${gasLimit}`;
    }
    
    if (gasPrice) {
      command += ` --gas-price ${gasPrice}`;
    }
    
    if (confirmations) {
      command += ` --confirmations ${confirmations}`;
    }
    
    const result = await executeCommand(command);
    
    return {
      content: [{ 
        type: "text", 
        text: result.success 
          ? `Transaction sent successfully:\n${result.message}` 
          : `Transaction failed: ${result.message}` 
      }],
      isError: !result.success
    };
  }
);

// Tool: Check the ETH balance of an address
server.tool(
  "cast_balance",
  "Check the ETH balance of an address",
  {
    address: z.string().describe("Ethereum address to check balance for"),
    rpcUrl: z.string().optional().describe("JSON-RPC URL (default: http://localhost:8545)"),
    blockNumber: z.string().optional().describe("Block number (e.g., 'latest', 'earliest', or a number)"),
    formatEther: z.boolean().optional().describe("Format the balance in Ether (default: wei)")
  },
  async ({ address, rpcUrl, blockNumber, formatEther = false }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const resolvedRpcUrl = await resolveRpcUrl(rpcUrl);
    let command = `${castPath} balance ${address}`;
    
    if (resolvedRpcUrl) {
      command += ` --rpc-url "${resolvedRpcUrl}"`;
    }
    
    if (blockNumber) {
      command += ` --block ${blockNumber}`;
    }
    
    if (formatEther) {
      command += " --ether";
    }
    
    const result = await executeCommand(command);
    const unit = formatEther ? "ETH" : "wei";
    
    return {
      content: [{ 
        type: "text", 
        text: result.success 
          ? `Balance of ${address}: ${result.message.trim()} ${unit}` 
          : `Failed to get balance: ${result.message}` 
      }],
      isError: !result.success
    };
  }
);

// Tool: Get transaction receipt
server.tool(
  "cast_receipt",
  "Get the transaction receipt",
  {
    txHash: z.string().describe("Transaction hash"),
    rpcUrl: z.string().optional().describe("JSON-RPC URL (default: http://localhost:8545)"),
    confirmations: z.number().optional().describe("Number of confirmations to wait for"),
    field: z.string().optional().describe("Specific field to extract (e.g., 'blockNumber', 'status')")
  },
  async ({ txHash, rpcUrl, confirmations, field }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const resolvedRpcUrl = await resolveRpcUrl(rpcUrl);
    let command = `${castPath} receipt ${txHash}`;
    
    if (resolvedRpcUrl) {
      command += ` --rpc-url "${resolvedRpcUrl}"`;
    }
    
    if (confirmations) {
      command += ` --confirmations ${confirmations}`;
    }
    
    if (field) {
      command += ` ${field}`;
    }
    
    const result = await executeCommand(command);
    
    return {
      content: [{ 
        type: "text", 
        text: result.success 
          ? `Transaction receipt for ${txHash}${field ? ` (${field})` : ""}:\n${result.message}` 
          : `Failed to get receipt: ${result.message}` 
      }],
      isError: !result.success
    };
  }
);

// Tool: Read a contract's storage at a given slot
server.tool(
  "cast_storage",
  "Read contract storage at a specific slot",
  {
    address: z.string().describe("Contract address"),
    slot: z.string().describe("Storage slot to read"),
    rpcUrl: z.string().optional().describe("JSON-RPC URL (default: http://localhost:8545)"),
    blockNumber: z.string().optional().describe("Block number (e.g., 'latest', 'earliest', or a number)")
  },
  async ({ address, slot, rpcUrl, blockNumber }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const resolvedRpcUrl = await resolveRpcUrl(rpcUrl);
    let command = `${castPath} storage ${address} ${slot}`;
    
    if (resolvedRpcUrl) {
      command += ` --rpc-url "${resolvedRpcUrl}"`;
    }
    
    if (blockNumber) {
      command += ` --block ${blockNumber}`;
    }
    
    const result = await executeCommand(command);
    
    return {
      content: [{ 
        type: "text", 
        text: result.success 
          ? `Storage at ${address} slot ${slot}: ${result.message.trim()}` 
          : `Failed to read storage: ${result.message}` 
      }],
      isError: !result.success
    };
  }
);

// Tool: Run a published transaction in a local environment and print the trace
server.tool(
  "cast_run",
  "Runs a published transaction in a local environment and prints the trace",
  {
    txHash: z.string().describe("Transaction hash to replay"),
    rpcUrl: z.string().describe("JSON-RPC URL"),
    quick: z.boolean().optional().describe("Execute the transaction only with the state from the previous block"),
    debug: z.boolean().optional().describe("Open the transaction in the debugger"),
    labels: z.array(z.string()).optional().describe("Label addresses in the trace (format: <address>:<label>)")
  },
  async ({ txHash, rpcUrl, quick = false, debug = false, labels = [] }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const resolvedRpcUrl = await resolveRpcUrl(rpcUrl);
    let command = `${castPath} run ${txHash}`;
    
    if (resolvedRpcUrl) {
      command += ` --rpc-url "${resolvedRpcUrl}"`;
    }
    
    if (quick) {
      command += " --quick";
    }
    
    if (debug) {
      command += " --debug";
    }
    
    // Add labels if provided
    for (const label of labels) {
      command += ` --label ${label}`;
    }
    
    const result = await executeCommand(command);
    
    return {
      content: [{ 
        type: "text", 
        text: result.success 
          ? `Transaction trace for ${txHash}:\n${result.message}` 
          : `Failed to run transaction: ${result.message}` 
      }],
      isError: !result.success
    };
  }
);

// Tool: Get logs by signature or topic
server.tool(
  "cast_logs",
  "Get logs by signature or topic",
  {
    signature: z.string().describe("Event signature (e.g., 'Transfer(address,address,uint256)') or topic 0 hash"),
    topics: z.array(z.string()).optional().describe("Additional topics (up to 3)"),
    address: z.string().optional().describe("Contract address to filter logs from"),
    fromBlock: z.string().optional().describe("Starting block number/tag"),
    toBlock: z.string().optional().describe("Ending block number/tag"),
    rpcUrl: z.string().optional().describe("JSON-RPC URL (default: http://localhost:8545)")
  },
  async ({ signature, topics = [], address, fromBlock, toBlock, rpcUrl }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const resolvedRpcUrl = await resolveRpcUrl(rpcUrl);
    let command = `${castPath} logs "${signature}"`;
    
    if (topics.length > 0) {
      command += " " + topics.join(" ");
    }
    
    if (address) {
      command += ` --address ${address}`;
    }
    
    if (fromBlock) {
      command += ` --from-block ${fromBlock}`;
    }
    
    if (toBlock) {
      command += ` --to-block ${toBlock}`;
    }
    
    if (resolvedRpcUrl) {
      command += ` --rpc-url "${resolvedRpcUrl}"`;
    }
    
    const result = await executeCommand(command);
    
    return {
      content: [{ 
        type: "text", 
        text: result.success 
          ? `Logs for signature "${signature}":\n${result.message}` 
          : `Failed to get logs: ${result.message}` 
      }],
      isError: !result.success
    };
  }
);

// Tool: Lookup function or event signatures
server.tool(
  "cast_sig",
  "Get the selector for a function or event signature",
  {
    signature: z.string().describe("Function or event signature"),
    isEvent: z.boolean().optional().describe("Whether the signature is for an event (default: false)")
  },
  async ({ signature, isEvent = false }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const command = isEvent 
      ? `${castPath} sig-event "${signature}"` 
      : `${castPath} sig "${signature}"`;
    
    const result = await executeCommand(command);
    
    return {
      content: [{ 
        type: "text", 
        text: result.success 
          ? `Selector for ${isEvent ? "event" : "function"} "${signature}": ${result.message.trim()}` 
          : `Selector generation failed: ${result.message}` 
      }],
      isError: !result.success
    };
  }
);

// Tool: Get event or function signature using 4byte directory
server.tool(
  "cast_4byte",
  "Lookup function or event signature from the 4byte directory",
  {
    selector: z.string().describe("Function selector (0x + 4 bytes) or event topic (0x + 32 bytes)"),
    isEvent: z.boolean().optional().describe("Whether to lookup an event (default: false)")
  },
  async ({ selector, isEvent = false }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const command = isEvent 
      ? `${castPath} 4byte-event ${selector}` 
      : `${castPath} 4byte ${selector}`;
    
    const result = await executeCommand(command);
    
    return {
      content: [{ 
        type: "text", 
        text: result.success 
          ? `Possible ${isEvent ? "event" : "function"} signatures for ${selector}:\n${result.message}` 
          : `Lookup failed: ${result.message}` 
      }],
      isError: !result.success
    };
  }
);

// Tool: Get chain information
server.tool(
  "cast_chain",
  "Get information about the current chain",
  {
    rpcUrl: z.string().optional().describe("JSON-RPC URL (default: http://localhost:8545)"),
    returnId: z.boolean().optional().describe("Return the chain ID instead of the name (default: false)")
  },
  async ({ rpcUrl, returnId = false }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const resolvedRpcUrl = await resolveRpcUrl(rpcUrl);
    const command = returnId 
      ? `${castPath} chain-id --rpc-url "${resolvedRpcUrl}"` 
      : `${castPath} chain --rpc-url "${resolvedRpcUrl}"`;
    
    const result = await executeCommand(command);
    
    return {
      content: [{ 
        type: "text", 
        text: result.success 
          ? `Chain ${returnId ? "ID" : "name"}: ${result.message.trim()}` 
          : `Failed to get chain information: ${result.message}` 
      }],
      isError: !result.success
    };
  }
);

// Tool: Trace transaction execution and analyze call stack
server.tool(
  "cast_trace",
  "Trace a transaction and analyze its call stack",
  {
    txHash: z.string().describe("Transaction hash to trace"),
    rpcUrl: z.string().describe("JSON-RPC URL"),
    verbosity: z.number().optional().describe("Trace verbosity level (0-5, default: 3)"),
    labels: z.array(z.string()).optional().describe("Label addresses in the trace (format: <address>:<label>)"),
    matchSignatures: z.boolean().optional().describe("Try to match function signatures using 4byte directory"),
    outputFormat: z.enum(["text", "json"]).optional().describe("Output format (default: text)")
  },
  async ({ txHash, rpcUrl, verbosity = 3, labels = [], matchSignatures = true, outputFormat = "text" }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const resolvedRpcUrl = await resolveRpcUrl(rpcUrl);
    let command = `${castPath} run ${txHash} --trace`;
    
    if (resolvedRpcUrl) {
      command += ` --rpc-url "${resolvedRpcUrl}"`;
    }
    
    // Configure trace verbosity
    if (verbosity >= 0 && verbosity <= 5) {
      command += ` --verbosity ${verbosity}`;
    }
    
    // Add labels if provided
    for (const label of labels) {
      command += ` --label ${label}`;
    }
    
    // Choose output format
    if (outputFormat === "json") {
      command += " --json";
    }
    
    const result = await executeCommand(command);
    
    if (!result.success) {
      return {
        content: [{ 
          type: "text", 
          text: `Failed to trace transaction: ${result.message}` 
        }],
        isError: true
      };
    }
    
    // Process the trace data
    let output = result.message;
    
    // If signature matching is enabled, attempt to identify unknown function selectors
    if (matchSignatures && result.success) {
      output = await processFunctionSelectors(output, resolvedRpcUrl);
    }
    
    return {
      content: [{ 
        type: "text", 
        text: `Transaction trace for ${txHash}:\n\n${output}` 
      }]
    };
  }
);

// Helper function to process trace output and match function selectors
async function processFunctionSelectors(traceOutput: string, rpcUrl: string): Promise<string> {
  // Extract function selectors in the form 0x12345678
  const selectorRegex = /0x[a-fA-F0-9]{8}(?![a-fA-F0-9])/g;
  const selectors = [...new Set(traceOutput.match(selectorRegex) || [])];
  
  if (selectors.length === 0) {
    return traceOutput;
  }
  
  // Create lookup table for selectors
  const selectorMap = new Map<string, string[]>();
  
  // Look up each selector
  for (const selector of selectors) {
    const command = `${castPath} 4byte ${selector} --rpc-url "${rpcUrl}"`;
    const result = await executeCommand(command);
    
    if (result.success && result.message.trim()) {
      const signatures = result.message.trim().split('\n').map(s => s.trim());
      selectorMap.set(selector, signatures);
    }
  }
  
  // Replace selectors in the output with potential function signatures
  let processedOutput = traceOutput;
  selectorMap.forEach((signatures, selector) => {
    if (signatures.length > 0) {
      // Sort signatures by length (shorter ones are often more common/standard)
      signatures.sort((a, b) => a.length - b.length);
      
      // Take the most likely signature (first 3 at most)
      const signaturesDisplay = signatures.slice(0, 3).join(" or ");
      processedOutput = processedOutput.replace(
        new RegExp(selector + "(?![a-fA-F0-9])", "g"), 
        `${selector} [Likely: ${signaturesDisplay}]`
      );
    }
  });
  
  return processedOutput;
}

// Tool: Lookup function signatures from a local signatures database file
server.tool(
  "cast_4byte_from_file",
  "Match function selectors with signatures from a local file",
  {
    selector: z.string().describe("Function selector (0x + 4 bytes)"),
    filePath: z.string().describe("Path to file containing function signatures (one per line)"),
    fuzzyMatch: z.boolean().optional().describe("Enable fuzzy matching (default: false)")
  },
  async ({ selector, filePath, fuzzyMatch = false }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    try {
      // Ensure selector is valid
      if (!/^0x[a-fA-F0-9]{8}$/.test(selector)) {
        return {
          content: [{ type: "text", text: "Invalid selector format. Must be 0x followed by 8 hex characters." }],
          isError: true
        };
      }
      
      // First try to get signature from 4byte directory for comparison
      const onlineCommand = `${castPath} 4byte ${selector}`;
      const onlineResult = await executeCommand(onlineCommand);
      let onlineSignatures: string[] = [];
      
      if (onlineResult.success && onlineResult.message.trim()) {
        onlineSignatures = onlineResult.message.trim().split('\n').map(s => s.trim());
      }
      
      // Read the local signatures file
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!fileExists) {
        return {
          content: [{ type: "text", text: `Signatures file not found: ${filePath}` }],
          isError: true
        };
      }
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      const signatures = fileContent.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      
      if (signatures.length === 0) {
        return {
          content: [{ type: "text", text: "No signatures found in the provided file." }],
          isError: true
        };
      }
      
      // Generate selectors for all signatures in the file
      const matchingSignatures: string[] = [];
      
      for (const signature of signatures) {
        // Skip invalid signatures
        if (!signature.includes('(')) continue;
        
        // Calculate selector for this signature
        const sigCommand = `${castPath} sig "${signature}"`;
        const sigResult = await executeCommand(sigCommand);
        
        if (sigResult.success && sigResult.message.trim() === selector) {
          matchingSignatures.push(signature);
        } else if (fuzzyMatch && sigResult.success) {
          // For fuzzy matching, we can check if the first 2-3 bytes match
          const resultSelector = sigResult.message.trim();
          if (resultSelector.substring(0, 6) === selector.substring(0, 6)) {
            matchingSignatures.push(`${signature} (partial match: ${resultSelector})`);
          }
        }
      }
      
      // Compile results
      let output = `Results for selector ${selector}:\n\n`;
      
      if (matchingSignatures.length > 0) {
        output += "Matching signatures from local file:\n";
        output += matchingSignatures.join('\n');
        output += "\n\n";
      } else {
        output += "No matching signatures found in local file.\n\n";
      }
      
      if (onlineSignatures.length > 0) {
        output += "Possible signatures from 4byte directory:\n";
        output += onlineSignatures.join('\n');
      } else {
        output += "No signatures found in 4byte directory.";
      }
      
      return {
        content: [{ type: "text", text: output }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error processing signatures: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Tool: Analyze a transaction trace and try to match all function selectors
server.tool(
  "analyze_transaction_trace",
  "Analyze a transaction trace and identify function calls",
  {
    txHash: z.string().describe("Transaction hash to analyze"),
    rpcUrl: z.string().describe("JSON-RPC URL"),
    signatureFile: z.string().optional().describe("Optional path to local signature file"),
    knownAddresses: z.array(z.string()).optional().describe("Known contract addresses and names (format: <address>:<name>)")
  },
  async ({ txHash, rpcUrl, signatureFile, knownAddresses = [] }) => {
    const installed = await checkFoundryInstalled();
    if (!installed) {
      return {
        content: [{ type: "text", text: FOUNDRY_NOT_INSTALLED_ERROR }],
        isError: true
      };
    }

    const resolvedRpcUrl = await resolveRpcUrl(rpcUrl);
    
    // Step 1: Get the transaction trace
    let traceCommand = `${castPath} run ${txHash} --trace --verbosity 4`;
    
    if (resolvedRpcUrl) {
      traceCommand += ` --rpc-url "${resolvedRpcUrl}"`;
    }
    
    // Add labels for known addresses
    for (const addressInfo of knownAddresses) {
      traceCommand += ` --label ${addressInfo}`;
    }
    
    const traceResult = await executeCommand(traceCommand);
    
    if (!traceResult.success) {
      return {
        content: [{ 
          type: "text", 
          text: `Failed to trace transaction: ${traceResult.message}` 
        }],
        isError: true
      };
    }
    
    // Step 2: Extract all function selectors from the trace
    const selectorRegex = /0x[a-fA-F0-9]{8}(?![a-fA-F0-9])/g;
    const selectors = [...new Set(traceResult.message.match(selectorRegex) || [])];
    
    if (selectors.length === 0) {
      return {
        content: [{ 
          type: "text", 
          text: `No function selectors found in the transaction trace.` 
        }]
      };
    }
    
    // Step 3: Match selectors with signatures
    const selectorMap = new Map<string, { online: string[], local: string[] }>();
    
    for (const selector of selectors) {
      // Try online 4byte directory
      const onlineCommand = `${castPath} 4byte ${selector}`;
      const onlineResult = await executeCommand(onlineCommand);
      const onlineSignatures = onlineResult.success && onlineResult.message.trim() 
        ? onlineResult.message.trim().split('\n').map(s => s.trim())
        : [];
      
      // Try local signature file if provided
      let localSignatures: string[] = [];
      if (signatureFile) {
        const fileExists = await fs.access(signatureFile).then(() => true).catch(() => false);
        if (fileExists) {
          const fileContent = await fs.readFile(signatureFile, 'utf8');
          const signatures = fileContent.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#') && line.includes('('));
          
          for (const signature of signatures) {
            const sigCommand = `${castPath} sig "${signature}"`;
            const sigResult = await executeCommand(sigCommand);
            
            if (sigResult.success && sigResult.message.trim() === selector) {
              localSignatures.push(signature);
            }
          }
        }
      }
      
      selectorMap.set(selector, { online: onlineSignatures, local: localSignatures });
    }
    
    // Step 4: Build the analysis report
    let output = `Analysis of transaction ${txHash}:\n\n`;
    output += `Found ${selectors.length} unique function selectors in the trace.\n\n`;
    
    for (const selector of selectors) {
      const signatures = selectorMap.get(selector);
      output += `Selector: ${selector}\n`;
      
      if (signatures?.local && signatures.local.length > 0) {
        output += `  Local matches (${signatures.local.length}):\n`;
        for (const sig of signatures.local) {
          output += `    - ${sig}\n`;
        }
      }
      
      if (signatures?.online && signatures.online.length > 0) {
        output += `  Online matches (${signatures.online.length}):\n`;
        for (const sig of signatures.online.slice(0, 5)) { // Show first 5 online matches
          output += `    - ${sig}\n`;
        }
        if (signatures.online.length > 5) {
          output += `    - ... and ${signatures.online.length - 5} more\n`;
        }
      }
      
      if ((!signatures?.local || signatures.local.length === 0) && 
          (!signatures?.online || signatures.online.length === 0)) {
        output += `  No matches found\n`;
      }
      
      output += `\n`;
    }
    
    // Step 5: Add a simplified trace with replaced function selectors
    let simplifiedTrace = traceResult.message;
    selectorMap.forEach((signatures, selector) => {
      const bestMatch = signatures.local[0] || signatures.online[0] || null;
      if (bestMatch) {
        simplifiedTrace = simplifiedTrace.replace(
          new RegExp(selector + "(?![a-fA-F0-9])", "g"), 
          `${selector} [${bestMatch}]`
        );
      }
    });
    
    output += `Simplified trace with function names:\n\n${simplifiedTrace}`;
    
    return {
      content: [{ type: "text", text: output }]
    };
  }
);
