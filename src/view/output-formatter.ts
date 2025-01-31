import * as vscode from "vscode";
import { MermaidLinkGenerator } from "./mermaid/link-generator";
import { telemetry } from "../telemetry";

export class OutputFormatter {
    public static getDiagramFileContent(modelName: string, llmResponse: string): string {
        const mermaidBlock = this.getMermaidBlock(llmResponse);
        const mermaidCode = mermaidBlock.replace(/```mermaid|```/g, "");
        this.tryDetectCycle(mermaidCode);
        const linkGenerator = new MermaidLinkGenerator(mermaidCode);

        return `<p align="center">
<img src="https://raw.githubusercontent.com/swark-io/swark/refs/heads/main/assets/logo/swark-logo-dark-mode.png" width="10%" />
</p>\n
## Architecture Diagram

To render this diagram (Mermaid Syntax), you can:
* Install the [Markdown Preview Mermaid Support](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) extension in VS Code, or
* Use the links below to open it in Mermaid Live Editor.

For any issues or feature requests, please visit our [GitHub repository](https://github.com/swark-io/swark) or email us at contact@swark.io.

## Generated Content
**Model**: ${modelName}  
**Mermaid Live Editor**: [View](${linkGenerator.createViewLink()}) | [Edit](${linkGenerator.createEditLink()})

${mermaidBlock}`;
    }

    public static getMermaidBlock(llmResponse: string): string {
        const matches = llmResponse.match(/```mermaid[\s\S]*```/);

        if (!matches) {
            throw new Error("No Mermaid block found in the language model response. Please try again.");
        }

        const block = matches[0];

        if (block !== llmResponse) {
            telemetry.sendTelemetryEvent("llmResponseContainedExtraPayload");
        }

        return block;
    }

    public static tryDetectCycle(mermaidCode: string): void {
        try {
            const cycleNode = this.detectCycle(mermaidCode);

            if (cycleNode) {
                console.log(`Cycle detected in the diagram at node: ${cycleNode}`);
                telemetry.sendTelemetryErrorEvent("diagramCycleDetected");
            }
        } catch (error) {
            telemetry.sendTelemetryErrorEvent("diagramCycleDetectionFailed");
        }
    }

    public static detectCycle(mermaidCode: string): string | undefined {
        const lines = mermaidCode.split("\n");
        const parentNodes: string[] = [];

        for (let line of lines) {
            line = line.trim();

            if (line.startsWith("subgraph")) {
                const rest = line.substring("subgraph".length, line.length);
                const subgraphName = rest.split("[")[0].trim();

                if (parentNodes.includes(subgraphName)) {
                    return subgraphName;
                }

                parentNodes.push(subgraphName);
            } else if (line.startsWith("end")) {
                parentNodes.pop();
            } else if (line === "") {
                continue;
            } else {
                const node = line.split("[")[0];

                if (parentNodes.includes(node)) {
                    return node;
                }
            }
        }

        return undefined;
    }

    public static getLogFileContent(
        selectedFolder: vscode.Uri,
        model: vscode.LanguageModelChat,
        filePaths: string[]
    ): string {
        const json = JSON.stringify(
            {
                selectedFolder: selectedFolder.fsPath,
                model: { family: model.family, name: model.name, maxInputTokens: model.maxInputTokens },
                numFilesUsed: filePaths.length,
            },
            null,
            4
        );

        return `# Swark Log File

## Info
\`\`\`json
${json}
\`\`\`

## Files Used
\`\`\`
total ${filePaths.length}  
${filePaths.join("\n")}
\`\`\``;
    }
}
