let socket = null;
let isConnected = false;
const RECONNECT_INTERVAL = 5000; // Try to reconnect every 5 seconds
const KEEP_ALIVE_INTERVAL = 60000; // 1 minute for keep-alive check

function connectWebSocket() {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return; // Avoid reconnecting if it's already open or connecting
  }

  socket = new WebSocket("ws://localhost:3020");

  socket.onopen = function () {
    console.log("[open] Connection established");
    isConnected = true;
    socket.send(
      JSON.stringify({
        client: "chrome",
        message: "Chrome extension connected",
      })
    );
    scheduleKeepAlive();
  };

  socket.onmessage = function (event) {
    const message = JSON.parse(event.data);
    if (message.action === "start-selection") {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
          chrome.scripting.executeScript(
            {
              target: { tabId: tabs[0].id },
              files: ["content.js"], // Make sure content.js is injected
            },
            () => {
              // After injection, send the message
              chrome.tabs.sendMessage(tabs[0].id, {
                action: "start-selection",
              });
            }
          );
        }
      });
    } else if (message.action === "validate-xpath") {
      const xpaths = message.data;
      // Extract meta-information from the first path (assuming it contains browser/tab metadata)
      const metaXPath = xpaths[0];
      const appMatch = /app='([^']+)'/.exec(metaXPath);
      const titleMatch = /title='([^']+)'/.exec(metaXPath);
      const urlMatch = /url='([^']+)'/.exec(metaXPath);
      const tabApp = appMatch ? appMatch[1] : "";
      const tabTitle = titleMatch ? titleMatch[1] : "";
      const tabUrl = urlMatch ? urlMatch[1] : "";

      // Search for the correct tab using either title or URL
      chrome.tabs.query({}, function (tabs) {
        // Find the tab that matches the title or the URL
        const matchingTab = tabs.find((tab) => {
          if (tabUrl) {
            return tab.url.startsWith(tabUrl);
          } else if (tabTitle) {
            return tab.title === tabTitle;
          }
        });

        if (matchingTab) {
          chrome.scripting.executeScript(
            {
              target: { tabId: matchingTab.id },
              files: ["content.js"], // Inject content.js into the tab
            },
            () => {
              // After injection, send the validate-xpath action to the content script
              chrome.tabs.sendMessage(matchingTab.id, {
                action: "validate-xpath",
                data: xpaths,
              });
            }
          );
        } else {
          const message = {
            action: "validation-result",
            result: false,
          };
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ client: "chrome", message: message }));
          }
        }
      });
    } else if (message.action === "highlight-xpath") {
      const xpaths = message.data;
      // Extract meta-information from the first path (assuming it contains browser/tab metadata)
      const metaXPath = xpaths[0];
      const appMatch = /app='([^']+)'/.exec(metaXPath);
      const titleMatch = /title='([^']+)'/.exec(metaXPath);
      const urlMatch = /url='([^']+)'/.exec(metaXPath);
      const tabApp = appMatch ? appMatch[1] : "";
      const tabTitle = titleMatch ? titleMatch[1] : "";
      const tabUrl = urlMatch ? urlMatch[1] : "";

      // Search for the correct tab using either title or URL
      chrome.tabs.query({}, function (tabs) {
        // Find the tab that matches the title or the URL
        const matchingTab = tabs.find((tab) => {
          if (tabUrl) {
            return tab.url.startsWith(tabUrl);
          } else if (tabTitle) {
            return tab.title === tabTitle;
          }
        });

        if (matchingTab) {
          // switch to the tab
          chrome.tabs.update(matchingTab.id, {
            highlighted: true,
            selected: true,
          });
          chrome.scripting.executeScript(
            {
              target: { tabId: matchingTab.id },
              files: ["content.js"], // Inject content.js into the tab
            },
            () => {
              // After injection, send the validate-xpath action to the content script
              chrome.tabs.sendMessage(matchingTab.id, {
                action: "highlight-xpath",
                data: xpaths[1],
              });
            }
          );
        }
      });
    }
  };

  socket.onclose = function (event) {
    console.log(
      `[close] Connection closed, code=${event.code} reason=${event.reason}`
    );
    isConnected = false;
    setTimeout(connectWebSocket, RECONNECT_INTERVAL);
  };

  socket.onerror = function (error) {
    console.log(`[error] ${error.message}`);
    isConnected = false;
  };
}
// function validateXPathsInTabs(xpaths) {
//   const tabXPath = xpaths[0]; // The first XPath contains tab/browser info
//   const elementXPaths = xpaths.slice(1); // The rest are element XPaths

//   chrome.tabs.query({}, (tabs) => {
//     let tabFound = false;
//     for (const tab of tabs) {
//       chrome.scripting.executeScript(
//         {
//           target: { tabId: tab.id },
//           function: validateTabAndElements,
//           args: [tabXPath, elementXPaths],
//         },
//         (results) => {
//           if (chrome.runtime.lastError) {
//             console.error(chrome.runtime.lastError);
//           } else if (results && results[0]) {
//             if (results[0].result.result.tabValid) {
//               tabFound = true;
//               sendValidationResult({
//                 tabFound: true,
//                 elementFound: results[0].result.elementFound,
//               });
//             }
//           }

//           if (!tabFound) {
//             sendValidationResult({
//               tabFound: false,
//               elementFound: false,
//             });
//           }
//         }
//       );
//     }
//   });
// }

// function validateTabAndElements(tabXPath, elementXPaths) {
//   function parseWebCtrl(webctrlString) {
//     if (webctrlString.trim() === "<webctrl/>") {
//       return { tag: null, cssSelector: null };
//     }

//     const parser = new DOMParser();
//     const doc = parser.parseFromString(webctrlString, "text/xml");
//     const webctrl = doc.querySelector("webctrl");
//     if (!webctrl) return { tag: null, cssSelector: null };

//     return {
//       tag: webctrl.getAttribute("tag"),
//       cssSelector: webctrl.getAttribute("css-selector"),
//     };
//   }

//   function validateXPath(xpath) {
//     const { tag, cssSelector } = parseWebCtrl(xpath);
//     if (!cssSelector) return true; // If no properties are selected, consider it valid

//     const elements = document.querySelectorAll(cssSelector);
//     return tag
//       ? Array.from(elements).some(
//           (el) => el.tagName.toLowerCase() === tag.toLowerCase()
//         )
//       : elements.length > 0;
//   }

//   // Validate tab
//   const tabValid = validateXPath(tabXPath);
//   if (!tabValid) {
//     return { result: { tabValid: false, elementFound: false } };
//   }

//   // Validate elements, starting from the most specific (last) XPath
//   for (let i = elementXPaths.length - 1; i >= 0; i--) {
//     if (validateXPath(elementXPaths[i])) {
//       return { result: { tabValid: true, elementFound: true } };
//     }
//   }

//   return { result: { tabValid: true, elementFound: false } };
// }
// function sendValidationResult(isValid) {
//   socket.send(
//     JSON.stringify({
//       client: "chrome",
//       action: "validation-result",
//       result: isValid,
//     })
//   );
// }
// Send keep-alive message to WebSocket server
function sendKeepAlive() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ client: "chrome", message: "keep-alive" }));
  } else {
    connectWebSocket();
  }
}

// Schedule a keep-alive ping every minute
function scheduleKeepAlive() {
  chrome.alarms.create("keepAlive", { periodInMinutes: 1 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    sendKeepAlive();
  }
});

// Attempt to connect immediately on extension startup or installation
chrome.runtime.onStartup.addListener(connectWebSocket);
chrome.runtime.onInstalled.addListener(connectWebSocket);

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "store-element-data") {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ client: "chrome", message: message }));
    } else {
      console.log("WebSocket not connected. Attempting to reconnect...");
      connectWebSocket();
    }
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "validation-result") {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ client: "chrome", message: message }));
    } else {
      console.log("WebSocket not connected. Attempting to reconnect...");
      connectWebSocket();
    }
  }
});

// Periodically check connection status
setInterval(() => {
  if (!isConnected) {
    console.log("Connection lost. Attempting to reconnect...");
    connectWebSocket();
  }
}, KEEP_ALIVE_INTERVAL);

// Initiate WebSocket connection on load
connectWebSocket();
