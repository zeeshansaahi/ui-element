interface Property {
  name: string;
  value: string;
  selected: boolean;
}

interface Element {
  xpath: string;
  properties: Property[];
  selected: boolean;
  generatedXPath?: string;
}

interface UIElementData {
  name: string;
  element: Element[];
  generatedXPathHtml: string;
}

interface SavedState {
  message: string;
  data: UIElementData;
  arrayData: UIElementData[];
}

interface FileState {
  [fileUri: string]: SavedState;
}

const vscode = acquireVsCodeApi();

const fileStates: FileState = {};

const enhancedVSCode = {
  ...vscode,
  getFileState: (fileUri: string): SavedState | null => {
    return fileStates[fileUri] || null;
  },
  setFileState: (fileUri: string, state: SavedState) => {
    fileStates[fileUri] = state;
    vscode.setState(fileStates);
  },
};

export default enhancedVSCode;
