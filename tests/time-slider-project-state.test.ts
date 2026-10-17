import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { TimeSliderControl } from "maplibre-gl-time-slider";
import { maplibreTimeSliderPlugin } from "../packages/plugins/src/plugins/maplibre-time-slider";
import type { GeoLibreAppAPI } from "../packages/plugins/src/types";

const app = {} as GeoLibreAppAPI;
const validConfig = {
  startDate: "2024-02-29",
  endDate: "2024-03-01",
  currentDate: "2024-02-29",
  granularity: "day",
  sources: [],
};

describe("time slider project state", () => {
  beforeEach(() => {
    maplibreTimeSliderPlugin.applyProjectState?.(app, null);
  });

  it("rejects invalid start, end, and current dates through the existing reset path", () => {
    for (const patch of [
      { startDate: "not-a-date" },
      { startDate: "" },
      { startDate: "2024-02-30" },
      { endDate: "2024-13-01" },
      { endDate: "2023-02-29T12:00:00Z" },
      { currentDate: "not-a-date" },
      { currentDate: "2024-02-30T00:00:00+02:00" },
    ]) {
      assert.equal(
        maplibreTimeSliderPlugin.applyProjectState?.(app, {
          ...validConfig,
          ...patch,
        }),
        false,
      );
      assert.equal(maplibreTimeSliderPlugin.getProjectState?.(), undefined);
    }
  });

  it("rejects a range whose end precedes its start", () => {
    for (const range of [
      { startDate: "2024-03-01", endDate: "2024-02-29" },
      {
        startDate: "2024-03-01T01:00:00+01:00",
        endDate: "2024-02-29T23:59:59Z",
      },
    ]) {
      assert.equal(
        maplibreTimeSliderPlugin.applyProjectState?.(app, {
          ...validConfig,
          ...range,
        }),
        false,
      );
      assert.equal(maplibreTimeSliderPlugin.getProjectState?.(), undefined);
    }
  });

  it("preserves inclusive ranges, all granularities, and optional or out-of-range current dates", () => {
    for (const granularity of ["hour", "day", "month", "year"]) {
      for (const currentDate of [undefined, "2025-01-01"]) {
        const state = {
          ...validConfig,
          startDate: "2024-02-29T23:00:00+01:00",
          endDate: "2024-02-29T22:00:00.000Z",
          granularity,
          ...(currentDate === undefined ? {} : { currentDate }),
        };
        assert.equal(maplibreTimeSliderPlugin.applyProjectState?.(app, state), true);
        assert.deepEqual(maplibreTimeSliderPlugin.getProjectState?.(), state);
      }
    }
  });

  it("round-trips a valid project setting through JSON", () => {
    assert.equal(maplibreTimeSliderPlugin.applyProjectState?.(app, validConfig), true);
    const saved = JSON.parse(
      JSON.stringify(maplibreTimeSliderPlugin.getProjectState?.()),
    ) as unknown;
    maplibreTimeSliderPlugin.applyProjectState?.(app, null);
    assert.equal(maplibreTimeSliderPlugin.applyProjectState?.(app, saved), true);
    assert.deepEqual(maplibreTimeSliderPlugin.getProjectState?.(), validConfig);
  });

  it("clamps an active control and rebuilds its empty timeline after an invalid restore", () => {
    let control: TimeSliderControl | undefined;
    const liveApp = {
      addMapControl: (next: TimeSliderControl) => {
        control = next;
        return true;
      },
      removeMapControl: () => undefined,
    } as unknown as GeoLibreAppAPI;
    const state = {
      ...validConfig,
      currentDate: "2025-01-01",
      interval: 1,
      granularities: ["day"],
      speed: 800,
      loop: true,
      autoPlay: false,
      collapsed: false,
      theme: "light",
    };

    try {
      const { currentDate: _omitted, ...withoutCurrentDate } = state;
      assert.equal(
        maplibreTimeSliderPlugin.applyProjectState?.(liveApp, withoutCurrentDate),
        true,
      );
      maplibreTimeSliderPlugin.activate(liveApp);
      const firstControl = control;
      assert.ok(firstControl);
      assert.equal(firstControl.getConfig().currentDate, "2024-02-29T00:00:00.000Z");

      assert.equal(maplibreTimeSliderPlugin.applyProjectState?.(liveApp, state), true);
      assert.equal(firstControl.getConfig().currentDate, "2024-03-01T00:00:00.000Z");

      assert.equal(
        maplibreTimeSliderPlugin.applyProjectState?.(liveApp, {
          ...state,
          endDate: "2024-02-30",
        }),
        true,
      );
      assert.notEqual(control, firstControl);
      assert.equal(control?.getConfig().startDate, "1984-01-01T00:00:00.000Z");
      assert.deepEqual(control?.getSources(), []);
    } finally {
      maplibreTimeSliderPlugin.deactivate(liveApp);
      maplibreTimeSliderPlugin.applyProjectState?.(liveApp, null);
    }
  });
});
