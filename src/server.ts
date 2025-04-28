import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { checkFoundryInstalled } from "./utils/commands";

export const server = new McpServer({
  name: "Foundry MCP Server",
  version: "0.1.0"
}, {
  instructions: `
This server provides tools for Solidity developers using the Foundry toolkit:
- forge: Smart contract development framework
- cast: EVM nodes RPC client and utility tool
- anvil: Local EVM test node

You can interact with local or remote EVM chains, deploy contracts, perform common operations, and analyze smart contract code.
  `
});

export async function startServer() {
  const foundryInstalled = await checkFoundryInstalled();
  if (!foundryInstalled) {
    console.error("Error: Foundry is not installed");
    process.exit(1);
  }

  // 导入资源和工具
  await import("./resources/index");
  await import("./tools/anvil");
  await import("./tools/cast");
  await import("./tools/forge");
  await import("./tools/files");
  await import("./tools/utils");

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Foundry MCP Server started on stdio");
}