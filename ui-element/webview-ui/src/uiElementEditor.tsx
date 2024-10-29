import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "./components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import vscode from "./acquireVSCode";
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
  data: UIElementData;
  selectedXPaths: string[];
  selectedProperties: { [xpath: string]: { [property: string]: boolean } };
  generatedXPath: string;
  validationStatus: "valid" | "invalid" | "changed";
}
// interface initialData {
//   elements: [{xpath: string, properties: [{name: string, value: string}]}]
// }
interface UIElementEditorProps {
  newData: UIElementData | null; // The data being passed from App.tsx
}
interface MessageData {
  type: string;
  data?: UIElementData | UIElementData[];
  uri?: string;
  result?: boolean;
}
const UIElementEditor: React.FC<UIElementEditorProps> = ({ newData }) => {
  const [data, setData] = useState<UIElementData>({
    name: "",
    element: [],
    generatedXPathHtml: "",
  });
  // const [elementName, setElementName] = useState("");
  const [selectedXPaths, setSelectedXPaths] = useState<string[]>([]);
  const [clickedXPath, setClickedXPath] = useState<string>("");
  const [selectedProperties, setSelectedProperties] = useState<{
    [xpath: string]: { [property: string]: boolean };
  }>({});
  const [generatedXPath, setGeneratedXPath] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [validationStatus, setValidationStatus] = useState<
    "valid" | "invalid" | "changed"
  >("changed");
  useEffect(() => {
    const savedState = vscode.getState() as SavedState | null;
    if (savedState) {
      setData(savedState.data);
      setSelectedXPaths(savedState.selectedXPaths);
      setSelectedProperties(savedState.selectedProperties);
      setGeneratedXPath(savedState.generatedXPath);
      setValidationStatus(savedState.validationStatus);
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (newData) {
      console.log("Message Data:", newData);
      setData(newData);
      initializeState(newData);
    }
    // Listen for messages from the VSCode extension
    //   const message = event.data;
    //   if (message.type === "update" && message.data) {
    //     console.log("Message Data:", message.data);
    //     setData(message.data); // Set data dynamically
    //     initializeState(message.data);
    //   }
  }, [newData]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<MessageData>) => {
      const { type, result } = event.data;
      if (type === "validationResult") {
        console.log("inside ui element editor validation result.");
        setValidationStatus(result ? "valid" : "invalid");
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const initializeState = (newData: UIElementData) => {
    const initialSelectedXPaths = newData.element
      .filter((el) => el.selected)
      .map((el) => el.xpath);
    // Always include root and element XPaths
    const rootXPath = newData.element[0]?.xpath;
    const elementXPath = newData.element[newData.element.length - 1]?.xpath;
    const defaultXPaths = [rootXPath, elementXPath].filter(Boolean);

    const finalSelectedXPaths = Array.from(
      new Set([...initialSelectedXPaths, ...defaultXPaths])
    );
    setSelectedXPaths(finalSelectedXPaths);

    const initialSelectedProperties: {
      [xpath: string]: { [property: string]: boolean };
    } = {};
    // Pre select those properties which are included in the xpath
    newData.element
      .filter((el) => el) // Ensure there is an element to process
      .forEach((el) => {
        let match;

        // Initialize the entry for this element in initialSelectedProperties
        initialSelectedProperties[el.xpath] = {};

        // Regex to extract property and value from the xpath string
        const regex = /([\w-]+)='([^']*)'/g;

        // Create a set of properties present in the xpath
        const propertiesInXpath = new Set<string>();

        while ((match = regex.exec(el.xpath)) !== null) {
          const property = match[1]; // e.g., 'app', 'title', 'url'
          propertiesInXpath.add(property);
        }

        // Iterate over the element's properties and set the initial 'selected' state
        el.properties.forEach((propertyObj) => {
          // If the property exists in the xpath, mark it as selected (true), otherwise false
          initialSelectedProperties[el.xpath][propertyObj.name] =
            propertiesInXpath.has(propertyObj.name);
        });
      });
    console.log("selectedXpaths::", selectedXPaths);
    setSelectedProperties(initialSelectedProperties);
    const initialGeneratedXPath = newData.element
      .filter((el) => el.selected)
      .map(
        (el) =>
          el.generatedXPath ||
          generateXPathString(el, initialSelectedProperties[el.xpath])
      )
      .join("\n");
    setGeneratedXPath(initialGeneratedXPath);
    setIsInitialized(true);
  };

  const handleXPathSelect = (xpath: string) => {
    setSelectedXPaths((prev) => {
      if (prev.includes(xpath)) {
        // Don't allow deselection of root and element XPaths
        if (
          xpath === data.element[0]?.xpath ||
          xpath === data.element[data.element.length - 1]?.xpath
        ) {
          return prev;
        }
        return prev.filter((x) => x !== xpath);
      } else {
        const newSelected = [...prev];
        const index = data.element.findIndex((el) => el.xpath === xpath);
        let insertIndex = 0;
        while (
          insertIndex < newSelected.length &&
          data.element.findIndex(
            (el) => el.xpath === newSelected[insertIndex]
          ) < index
        ) {
          insertIndex++;
        }
        newSelected.splice(insertIndex, 0, xpath);
        return newSelected;
      }
    });
    setValidationStatus("changed");
  };

  useEffect(() => {
    if (isInitialized) {
      vscode.setState({
        data,
        selectedXPaths,
        selectedProperties,
        generatedXPath,
        validationStatus,
      });
    }
  }, [
    data,
    selectedXPaths,
    selectedProperties,
    generatedXPath,
    isInitialized,
    validationStatus,
  ]);
  const handleXPathClick = (xpath: string) => {
    setClickedXPath(xpath); // Set the clicked XPath for property display
  };

  const handlePropertyToggle = (propertyName: string) => {
    if (clickedXPath) {
      setSelectedProperties((prev) => ({
        ...prev,
        [clickedXPath]: {
          ...prev[clickedXPath],
          [propertyName]: !prev[clickedXPath]?.[propertyName],
        },
      }));
    }
    setValidationStatus("changed");
  };

  const handleValidate = () => {
    const xpaths = selectedXPaths
      .map((xpath) => {
        const element = data.element.find((el) => el.xpath === xpath);
        return element
          ? generateXPathString(element, selectedProperties[xpath])
          : "";
      })
      .filter(Boolean);

    vscode.postMessage({
      type: "validate",
      xpaths: xpaths,
    });
  };

  const handleHighlight = () => {
    const firstAndLastXPath: string[] = [];

    firstAndLastXPath.push(selectedXPaths[0]);
    firstAndLastXPath.push(selectedXPaths[selectedXPaths.length - 1]);

    // If no XPath is selected, do nothing
    if (!firstAndLastXPath) {
      return;
    }

    // Find the corresponding element based on the first and last selected XPath
    const xpaths = firstAndLastXPath
      .map((xpath) => {
        const element = data.element.find((el) => el.xpath === xpath);
        return element
          ? generateXPathString(element, selectedProperties[xpath])
          : "";
      })
      .filter(Boolean);

    const url = data.element[0].properties.find(
      (prop) => prop.name === "url"
    )?.value;
    // also add the url property in the tab xpath so before: "<html app='chrome.exe' title='Google'/>", after "<html app='chrome.exe' title='Google' url='https://www.google.com'/>",
    const tabPath = data.element[0].xpath.replace(/\/>$/, ` url='${url}'/>`);

    // replace the first xpath with tab path
    xpaths[0] = tabPath;
    // If a valid XPath is found, send it to VSCode for highlighting
    if (xpaths) {
      console.log("xpaths before sending:", xpaths);
      vscode.postMessage({
        type: "highlight",
        xpath: xpaths,
      });
    }
  };

  const escapeHtml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  const generateXPathString = (
    element: Element,
    properties: { [property: string]: boolean }
  ) => {
    const baseXPath = element.xpath.substring(
      0,
      element.xpath.lastIndexOf("/>")
    );
    const existingProps: string[] = baseXPath.match(/(\w+)='([^']*)'/g) || [];

    const selectedProps = element.properties
      .filter((prop) => properties[prop.name])
      .map((prop) => `${prop.name}='${escapeHtml(prop.value)}'`);

    const finalProps = existingProps
      .filter((prop) => {
        const [name] = prop.split("=");
        return properties[name];
      })
      .concat(selectedProps.filter((prop) => !existingProps.includes(prop)));

    return `${baseXPath.split(" ")[0]} ${finalProps.join(" ")}/>`.trim();
  };

  useEffect(() => {
    if (isInitialized) {
      const newGeneratedXPath = selectedXPaths
        .map((xpath) => {
          const element = data.element.find((el) => el.xpath === xpath);
          return element
            ? generateXPathString(element, selectedProperties[xpath])
            : "";
        })
        .filter(Boolean)
        .join("\n");
      setGeneratedXPath(newGeneratedXPath);
    }
  }, [selectedXPaths, selectedProperties, data.element, isInitialized]);

  const handleSave = () => {
    // Here you would implement the logic to save the .uie file

    const updatedElements = data.element.map((el) => {
      const isSelected = selectedXPaths.includes(el.xpath);
      const updatedProperties = el.properties.map((prop) => ({
        ...prop,
        selected: selectedProperties[el.xpath]?.[prop.name] ?? false,
      }));

      return {
        ...el,
        selected: isSelected,
        properties: updatedProperties,
        generatedXPath: isSelected
          ? generateXPathString(el, selectedProperties[el.xpath])
          : undefined,
      };
    });

    const updatedData: UIElementData = {
      name: data.name,
      element: updatedElements,
      generatedXPathHtml: generatedXPath.replace(/\n/g, "<br>"),
    };

    try {
      // Send updated data back to the VSCode extension for saving
      vscode.postMessage({
        type: "edited",
        data: updatedData, // Send the updated element data
      });
      console.log("Saved data:", updatedData);
    } catch (error) {
      console.error("Error sending message to VSCode:", error);
    }

    setData(updatedData);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Edit UI Element</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Pick elements from web and generate automation script...
      </p>

      <div className="mb-4">
        <Label htmlFor="elementName">Name</Label>
        <div className="flex items-center space-x-2">
          <Input
            id="elementName"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            className="flex-grow"
          />
          <Button
            variant="outline"
            onClick={handleValidate}
            className={`
              ${
                !validationStatus
                  ? -"bg-primary text-primary-foreground hover:bg-primary/90"
                  : ""
              }
              ${validationStatus === "valid" ? "bg-green-500 text-white" : ""}
              ${validationStatus === "invalid" ? "bg-red-500 text-white" : ""}
              ${
                validationStatus === "changed" ? "bg-yellow-500 text-black" : ""
              }
            `}
          >
            Validate
          </Button>
          <Button onClick={handleHighlight} variant="outline">
            Highlight
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <Label>HTML Code</Label>
          <ScrollArea className="h-[300px] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>XPath</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.element.map((element, index) => (
                  <TableRow
                    key={index}
                    className={clickedXPath === element.xpath ? "bg-muted" : ""}
                    onClick={() => handleXPathClick(element.xpath)} // Display properties when clicked
                  >
                    <TableCell className="font-medium">
                      <Checkbox
                        checked={selectedXPaths.includes(element.xpath)}
                        onCheckedChange={() => {
                          if (
                            element.xpath !== data.element[0].xpath &&
                            element.xpath !==
                              data.element[data.element.length - 1].xpath
                          ) {
                            handleXPathSelect(element.xpath);
                          }
                        }}
                        disabled={
                          element.xpath === data.element[0].xpath ||
                          element.xpath ===
                            data.element[data.element.length - 1].xpath
                        } // Disable root and last xpaths
                      />
                    </TableCell>
                    <TableCell
                      dangerouslySetInnerHTML={{
                        __html: escapeHtml(element.xpath),
                      }}
                    ></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
        <div>
          <Label>Properties</Label>
          <ScrollArea className="h-[300px] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.element
                  .find((el) => el.xpath === clickedXPath)
                  ?.properties.map((property, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        <Checkbox
                          checked={
                            selectedProperties[clickedXPath]?.[property.name] ??
                            false
                          } // Check for the clickedXPath and its property
                          onCheckedChange={() =>
                            handlePropertyToggle(property.name)
                          }
                        />
                      </TableCell>
                      <TableCell>{property.name}</TableCell>
                      <TableCell>{property.value}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>

      <div className="mt-6">
        <Label htmlFor="generatedXPath">Generated XPath</Label>
        <Textarea
          id="generatedXPath"
          value={generatedXPath}
          readOnly
          className="font-mono"
          rows={Math.max(3, generatedXPath.split("\n").length)} // Dynamic row size based on number of lines
        />
      </div>

      <div className="mt-6 flex justify-end space-x-2">
        <Button variant="outline">Back</Button>
        <Button onClick={handleSave}>Add</Button>
      </div>
    </div>
  );
};

export default UIElementEditor;
