import React from 'react';
import { Cloud, CloudRain, Sun, CloudLightning, Snowflake, CloudFog } from 'lucide-react';

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
    code: number;
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

export interface CityForecast { 
    name: string; 
    lat: number; 
    lng: number; 
    current?: CurrentWeather;
    daily: DailyData[];
    hourly: HourlyData[];
    loading: boolean; 
    error?: boolean; 
    lastUpdated?: number;
}

export const getWeatherIcon = (code: number, size = 24, className = "") => {
    // WMO Weather interpretation codes (WW)
    if (code === 0) return <Sun size={size} className={`text-orange-400 ${className}`} />;
    if (code >= 1 && code <= 3) return <Cloud size={size} className={`text-gray-400 ${className}`} />;
    if (code >= 45 && code <= 48) return <CloudFog size={size} className={`text-blue-300 ${className}`} />;
    if (code >= 51 && code <= 67) return <CloudRain size={size} className={`text-blue-500 ${className}`} />;
    if (code >= 71 && code <= 77) return <Snowflake size={size} className={`text-cyan-300 ${className}`} />;
    if (code >= 80 && code <= 82) return <CloudRain size={size} className={`text-blue-600 ${className}`} />;
    if (code >= 95 && code <= 99) return <CloudLightning size={size} className={`text-purple-500 ${className}`} />;
    return <Sun size={size} className={`text-orange-400 ${className}`} />;
};