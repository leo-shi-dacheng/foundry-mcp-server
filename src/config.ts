import * as path from "path";
import * as os from "os";
import dotenv from "dotenv";

dotenv.config();

export const FOUNDRY_WORKSPACE = path.join(os.homedir(), ".mcp-foundry-workspace");
export const DEFAULT_RPC_URL = process.env.RPC_URL || "http://localhost:8545";
export const FOUNDRY_NOT_INSTALLED_ERROR = "Foundry tools are not installed. Please install Foundry: https://book.getfoundry.sh/getting-started/installation";

export const homeDir = os.homedir(); // 直接导出 homeDir
const FOUNDRY_BIN = path.join(homeDir, ".foundry", "bin");

export const castPath = path.join(FOUNDRY_BIN, "cast");
export const forgePath = path.join(FOUNDRY_BIN, "forge");
export const anvilPath = path.join(FOUNDRY_BIN, "anvil");

export const getBinaryPaths = () => {
  return {
    castPath,
    forgePath,
    anvilPath,
    homeDir
  };
};