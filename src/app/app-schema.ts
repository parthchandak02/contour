import { defineToolcraft, imageExportModule } from "@/toolcraft/runtime";

import { backgroundControls, mapControls, placeControls } from "../contour/contour-controls";
import appDefaults from "./app-defaults.json" with { type: "json" };
import { appIdentity } from "./app-identity";

export const appSchema = defineToolcraft({
  base: {
    canvas: { draggable: true, enabled: true, renderScale: true, size: { height: 1080, unit: "px", width: 1920 }, sizing: { mode: "editable-output" }, upload: false },
    identity: appIdentity,
    panels: {
      controls: {
        sections: [
          { controls: backgroundControls, id: "runtime.setup", title: "Settings" },
          { controls: placeControls, id: "place", title: "Place" },
          { controls: mapControls, id: "map", title: "Map" },
        ],
        title: "Contour",
      },
    },
    toolbar: { history: true, radar: true, theme: true, zoom: true },
  },
  defaults: appDefaults,
  modules: [imageExportModule()],
});
