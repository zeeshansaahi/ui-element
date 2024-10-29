let flag: boolean = false;
let newflag: boolean = false;
let activeFileUri: string | undefined;
export function setFlag(value: boolean, uri: string) {
  flag = value;
  activeFileUri = uri;
}
export function getFlag() {
  return { flag, activeFileUri };
}
export function resetFlag() {
  flag = false;
  activeFileUri = undefined;
}

export function setNewElementInExistingFile(value: boolean) {
  newflag = value;
}

export function getNewElementInExistingFile() {
  return newflag;
}

export function resetNewElementInExistingFile() {
  newflag = false;
}
