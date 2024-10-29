import * as vscode from "vscode";
import { UIElementPanel } from "./uiElementPanel";
import { exec } from "child_process";
import * as path from "path";
const express = require("express");
import * as http from "http";
import * as WebSocket from "ws";
import * as os from "os";
import { UIFileRenderProvider } from "./uiFileRender";
import { RecentFilesView } from "./recentFilesView";
import { extensionEventEmitter } from "./eventEmitter";
import { executablePath } from "puppeteer";
let server: http.Server | null = null;
let wss: WebSocket.Server | null = null;
let recentFile: boolean = false;
import { getFlag, resetFlag, setNewElementInExistingFile } from "./flagManager";
function trackRecentUIEFiles(context: vscode.ExtensionContext) {
  const documentOpenListener = vscode.workspace.onDidOpenTextDocument(
    (document) => {
      const filePath = document.uri.fsPath;

      if (document.languageId === "uie") {
        // Set flag in globalState indicating a recent UIE file was opened
        context.globalState.update("recentUIEFileOpened", true);
        // Store the files in the globalState
        console.log(`UIE File opened: ${filePath}`);
      }
    }
  );

  context.subscriptions.push(documentOpenListener);
}

async function openBrowserAndHighlightElement(xpaths: string[]) {
  // Launch the browser
  const puppeteer = await import("puppeteer");
  const homeDir = os.homedir();

  // Construct the path to the Chrome User Data directory
  const extensionPath = path.resolve(__dirname, "..", "browser-ext");
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      //'--profile-directory=Profile 1'
    ],
  }); // Set headless to false to open a visible browser
  const page = await browser.newPage();
  //regex to get the url from first xpath
  const urlMatch = xpaths[0].match(/url='([^']+)'/);
  let url = "";
  if (urlMatch && urlMatch[1]) {
    url = urlMatch[1];
  }
  console.log("URL:", url);
  // Navigate to the target URL
  await page.goto(url); // Replace with your target URL

  // Wait for the page to load completely
  await page.waitForSelector("body");

  async function waitForWebSocketConnection() {
    const maxRetries = 10;
    let retries = 0;

    while (retries < maxRetries) {
      let allClientsReady = true;

      // Check if all WebSocket clients are ready
      wss!.clients.forEach((client: any) => {
        if (client.readyState !== WebSocket.OPEN) {
          allClientsReady = false;
        }
      });

      if (allClientsReady) {
        return true; // All clients are ready
      }

      // Wait for 500ms before retrying
      await new Promise((resolve) => setTimeout(resolve, 500));
      retries++;
    }

    console.log("WebSocket connection timed out.");
    return false;
  }

  // Wait until WebSocket connection is established
  const connectionEstablished = await waitForWebSocketConnection();
  if (connectionEstablished) {
    console.log(
      "WebSocket connection established. Sending highlight message..."
    );

    // Send a message to the extension to highlight elements
    wss!.clients.forEach((client: any) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({ action: "highlight-xpath", data: xpaths })
        );
      }
    });
  } else {
    console.error("Failed to establish WebSocket connection.");
  }

  // Optionally close the browser after some time
  // await browser.close();
}
async function getBrowserProcess() {
  try {
    const psList = await import("ps-list"); // Use dynamic import
    const processes = await psList.default(); // Access the default export

    // Check if any process has "chrome" or "Google" in its name
    const isChromeRunning = processes.some(
      (proc) =>
        proc.name.toLowerCase().includes("chrome") ||
        proc.name.toLowerCase().includes("google chrome")
    );

    return isChromeRunning;
  } catch (error: any) {
    console.error(`Error retrieving process list: ${error.message}`);
    return false;
  }
}
async function highlightElement(xpaths: string[], context: any) {
  // first check if the any chrome browser is opened
  const browserProcess = await getBrowserProcess();

  if (!browserProcess) {
    openBrowserAndHighlightElement(xpaths);
  } else {
    switchWindow(context);
    console.log("highlihting path:", xpaths);
    if (wss) {
      wss.clients.forEach((client: any) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({ action: "highlight-xpath", data: xpaths })
          );
        }
      });
    }
  }
}
export function activate(context: vscode.ExtensionContext) {
  extensionEventEmitter.on("validate", (xpaths: string[]) => {
    console.log("Validating XPaths:", xpaths);
    if (wss) {
      wss.clients.forEach((client: any) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({ action: "validate-xpath", data: xpaths })
          );
        }
      });
    }
  });
  extensionEventEmitter.on("highlight", (xpaths: string[]) => {
    highlightElement(xpaths, context);
  });
  trackRecentUIEFiles(context);
  // Check if a recent .uie file was opened in the previous session
  const recentUIEFileOpened = context.globalState.get<boolean>(
    "recentUIEFileOpened",
    false
  );

  if (recentUIEFileOpened) {
    vscode.commands.registerCommand("ui-element.addWebview", () => {
      vscode.commands.executeCommand("ui-element.recentFilePage");
    });
    // If a recent .uie file was opened, open the recent files view
    vscode.commands.executeCommand("ui-element.recentFilePage");
  } else {
    vscode.commands.registerCommand("ui-element.addWebview", () => {
      vscode.commands.executeCommand("ui-element.openLandingPage");
    });
    // Otherwise, open the default landing page
    vscode.commands.executeCommand("ui-element.openLandingPage");
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("ui-element.recentFilePage", () => {
      RecentFilesView.createOrShow(context.extensionUri, context);
    })
  );

  context.subscriptions.push(UIFileRenderProvider.register(context));
  startServer(context);
  // Register the command to open the landing page
  const disposable = vscode.commands.registerCommand(
    "ui-element.openLandingPage",
    () => {
      UIElementPanel.createOrShow(context.extensionUri);
    }
  );

  const disposable2 = vscode.commands.registerCommand(
    "extension.inspectElement",
    async () => {
      vscode.window.showInformationMessage("Activating browser extension...");
      vscode.window.showInformationMessage("Inspecting DOM Element.");

      // Run PowerShell script to bring the browser window to the front
      switchWindow(context);

      if (wss) {
        let clientsFound = false;
        wss.clients.forEach((client: any) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ action: "start-selection" }));
            clientsFound = true;
          }
        });
        if (clientsFound) {
          vscode.window.showInformationMessage(
            "Element selection started in Chrome"
          );
        } else {
          vscode.window.showWarningMessage(
            "No active Chrome extensions found. Please ensure the extension is running and refresh the page."
          );
        }
      } else {
        vscode.window.showErrorMessage("Server is not running");
      }
    }
  );
  context.subscriptions.push(disposable, disposable2);
}

// This method is called when your extension is deactivated
export function deactivate() {
  stopServer();
}

function startServer(context: any) {
  const app = express();
  server = http.createServer(app);
  wss = new WebSocket.Server({ server });

  wss.on("connection", (ws: WebSocket) => {
    console.log("Browser Extension established connection successfully.");
    ws.on("message", (message: string) => {
      const data = JSON.parse(message);
      if (data.message.action === "store-element-data") {
        createUIEFile(data.message.data, context);
        switchWindow(context);
        // Handle the element data here
        vscode.window.showInformationMessage(
          `Element selected: ${JSON.stringify(data.message.data)}`
        );
      }
    });
    ws.on("message", (message: string) => {
      const data = JSON.parse(message);
      console.log("validation: result:", data);
      if (data.message.action === "validation-result") {
        extensionEventEmitter.emit("validationResult", data.message.result);
      }
    });
  });

  server.listen(3020, () => {
    console.log("Server is running on http://localhost:3020");
  });
}

function stopServer() {
  if (server) {
    server.close();
  }
  if (wss) {
    wss.close();
  }
}

function switchWindow(context: any) {
  const scriptPath = path.join(
    context.extensionPath,
    "src",
    "scripts",
    "switchWindow.ps1"
  );

  exec(
    `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error switching windows: ${error}`);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
      }
      console.log("Window Switched:", stdout);
    }
  );
}
async function createUIEFile(data: any, context: any) {
  // No Need to create a new .uie file if the call was made from an existing .uie file
  const { flag, activeFileUri } = getFlag();
  if (flag && activeFileUri) {
    const existingDocument = await vscode.workspace.openTextDocument(
      vscode.Uri.parse(activeFileUri)
    );
    let currentData = JSON.parse(existingDocument.getText());
    if (Array.isArray(currentData)) {
      currentData.push(data);
    } else {
      currentData = [data];
    }

    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      existingDocument.uri,
      new vscode.Range(0, 0, existingDocument.lineCount, 0),
      JSON.stringify(currentData, null, 2)
    );
    setNewElementInExistingFile(true);
    await vscode.workspace.applyEdit(edit);
    resetFlag(); // Clear flag and URI after updating
    // render the newly coming data in the editor
  } else {
    try {
      // Stringify the data you received from the browser extension
      const uieContent = JSON.stringify(data, null, 2);

      // Create an untitled .uie file URI
      const document = await vscode.workspace.openTextDocument({
        content: uieContent,
        language: "uie",
      });
      // Show the document in the editor, which will now be an unsaved .uie file
      await vscode.window.showTextDocument(document, { preview: true });

      // Now, you can open this document with your custom editor for rendering
      await vscode.commands.executeCommand(
        "vscode.openWith",
        document.uri,
        "uiElement.uieRender" // Use the viewType from your package.json
      );
      // Optional: Notify the user that the file is opened but not yet saved
      vscode.window.showInformationMessage(
        "Opened unsaved .uie file in the editor"
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Error creating .uie file: ${error.message}`
      );
    }
  }
  return;
}
