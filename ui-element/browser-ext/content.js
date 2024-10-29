let selectedElement = null;
function formatHTMLTagWithProperties() {
  const appName = "chrome.exe"; // You can adjust this depending on the browser (hardcoded as chrome here)
  const pageTitle = document.title; // Get the page title
  const pageUrl = document.location.href; // Get the current URL

  // Create a properties object for the <html> tag
  const htmlProperties = {
    app: appName,
    title: pageTitle,
    url: pageUrl,
  };

  // Format the HTML tag string like in the image you provided
  const htmlTag = `<html app='${appName}' title='${pageTitle}'/>`;

  return { htmlTag, htmlProperties };
}

// Function to get the XPath of an element
function getXPath(element) {
  const idx = (sib, name) =>
    sib
      ? idx(sib.previousElementSibling, name || sib.localName) +
        (sib.localName === name)
      : 1;
  const segs = (elm) =>
    !elm || elm.nodeType !== 1
      ? [""]
      : elm.id && document.getElementById(elm.id) === elm
      ? [`id("${elm.id}")`]
      : [
          ...(elm.parentNode ? segs(elm.parentNode) : [""]),
          `${elm.localName.toLowerCase()}[${idx(elm)}]`,
        ];
  return segs(element).join("/");
}

// Function to format element details for HTML code panel
function formatElementHTMLCode(element) {
  const attributes = Array.from(element.attributes)
    .map((attr) => `${attr.name}='${attr.value}'`)
    .join(" ");
  const eleProperties = getElementProperties(element, element.parentElement);
  const tagName = element.tagName.toLowerCase();
  const cssSelector = generateCssSelector(element);
  // optionally add id and parentid if they exist and have a value
  const id = eleProperties.id ? `id='${eleProperties.id}'` : "";
  const parentid = eleProperties.parentid
    ? `parentid='${eleProperties.parentid}'`
    : "";
  return `<webctrl css-selector='${cssSelector}' ${id} ${parentid} tag='${tagName}'/>`;
}

// Function to collect properties for each element
function getElementProperties(element, parentElement) {
  const properties = {
    cssSelector: generateCssSelector(element),
    id: element.id || null,
    parentid: parentElement ? parentElement.id : null,
    tag: element.tagName.toLowerCase(),
    aaname: element.aaname || null,
    class: element.className || null,
    innerText: element.innerText.trim() || null,
    isleaf: element.children.length === 0 ? 1 : 0,
    parentClass: parentElement ? parentElement.className : null,
    visibleInnerText: element.visibleInnerText
      ? element.visibleInnerText.trim()
      : null,
  };

  return properties;
}
function generateCssSelector(el) {
  if (!(el instanceof Element)) return;
  let path = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    let sib = el,
      nth = 1;
    while ((sib = sib.previousElementSibling)) {
      if (sib.nodeName.toLowerCase() == selector) nth++;
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(">");
}
// Function to transform properties into key-value pair format
function formatPropertiesForJSON(properties) {
  const formattedProperties = [];
  // Convert each attribute
  Object.keys(properties).forEach((attrName) => {
    if (attrName === "cssSelector") {
      formattedProperties.push({
        name: "css-selector",
        value: properties.cssSelector,
      });
      return;
    }
    if (attrName === "visibleInnerText") {
      formattedProperties.push({
        name: "visibleinnertext",
        value: properties.visibleInnerText,
      });
      return;
    }
    formattedProperties.push({
      name: attrName,
      value: properties[attrName],
    });
  });

  return formattedProperties;
}

// Function to handle element click and generate WebCTRL-like output
function handleElementClick(event) {
  event.preventDefault();
  event.stopPropagation();

  let selectedElement = event.target;

  // Highlight the selected element with a red border
  selectedElement.style.outline = "2px solid red";

  // Start collecting details from selected element up to the root <html> element
  const elementData = [];
  let currentElement = selectedElement;

  // 2. Traverse the DOM hierarchy, starting from the selected element to the top
  while (currentElement) {
    const parentElement = currentElement.parentElement;
    // Collect HTML code for each element
    const elementHTML = formatElementHTMLCode(currentElement);

    // Collect properties for each element
    const elementProperties = getElementProperties(
      currentElement,
      parentElement
    );

    // Add each element's data to the array
    elementData.push({
      xpath: elementHTML,
      properties: formatPropertiesForJSON(elementProperties),
    });

    // Move to parent element
    currentElement = parentElement;
  }
  elementData.reverse();
  // 1. Add the <html> tag and its properties at the start
  const { htmlTag, htmlProperties } = formatHTMLTagWithProperties();
  elementData.unshift({
    xpath: htmlTag,
    properties: formatPropertiesForJSON(htmlProperties),
  });
  // 3. Log the final JSON structure
  const jsonData = {
    elements: elementData,
  };

  console.log("Structured JSON Data:\n", JSON.stringify(jsonData, null, 2));

  // 4. Optionally send this data to the background or popup
  chrome.runtime.sendMessage({
    action: "store-element-data",
    data: jsonData,
  });

  // Stop the hover effect and prevent further selection
  deactivateSelectionMode();
}

// Function to activate selection mode
function activateSelectionMode() {
  console.log("Selection mode activated");

  // Add a one-time click event listener to the document to select the element
  document.body.addEventListener("click", handleElementClick, { once: true });

  // Highlight elements on hover with a blue outline
  document.body.addEventListener("mouseover", handleHover);
  document.body.addEventListener("mouseout", removeHover);
}

// Function to deactivate selection mode (removes hover effect)
function deactivateSelectionMode() {
  console.log("Selection mode deactivated");

  // Remove hover event listeners to stop the hover process
  document.body.removeEventListener("mouseover", handleHover);
  document.body.removeEventListener("mouseout", removeHover);
}

// Function to add blue outline on hover
function handleHover(event) {
  if (event.target !== selectedElement) {
    // Ensure the hover effect doesn't affect the selected element
    event.target.style.outline = "2px solid blue";
  }
}

// Function to remove the hover outline
function removeHover(event) {
  if (event.target !== selectedElement) {
    // Ensure the selected element retains its red border
    event.target.style.outline = "";
  }
}

// Helper function to validate a single webctrl path
function validateWebCtrlPaths(paths) {
  console.log("Received paths", paths);

  // Iterate over each path
  for (let i = 1; i < paths.length; i++) {
    const webctrlData = paths[i];

    // Extract properties dynamically using regex
    const properties = extractWebCtrlProperties(webctrlData);

    // Attempt to validate the element based on the extracted properties
    const element = validateWebCtrlElement(properties);

    if (!element.element) {
      console.error(`Validation failed for path: ${webctrlData}`);
      return false;
    }

    // Cross-validate all remaining properties
    if (!element.crossResult) {
      console.error(`Cross-validation failed for path: ${webctrlData}`);
      return false;
    }
  }

  console.log("All paths validated successfully");
  return true;
}

// Extract the webctrl properties from the string using regex
function extractWebCtrlProperties(webctrlData) {
  const propertyNames = [
    "css-selector",
    "id",
    "parentid",
    "tag",
    "aaname",
    "class",
    "innerText",
    "isleaf",
    "parentClass",
  ];

  const properties = {};
  propertyNames.forEach((property) => {
    const match = new RegExp(`${property}='([^']*)'`).exec(webctrlData);
    properties[property] = match ? match[1] : null;
  });

  return properties;
}

// Validate element using prioritized properties
function validateWebCtrlElement(properties) {
  let element = null;

  // Prioritize validation by 'id' first
  if (properties["id"]) {
    element = document.getElementById(properties["id"]);
    if (element) {
      console.log(`Element found by ID: ${properties["id"]}`);
      const crossResult = crossValidateProperties(element, properties, "id");
      return { element, crossResult };
    }
  }

  // Try to find the element by 'css-selector'
  if (!element && properties["css-selector"]) {
    element = document.querySelector(
      properties["css-selector"].replace(/&gt;/g, ">")
    );
    if (element) {
      console.log(
        `Element found by CSS selector: ${properties["css-selector"]}`
      );
      const crossResult = crossValidateProperties(
        element,
        properties,
        "css-selector"
      );
      return { element, crossResult };
    }
  }

  // Try validation using 'parentid'
  if (!element && properties["parentid"]) {
    const parentElement = document.getElementById(properties["parentid"]);
    if (parentElement) {
      element = Array.from(parentElement.children).find((child) => {
        return (
          properties["tag"] && child.tagName.toLowerCase() === properties["tag"]
        );
      });
      if (element) {
        console.log(`Element found by parent ID: ${properties["parentid"]}`);
        const crossResult = crossValidateProperties(
          element,
          properties,
          "parentid"
        );
        return { element, crossResult };
      }
    }
  }

  // Validate by 'aaname' (Accessibility name, often used in UI automation)
  if (!element && properties["aaname"]) {
    element = document.querySelector(`[aria-label="${properties["aaname"]}"]`);
    if (element) {
      console.log(
        `Element found by Accessibility name: ${properties["aaname"]}`
      );
      const crossResult = crossValidateProperties(
        element,
        properties,
        "aaname"
      );
      return { element, crossResult };
    }
  }

  // Validate by 'class' (Check for elements matching the class)
  if (!element && properties["class"]) {
    element = document.querySelector(
      `.${properties["class"].split(" ").join(".")}`
    );
    if (element) {
      console.log(`Element found by class: ${properties["class"]}`);
      const crossResult = crossValidateProperties(element, properties, "class");
      return { element, crossResult };
    }
  }

  // Validate by 'innerText' (Check if inner text matches)
  if (!element && properties["innerText"]) {
    element = Array.from(document.querySelectorAll("*")).find((el) => {
      return el.innerText.trim() === properties["innerText"].trim();
    });
    if (element) {
      console.log(`Element found by innerText: ${properties["innerText"]}`);
      const crossResult = crossValidateProperties(
        element,
        properties,
        "innerText"
      );
      return { element, crossResult };
    }
  }

  // validate by 'tag'
  if (!element && properties["tag"]) {
    element = document.querySelector(properties["tag"]);
    if (element) {
      console.log(`Element found by tag: ${properties["tag"]}`);
      const crossResult = crossValidateProperties(element, properties, "tag");
      return { element, crossResult };
    }
  }

  // Validate by 'parentClass' (Check if element has a parent with the given class)
  if (!element && properties["parentClass"]) {
    element = Array.from(document.querySelectorAll("*")).find((el) => {
      return (
        el.parentElement &&
        el.parentElement.classList.contains(properties["parentClass"])
      );
    });
    if (element) {
      console.log(
        `Element found by parent class: ${properties["parentClass"]}`
      );
      const crossResult = crossValidateProperties(
        element,
        properties,
        "parentClass"
      );
      return { element, crossResult };
    }
  }

  // Validate by 'isleaf' (If element has no child elements)
  if (!element && properties["isleaf"] === true) {
    element = Array.from(document.querySelectorAll("*")).find((el) => {
      return el.children.length === 0;
    });
    if (element) {
      console.log(`Element found by leaf node (isleaf=true)`);
      const crossResult = crossValidateProperties(
        element,
        properties,
        "isleaf"
      );
      return { element, crossResult };
    }
  }

  console.log("Element not found using any provided method.");
  return null;
}

// Cross-validation function to check all remaining properties
function crossValidateProperties(element, properties, identifiedBy) {
  console.log(`Cross-validating element identified by: ${identifiedBy}`);

  // Validate CSS Selector (if the element wasn't identified by it)
  if (identifiedBy !== "css-selector" && properties["css-selector"]) {
    const cssSelectorMatch = element.matches(
      properties["css-selector"].replace(/&gt;/g, ">")
    );
    if (!cssSelectorMatch) {
      console.log(
        `CSS Selector mismatch. Expected: ${properties["css-selector"]}`
      );
      return false;
    }
  }

  // Validate ID (if the element wasn't identified by it)
  if (identifiedBy !== "id" && properties["id"]) {
    if (element.id !== properties["id"]) {
      console.log(
        `ID mismatch. Expected: ${properties["id"]}, Found: ${element.id}`
      );
      return false;
    }
  }

  // Validate Parent ID (if the element wasn't identified by it)
  if (identifiedBy !== "parentid" && properties["parentid"]) {
    const parentElement = element.parentElement;
    if (!parentElement || parentElement.id !== properties["parentid"]) {
      console.log(
        `Parent ID mismatch. Expected: ${properties["parentid"]}, Found: ${
          parentElement ? parentElement.id : "no parent"
        }`
      );
      return false;
    }
  }

  // Validate Tag (if the element wasn't identified by it)
  if (identifiedBy !== "tag" && properties["tag"]) {
    if (element.tagName.toLowerCase() !== properties["tag"]) {
      console.log(
        `Tag mismatch. Expected: ${
          properties["tag"]
        }, Found: ${element.tagName.toLowerCase()}`
      );
      return false;
    }
  }

  // Validate Class (if the element wasn't identified by it)
  if (identifiedBy !== "class" && properties["class"]) {
    if (
      properties["class"] &&
      !element.classList.contains(properties["class"])
    ) {
      console.log(
        `Class mismatch. Expected: ${properties["class"]}, Found: ${element.className}`
      );
      return false;
    }
  }

  // Validate innerText (if th element wasn't identified by it)
  if (identifiedBy !== "innerText" && properties["innerText"]) {
    if (
      properties["innerText"] &&
      element.innerText.trim() !== properties["innerText"].trim()
    ) {
      console.log(
        `InnerText mismatch. Expected: "${
          properties["innerText"]
        }", Found: "${element.innerText.trim()}"`
      );
      return false;
    }
  }
  // Validate aaname (if the element wasn't identified by it)
  if (identifiedBy !== "aaname" && properties["aaname"]) {
    if (
      properties["aaname"] &&
      element.getAttribute("aria-label") !== properties["aaname"]
    ) {
      console.error(
        `Accessible name mismatch. Expected: ${
          properties["aaname"]
        }, Found: ${element.getAttribute("aria-label")}`
      );
      return false;
    }
  }
  // Validate isLeaf (if the element wasn't identified by it)
  if (identifiedBy !== "isLeaf" && properties["isLeaf"]) {
    if (properties["isleaf"]) {
      const isLeaf = element.children.length === 0;
      if (
        (properties["isleaf"] === "true" && !isLeaf) ||
        (properties["isleaf"] === "false" && isLeaf)
      ) {
        console.log(
          `Leaf status mismatch. Expected: ${properties["isleaf"]}, Found: ${isLeaf}`
        );
        return false;
      }
    }
  }

  // Validate Parent Class (if the element wasn't identified by it)
  if (identifiedBy !== "parentClass" && properties["parentClass"]) {
    if (properties["parentClass"]) {
      const parentElement = element.parentElement;
      if (
        !parentElement ||
        !parentElement.classList.contains(properties["parentClass"])
      ) {
        console.error(
          `Parent class mismatch. Expected: ${
            properties["parentClass"]
          }, Found: ${parentElement ? parentElement.className : "no parent"}`
        );
        return false;
      }
    }
  }

  console.log("All properties validated successfully.");
  return true;
}

function highlightPath(path) {
  const properties = extractWebCtrlProperties(path);

  // Attempt to validate the element based on the extracted properties
  const element = validateWebCtrlElement(properties);

  console.log("ELEMENT:", element);

  if (element.element && element.crossResult) {
    // Highlight the element
    element.element.style.backgroundColor = "yellow";
  }
  return true;
}
// // Main function to validate all the webctrl paths
// function validatePaths(webctrlPaths) {
//   for (let i = 1; i < webctrlPaths.length; i++) {
//     const webctrlPath = webctrlPaths[i];

//     // Validate the current webctrl path
//     const result = validateWebCtrlPath(webctrlPath);

//     // If we can't find the element, return failure
//     if (!result) {
//       return false;
//     }
//   }

//   // If we validated all the steps, return success
//   console.log("All webctrl paths validated successfully");
//   return true;
// }

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "validate-xpath") {
    const result = validateWebCtrlPaths(message.data);
    if (result !== undefined) {
      chrome.runtime.sendMessage({
        action: "validation-result",
        result: result,
      });
    }
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "highlight-xpath") {
    const result = highlightPath(message.data);
    if (result !== undefined) {
      console.log("Highlighted path.");
    }
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "start-selection") {
    console.log("recieved action message of selection");
    activateSelectionMode();
  }
});
