import * as path from "path";
import * as fs from "fs/promises";
import { z } from "zod";
import { server } from "../server";
import { ensureWorkspaceInitialized } from "../utils/workspace";

// Tool: Create or update a Solidity file (contract, script, etc.)
server.tool(
  "create_solidity_file",
  "Create or update a Solidity file in the workspace",
  {
    filePath: z.string().describe("Path to the file (e.g., 'src/MyContract.sol' or 'script/Deploy.s.sol')"),
    content: z.string().describe("File content"),
    overwrite: z.boolean().optional().describe("Overwrite existing file (default: false)")
  },
  async ({ filePath, content, overwrite = false }) => {
    try {
      const workspace = await ensureWorkspaceInitialized();
      const fullFilePath = path.join(workspace, filePath);
      
      const fileExists = await fs.access(fullFilePath).then(() => true).catch(() => false);
      if (fileExists && !overwrite) {
        return {
          content: [{ 
            type: "text", 
            text: `File already exists at ${fullFilePath}. Use overwrite=true to replace it.` 
          }],
          isError: true
        };
      }
      
      await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
      
      await fs.writeFile(fullFilePath, content);
      
      return {
        content: [{ 
          type: "text", 
          text: `File ${fileExists ? 'updated' : 'created'} successfully at ${fullFilePath}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error managing file: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Tool: List files in the workspace
server.tool(
  "list_files",
  "List files in the workspace",
  {
    directory: z.string().optional().describe("Directory to list (e.g., 'src' or 'script'), defaults to root")
  },
  async ({ directory = '' }) => {
    try {
      const workspace = await ensureWorkspaceInitialized();
      const dirPath = path.join(workspace, directory);
      
      const dirExists = await fs.access(dirPath).then(() => true).catch(() => false);
      if (!dirExists) {
        return {
          content: [{ 
            type: "text", 
            text: `Directory '${directory}' does not exist in the workspace` 
          }],
          isError: true
        };
      }
      
      async function listFiles(dir, baseDir = '') {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        let files = [];
        
        for (const entry of entries) {
          const relativePath = path.join(baseDir, entry.name);
          if (entry.isDirectory()) {
            const subFiles = await listFiles(path.join(dir, entry.name), relativePath);
            files = [...files, ...subFiles];
          } else {
            files.push(relativePath);
          }
        }
        
        return files;
      }
      
      const files = await listFiles(dirPath);
      return {
        content: [{ 
          type: "text", 
          text: files.length > 0
            ? `Files in ${directory || 'workspace'}:\n\n${files.join('\n')}`
            : `No files found in ${directory || 'workspace'}`
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error listing files: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);

// Tool: Read a file from the workspace
server.tool(
  "read_file",
  "Read the content of a file from the workspace",
  {
    filePath: z.string().describe("Path to the file (e.g., 'src/MyContract.sol')")
  },
  async ({ filePath }) => {
    try {
      const workspace = await ensureWorkspaceInitialized();
      const fullFilePath = path.join(workspace, filePath);
      
      const fileExists = await fs.access(fullFilePath).then(() => true).catch(() => false);
      if (!fileExists) {
        return {
          content: [{ 
            type: "text", 
            text: `File does not exist at ${fullFilePath}` 
          }],
          isError: true
        };
      }
      
      const content = await fs.readFile(fullFilePath, 'utf8');
      
      return {
        content: [{ 
          type: "text", 
          text: `Content of ${filePath}:\n\n${content}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error reading file: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }
);