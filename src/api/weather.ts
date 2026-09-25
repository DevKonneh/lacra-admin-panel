import apiClient from './client';
import type { ApiResponse } from './types';

export interface WeatherDailyForecast {
    date: string;
    weatherCode: number;
    weatherLabel: string;
    tempMaxC: number;
    tempMinC: number;
    precipitationSumMm: number;
    precipitationProbabilityMax: number | null;
}

export interface WeatherCurrentConditions {
    time: string;
    temperatureC: number;
    relativeHumidityPercent: number;
    precipitationMm: number;
    weatherCode: number;
    weatherLabel: string;
    windSpeedKmh: number;
}

export interface FarmWeatherResult {
    latitude: number;
    longitude: number;
    timezone: string;
    elevationM: number;
    current: WeatherCurrentConditions;
    daily: WeatherDailyForecast[];
    advisories: {
        heavyRainExpected: boolean;
        droughtRisk: boolean;
        heatStress: boolean;
    };
}

export const getFarmWeather = async (farmId: string) => {
    return apiClient.get<ApiResponse<FarmWeatherResult>>(`/weather/farm/${farmId}`);
};

export const getWeatherByCoordinates = async (lat: number, lon: number) => {
    return apiClient.get<ApiResponse<FarmWeatherResult>>(`/weather`, { params: { lat, lon } });
};
