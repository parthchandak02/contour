import { useRef, useCallback } from "react";
import { ToolcraftApp } from "@/toolcraft/runtime/react";
import type { ToolcraftPanelActionHandler } from "@/toolcraft/runtime/react";

import { appSchema } from "../app/app-schema";
import { ContourCanvas } from "../app/ContourCanvas";

export function AppHome(): React.JSX.Element {
  const clearRef = useRef<(() => void) | null>(null);

  const handlePanelAction: ToolcraftPanelActionHandler = useCallback((context) => {
    if (context.action.value === "clearCanvas" && clearRef.current) {
      clearRef.current();
    }
  }, []);

  return (
    <ToolcraftApp
      className="h-dvh min-h-dvh"
      schema={appSchema}
      canvasContent={<ContourCanvas clearRef={clearRef} />}
      onPanelAction={handlePanelAction}
      renderDefaultCanvasMedia={false}
    />
  );
}
