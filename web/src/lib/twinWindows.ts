import data from "../../data/test-window-twins.json";
import type { Windows } from "./testWindow";

/** The 21 published twins' test windows (results/test_window/twins_v1.json; W1 and W2 passed). */
export const TWIN_WINDOWS = data as unknown as Record<string, Windows>;
