import type { ToolcraftCommand } from "@/toolcraft/runtime";

import { CONTOUR_TARGETS, PEAK_PRESETS } from "./contour-settings";

type ActionContext = { action: { value: string }; dispatch: (command: ToolcraftCommand) => void };

export function handleContourAction({ action, dispatch }: ActionContext): void {
  const peak = PEAK_PRESETS.find((preset) => preset.value === action.value);
  if (!peak) return;
  dispatch({ label: peak.label, target: CONTOUR_TARGETS.latitude, type: "controls.setValue", value: peak.latitude });
  dispatch({ label: peak.label, target: CONTOUR_TARGETS.longitude, type: "controls.setValue", value: peak.longitude });
  dispatch({ label: peak.label, target: CONTOUR_TARGETS.area, type: "controls.setValue", value: peak.area });
  dispatch({ label: peak.label, target: CONTOUR_TARGETS.interval, type: "controls.setValue", value: peak.interval });
}
