import * as vscode from "vscode";
import * as path from "path";

export class RecentFilesView {
  public static currentPanel: RecentFilesView | undefined;
  public recentFiles: { name: string; path: string }[] = [];
  public static readonly viewType = "recentFileView";
  private static readonly storageKey = "recentUIEFiles"; // Key to store recent files in globalState

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._context = context;
    // Load recent files from globalState when the panel is created
    this.loadRecentFilesFromGlobalState();

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

    // Listen for document open/save events
    this.listenForFileEvents();
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    const column = vscode.ViewColumn.One;

    // If we already have a panel, show it.
    if (RecentFilesView.currentPanel) {
      RecentFilesView.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      RecentFilesView.viewType,
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

    RecentFilesView.currentPanel = new RecentFilesView(
      panel,
      extensionUri,
      context
    );
  }

  public dispose() {
    RecentFilesView.currentPanel = undefined;

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
    this._panel.webview.html = this.getWebviewContent(webview);

    // Send recent files to the webview
    this._panel.webview.postMessage({
      command: "updateRecentFiles",
      files: this.recentFiles,
    });

    // if the message received from the script is browser dom, execute vscode command..
    webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "addElement":
          if (message.value === "Browser DOM") {
            vscode.commands.executeCommand("extension.inspectElement");
          }
          break;
      }
    });
  }

  public getWebviewContent(webview: vscode.Webview): string {
    const logoPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "Autosphere.svg"
    );
    const logoUri = webview.asWebviewUri(logoPath);

    const stylePath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "css",
      "recentFilePage.css"
    );
    const styleUri = webview.asWebviewUri(stylePath);

    const scriptPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "scripts",
      "recentFileScript.js"
    );
    const scriptUri = webview.asWebviewUri(scriptPath);
    return /* html */ `
    <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>UI Elements</title>
          <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
          <div class="container">
            <header>
              <div class="logo">
                <img src="${logoUri}" alt="Autosphere Logo" />
              </div>
              <div class="header-content">
                <h1>UI Elements</h1>
                <p class="subheading">Effortlessly record your screen actions and convert them into automation scripts.</p>
              </div>
              <div class="dropdown">
                <button class="add-element" id="addElementBtn">Add Element ▼</button>
                <div class="dropdown-content" id="dropdownContent">
                  <a href="#" data-value="Browser DOM">Browser DOM</a>
                  <a href="#" data-value="Desktop">Desktop</a>
                  <a href="#" data-value="Accessibility Insights">Accessibility Insights</a>
                  <a href="#" data-value="JAB">JAB</a>
                </div>
              </div>
            </header>
            <main>
              <h2>Recent Files</h2>
              <div class="file-grid" id="fileGrid">
                <!-- File items will be dynamically inserted here -->
              </div>
            </main>
          </div>
          <script src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  private listenForFileEvents() {
    // Listen for file opening or saving and update recent files accordingly
    vscode.workspace.onDidOpenTextDocument((document) => {
      this.addRecentFile(document);
    });

    vscode.workspace.onDidSaveTextDocument((document) => {
      this.addRecentFile(document);
    });
  }

  private addRecentFile(document: vscode.TextDocument) {
    const filePath = document.uri.fsPath;
    if (filePath.endsWith(".uie")) {
      const fileName = path.basename(filePath);

      // Check if the file is already in the recentFiles array
      const isAlreadyTracked = this.recentFiles.some(
        (file) => file.path === filePath
      );

      if (!isAlreadyTracked) {
        this.recentFiles.push({ name: fileName, path: filePath });
      }

      // Keep only the last 10 recent files
      this.recentFiles = this.recentFiles.slice(-10);

      // Update the global state with the new recent files
      this.saveRecentFilesToGlobalState();
    }
  }

  private saveRecentFilesToGlobalState() {
    // Store recent files in globalState using context
    this._context.globalState.update(
      RecentFilesView.storageKey,
      this.recentFiles
    );
  }

  private loadRecentFilesFromGlobalState() {
    const storedFiles = this._context.globalState.get<
      { name: string; path: string }[]
    >(RecentFilesView.storageKey);

    if (storedFiles) {
      this.recentFiles = storedFiles;
    }
  }
}
