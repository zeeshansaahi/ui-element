import { EventEmitter } from "events";

class ExtensionEventEmitter extends EventEmitter {}

export const extensionEventEmitter = new ExtensionEventEmitter();
