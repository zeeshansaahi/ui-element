import { useEffect, useState } from "react";
import UIElementEditor from "./uiElementEditor";
import UIElements from "./uiElementAdd";
import "./index.css";

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

interface MessageData {
  type: string;
  data?: UIElementData | UIElementData[];
  uri?: string;
  result?: boolean;
}

const App = () => {
  const [messageType, setMessageType] = useState<string | null>(null);
  const [data, setData] = useState<UIElementData | null>(null);
  const [arrayData, setArrayData] = useState<UIElementData[]>([]);
  const [fileUri, setFileUri] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<MessageData>) => {
      const { type, data, uri, result } = event.data;

      // Basic validation for incoming messages
      if (!type) {
        console.error("Invalid message format:", event.data);
        return;
      }
      console.log("type:", type, "data:", data, "uri:", uri, "result:", result);
      setMessageType(type);
      setFileUri(uri || "");

      if (type === "home" && Array.isArray(data)) {
        setArrayData(data);
        setData(null);
      } else if (type === "edit" && !Array.isArray(data) && data) {
        setData(data);
        setArrayData([]);
      } else {
        console.error(
          "Unrecognized message type or data structure:",
          type,
          data
        );
      }

      // Finish loading after message is processed
      setIsLoading(false);
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Prevents rendering until data is fully set
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Conditional rendering based on the current message type
  return (
    <div>
      {data && messageType === "edit" ? (
        <UIElementEditor newData={data} />
      ) : (
        <UIElements data={arrayData} fileUri={fileUri} />
      )}
    </div>
  );
};

export default App;
