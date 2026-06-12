/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import rawSchedule from "./data/MRTSchedule.json";
import { ScheduleItem, DayType } from "./types";

export const STATIONS = [
  "Lebak Bulus",
  "Fatmawati",
  "Cipete Raya",
  "Haji Nawi",
  "Blok A",
  "Blok M",
  "ASEAN Headquarter",
  "Senayan Mastercard",
  "Istora Mandiri",
  "Bendungan Hilir",
  "Setiabudi Astra",
  "Dukuh Atas BNI",
  "Bundaran HI"
];

// Interval between stations is exactly 2.5 minutes (150 seconds)
export const STATION_INTERVAL_SECONDS = 150;

/**
 * Convert time string "HH:mm" or "HH:mm:ss" to seconds of the day
 */
export function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  const s = parseInt(parts[2] || "0", 10);
  return h * 3600 + m * 60 + s;
}

/**
 * Format seconds of the day back to time string
 */
export function secondsToTimeStr(seconds: number, includeSeconds = true): string {
  const normalized = (seconds + 86400 * 2) % 86400; // clamp to 24h safety
  const h = Math.floor(normalized / 3600);
  const m = Math.floor((normalized % 3600) / 60);
  const s = normalized % 60;
  
  const pad = (n: number) => String(n).padStart(2, "0");
  if (includeSeconds) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(h)}:${pad(m)}`;
}

/**
 * Calculate the fare between two stations
 * Base Rp 3.000, +Rp 1.000 per station, capped at Rp 14.000
 */
export function calculateFare(origin: string, destination: string): number {
  const oIdx = STATIONS.indexOf(origin);
  const dIdx = STATIONS.indexOf(destination);
  if (oIdx === -1 || dIdx === -1) return 0;
  const distance = Math.abs(oIdx - dIdx);
  if (distance === 0) return 0;
  return Math.min(14000, 3000 + distance * 1000);
}

/**
 * Calculate travel duration in minutes based on 2.5 minutes per station pacing
 */
export function calculateDurationMinutes(origin: string, destination: string): number {
  const oIdx = STATIONS.indexOf(origin);
  const dIdx = STATIONS.indexOf(destination);
  if (oIdx === -1 || dIdx === -1) return 0;
  return Math.abs(oIdx - dIdx) * 2.5;
}

/**
 * Generate full sequence schedule departures for any station
 * based on the base terminuses (Lebak Bulus or Bundaran HI) schedules in rawSchedule
 */
export function getStationDepartures(
  stationName: string,
  direction: string,
  dayType: DayType
): { timeStr: string; seconds: number }[] {
  const stationIndex = STATIONS.indexOf(stationName);
  if (stationIndex === -1) return [];

  // Determine which terminus is the origin of this direction
  let baseStation = "Lebak Bulus";
  let offsetFactor = 0;

  if (direction === "Bundaran HI") {
    // Train starts from Lebak Bulus (index 0) and moves towards Bundaran HI (index 12)
    baseStation = "Lebak Bulus";
    offsetFactor = stationIndex; // distance from Lebak Bulus
  } else if (direction === "Lebak Bulus") {
    // Train starts from Bundaran HI (index 12) and moves towards Lebak Bulus (index 0)
    baseStation = "Bundaran HI";
    offsetFactor = STATIONS.length - 1 - stationIndex; // distance from Bundaran HI
  } else {
    return [];
  }

  // Find the base departures for the starting terminus
  const baseItem = (rawSchedule as ScheduleItem[]).find(
    (item) =>
      (item.station_name === baseStation || item.station_name.startsWith(baseStation)) &&
      item.direction === direction &&
      item.day_type === dayType
  );

  if (!baseItem) {
    // Fallback if not found (e.g., generate mock schedules to make it foolproof)
    const fallbackDepartures: string[] = [];
    const interval = dayType === "WEEKDAY" ? 12 : 20;
    for (let h = 5; h <= 23; h++) {
      for (let m = 0; m < 60; m += interval) {
        fallbackDepartures.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return fallbackDepartures.map((timeStr) => {
      const baseSec = timeToSeconds(timeStr);
      const shiftedSec = baseSec + offsetFactor * STATION_INTERVAL_SECONDS;
      return {
        timeStr: secondsToTimeStr(shiftedSec, false),
        seconds: shiftedSec
      };
    });
  }

  // Map and shift departure times by station offsets
  return baseItem.departure_times
    .map((timeStr) => {
      const baseSec = timeToSeconds(timeStr);
      const shiftedSec = baseSec + offsetFactor * STATION_INTERVAL_SECONDS;
      return {
        timeStr: secondsToTimeStr(shiftedSec, false),
        seconds: shiftedSec
      };
    })
    .sort((a, b) => a.seconds - b.seconds);
}

/**
 * Get Indonesian day name
 */
export function getIndonesianDayName(dayIndex: number): string {
  const days = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu"
  ];
  return days[dayIndex] || "Senin";
}
