# BAPI Analyzer MCP Server

This is a TypeScript-based MCP server designed to analyze SAP BAPI (Business Application Programming Interface) JSON structure files. It provides a tool to search within these files for specific properties and values.

## Features

### Tools

-   **`search_bapi_file`**: Searches a BAPI JSON file.
    -   **Input Parameters:**
        -   `filePath` (string, required): Absolute path to the BAPI JSON file to search.
        -   `searchProperty` (string, required): The property name to search for within the JSON structure.
        -   `searchValue` (string, optional): The specific value of the `searchProperty` to filter by. If omitted, all occurrences of `searchProperty` are reported.
    -   **Functionality:**
        The tool parses the specified JSON file, traverses its structure to find occurrences of the `searchProperty`. If `searchValue` is provided, it further filters these occurrences. It returns an analysis report detailing the findings, including paths to the matched properties/values.
    -   **Error Handling:**
        Handles cases such as file not found or invalid JSON format.

## Development

This project is built with Node.js and TypeScript.

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## Installation

To use this MCP server with a compatible client (e.g., an IDE extension that supports MCP), you need to configure the client to locate and run this server.

For example, in `cline_mcp_settings.json` (typically found in a path like `/home/USER/.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` on Linux for VSCode), you would add an entry:

```json
{
  "mcpServers": {
    "bapi-analyzer-server": {
      "command": "node /full/path/to/bapi-analyzer-server/build/index.js"
    }
  }
}
```
Replace `/full/path/to/` with the actual absolute path to the `bapi-analyzer-server` directory on your system. The server name used here (`bapi-analyzer-server`) should match the `name` field in the server's manifest if it has one, or be a unique identifier you choose.

## Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which can be run if added as a script to `package.json`:

Example `package.json` script:
```json
"scripts": {
  "inspector": "mcp-inspector"
}
```

Then run:
```bash
npm run inspector
```
The Inspector will provide a URL to access debugging tools in your browser.
