import {
  Search,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  Copy,
  Trash2,
  MousePointerClick,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import vscode from "./acquireVSCode";
import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
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
interface modifiedData {
  data: UIElementData[];
  fileUri: string;
}

const UIElements: React.FC<modifiedData> = ({ data, fileUri }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(data.length / itemsPerPage);

  // Get elements for the current page
  const currentData = data.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleAddElement = (option: string, uri: string) => {
    if (option === "Browser DOM") {
      vscode.postMessage({
        type: "addMoreElement",
        option: "Browser DOM",
        uri: uri,
      });
    }
  };

  const handleHighlight = (elementData: UIElementData) => {
    const firstAndLastXPath: string[] = [];
    const generatedPaths = elementData.generatedXPathHtml;
    const generatedPathsArray = generatedPaths.match(/<(?!br\b)[^>]+\/>/g);
    console.log("GeneratedPaths:", generatedPathsArray);
    const firstPath = generatedPathsArray?.[0] ?? "";
    console.log("first path:", firstPath);
    const lastPath =
      generatedPathsArray?.[generatedPathsArray.length - 1] ?? "";
    console.log("last path:", lastPath);
    firstAndLastXPath.push(firstPath);
    firstAndLastXPath.push(lastPath);

    // If no XPath is selected, do nothing
    if (!firstAndLastXPath) {
      return;
    }
    const url = elementData.element[0].properties.find(
      (prop: { name: string }) => prop.name === "url"
    )?.value;
    console.log("URL:", url);
    // also add the url property in the tab xpath so before: "<html app='chrome.exe' title='Google'/>", after "<html app='chrome.exe' title='Google' url='https://www.google.com'/>",
    firstAndLastXPath[0] = firstAndLastXPath[0].replace(
      /\/>$/,
      ` url='${url}'/>`
    );
    // If a valid XPath is found, send it to VSCode for highlighting
    if (firstAndLastXPath) {
      console.log("xpaths before sending:", firstAndLastXPath);
      vscode.postMessage({
        type: "highlight",
        xpath: firstAndLastXPath, // Send only the last XPath
      });
    }
  };
  const handleAction = (
    action: string,
    elementData: UIElementData,
    index: number
  ) => {
    const dataToHighlight = handleHighlight(elementData);
    switch (action) {
      case "view":
        // Send element data to the edit screen
        vscode.postMessage({
          type: "editElement",
          data: elementData,
          index: index,
          uri: fileUri,
        });
        break;
      case "highlight":
        // Implement highlighting functionality if needed
        vscode.postMessage({
          type: "highlight",
          xpath: dataToHighlight,
        });
        break;
      case "duplicate":
        // Duplicate logic here
        vscode.postMessage({
          type: "duplicateElement",
          data: elementData,
          uri: fileUri,
        });
        break;
      case "remove":
        // Remove logic here
        vscode.postMessage({
          type: "removeElement",
          index: index,
          uri: fileUri,
        });
        break;
      default:
        break;
    }
  };
  return (
    <div className="flex flex-col min-h-screen w-full bg-[#1e1e1e] text-[#cccccc] overflow-hidden">
      <div className="flex-grow p-6 w-full">
        <h1 className="text-2xl font-semibold mb-2">UI Elements</h1>
        <p className="text-sm text-[#8c8c8c] mb-6">
          Pick elements from web and generate automation script...
        </p>

        <div className="flex justify-between items-center mb-6">
          <div className="relative flex-grow mr-4">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8c8c8c]"
              size={18}
            />
            <Input
              type="text"
              placeholder="Search element..."
              className="pl-10 w-full bg-[#3c3c3c] border-[#3c3c3c] text-[#cccccc] placeholder-[#8c8c8c]"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-[#0e639c] hover:bg-[#1177bb] text-white">
                Add Element
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuItem
                onClick={() => handleAddElement("Browser DOM", fileUri)}
              >
                Browser DOM
              </DropdownMenuItem>
              <DropdownMenuItem disabled>Desktop</DropdownMenuItem>
              <DropdownMenuItem disabled>
                Accessibility Insights
              </DropdownMenuItem>
              <DropdownMenuItem disabled>JAB</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#3c3c3c]">
              <TableHead className="text-[#8c8c8c]">Name</TableHead>
              <TableHead className="text-[#8c8c8c]">xPath</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentData.map((elementData, index) => (
              <TableRow key={index} className="border-b border-[#3c3c3c]">
                <TableCell>
                  {elementData.name ? elementData.name : ""}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {elementData.generatedXPathHtml || "N/A"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-32">
                      <DropdownMenuItem
                        onClick={() => handleAction("view", elementData, index)}
                      >
                        <Eye className="mr-2 h-4 w-4" /> View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleAction("highlight", elementData, index)
                        }
                      >
                        <MousePointerClick className="mr-2 h-4 w-4" /> Highlight
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleAction("duplicate", elementData, index)
                        }
                      >
                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleAction("remove", elementData, index)
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between mt-4 text-sm text-[#8c8c8c]">
          <span>{`${(currentPage - 1) * itemsPerPage + 1}-${Math.min(
            currentPage * itemsPerPage,
            data.length
          )} of ${data.length} items`}</span>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="mx-2">{`${currentPage} / ${totalPages}`}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UIElements;
