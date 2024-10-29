// popup.js

document.getElementById("start-btn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    console.log("Sending message to start element selection"); // Add this log
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: startSelectionMode,
    });

    chrome.tabs.sendMessage(tabs[0].id, { action: "start-selection" });
  });
});

function startSelectionMode() {
  // chrome.runtime.sendMessage({ action: "start-selection" });
  console.log("Selection mode started!"); // Add this log
}

// Listen for the message from background script with element details
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "store-element-data") {
    displayElementDetails(message.data);
  }
});

// Function to display the captured element details
function displayElementDetails(data) {
  const detailsElement = document.getElementById("element-details");
  detailsElement.textContent = JSON.stringify(data, null, 2);
}
