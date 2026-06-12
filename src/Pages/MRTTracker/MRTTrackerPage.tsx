/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import "C:\Users\jenme\MEGAHSOLUTION\src\Pages\MRTTracker\MRTTrackerPage.tsx";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Train,
  Clock,
  ArrowRight,
  ArrowLeftRight,
  Navigation,
  Bell,
  BellRing,
  AlertTriangle,
  ChevronRight,
  Volume2,
  VolumeX,
  Volume,
  Info,
  Calendar,
  Settings,
  X,
  MapPin,
  Map,
  DollarSign,
  AlertCircle,
  HelpCircle
} from "lucide-react";
import {
  STATIONS,
  calculateFare,
  calculateDurationMinutes,
  getStationDepartures,
  getIndonesianDayName,
  timeToSeconds,
  secondsToTimeStr,
  STATION_INTERVAL_SECONDS
} from "./utils";
import { RouteState, DayType } from "./types";

export default function App() {
  // --- STATE SYSTEM ---
  const [route, setRoute] = useState<RouteState>({
    origin: "",
    destination: "",
    isActive: true
  });

  const dropdownStations = [...STATIONS].reverse();

  // Time & Simulation system
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedSeconds, setSimulatedSeconds] = useState<number>(0); // seconds of day
  const [simulatedDayType, setSimulatedDayType] = useState<DayType>("WEEKDAY");
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1); // seconds per real second
  
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  // Audio Context reference for cyber alert beep if user clicks (optional nice touch)
  const audioContextRef = useRef<AudioContext | null>(null);

  // Sync state values
  const currentDayIndex = currentTime.getDay(); // 0 is Sunday, 6 is Saturday
  const actualDayType: DayType = (currentDayIndex === 0 || currentDayIndex === 6) ? "WEEKEND" : "WEEKDAY";
  const activeDayType = isSimulating ? simulatedDayType : actualDayType;

  // Calculate current seconds of day
  const currentSecondsOfDay = isSimulating
    ? simulatedSeconds
    : currentTime.getHours() * 3600 + currentTime.getMinutes() * 60 + currentTime.getSeconds();

  // Handle live ticking clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      if (isSimulating) {
        setSimulatedSeconds((prev) => {
          const next = prev + simulationSpeed;
          return next >= 86400 ? 0 : next; // Reset at midnight
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isSimulating, simulationSpeed]);

  // Sync simulated seconds when user switches simulation mode on
  const handleToggleSimulation = () => {
    if (!isSimulating) {
      // Seed simulation state with real-world time
      const now = new Date();
      let secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      // If outside operation hours (05:00 to 23:59), default to 07:30 so trains are immediately visible
      if (secs < 18000 || secs > 86399) {
        secs = 27000;
      }
      setSimulatedSeconds(secs);
      setSimulatedDayType(actualDayType);
    }
    setIsSimulating(!isSimulating);
  };

  // Sound triggering utility
  const playBeep = (freq = 880, duration = 0.1) => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Ignored if browser rules block audio
    }
  };

  // Determine transit details
  const originIndex = STATIONS.indexOf(route.origin);
  const destinationIndex = STATIONS.indexOf(route.destination);
  const direction = originIndex < destinationIndex ? "Bundaran HI" : "Lebak Bulus";
  const stationsCount = Math.abs(originIndex - destinationIndex);
  const totalDuration = calculateDurationMinutes(route.origin, route.destination);
  const totalFare = calculateFare(route.origin, route.destination);

  // Get departures list for current selection
  const departures = getStationDepartures(route.origin, direction, activeDayType);

  // Terminus and Destination departures to identify precise schedules
  const terminusName = direction === "Bundaran HI" ? "Lebak Bulus" : "Bundaran HI";
  const terminusDepartures = getStationDepartures(terminusName, direction, activeDayType);
  const destinationDepartures = getStationDepartures(route.destination, direction, activeDayType);

  // FIND NEXT TRAINS
  // A train is a match if its departure time is strictly in the future relative to currentSecondsOfDay.
  // This allows the next schedule to immediately rise to the main menu when a train has passed its schedule.
  const activeDepartureIndex = departures.findIndex(
    (dep) => dep.seconds > currentSecondsOfDay
  );

  const activeDeparture = activeDepartureIndex !== -1 ? departures[activeDepartureIndex] : null;

  // Train numbers/IDs for the upcoming train
  const upcomingTrainNumber = activeDepartureIndex !== -1 ? activeDepartureIndex + 1 : null;
  const upcomingTrainCode = upcomingTrainNumber ? `MGS-TR-${String(upcomingTrainNumber).padStart(2, "0")}` : "";
  const upcomingTrainTerminusTime = upcomingTrainNumber !== null && terminusDepartures[activeDepartureIndex] ? terminusDepartures[activeDepartureIndex].timeStr : "";
  const upcomingTrainDestTime = upcomingTrainNumber !== null && destinationDepartures[activeDepartureIndex] ? destinationDepartures[activeDepartureIndex].timeStr : "";
  const upcomingTrainDuration = upcomingTrainNumber !== null && destinationDepartures[activeDepartureIndex] && activeDeparture
    ? (destinationDepartures[activeDepartureIndex].seconds - activeDeparture.seconds) / 60
    : totalDuration;

  // List of stations in correct visual order of transit from Origin to Destination
  const isForward = originIndex < destinationIndex;
  const pathStations = [];
  if (originIndex !== -1 && destinationIndex !== -1) {
    if (isForward) {
      for (let i = originIndex; i <= destinationIndex; i++) {
        pathStations.push({ stationName: STATIONS[i], index: i });
      }
    } else {
      for (let i = originIndex; i >= destinationIndex; i--) {
        pathStations.push({ stationName: STATIONS[i], index: i });
      }
    }
  }

  // Precision countdown calculation
  let remainingSeconds = 0;
  let countdownText = "Layanan Berakhir";
  let countdownState: "WAITING" | "BOARDING" | "DEPARTING" | "TERMINATED" = "TERMINATED";

  if (activeDeparture) {
    remainingSeconds = activeDeparture.seconds - currentSecondsOfDay;

    if (remainingSeconds <= 35 && remainingSeconds >= 0) {
      countdownText = "Kereta sedang menunggu di peron";
      countdownState = "BOARDING";
    } else if (remainingSeconds > 35) {
      const minutesLeft = Math.ceil(remainingSeconds / 60);
      countdownText = `Tiba dalam ${minutesLeft} menit`;
      countdownState = "WAITING";
    } else {
      countdownText = "Kereta berangkat dari peron";
      countdownState = "DEPARTING";
    }
  }

  // Next 3 subsequent departures
  const subsequentDepartures = [];
  if (activeDepartureIndex !== -1) {
    for (let i = 1; i <= 3; i++) {
      const nextIdx = activeDepartureIndex + i;
      if (nextIdx < departures.length) {
        subsequentDepartures.push(departures[nextIdx]);
      }
    }
  }

  // ALARM ALGORITHM
  // SWAP ROUTE FUNCTION
  const handleSwapRoute = () => {
    playBeep(660, 0.1);
    setRoute((prev) => ({
      ...prev,
      origin: prev.destination,
      destination: prev.origin
    }));
  };

  // RESET TO SETUP
  const handleReset = () => {
    setRoute((prev) => ({ ...prev, isActive: false }));
    playBeep(440, 0.15);
  };

  // TRAIN POSITION ALONG THE ENTIRE LINE FOR SELECTED RUTE IN REAL-TIME
  // Let's compute the estimated progress of a running train active on the direct origin-destination path.
  // The train takes 150 seconds (2.5 mins) between subsequent stations.
  // Let's look at the active departure. If it left origin at T_dep:
  // It will reach destination at T_dep + stationsCount * 150.
  // We can track if a train on this trip is currently running!
  // To simulate beautifully, let's take the departure that is *already running*
  // (the one immediately prior to the upcoming departure).
  const precedingDepartures = departures.filter((dep) => dep.seconds < currentSecondsOfDay);
  const latestDepartedTrain = precedingDepartures[precedingDepartures.length - 1];
  const runningTrainIndex = latestDepartedTrain ? departures.indexOf(latestDepartedTrain) : -1;
  const runningTrainNumber = runningTrainIndex !== -1 ? runningTrainIndex + 1 : null;
  const runningTrainCode = runningTrainNumber ? `MGS-TR-${String(runningTrainNumber).padStart(2, "0")}` : "";
  const runningTrainTerminusTime = runningTrainNumber !== null && terminusDepartures[runningTrainIndex] ? terminusDepartures[runningTrainIndex].timeStr : "";

  let activeTrainProgress = 0; // 0 to 1
  let currentSegmentText = "Siap berangkat di peron asal";
  let activeTrainOnLine = false;

  if (latestDepartedTrain && stationsCount > 0) {
    const tripTotalSeconds = stationsCount * STATION_INTERVAL_SECONDS;
    const secondsSinceDeparture = currentSecondsOfDay - latestDepartedTrain.seconds;

    if (secondsSinceDeparture >= 0 && secondsSinceDeparture <= tripTotalSeconds) {
      activeTrainOnLine = true;
      activeTrainProgress = secondsSinceDeparture / tripTotalSeconds;

      // Find current segment
      const currentPassedStations = Math.floor(secondsSinceDeparture / STATION_INTERVAL_SECONDS);
      const originIdx = STATIONS.indexOf(route.origin);
      const isForward = originIdx < STATIONS.indexOf(route.destination);
      
      const currentStationIdx = isForward 
        ? originIdx + currentPassedStations 
        : originIdx - currentPassedStations;
      
      const nextStationIdx = isForward
        ? currentStationIdx + 1
        : currentStationIdx - 1;

      const currentStationName = STATIONS[currentStationIdx] || route.origin;
      const nextStationName = STATIONS[nextStationIdx] || route.destination;

      if (currentStationName === route.destination) {
        currentSegmentText = `Kereta telah tiba di tujuan: ${route.destination}`;
      } else {
        const percentSeg = Math.round(((secondsSinceDeparture % STATION_INTERVAL_SECONDS) / STATION_INTERVAL_SECONDS) * 100);
        currentSegmentText = `Melaju antara ${currentStationName} → ${nextStationName} (${percentSeg}%)`;
      }
    }
  }

  // --- COMPLETE ACTIVE TRAINS LIST FOR CURRENT DIRECTION ---
  const isForwardDirection = direction === "Bundaran HI";
  const lineStations: { stationName: string; indexInLine: number; indexInGlobal: number }[] = [];
  if (isForwardDirection) {
    for (let i = 0; i < STATIONS.length; i++) {
      lineStations.push({ stationName: STATIONS[i], indexInLine: i, indexInGlobal: i });
    }
  } else {
    for (let i = STATIONS.length - 1; i >= 0; i--) {
      lineStations.push({ stationName: STATIONS[i], indexInLine: STATIONS.length - 1 - i, indexInGlobal: i });
    }
  }

  // Precompute map of southbound departure index -> trainNumber to prevent any duplicate pairings
  const sbIndexToTrainNumber: { [key: number]: number } = {};
  const usedNbInMapping = new Set<number>();
  
  const sbDeparturesMapInput = getStationDepartures("Bundaran HI", "Lebak Bulus", activeDayType);
  const nbDeparturesMapInput = getStationDepartures("Lebak Bulus", "Bundaran HI", activeDayType);
  const mapTotalDurationSecs = (STATIONS.length - 1) * STATION_INTERVAL_SECONDS;

  sbDeparturesMapInput.forEach((dep, sbIdx) => {
    const T_start = dep.seconds;
    
    let pairedNbIndex = -1;
    // Look for the closest preceding northbound train arrival that hasn't been used yet
    for (let nbIdx = nbDeparturesMapInput.length - 1; nbIdx >= 0; nbIdx--) {
      const nbDep = nbDeparturesMapInput[nbIdx];
      const nbArrival = nbDep.seconds + mapTotalDurationSecs;
      if (nbArrival <= T_start && !usedNbInMapping.has(nbIdx)) {
        const turnaround = T_start - nbArrival;
        // Turnaround must be realistic (minimum 60s, maximum 30 minutes)
        if (turnaround >= 60 && turnaround <= 1800) {
          pairedNbIndex = nbIdx;
          break;
        }
      }
    }

    if (pairedNbIndex !== -1) {
      usedNbInMapping.add(pairedNbIndex);
      sbIndexToTrainNumber[sbIdx] = pairedNbIndex + 1;
    } else {
      sbIndexToTrainNumber[sbIdx] = 100 + sbIdx + 1;
    }
  });

  const activeTrainsOnLineList: {
    trainNumber: number;
    trainCode: string;
    progress: number;
    stoppedAtStationIndex: number;
    direction: "Bundaran HI" | "Lebak Bulus";
  }[] = [];

  const northboundDepartures = getStationDepartures("Lebak Bulus", "Bundaran HI", activeDayType);
  const southboundDepartures = getStationDepartures("Bundaran HI", "Lebak Bulus", activeDayType);

  // 1. Process Northbound trains heading to Bundaran HI (Lebak Bulus to Bundaran HI)
  northboundDepartures.forEach((dep, tIdx) => {
    const T_start = dep.seconds;
    const totalDurationSecs = (STATIONS.length - 1) * STATION_INTERVAL_SECONDS; // 1800
    const elapsed = currentSecondsOfDay - T_start;
    
    // Train is active from 3 minutes (180s) before departing Lebak Bulus up to the arrival at Bundaran HI (1800s)
    if (elapsed >= -180 && elapsed < totalDurationSecs) {
      const trainNumber = tIdx + 1;
      const trainCode = `MGS-TR-${String(trainNumber).padStart(2, "0")}`;
      const progress = Math.max(0, Math.min(1, elapsed / totalDurationSecs));
      
      // Check if stopped at any station k (0 to 12)
      let stoppedAtStationIndex = -1;
      for (let k = 0; k < STATIONS.length; k++) {
        const T_dep_k = T_start + k * STATION_INTERVAL_SECONDS;
        const startWindow = k === 0 ? 180 : 30; // 3 minutes (180s) at Lebak Bulus, 30s at intermediate stations
        if (currentSecondsOfDay >= T_dep_k - startWindow && currentSecondsOfDay <= T_dep_k + 5) {
          stoppedAtStationIndex = k;
          break;
        }
      }
      
      // Compute display progress locked or interpolated
      let displayProgress = progress;
      if (stoppedAtStationIndex !== -1) {
        displayProgress = stoppedAtStationIndex / (STATIONS.length - 1);
      } else {
        const floatIdx = elapsed / STATION_INTERVAL_SECONDS;
        const k = Math.floor(floatIdx);
        if (k >= 0 && k < STATIONS.length - 1) {
          const T_dep_k = T_start + k * STATION_INTERVAL_SECONDS;
          const T_arr_k1 = T_dep_k + STATION_INTERVAL_SECONDS - 30;
          
          if (currentSecondsOfDay > T_dep_k + 5 && currentSecondsOfDay < T_arr_k1) {
            const travelDuration = T_arr_k1 - (T_dep_k + 5);
            const travelElapsed = currentSecondsOfDay - (T_dep_k + 5);
            const ratio = Math.max(0, Math.min(1, travelElapsed / travelDuration));
            displayProgress = (k + ratio) / (STATIONS.length - 1);
          } else if (currentSecondsOfDay <= T_dep_k + 5) {
            displayProgress = k / (STATIONS.length - 1);
          } else {
            displayProgress = (k + 1) / (STATIONS.length - 1);
          }
        }
      }
      
      activeTrainsOnLineList.push({
        trainNumber,
        trainCode,
        progress: displayProgress,
        stoppedAtStationIndex,
        direction: "Bundaran HI"
      });
    }
  });

  // 2. Process Southbound trains heading to Lebak Bulus (Bundaran HI to Lebak Bulus)
  southboundDepartures.forEach((dep, tIdx) => {
    const T_start = dep.seconds;
    const totalDurationSecs = (STATIONS.length - 1) * STATION_INTERVAL_SECONDS; // 1800
    
    // Look up precalc unique trainNumber and its corresponding paired inbound info
    const trainNumber = sbIndexToTrainNumber[tIdx] || (100 + tIdx + 1);
    const trainCode = `MGS-TR-${String(trainNumber).padStart(2, "0")}`;
    
    let pairedArrivalSecs = -1;
    if (trainNumber <= 100) {
      const pairedNbIdx = trainNumber - 1;
      const nbDep = northboundDepartures[pairedNbIdx];
      if (nbDep) {
        pairedArrivalSecs = nbDep.seconds + totalDurationSecs;
      }
    }
    
    // Train starts being active either from its paired arrival time at Bundaran HI or 60s fallback
    const activeFrom = pairedArrivalSecs !== -1 ? pairedArrivalSecs : T_start - 60;
    const elapsed = currentSecondsOfDay - T_start;
    
    if (currentSecondsOfDay >= activeFrom && elapsed <= totalDurationSecs + 15) {
      let stoppedAtStationIndex = -1;
      let displayProgress = 0;
      
      if (currentSecondsOfDay < T_start) {
        // Since it hasn't departed yet, it is waiting at Bundaran HI platform (k = 0)
        stoppedAtStationIndex = 0;
        displayProgress = 0;
      } else {
        // Train has departed, calculate normal progression and station stops
        const progress = Math.max(0, Math.min(1, elapsed / totalDurationSecs));
        
        // Check if stopped at any station k (0 to 12 from Bundaran HI as start)
        for (let k = 0; k < STATIONS.length; k++) {
          const T_dep_k = T_start + k * STATION_INTERVAL_SECONDS;
          const startWindow = k === 0 ? 60 : 30;
          if (currentSecondsOfDay >= T_dep_k - startWindow && currentSecondsOfDay <= T_dep_k + 5) {
            stoppedAtStationIndex = k;
            break;
          }
        }
        
        displayProgress = progress;
        if (stoppedAtStationIndex !== -1) {
          displayProgress = stoppedAtStationIndex / (STATIONS.length - 1);
        } else {
          const floatIdx = elapsed / STATION_INTERVAL_SECONDS;
          const k = Math.floor(floatIdx);
          if (k >= 0 && k < STATIONS.length - 1) {
            const T_dep_k = T_start + k * STATION_INTERVAL_SECONDS;
            const T_arr_k1 = T_dep_k + STATION_INTERVAL_SECONDS - 30;
            
            if (currentSecondsOfDay > T_dep_k + 5 && currentSecondsOfDay < T_arr_k1) {
              const travelDuration = T_arr_k1 - (T_dep_k + 5);
              const travelElapsed = currentSecondsOfDay - (T_dep_k + 5);
              const ratio = Math.max(0, Math.min(1, travelElapsed / travelDuration));
              displayProgress = (k + ratio) / (STATIONS.length - 1);
            } else if (currentSecondsOfDay <= T_dep_k + 5) {
              displayProgress = k / (STATIONS.length - 1);
            } else {
              displayProgress = (k + 1) / (STATIONS.length - 1);
            }
          }
        }
      }
      
      activeTrainsOnLineList.push({
        trainNumber,
        trainCode,
        progress: displayProgress,
        stoppedAtStationIndex,
        direction: "Lebak Bulus"
      });
    }
  });

  const getTrainCodeForIndex = (depGlobalIdx: number, dir: "Bundaran HI" | "Lebak Bulus") => {
    if (dir === "Bundaran HI") {
      const trainNumber = depGlobalIdx + 1;
      return `MGS-TR-${String(trainNumber).padStart(2, "0")}`;
    } else {
      const trainNumber = sbIndexToTrainNumber[depGlobalIdx];
      if (trainNumber !== undefined) {
        return `MGS-TR-${String(trainNumber).padStart(2, "0")}`;
      }
      return `MGS-TR-SB-${String(depGlobalIdx + 1).padStart(2, "0")}`;
    }
  };

  const getHeadingStationName = (trainMatch: { progress: number; direction: "Bundaran HI" | "Lebak Bulus" }): string => {
    const localProgress = trainMatch.progress;
    if (trainMatch.direction === "Bundaran HI") {
      const nextGlobalIdx = Math.min(STATIONS.length - 1, Math.max(0, Math.ceil(localProgress * (STATIONS.length - 1))));
      return STATIONS[nextGlobalIdx];
    } else {
      const nextGlobalIdx = Math.max(0, Math.min(STATIONS.length - 1, Math.floor((STATIONS.length - 1) - localProgress * (STATIONS.length - 1))));
      return STATIONS[nextGlobalIdx];
    }
  };

  const activeTrainCode = activeDepartureIndex !== -1 ? getTrainCodeForIndex(activeDepartureIndex, direction) : null;
  const mainActiveTrainMatch = activeTrainCode ? activeTrainsOnLineList.find(t => t.trainCode === activeTrainCode) : null;

  const renderRouteTracker = () => {
    return (
      <div className="bg-[#09111e]/90 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold font-display uppercase tracking-wider text-white">
              Graphical Route Tracker
            </h3>
          </div>
        </div>

        {/* DYNAMIC PROGRESS PROGRESS TRACK */}
        <div className="relative py-2 bg-[#070e1a] rounded-lg p-4 border border-slate-900 overflow-hidden">
          
          {/* Rail linear Track representation */}
          <div className="relative py-2 select-none" style={{ height: "650px" }}>
            
            {/* 1. Base Rails */}
            {/* Garis Kiri: Lebak Bulus ke Bundaran HI (Northbound) */}
            <div className="absolute left-[30%] top-[25px] bottom-[25px] w-[3px] bg-slate-800/80 rounded" />
            
            {/* Garis Kanan: Bundaran HI ke Lebak Bulus (Southbound) */}
            <div className="absolute left-[70%] top-[25px] bottom-[25px] w-[3px] bg-slate-800/80 rounded" />

            {/* 2. User Travel Highlights */}
            {(() => {
              const hasSelectedRoute = route.origin && route.destination && route.origin !== route.destination;
              if (!hasSelectedRoute) return null;

              const orgIdx = STATIONS.indexOf(route.origin);
              const destIdx = STATIONS.indexOf(route.destination);
              
              // Northbound Highlight on Left Rail
              if (direction === "Bundaran HI") {
                const y_origin = 625 - (orgIdx / 12) * 600;
                const y_dest = 625 - (destIdx / 12) * 600;
                const top = Math.min(y_origin, y_dest);
                const height = Math.abs(y_origin - y_dest);
                return (
                  <div 
                    className="absolute left-[30%] -ml-[0.5px] w-[4px] bg-cyan-500/60 rounded shadow-[0_0_8px_rgba(0,240,255,0.5)] animate-pulse"
                    style={{ top: `${top}px`, height: `${height}px` }}
                  />
                );
              }
              
              // Southbound Highlight on Right Rail
              if (direction === "Lebak Bulus") {
                const y_origin = 25 + ((12 - orgIdx) / 12) * 600;
                const y_dest = 25 + ((12 - destIdx) / 12) * 600;
                const top = Math.min(y_origin, y_dest);
                const height = Math.abs(y_origin - y_dest);
                return (
                  <div 
                    className="absolute left-[70%] -ml-[0.5px] w-[4px] bg-emerald-500/60 rounded shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"
                    style={{ top: `${top}px`, height: `${height}px` }}
                  />
                );
              }
              return null;
            })()}

            {/* 3. Station Nodes Grid (Drawn row-by-row) */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-10 font-mono">
              {(() => {
                const reversedStations = [...STATIONS].reverse();
                const hasSelectedRoute = route.origin && route.destination && route.origin !== route.destination;
                const orgIdx = hasSelectedRoute ? STATIONS.indexOf(route.origin) : -1;
                const destIdx = hasSelectedRoute ? STATIONS.indexOf(route.destination) : -1;

                return reversedStations.map((st) => {
                  const origIndex = STATIONS.indexOf(st);
                  const isUserOrigin = hasSelectedRoute && st === route.origin;
                  const isUserDestination = hasSelectedRoute && st === route.destination;

                  // Check if station is in active trip
                  let userTripActive = false;
                  if (hasSelectedRoute) {
                    if (direction === "Bundaran HI") {
                      userTripActive = origIndex >= orgIdx && origIndex <= destIdx;
                    } else {
                      userTripActive = origIndex <= orgIdx && origIndex >= destIdx;
                    }
                  }

                  // Find stopped trains on Left Track (Northbound, heading to BHI)
                  const stoppedNB = activeTrainsOnLineList.find(
                    t => t.direction === "Bundaran HI" && t.stoppedAtStationIndex === origIndex
                  );

                  // Find stopped trains on Right Track (Southbound, heading to LB)
                  const stoppedSB = activeTrainsOnLineList.find(
                    t => t.direction === "Lebak Bulus" && (12 - t.stoppedAtStationIndex) === origIndex
                  );

                  // Left dot classes
                  let leftDotClass = "";
                  if (stoppedNB) {
                    leftDotClass = "bg-amber-400 border-amber-500 scale-125 shadow-[0_0_12px_#fbbf24] animate-pulse";
                  } else if (hasSelectedRoute && direction === "Bundaran HI" && userTripActive) {
                    if (isUserOrigin) {
                      leftDotClass = "bg-cyan-500 border-cyan-400 scale-110 shadow-[0_0_8px_#00f0ff]";
                    } else if (isUserDestination) {
                      leftDotClass = "bg-emerald-500 border-emerald-500 scale-110 shadow-[0_0_8px_#10b981]";
                    } else {
                      leftDotClass = "bg-[#060b13] border-cyan-400 border-2";
                    }
                  } else {
                    leftDotClass = "bg-[#03070d] border-slate-700 opacity-40";
                  }

                  // Right dot classes
                  let rightDotClass = "";
                  if (stoppedSB) {
                    rightDotClass = "bg-amber-400 border-amber-500 scale-125 shadow-[0_0_12px_#fbbf24] animate-pulse";
                  } else if (hasSelectedRoute && direction === "Lebak Bulus" && userTripActive) {
                    if (isUserOrigin) {
                      rightDotClass = "bg-cyan-500 border-cyan-400 scale-110 shadow-[0_0_8px_#00f0ff]";
                    } else if (isUserDestination) {
                      rightDotClass = "bg-emerald-500 border-emerald-500 scale-110 shadow-[0_0_8px_#10b981]";
                    } else {
                      rightDotClass = "bg-[#060b13] border-[#10b981] border-2";
                    }
                  } else {
                    rightDotClass = "bg-[#03070d] border-slate-700 opacity-40";
                  }

                  return (
                    <div key={`row-st-${st}`} className="relative flex items-center h-[50px] w-full">
                      
                      {/* Left Platform dot aligned to Left Rail (30%) */}
                      <div className="absolute left-[30%] -translate-x-1/2 flex justify-center items-center h-full z-20 pointer-events-none">
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${leftDotClass}`}>
                          {!stoppedNB && (!userTripActive || direction !== "Bundaran HI" || (!isUserOrigin && !isUserDestination)) && (
                            <div className={`w-1 h-1 rounded-full ${userTripActive && direction === "Bundaran HI" ? "bg-cyan-400 animate-pulse" : "bg-slate-700"}`} />
                          )}
                          {stoppedNB && (
                            <div className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                          )}
                        </div>
                      </div>

                      {/* Centered Station Name Text */}
                      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center text-center z-10 w-[38%] pointer-events-auto">
                        <span className={`text-[10px] sm:text-xs font-mono tracking-tight leading-none uppercase transition-colors duration-300 whitespace-nowrap ${
                          isUserOrigin 
                            ? "text-cyan-400 font-bold" 
                            : isUserDestination 
                              ? "text-emerald-400 font-bold" 
                              : (stoppedNB || stoppedSB)
                                ? "text-amber-300 font-semibold"
                                : userTripActive
                                  ? "text-white"
                                  : "text-gray-500"
                        }`}>
                          {st}
                        </span>
                        {isUserOrigin && (
                          <span className="text-[7px] text-cyan-400/80 font-mono font-bold uppercase mt-0.5 leading-none select-none whitespace-nowrap">Origin</span>
                        )}
                        {isUserDestination && (
                          <span className="text-[7px] text-emerald-400/80 font-mono font-bold uppercase mt-0.5 leading-none select-none whitespace-nowrap">Dest</span>
                        )}
                        {(stoppedNB || stoppedSB) && (
                          <span className="text-[7px] text-amber-400 font-mono font-bold uppercase mt-0.5 leading-none select-none animate-pulse whitespace-nowrap">Waiting</span>
                        )}
                      </div>

                      {/* Right Platform dot aligned to Right Rail (70%) */}
                      <div className="absolute left-[70%] -translate-x-1/2 flex justify-center items-center h-full z-20 pointer-events-none">
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${rightDotClass}`}>
                          {!stoppedSB && (!userTripActive || direction !== "Lebak Bulus" || (!isUserOrigin && !isUserDestination)) && (
                            <div className={`w-1 h-1 rounded-full ${userTripActive && direction === "Lebak Bulus" ? "bg-emerald-400 animate-pulse" : "bg-slate-700"}`} />
                          )}
                          {stoppedSB && (
                            <div className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                          )}
                        </div>
                      </div>

                    </div>
                  );
                });
              })()}
            </div>

            {/* 4. Active Trains Moving Overlay - Left Track (Northbound) */}
            {activeTrainsOnLineList
              .filter(train => train.direction === "Bundaran HI")
              .map((train, idx) => {
                const yPos = 625 - train.progress * 600;

                return (
                  <div
                    key={`realtime-trn-nb-${train.trainCode}-${idx}`}
                    className="absolute left-[30%] flex items-center justify-end z-20 pointer-events-none"
                    style={{
                      top: `${yPos}px`,
                      transform: "translate(-100%, -50%)",
                      transition: "top 1s linear"
                    }}
                  >
                    <div className="flex items-center gap-1 bg-cyan-950/90 border border-cyan-500/50 rounded px-1.5 py-0.5 shadow-lg mr-2">
                      <span className="text-[8px] font-mono font-bold text-cyan-300">
                        {train.trainCode}
                      </span>
                      <span className="text-[8px] text-cyan-400 font-bold animate-pulse">
                        ↑
                      </span>
                    </div>
                    <div className="relative shrink-0 mr-[-7px]">
                      <div className="absolute -inset-1 w-5 h-5 bg-cyan-400/30 blur-sm rounded-full animate-ping" />
                      <div className="w-3.5 h-3.5 rounded-full border border-cyan-400 bg-cyan-500 text-black flex items-center justify-center font-mono text-[8.5px] font-bold shadow-[0_0_8px_#00f0ff]">
                        🚊
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* 5. Active Trains Moving Overlay - Right Track (Southbound) */}
            {activeTrainsOnLineList
              .filter(train => train.direction === "Lebak Bulus")
              .map((train, idx) => {
                const yPos = 25 + train.progress * 600;

                return (
                  <div
                    key={`realtime-trn-sb-${train.trainCode}-${idx}`}
                    className="absolute left-[70%] flex items-center justify-start z-20 pointer-events-none"
                    style={{
                      top: `${yPos}px`,
                      transform: "translate(0, -50%)",
                      transition: "top 1s linear"
                    }}
                  >
                    <div className="relative shrink-0 ml-[-7px]">
                      <div className="absolute -inset-1 w-5 h-5 bg-emerald-400/30 blur-sm rounded-full animate-ping" />
                      <div className="w-3.5 h-3.5 rounded-full border border-emerald-400 bg-emerald-500 text-black flex items-center justify-center font-mono text-[8.5px] font-bold shadow-[0_0_8px_#10b981]">
                        🚊
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-emerald-950/90 border border-emerald-500/50 rounded px-1.5 py-0.5 shadow-lg ml-2">
                      <span className="text-[8px] text-emerald-400 font-bold animate-pulse">
                        ↓
                      </span>
                      <span className="text-[8px] font-mono font-bold text-emerald-300">
                        {train.trainCode}
                      </span>
                    </div>
                  </div>
                );
              })}

          </div>

          {/* Moving train progress logs */}
          <div className="border-t border-slate-850 pt-3 mt-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="block text-[10px] font-mono text-gray-500 uppercase">PROYEKSI JALUR KERETA AKTIF</span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-900/30">
                {activeTrainsOnLineList.length} Rangkaian Beroperasi
              </span>
            </div>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#060b13] text-gray-100 font-sans relative overflow-x-hidden crt-scanlines selection:bg-[#00f0ff] selection:text-black">
      {/* BACKGROUND FLOATING MATRIX LIGHTS */}
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-blue-950/10 via-cyan-950/5 to-transparent pointer-events-none" />

      {/* TOP HEADER STATUS PANEL */}
      <header className="border-b border-sky-950/40 bg-[#09111e]/90 sticky top-0 z-30 backdrop-blur-md px-4 sm:px-8 py-2">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-[#00f0ff] blur-md opacity-25 rounded-md" />
              <div className="w-8 h-8 rounded border border-[#00f0ff]/50 bg-sky-950/60 flex items-center justify-center text-[#00f0ff]">
                <Train className="w-4 h-4 animate-pulse-cyber text-[#00f0ff]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] tracking-[0.2em] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/20">MEGAH GLOBAL SOLUTION</span>
              </div>
              <h1 className="text-sm sm:text-base font-bold font-display tracking-tight text-white flex items-center gap-1.5 leading-none mt-0.5">
                MRT Jakarta Tracker
              </h1>
            </div>
          </div>

          {/* Quick System Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                playBeep(880, 0.08);
              }}
              className={`p-2 rounded-lg border transition duration-200 ${
                soundEnabled
                  ? "bg-cyan-950/30 border-cyan-800/40 text-cyan-400 hover:bg-cyan-900/40"
                  : "bg-gray-900/40 border-gray-800 text-gray-500 hover:bg-gray-800"
              }`}
              title={soundEnabled ? "Mute audio" : "Unmute audio"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowTutorial(!showTutorial)}
              className="p-2 rounded-lg border border-cyan-950/50 bg-[#0c192d] text-cyan-400 hover:bg-cyan-950/80 transition"
              title="Bantuan Konsol"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        
        {/* TUTORIAL POPUP */}
        {showTutorial && (
          <div className="mb-6 bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-4 sm:p-5 relative overflow-hidden backdrop-blur-md">
            <div className="absolute right-3 top-3">
              <button onClick={() => setShowTutorial(false)} className="text-cyan-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3">
              <div className="p-2 bg-cyan-950/80 rounded-lg text-[#00f0ff] shrink-0 self-start">
                <Info className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider">Panduan Konsol MRT Jakarta</h3>
                <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
                  Selamat datang di **MRT Jakarta Tracker** dari **Megah Global Solution**. Sistem mengoordinasi jadwal 13 stasiun MRT berturutan secara real-time. Anda dapat memantau estimasi keberangkatan, memicu simulasi waktu untuk menguji alarm, menghitung tarif otomatis (*Ongkos*), dan mengeset alarm offset untuk menghindari keterटिंगਗalan kereta.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-[11px] font-mono text-cyan-300">
                  <div className="p-2 bg-cyan-950/40 rounded border border-cyan-800/20">
                    <span className="block text-white font-bold mb-0.5">⏱️ PRESISI DETIK</span>
                    Kedatangan & status peron dihitung setiap detik menggunakan waktu sistem atau simulasi.
                  </div>
                  <div className="p-2 bg-[#09111e]/90 rounded border border-cyan-800/20">
                    <span className="block text-white font-bold mb-0.5">📅 JADWAL DINAMIS</span>
                    Sistem otomatis merujuk jadwal Weekday / Weekend sesuai waktu nyata atau override emulator.
                  </div>
                  <div className="p-2 bg-cyan-950/40 rounded border border-cyan-800/20">
                    <span className="block text-white font-bold mb-0.5">🚊 TRACK VISUAL</span>
                    Memproyeksikan seluruh perjalanan kereta aktif pada rute Lebak Bulus - Bundaran HI.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- MAIN PAGE CONTENT --- */}
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* CURRENT TRANSIT METADATA HEADER CARD */}
          <div className="bg-[#09111e]/90 border border-slate-800 rounded-xl p-3 sm:p-4 flex items-center justify-center gap-2 sm:gap-4 shadow-xl relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1 bg-cyan-400" />
            
            {/* Origin station selector */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-mono text-gray-500 block mb-1 font-bold tracking-wider text-center sm:text-left">ORIGIN (ASAL)</span>
              <select
                value={route.origin}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val !== route.destination) {
                    setRoute((prev) => ({ ...prev, origin: val }));
                  } else {
                    setRoute((prev) => ({ ...prev, origin: val, destination: prev.origin }));
                  }
                  playBeep(440, 0.05);
                }}
                className="bg-[#0c1a30] hover:bg-sky-900 border border-cyan-800/60 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer w-[130px] sm:w-[170px] transition text-ellipsis overflow-hidden font-bold"
              >
                <option value="" className="bg-[#09111e] text-gray-500">Pilih Asal</option>
                {dropdownStations.map((st) => (
                  <option key={`meta-orig-${st}`} value={st} className="bg-[#09111e] text-white">
                    {st}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Swap button interposed in the middle */}
            <div className="flex flex-col justify-end pt-4">
              <button
                onClick={handleSwapRoute}
                disabled={!route.origin || !route.destination}
                className="flex items-center text-cyan-400 hover:text-[#00f0ff] disabled:opacity-30 disabled:hover:text-cyan-400 border border-cyan-800/40 hover:border-[#00f0ff]/50 px-2 sm:px-3 py-1.5 rounded bg-cyan-950/30 hover:bg-cyan-900/30 transition-all duration-200 text-[10px] font-mono tracking-wider group shrink-0 select-none"
                title="Tukar Rute Asal / Tujuan"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-180 transition-transform duration-300 sm:mr-1" />
                <span className="hidden sm:inline">TUKAR</span>
              </button>
            </div>

            {/* Destination station selector */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-mono text-gray-400 block mb-1 font-bold tracking-wider text-center sm:text-left">DESTINATION (TUJUAN)</span>
              <select
                value={route.destination}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val !== route.origin) {
                    setRoute((prev) => ({ ...prev, destination: val }));
                  } else {
                    setRoute((prev) => ({ ...prev, destination: val, origin: prev.destination }));
                  }
                  playBeep(440, 0.05);
                }}
                className="bg-[#0c1a30] hover:bg-sky-900 border border-emerald-800/60 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer w-[130px] sm:w-[170px] transition text-ellipsis overflow-hidden font-bold"
              >
                <option value="" className="bg-[#09111e] text-gray-500">Pilih Tujuan</option>
                {dropdownStations.map((st) => (
                  <option key={`meta-dest-${st}`} value={st} className="bg-[#09111e] text-white">
                    {st}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* ROUTE VALIDATOR NOTICE */}
          {route.origin && route.destination && route.origin === route.destination && (
            <div className="p-3 bg-red-950/20 border border-red-950/80 rounded-xl text-center text-xs text-red-400 flex items-center justify-center gap-2 font-mono">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              Asal dan tujuan tidak boleh sama. Hub rute tidak valid.
            </div>
          )}

          {/* DYNAMIC PROGRESS RADAR AND INFO COLUMNS STACK (Animated flow) */}
          <AnimatePresence initial={false}>
            {route.origin && route.destination && route.origin !== route.destination && (
              <motion.div
                key="dashboard-details-holder"
                initial={{ opacity: 0, height: 0, scale: 0.98 }}
                animate={{ opacity: 1, height: "auto", scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.98 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="space-y-6 overflow-hidden origin-top"
              >
              {/* CORE DASHBOARD CONTAINER: COUNTDOWN AND PROGRESS */}
              <div className="space-y-6">
                
                {/* 1. PRIMARY DETAILS */}
                <div className="space-y-6">
                  
                  {/* CENTRAL COUNTDOWN STATUS RADAR CARD */}
                  <div className="relative rounded-xl p-6 border border-slate-800 bg-[#09111e]/90 overflow-hidden backdrop-blur-md shadow-lg transition duration-300">

                    <div className="space-y-4">
                      {/* Subtitle status badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold tracking-widest text-[#00f0ff] block">
                          Status kereta <br />
                          stasiun {route.origin}
                        </span>
                      </div>
                      
                      {/* Giant timer clock / Alert description */}
                      <div className="py-2 overflow-hidden min-h-[96px]">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeDeparture ? activeDeparture.timeStr : "none"}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                          >
                            {activeDeparture ? (
                              <div className="space-y-1">
                                <h3 className={`text-2xl sm:text-4xl font-black font-mono tracking-tight uppercase leading-none ${
                                    countdownState === "DEPARTING"
                                      ? "text-red-400 neon-glow-red"
                                      : countdownState === "BOARDING"
                                        ? "text-orange-400 neon-glow-orange"
                                        : "text-white"
                                }`}>
                                  {countdownText}
                                </h3>
                                <p className="text-xs text-gray-400 font-mono mt-2">
                                  Keberangkatan Dijadwalkan:{" "}
                                  <span className="text-[#00f0ff] font-bold font-mono">
                                    {activeDeparture.timeStr}
                                  </span>
                                </p>
                                {/* Green status indicator */}
                                <div className="text-emerald-400 font-mono font-bold text-[10px] sm:text-xs mt-3 flex items-center gap-1.5 bg-emerald-950/20 border border-emerald-950/20 py-1.5 px-3 rounded-lg select-none w-fit">
                                  <span className={`h-1.5 w-1.5 rounded-full bg-emerald-400 ${mainActiveTrainMatch && mainActiveTrainMatch.direction === direction ? "animate-ping" : "bg-emerald-500"}`} />
                                  <span>
                                    {mainActiveTrainMatch && mainActiveTrainMatch.direction === direction ? (
                                      `kereta sedang menuju stasiun ${getHeadingStationName(mainActiveTrainMatch)}`
                                    ) : (
                                      "kereta dalam persiapan"
                                    )}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="py-4">
                                <h3 className="text-xl sm:text-2xl font-bold font-mono text-red-500">
                                  Layanan Berakhir
                                </h3>
                                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                  Tidak ada jadwal kereta lanjutan untuk stasiun ini hari ini. Operasional stasiun MRT dimulai pukul 05:00 hingga 23:59.
                                </p>
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* TRIP STATS & TICKET PRICE (Directly below Central Countdown) */}
                  {route.origin !== route.destination && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-[#09111e]/90 border border-slate-800 rounded-xl font-mono text-xs text-gray-400 shadow-xl">
                      <div>
                        <span className="block text-gray-500 uppercase text-[9px] tracking-wider mb-1">ONGKOS PERJALANAN</span>
                        <span className="text-[#00f0ff] font-bold text-sm sm:text-base tracking-wider leading-none">
                          Rp {totalFare.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="flex flex-col justify-between">
                        <span className="block text-gray-500 uppercase text-[9px] tracking-wider mb-1">DURASI PERJALANAN (JARAK STASIUN)</span>
                        <span className="text-white font-bold text-sm sm:text-base tracking-wide leading-none">
                          {totalDuration} menit
                        </span>
                        <span className="text-gray-500 text-xs font-normal mt-1">
                          ({stationsCount} Stasiun)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* NEXT 3 SUBSEQUENT DEPARTURES PANEL (CRITICAL REQUIREMENT) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between font-mono">
                      <h3 className="text-xs font-bold text-cyan-400 tracking-wider uppercase block">
                        Kereta selanjutnya di {route.origin}
                      </h3>
                      <span className="text-[10px] text-gray-500">TOTAL {departures.length} JADWAL</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {subsequentDepartures.length > 0 ? (
                        subsequentDepartures.map((dep, idx) => {
                          const deltaSecs = dep.seconds - currentSecondsOfDay;
                          const deltaMins = Math.floor(deltaSecs / 60);

                          const depGlobalIdx = (activeDepartureIndex !== -1 ? activeDepartureIndex : 0) + 1 + idx;
                          const seqCode = getTrainCodeForIndex(depGlobalIdx, direction);
                          const seqNumber = depGlobalIdx + 1;

                          // Dynamically identify where the train is currently heading
                          const activeTrainMatch = activeTrainsOnLineList.find(t => t.trainCode === seqCode);
                          const currentHeadingText = (activeTrainMatch && activeTrainMatch.direction === direction)
                            ? `sedang menuju stasiun ${getHeadingStationName(activeTrainMatch)}`
                            : "Kereta dalam persiapan";

                          return (
                            <div
                              key={`sub-${dep.timeStr}-${idx}`}
                              className="bg-[#09111e]/90 border border-slate-800 rounded-lg p-2 text-left font-mono relative overflow-hidden flex flex-col justify-between"
                            >
                              <div className="flex items-center justify-between text-[8px] uppercase font-mono">
                                <span className="text-gray-500 font-bold">Kereta {seqNumber}</span>
                                <span className="text-cyan-400/70 bg-cyan-950/40 px-1 rounded text-[7px] tracking-tight">{seqCode}</span>
                              </div>
                              
                              <div className="flex items-baseline justify-between mt-1 mb-1">
                                <span className="text-sm font-black text-[#00f0ff] leading-none">
                                  {dep.timeStr}
                                </span>
                                <span className="text-[9px] text-gray-400 font-bold shrink-0">
                                  {Math.max(1, deltaMins)}m lagi
                                </span>
                              </div>
                              
                              {/* Tell where the train is currently heading or if in preparation */}
                              <div className="text-[8px] text-emerald-400 bg-emerald-950/10 border border-emerald-900/20 py-0.5 px-1.5 rounded truncate select-none text-center">
                                {currentHeadingText}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-3 bg-[#09111e]/40 border border-slate-800/40 p-4 text-center text-xs text-gray-500 rounded-lg">
                          Tidak terdapat jadwal berikutnya.
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* 2. ROUTE PROGRESS TRACKER MOVED BELOW */}
                <div className="w-full">
                  {renderRouteTracker()}
                </div>

                {/* 2. RIGHT COLUMN: TRACK PROGRESS, FARE & DURATIONS STATS (5/12 cols) - HIDDEN REDUNDANT TEMPLATE */}
                <div className="hidden">
                  
                  {/* REAL-TIME PROGRESS TRACKING MAP */}
                  <div className="bg-[#09111e]/90 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold font-display uppercase tracking-wider text-white">
                          Graphical Route Tracker
                        </h3>
                      </div>
                    </div>

                    {/* DYNAMIC PROGRESS PROGRESS TRACK */}
                    <div className="relative py-2 bg-[#070e1a] rounded-lg p-4 border border-slate-900 overflow-hidden">
                      
                      {/* Rail linear Track representation */}
                      <div className="relative py-2 select-none" style={{ height: "650px" }}>
                        
                        {/* 1. Base Rails */}
                        {/* Garis Kiri: Lebak Bulus ke Bundaran HI (Northbound) */}
                        <div className="absolute left-[30%] top-[25px] bottom-[25px] w-[3px] bg-slate-800/80 rounded" />
                        
                        {/* Garis Kanan: Bundaran HI ke Lebak Bulus (Southbound) */}
                        <div className="absolute left-[70%] top-[25px] bottom-[25px] w-[3px] bg-slate-800/80 rounded" />

                        {/* 2. User Travel Highlights */}
                        {(() => {
                          const orgIdx = STATIONS.indexOf(route.origin);
                          const destIdx = STATIONS.indexOf(route.destination);
                          
                          // Northbound Highlight on Left Rail
                          if (direction === "Bundaran HI") {
                            const y_origin = 625 - (orgIdx / 12) * 600;
                            const y_dest = 625 - (destIdx / 12) * 600;
                            const top = Math.min(y_origin, y_dest);
                            const height = Math.abs(y_origin - y_dest);
                            return (
                              <div 
                                className="absolute left-[30%] -ml-[0.5px] w-[4px] bg-cyan-500/60 rounded shadow-[0_0_8px_rgba(0,240,255,0.5)] animate-pulse"
                                style={{ top: `${top}px`, height: `${height}px` }}
                              />
                            );
                          }
                          
                          // Southbound Highlight on Right Rail
                          if (direction === "Lebak Bulus") {
                            const y_origin = 25 + ((12 - orgIdx) / 12) * 600;
                            const y_dest = 25 + ((12 - destIdx) / 12) * 600;
                            const top = Math.min(y_origin, y_dest);
                            const height = Math.abs(y_origin - y_dest);
                            return (
                              <div 
                                className="absolute left-[70%] -ml-[0.5px] w-[4px] bg-emerald-500/60 rounded shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"
                                style={{ top: `${top}px`, height: `${height}px` }}
                              />
                            );
                          }
                          return null;
                        })()}

                        {/* 3. Station Nodes Grid (Drawn row-by-row) */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-10 font-mono">
                          {(() => {
                            const reversedStations = [...STATIONS].reverse();
                            const orgIdx = STATIONS.indexOf(route.origin);
                            const destIdx = STATIONS.indexOf(route.destination);

                            return reversedStations.map((st, pIdx) => {
                              const origIndex = STATIONS.indexOf(st);
                              const isUserOrigin = st === route.origin;
                              const isUserDestination = st === route.destination;

                              // Check if station is in active trip
                              let userTripActive = false;
                              if (direction === "Bundaran HI") {
                                userTripActive = origIndex >= orgIdx && origIndex <= destIdx;
                              } else {
                                userTripActive = origIndex <= orgIdx && origIndex >= destIdx;
                              }

                              // Find stopped trains on Left Track (Northbound, heading to BHI)
                              const stoppedNB = activeTrainsOnLineList.find(
                                t => t.direction === "Bundaran HI" && t.stoppedAtStationIndex === origIndex
                              );

                              // Find stopped trains on Right Track (Southbound, heading to LB)
                              const stoppedSB = activeTrainsOnLineList.find(
                                t => t.direction === "Lebak Bulus" && (12 - t.stoppedAtStationIndex) === origIndex
                              );

                              // Left dot classes
                              let leftDotClass = "";
                              if (stoppedNB) {
                                leftDotClass = "bg-amber-400 border-amber-500 scale-125 shadow-[0_0_12px_#fbbf24] animate-pulse";
                              } else if (direction === "Bundaran HI" && userTripActive) {
                                if (isUserOrigin) {
                                  leftDotClass = "bg-cyan-500 border-cyan-400 scale-110 shadow-[0_0_8px_#00f0ff]";
                                } else if (isUserDestination) {
                                  leftDotClass = "bg-emerald-500 border-emerald-500 scale-110 shadow-[0_0_8px_#10b981]";
                                } else {
                                  leftDotClass = "bg-[#060b13] border-cyan-400 border-2";
                                }
                              } else {
                                leftDotClass = "bg-[#03070d] border-slate-700 opacity-40";
                              }

                              // Right dot classes
                              let rightDotClass = "";
                              if (stoppedSB) {
                                rightDotClass = "bg-amber-400 border-amber-500 scale-125 shadow-[0_0_12px_#fbbf24] animate-pulse";
                              } else if (direction === "Lebak Bulus" && userTripActive) {
                                if (isUserOrigin) {
                                  rightDotClass = "bg-cyan-500 border-cyan-400 scale-110 shadow-[0_0_8px_#00f0ff]";
                                } else if (isUserDestination) {
                                  rightDotClass = "bg-emerald-500 border-emerald-500 scale-110 shadow-[0_0_8px_#10b981]";
                                } else {
                                  rightDotClass = "bg-[#060b13] border-emerald-400 border-2";
                                }
                              } else {
                                rightDotClass = "bg-[#03070d] border-slate-700 opacity-40";
                              }

                              return (
                                <div key={`row-st-${st}`} className="relative flex items-center h-[50px] w-full">
                                  
                                  {/* Left Platform dot aligned to Left Rail (30%) */}
                                  <div className="absolute left-[30%] -translate-x-1/2 flex justify-center items-center h-full z-20 pointer-events-none">
                                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${leftDotClass}`}>
                                      {!stoppedNB && (!userTripActive || direction !== "Bundaran HI" || (!isUserOrigin && !isUserDestination)) && (
                                        <div className={`w-1 h-1 rounded-full ${userTripActive && direction === "Bundaran HI" ? "bg-cyan-400 animate-pulse" : "bg-slate-700"}`} />
                                      )}
                                      {stoppedNB && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                                      )}
                                    </div>
                                  </div>

                                  {/* Centered Station Name Text with wide margin, absolutely centered and nowrap to prevent truncation */}
                                  <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center text-center z-10 w-[38%] pointer-events-auto">
                                    <span className={`text-[10px] sm:text-xs font-mono tracking-tight leading-none uppercase transition-colors duration-300 whitespace-nowrap ${
                                      isUserOrigin 
                                        ? "text-cyan-400 font-bold" 
                                        : isUserDestination 
                                          ? "text-emerald-400 font-bold" 
                                          : (stoppedNB || stoppedSB)
                                            ? "text-amber-300 font-semibold"
                                            : userTripActive
                                              ? "text-white"
                                              : "text-gray-500"
                                    }`}>
                                      {st}
                                    </span>
                                    {isUserOrigin && (
                                      <span className="text-[7px] text-cyan-400/80 font-mono font-bold uppercase mt-0.5 leading-none select-none whitespace-nowrap">Origin</span>
                                    )}
                                    {isUserDestination && (
                                      <span className="text-[7px] text-emerald-400/80 font-mono font-bold uppercase mt-0.5 leading-none select-none whitespace-nowrap">Dest</span>
                                    )}
                                    {(stoppedNB || stoppedSB) && (
                                      <span className="text-[7px] text-amber-400 font-mono font-bold uppercase mt-0.5 leading-none select-none animate-pulse whitespace-nowrap">Waiting</span>
                                    )}
                                  </div>

                                  {/* Right Platform dot aligned to Right Rail (70%) */}
                                  <div className="absolute left-[70%] -translate-x-1/2 flex justify-center items-center h-full z-20 pointer-events-none">
                                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${rightDotClass}`}>
                                      {!stoppedSB && (!userTripActive || direction !== "Lebak Bulus" || (!isUserOrigin && !isUserDestination)) && (
                                        <div className={`w-1 h-1 rounded-full ${userTripActive && direction === "Lebak Bulus" ? "bg-emerald-400 animate-pulse" : "bg-slate-700"}`} />
                                      )}
                                      {stoppedSB && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                                      )}
                                    </div>
                                  </div>

                                </div>
                              );
                            });
                          })()}
                        </div>

                        {/* 4. Active Trains Moving Overlay - Left Track (Northbound, moving Lebak Bulus bottom to Bundaran HI top) */}
                        {activeTrainsOnLineList
                          .filter(train => train.direction === "Bundaran HI")
                          .map((train, idx) => {
                            const yPos = 625 - train.progress * 600;

                            return (
                              <div
                                key={`realtime-trn-nb-${train.trainCode}-${idx}`}
                                className="absolute left-[30%] flex items-center justify-end z-20 pointer-events-none"
                                style={{
                                  top: `${yPos}px`,
                                  transform: "translate(-100%, -50%)",
                                  transition: "top 1s linear"
                                }}
                              >
                                <div className="flex items-center gap-1 bg-cyan-950/90 border border-cyan-500/50 rounded px-1.5 py-0.5 shadow-lg mr-2">
                                  <span className="text-[8px] font-mono font-bold text-cyan-300">
                                    {train.trainCode}
                                  </span>
                                  <span className="text-[8px] text-cyan-400 font-bold animate-pulse">
                                    ↑
                                  </span>
                                </div>
                                <div className="relative shrink-0 mr-[-7px]">
                                  <div className="absolute -inset-1 w-5 h-5 bg-cyan-400/30 blur-sm rounded-full animate-ping" />
                                  <div className="w-3.5 h-3.5 rounded-full border border-cyan-400 bg-cyan-500 text-black flex items-center justify-center font-mono text-[8.5px] font-bold shadow-[0_0_8px_#00f0ff]">
                                    🚊
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                        {/* 5. Active Trains Moving Overlay - Right Track (Southbound, moving Bundaran HI top to Lebak Bulus bottom) */}
                        {activeTrainsOnLineList
                          .filter(train => train.direction === "Lebak Bulus")
                          .map((train, idx) => {
                            const yPos = 25 + train.progress * 600;

                            return (
                              <div
                                key={`realtime-trn-sb-${train.trainCode}-${idx}`}
                                className="absolute left-[70%] flex items-center justify-start z-20 pointer-events-none"
                                style={{
                                  top: `${yPos}px`,
                                  transform: "translate(0, -50%)",
                                  transition: "top 1s linear"
                                }}
                              >
                                <div className="relative shrink-0 ml-[-7px]">
                                  <div className="absolute -inset-1 w-5 h-5 bg-emerald-400/30 blur-sm rounded-full animate-ping" />
                                  <div className="w-3.5 h-3.5 rounded-full border border-emerald-400 bg-emerald-500 text-black flex items-center justify-center font-mono text-[8.5px] font-bold shadow-[0_0_8px_#10b981]">
                                    🚊
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 bg-emerald-950/90 border border-emerald-500/50 rounded px-1.5 py-0.5 shadow-lg ml-2">
                                  <span className="text-[8px] text-emerald-400 font-bold animate-pulse">
                                    ↓
                                  </span>
                                  <span className="text-[8px] font-mono font-bold text-emerald-300">
                                    {train.trainCode}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                      </div>
 
                      {/* Moving train progress logs */}
                      <div className="border-t border-slate-850 pt-3 mt-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="block text-[10px] font-mono text-gray-500 uppercase">PROYEKSI JALUR KERETA AKTIF</span>
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-900/30">
                            {activeTrainsOnLineList.length} Rangkaian Beroperasi
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>



                </div>

              </div>
              


            </motion.div>
          )}
        </AnimatePresence>

        {/* LANDING SCREEN INITIAL STATE: Show Tracker when route is not selected or invalid */}
        {(!route.origin || !route.destination || route.origin === route.destination) && (
          <div className="mt-6">
            {renderRouteTracker()}
          </div>
        )}
      </div>

      </main>

    </div>
  );
}
