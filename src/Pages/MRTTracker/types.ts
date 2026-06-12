/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ScheduleItem {
  station_name: string;
  direction: string; // "Bundaran HI" or "Lebak Bulus"
  day_type: "WEEKDAY" | "WEEKEND";
  departure_times: string[]; // array of "HH:mm" or "HH:mm:ss"
}

export interface RouteState {
  origin: string;
  destination: string;
  isActive: boolean;
}

export type DayType = "WEEKDAY" | "WEEKEND";

export interface TrackingDetail {
  nextDepartureTime: string; // HH:mm:ss
  departureSeconds: number; // seconds of day
  remainingSeconds: number;
  statusText: string;
  statusCode: "WAITING" | "BOARDING" | "DEPARTED" | "STANDBY" | "TERMINATED";
}
