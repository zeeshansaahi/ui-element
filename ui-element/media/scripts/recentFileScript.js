(function () {
  const vscode = acquireVsCodeApi();

  document.addEventListener("DOMContentLoaded", function () {
    const addElementBtn = document.getElementById("addElementBtn");
    const dropdownContent = document.getElementById("dropdownContent");

    addElementBtn.addEventListener("click", function () {
      dropdownContent.style.display =
        dropdownContent.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", function (event) {
      if (
        !addElementBtn.contains(event.target) &&
        !dropdownContent.contains(event.target)
      ) {
        dropdownContent.style.display = "none";
      }
    });

    dropdownContent.addEventListener("click", function (event) {
      if (event.target.tagName === "A") {
        const selectedValue = event.target.getAttribute("data-value");
        vscode.postMessage({ command: "addElement", value: selectedValue });
        dropdownContent.style.display = "none";
      }
    });
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.command) {
      case "updateRecentFiles":
        updateFileGrid(message.files);
        break;
    }
  });

  function updateFileGrid(files) {
    const fileGrid = document.getElementById("fileGrid");
    fileGrid.innerHTML = "";
    files.forEach((file) => {
      const fileItem = document.createElement("div");
      fileItem.className = "file-item";
      fileItem.innerHTML = `
              <div class="file-icon"></div>
              <div class="file-name">${file.name}</div>
              <div class="file-path">${file.path}</div>
          `;
      fileItem.addEventListener("click", () => {
        vscode.postMessage({ command: "openFile", path: file.path });
      });
      fileGrid.appendChild(fileItem);
    });
  }
})();
