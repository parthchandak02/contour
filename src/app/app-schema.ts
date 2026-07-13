import { defineToolcraft } from "@/toolcraft/runtime";

export const appSchema = defineToolcraft({
  canvas: {
    enabled: true,
    upload: false,
    sizing: {
      mode: "editable-output",
    },
    draggable: false,
  },
  panels: {
    controls: {
      sections: [
        {
          title: "Brush",
          controls: {
            strokeWidth: {
              type: "slider",
              target: "strokeWidth",
              label: "Stroke width",
              defaultValue: 3,
              min: 1,
              max: 8,
              step: 0.5,
            },
            contourSpacing: {
              type: "slider",
              target: "contourSpacing",
              label: "Contour spacing",
              defaultValue: 14,
              min: 8,
              max: 24,
              step: 1,
            },
          },
        },
        {
          title: "Terrain",
          controls: {
            elevationScale: {
              type: "slider",
              target: "elevationScale",
              label: "Elevation scale",
              defaultValue: 1.0,
              min: 0.3,
              max: 2.0,
              step: 0.1,
            },
            roughness: {
              type: "slider",
              target: "roughness",
              label: "Roughness",
              defaultValue: 0.4,
              min: 0,
              max: 1,
              step: 0.05,
            },
            windEffect: {
              type: "toggle",
              target: "windEffect",
              label: "Wind affects terrain",
              defaultValue: true,
            },
          },
        },
        {
          title: "Palette",
          controls: {
            colorScheme: {
              type: "segmented",
              target: "colorScheme",
              label: "Color scheme",
              defaultValue: "midnight",
              options: [
                { value: "midnight", label: "Midnight" },
                { value: "ember", label: "Ember" },
                { value: "void", label: "Void" },
              ],
            },
          },
        },
        {
          title: "Actions",
          controls: {
            clearCanvas: {
              type: "button",
              target: "clearCanvas",
              label: "Clear all contours",
            },
          },
        },
      ],
      title: "Contour",
    },
  },
  toolbar: {
    history: false,
    radar: false,
    zoom: false,
  },
});
