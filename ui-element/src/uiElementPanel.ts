import * as vscode from "vscode";
import * as path from "path";
export class UIElementPanel {
  public static currentPanel: UIElementPanel | undefined;

  public static readonly viewType = "uiElementView";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.ViewColumn.One;

    // If we already have a panel, show it.
    if (UIElementPanel.currentPanel) {
      UIElementPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      UIElementPanel.viewType,
      "UI Elements",
      column,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );
    panel.iconPath = vscode.Uri.joinPath(
      extensionUri,
      "media",
      "side_nav_logo.svg"
    );

    UIElementPanel.currentPanel = new UIElementPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the initial content of the Webview
    this._update();

    // Handle when the panel is closed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle view state changes
    this._panel.onDidChangeViewState(
      (e) => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    UIElementPanel.currentPanel = undefined;

    // Clean up the resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;

    // Set the HTML content for the landing page UI
    this._panel.title = "UI Elements";
    this._panel.webview.html = this._getHtmlForWebview(webview);

    webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "addElement":
          if (message.type === "Browser DOM") {
            vscode.commands.executeCommand("extension.inspectElement");
          }
          break;
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Local path to the CSS file
    const stylePath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "css",
      "landing-page.css"
    );
    const styleUri = webview.asWebviewUri(stylePath);
    // Landing Page HTML content
    return /*html*/ `
<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>UI Elements</title>
            <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
            <div class="landing-page">
                <div class="empty-state">
                    <!-- Placeholder for the mockup image -->
                    <img src="path/to/image" alt="No elements image" class="landing-logo">
                    <h1>No elements have been saved yet!</h1>
                    <p>Click "Add Element" button to start adding UI Elements.</p>
                </div>
                <div class="add-element-dropdown">
                    <button class="add-element-button">Add Element
                    </button>
                    <div class="dropdown-content">
                        <a href="#" id="browserDom">Browser DOM</a>
                        <a href="#" disabled id="desktop">Desktop</a>
                        <a href="#" disabled id="accessibilityInsights">Accessibility Insights</a>
                        <a href="#" disabled id="jab">JAB</a>
                    </div>
                </div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('browserDom').addEventListener('click', () => {
                    vscode.postMessage({ command: 'addElement', type: 'Browser DOM' });
                });
                document.getElementById('desktop').addEventListener('click', () => {
                    vscode.postMessage({ command: 'addElement', type: 'Desktop' });
                });
                document.getElementById('accessibilityInsights').addEventListener('click', () => {
                    vscode.postMessage({ command: 'addElement', type: 'Accessibility Insights' });
                });
                document.getElementById('jab').addEventListener('click', () => {
                    vscode.postMessage({ command: 'addElement', type: 'JAB' });
                });
            </script>
        </body>
        </html>
      `;
  }
}
