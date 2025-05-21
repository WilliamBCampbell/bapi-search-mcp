#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import fs from 'fs'; // Renamed from 'node:fs' to 'fs' for broader compatibility
import path from 'path'; // Renamed from 'node:path' to 'path'
/**
 * Create an MCP server for BAPI file analysis.
 */
const server = new Server({
    name: "bapi-analyzer-server", // Ensuring name is consistent with last good connection
    version: "0.1.0",
    description: "MCP server for analyzing SAP BAPI JSON files." // Original description
}, {
    capabilities: {
        tools: {}, // Only tool capability
    },
});
/**
 * Handler that lists available tools.
 * Exposes a "search_bapi_file" tool.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "search_bapi_file",
                description: "Searches a BAPI JSON file for a specific property and optional value, and returns an analysis report.",
                inputSchema: {
                    type: "object",
                    properties: {
                        filePath: {
                            type: "string",
                            description: "Absolute path to the BAPI JSON file to search."
                        },
                        searchProperty: {
                            type: "string",
                            description: "Property name to search for."
                        },
                        searchValue: {
                            type: "string",
                            description: "Optional. Property value to filter by."
                        },
                    },
                    required: ["filePath", "searchProperty"]
                },
                outputSchema: {
                    type: "object",
                    properties: {
                        report: {
                            type: "string",
                            description: "The analysis report content."
                        },
                        distinctValues: {
                            type: "string",
                            description: "Distinct values found for the searchProperty (if no searchValue was provided)."
                        }
                    },
                    required: ["report"]
                }
            }
        ]
    };
});
/**
 * Handler for the search_bapi_file tool.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "search_bapi_file") {
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
    const { filePath, searchProperty, searchValue } = request.params.arguments;
    if (!filePath || !searchProperty) {
        throw new Error("filePath and searchProperty are required arguments.");
    }
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    if (fs.statSync(filePath).isDirectory()) {
        throw new Error(`Specified path is a directory, not a file: ${filePath}`);
    }
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        const allTargetNodes = [];
        function searchNodes(obj, currentPath = '') {
            if (!obj || typeof obj !== 'object')
                return;
            if (obj[searchProperty] !== undefined) {
                if (!searchValue || obj[searchProperty] === searchValue) {
                    allTargetNodes.push({
                        node: obj,
                        path: currentPath
                    });
                }
            }
            if (Array.isArray(obj)) {
                obj.forEach((item, index) => {
                    searchNodes(item, `${currentPath}[${index}]`);
                });
            }
            else {
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        searchNodes(obj[key], currentPath ? `${currentPath}.${key}` : key);
                    }
                }
            }
        }
        searchNodes(data);
        const searchDesc = searchValue
            ? `"${searchProperty}": "${searchValue}"`
            : `"${searchProperty}" (any value)`;
        const pathPatterns = {};
        allTargetNodes.forEach(item => {
            const pattern = item.path.replace(/\\[\\d+\\]/g, '[]');
            if (!pathPatterns[pattern]) {
                pathPatterns[pattern] = [];
            }
            pathPatterns[pattern].push(item);
        });
        let distinctValuesReport = "";
        if (!searchValue) {
            const valueFrequency = {};
            allTargetNodes.forEach(item => {
                const value = item.node[searchProperty];
                if (value !== undefined) {
                    const valueStr = String(value);
                    if (!valueFrequency[valueStr]) {
                        valueFrequency[valueStr] = 0;
                    }
                    valueFrequency[valueStr]++;
                }
            });
            const sortedValues = Object.entries(valueFrequency)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([value, count]) => ({ value, count }));
            distinctValuesReport = `Distinct values for "${searchProperty}" in ${path.basename(filePath)}:\n\n`;
            distinctValuesReport += sortedValues
                .map(({ value, count }) => `${value}: ${count} occurrences`)
                .join('\n');
        }
        let mainReport = `BAPI DEEP SEARCH REPORT\n`;
        mainReport += `=====================\n\n`;
        mainReport += `File: ${path.basename(filePath)}\n`;
        mainReport += `Search: ${searchDesc}\n`;
        mainReport += `Date: ${new Date().toISOString()}\n\n`;
        mainReport += `Total matching nodes: ${allTargetNodes.length}\n\n`;
        mainReport += `Nodes found by location:\n`;
        Object.entries(pathPatterns).forEach(([pattern, nodes]) => {
            mainReport += `- ${pattern}: ${nodes.length} nodes\n`;
        });
        mainReport += `\nSample nodes (first 5):\n`;
        allTargetNodes.slice(0, 5).forEach((item, index) => {
            mainReport += `\n[${index + 1}] Path: ${item.path}\n`;
            mainReport += JSON.stringify(item.node, null, 2) + '\n';
        });
        mainReport += `\nRELATED PROPERTY ANALYSIS\n`;
        mainReport += `=========================\n\n`;
        const relatedProperties = new Set();
        const relatedPropertyValues = {};
        allTargetNodes.forEach(item => {
            Object.keys(item.node).forEach(prop => {
                if (prop !== searchProperty) {
                    relatedProperties.add(prop);
                    if (!relatedPropertyValues[prop]) {
                        relatedPropertyValues[prop] = new Set();
                    }
                    if (item.node[prop] !== undefined) {
                        relatedPropertyValues[prop].add(item.node[prop]);
                    }
                }
            });
        });
        mainReport += `Common properties found with "${searchProperty}":\n`;
        Array.from(relatedProperties).sort().forEach(prop => {
            const valueCount = relatedPropertyValues[prop] ? relatedPropertyValues[prop].size : 0;
            mainReport += `- ${prop}: ${valueCount} distinct values\n`;
            if (valueCount > 0) {
                const sampleValues = Array.from(relatedPropertyValues[prop]).slice(0, 5);
                sampleValues.forEach(val => {
                    mainReport += `  - ${String(val).substring(0, 100)}${String(val).length > 100 ? '...' : ''}\n`;
                });
                if (valueCount > 5) {
                    mainReport += `  - (${valueCount - 5} more values not shown)\n`;
                }
            }
        });
        mainReport += `\nPOTENTIAL USAGE IN MAPPERSETTINGS.JSON (example from BapiContext.md):\n`;
        mainReport += `If "${searchProperty}" represents a characteristic name, you might use it in mappersettings.json like:\n`;
        mainReport += `
"SomeMapper": {
  "Characteristic": "${searchProperty}",
  "Property": "THE_CONTAINING_PROPERTY" // Replace with actual containing property
}\n`;
        const toolResponse = [{
                type: "text",
                text: mainReport
            }];
        if (distinctValuesReport) {
            toolResponse.push({
                type: "text",
                text: "\n\n--- Distinct Values Report ---\n" + distinctValuesReport
            });
        }
        return { content: toolResponse };
    }
    catch (error) {
        console.error(`Error in BAPI search/report generation: ${error.message}`);
        console.error(error.stack);
        throw new Error(`BAPI tool failed during search/report generation: ${error.message}`);
    }
});
/**
 * Start the server using stdio transport.
 */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    console.error("Server failed to start or encountered a fatal error:", error);
    process.exit(1);
});
