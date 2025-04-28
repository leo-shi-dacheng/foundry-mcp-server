import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { server } from "../server";
import { getAnvilInfo } from "../tools/anvil";
import { castPath } from "../config";
import { executeCommand } from "../utils/commands";

// Resource: Anvil status
server.resource(
  "anvil_status",
  "anvil://status",
  async (uri) => {
    const info = await getAnvilInfo();
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(info, null, 2)
      }]
    };
  }
);

// Resource: Contract source from Etherscan
server.resource(
  "contract_source",
  new ResourceTemplate("contract://{address}/source", { list: undefined }),
  async (uri, { address }) => {
    try {
      const command = `${castPath} etherscan-source ${address}`;
      const { success, message } = await executeCommand(command);
      
      if (success) {
        return {
          contents: [{
            uri: uri.href,
            text: message
          }]
        };
      } else {
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ error: "Could not retrieve contract source", details: message })
          }]
        };
      }
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ error: "Failed to retrieve contract source" })
        }]
      };
    }
  }
);