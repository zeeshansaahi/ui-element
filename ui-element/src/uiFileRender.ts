import * as vscode from "vscode";
import * as path from "path";
import { extensionEventEmitter } from "./eventEmitter";
import {
  getNewElementInExistingFile,
  resetNewElementInExistingFile,
  setFlag,
} from "./flagManager";
export class UIFileRenderProvider implements vscode.CustomTextEditorProvider {
  currentEditIndex: any;
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new UIFileRenderProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      UIFileRenderProvider.viewType,
      provider
    );
    return providerRegistration;
  }

  private static readonly viewType = "uiElement.uieRender";
  private webviewPanel: vscode.WebviewPanel | undefined;
  private validationInProgress: boolean = false;
  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
    let changeTimeout: string | number | NodeJS.Timeout | undefined;
    const updateWebview = () => {
      if (this.validationInProgress) {
        console.log("Skipping updateWebview due to validation in progress.");
        return;
      }
      let jsonData;
      try {
        jsonData = JSON.parse(document.getText());
      } catch (error) {
        jsonData = null;
      }

      const isNotArrayData = !Array.isArray(JSON.parse(document.getText()));
      console.log("is not array?:", isNotArrayData);
      console.log(
        "Sending message to webview:",
        isNotArrayData ? "edit" : "home"
      );
      let message = isNotArrayData ? "edit" : "home";
      const newFlag = getNewElementInExistingFile();
      if (newFlag) {
        message = "edit";
        jsonData = !isNotArrayData ? jsonData[jsonData.length - 1] : jsonData;
      }
      if (webviewPanel.webview.html) {
        webviewPanel.webview.postMessage({
          type: message,
          data: jsonData,
          uri: document.uri.toString(),
        });
      }

      resetNewElementInExistingFile();
    };

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          updateWebview();
        }
      }
    );

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage((e) => {
      switch (e.type) {
        case "edited":
          // wrap the received data with an array and then write it into the document if the data in the file doesn't already have an array
          if (!Array.isArray(JSON.parse(document.getText()))) {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
              document.uri,
              new vscode.Range(0, 0, document.lineCount, 0),
              JSON.stringify([e.data], null, 2)
            );
            vscode.workspace.applyEdit(edit);
          } else {
            // if the data in the file is already an array, replace the last element in the array with the new data
            const currentData = JSON.parse(document.getText());
            const index =
              this.currentEditIndex !== undefined
                ? this.currentEditIndex
                : currentData.length - 1;
            currentData[index] = e.data;

            // Clear the index after use (optional)
            delete this.currentEditIndex;
            this.updateTextDocument(document, currentData);
          }
          switchScreen(JSON.parse(document.getText()));

          // this.updateTextDocument(document, e.data);
          return;
        case "validate":
          this.validationInProgress = true;
          this.sendXPaths(e.xpaths);
          return;
        case "highlight":
          this.sendHighlight(e.xpath);
        case "addMoreElement":
          if (e.option === "Browser DOM") {
            // set a flag that I can read in extension.ts
            setFlag(true, e.uri);

            vscode.commands.executeCommand("extension.inspectElement");
          }
          break;
        case "editElement":
          const elementData = e.data;
          const elementIndex = e.index;
          // Update the webview to edit mode with the element's data
          webviewPanel.webview.postMessage({
            type: "edit",
            data: elementData,
            index: elementIndex,
            uri: e.uri,
          });
          this.currentEditIndex = elementIndex;
          break;
        case "duplicateElement":
          const duplicateData = { ...e.data, name: `${e.data.name} Copy` }; // Optional: add "Copy" to the name
          const currentData = JSON.parse(document.getText());
          currentData.push(duplicateData);
          this.updateTextDocument(document, currentData);
          // switchScreen(currentData);
          break;
        case "removeElement":
          const { index } = e;
          const fileData = JSON.parse(document.getText());

          if (Array.isArray(fileData)) {
            // Check if the index is within bounds
            if (index >= 0 && index < fileData.length) {
              // Remove the element at the specified index
              fileData.splice(index, 1);
              this.updateTextDocument(document, fileData);
              // Send updated data to switch screen
              // switchScreen(currentData);
            }
          } else {
            console.error("Data is not an array; cannot remove element.");
          }
          break;
      }
    });
    function switchScreen(data: any) {
      webviewPanel.webview.postMessage({
        type: "home",
        data: data,
      });
    }
    updateWebview();
    extensionEventEmitter.on("validationResult", (result: any) => {
      console.log("received event of validation result from extension.ts!");
      if (webviewPanel && webviewPanel.active) {
        webviewPanel.webview.postMessage({
          type: "validationResult",
          result: result,
        });
      }
    });
    this.validationInProgress = false;
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const stylePath = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "webview-ui",
        "build",
        "assets",
        "index.css"
      )
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "webview-ui",
        "build",
        "assets",
        "index.js"
      )
    );

    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>body {
          padding: 0px !important;
        }</style>
        <link rel="stylesheet" type="text/css" href="${stylePath}">
        <title>UI Element Editor</title>
      </head>
      <body>
        <div id="root"></div>
        <script src="${scriptUri}"></script>
      </body>
      </html>
    `;
  }

  private updateTextDocument(document: vscode.TextDocument, json: any) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      JSON.stringify(json, null, 2)
    );
    return vscode.workspace.applyEdit(edit);
  }
  private sendXPaths(xpaths: string[]) {
    extensionEventEmitter.emit("validate", xpaths);
  }

  private sendHighlight(xpaths: string[]) {
    console.log("Sent path to highlight:", xpaths);
    extensionEventEmitter.emit("highlight", xpaths);
  }
  //   private handleValidationResult(
  //     result: boolean,
  //     webviewPanel: vscode.WebviewPanel
  //   ) {
  //     console.log("webview:", webviewPanel);
  //     console.log("validation-result in handleValidation function:", result);
  //     if (webviewPanel && webviewPanel.active) {
  //       webviewPanel.webview.postMessage({
  //         type: "validationResult",
  //         result: result,
  //       });
  //     }
  //     this.validationInProgress = false;
  //   }
}
