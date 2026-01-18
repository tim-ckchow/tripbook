import React from 'react';
import { Cloud, CloudRain, Sun, CloudLightning, Snowflake, CloudFog, AlertTriangle, Wind, ThermometerSnowflake, AlertOctagon, Info, Mountain } from 'lucide-react';

export interface HourlyData {
    time: string;
    temp: number;
    precipProb: number;
    precipAmount: number; // mm
    snowAmount: number;   // cm
    code: number;
}

export interface DailyData {
    date: string;
    code: number;     // Overall dominant code
    amCode: number;   // 06:00 - 12:00
    pmCode: number;   // 12:00 - 21:00
    max: number;
    min: number;
    maxWind: number;
    precipProbMax: number;
    precipSum: number;
    snowSum: number;
}

export interface CurrentWeather {
    temp: number;
    code: number;
    windSpeed: number;
    humidity: number;
}

// Updated Interface for Open-Meteo Alerts
export interface OfficialAlert {
    sender_name: string;
    event: string;
    start: string;
    end: string;
    description: string;
    tags?: string[];
}

export interface CityForecast { 
    name: string; 
    lat: number; 
    lng: number; 
    current?: CurrentWeather;
    daily: DailyData[];
    hourly: HourlyData[];
    officialAlerts?: OfficialAlert[]; 
    loading: boolean; 
    error?: boolean; 
    lastUpdated?: number;
}

export interface WeatherHazard {
    type: 'snow' | 'wind' | 'cold' | 'rain' | 'typhoon' | 'general';
    level: 'advisory' | 'warning' | 'emergency'; 
    title: string;
    message: string;
    timing: 'Current' | 'Expected Later' | string;
    icon: any;
    isOfficial?: boolean; 
}

// --- JMA SPECIFIC TYPES ---

export interface JMAWarning {
    code: string;
    status: string;
    title: string; // Mapped from code
    level: 'advisory' | 'warning' | 'emergency' | 'cleared';
}

// Mapping JMA codes to English Titles and Levels
// Source: JMA Documentation & provided JSON payload
export const mapJMACode = (code: string): { title: string, level: 'advisory' | 'warning' | 'emergency' } => {
    const map: {[key: string]: { title: string, level: 'advisory' | 'warning' | 'emergency' }} = {
        '02': { title: 'Blizzard', level: 'warning' }, // 暴風雪警報
        '03': { title: 'Heavy Rain', level: 'warning' }, // 大雨警報
        '04': { title: 'Heavy Snow', level: 'warning' }, // 大雪警報
        '05': { title: 'Storm / Gale', level: 'warning' }, // 暴風警報
        '08': { title: 'Storm Surge', level: 'warning' }, // 高潮警報
        '10': { title: 'Heavy Rain / Flood', level: 'warning' }, 
        '12': { title: 'Heavy Snow Advisory', level: 'advisory' }, // 大雪注意報 (Note: distinct from 04 warning)
        '13': { title: 'Lightning', level: 'advisory' }, // 雷注意報
        '14': { title: 'Snow Advisory', level: 'advisory' }, 
        '15': { title: 'Strong Wind', level: 'advisory' }, // 強風注意報
        '16': { title: 'Dense Fog', level: 'advisory' }, // 濃霧注意報
        '19': { title: 'Avalanche', level: 'advisory' }, // なだれ注意報 (Common code)
        '22': { title: 'Avalanche', level: 'advisory' }, // なだれ注意報 (Code in Sapporo feed)
        '23': { title: 'Dry Air', level: 'advisory' }, // 乾燥注意報
        '24': { title: 'Low Temp', level: 'advisory' }, // 低温注意報
        '32': { title: 'Emergency Heavy Rain', level: 'emergency' },
        '33': { title: 'Emergency Heavy Snow', level: 'emergency' },
        '35': { title: 'Emergency Storm', level: 'emergency' },
    };
    return map[code] || { title: `JMA Code ${code}`, level: 'advisory' };
};

// Helper to determine severity score of a weather code
export const getSeverityScore = (code: number) => {
    if (code >= 95) return 95; // Thunderstorm
    if (code >= 71 && code <= 77) return 80; // Snow
    if (code >= 85 && code <= 86) return 80; // Snow Showers
    if (code >= 66 && code <= 67) return 70; // Freezing Rain
    if (code >= 61 && code <= 65) return 60; // Rain
    if (code >= 80 && code <= 82) return 60; // Rain Showers
    if (code >= 51 && code <= 57) return 50; // Drizzle
    if (code >= 45 && code <= 48) return 40; // Fog
    return 0;
};

export const getWeatherIcon = (code: number, size = 24, className = "") => {
    // WMO Weather interpretation codes (WW)
    if (code === 0) return <Sun size={size} className={`text-orange-400 ${className}`} />;
    if (code >= 1 && code <= 3) return <Cloud size={size} className={`text-gray-400 ${className}`} />;
    if (code >= 45 && code <= 48) return <CloudFog size={size} className={`text-blue-300 ${className}`} />;
    if (code >= 51 && code <= 67) return <CloudRain size={size} className={`text-blue-500 ${className}`} />;
    if (code >= 71 && code <= 77) return <Snowflake size={size} className={`text-cyan-400 ${className}`} />;
    if (code >= 80 && code <= 82) return <CloudRain size={size} className={`text-blue-600 ${className}`} />;
    if (code >= 85 && code <= 86) return <Snowflake size={size} className={`text-cyan-600 ${className}`} />;
    if (code >= 95 && code <= 99) return <CloudLightning size={size} className={`text-purple-500 ${className}`} />;
    return <Sun size={size} className={`text-orange-400 ${className}`} />;
};