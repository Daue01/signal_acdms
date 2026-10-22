'use client';

import type {KeyboardEvent} from 'react';
import nigeriaGeo from '@/data/ng.json';

export type GeoFeature = {
  properties: {id: string; name: string};
  geometry: {type: string; coordinates: any};
};

export const nigeriaFeatures = (nigeriaGeo as {features: GeoFeature[]}).features;

const points: number[][] = [];
const collect = (value: any) => {
  if (Array.isArray(value) && typeof value[0] === 'number') points.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
};
nigeriaFeatures.forEach(feature => collect(feature.geometry.coordinates));

const longitudes = points.map(point => point[0]);
const latitudes = points.map(point => point[1]);
const bounds = {
  minLongitude: Math.min(...longitudes),
  maxLongitude: Math.max(...longitudes),
  minLatitude: Math.min(...latitudes),
  maxLatitude: Math.max(...latitudes),
};

const project = (point: number[]) => {
  const padding = 32;
  return [
    padding + (point[0] - bounds.minLongitude) / (bounds.maxLongitude - bounds.minLongitude) * (800 - padding * 2),
    800 - padding - (point[1] - bounds.minLatitude) / (bounds.maxLatitude - bounds.minLatitude) * (800 - padding * 2),
  ];
};

const ringPath = (ring: number[][]) => ring.map((point, index) => {
  const [x, y] = project(point);
  return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
}).join(' ') + ' Z';

const pathFor = (feature: GeoFeature) => feature.geometry.type === 'Polygon'
  ? feature.geometry.coordinates.map(ringPath).join(' ')
  : feature.geometry.coordinates.map((polygon: number[][][]) => polygon.map(ringPath).join(' ')).join(' ');

const centroidFor = (feature: GeoFeature) => {
  const coordinates: number[][] = [];
  const visit = (value: any) => {
    if (Array.isArray(value) && typeof value[0] === 'number') coordinates.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
  };
  visit(feature.geometry.coordinates);
  const average = [
    coordinates.reduce((sum, point) => sum + point[0], 0) / coordinates.length,
    coordinates.reduce((sum, point) => sum + point[1], 0) / coordinates.length,
  ];
  return project(average);
};

const displayName = (name: string) => name === 'Federal Capital Territory' ? 'FCT' : name;

export default function NigeriaMap({
  visible = nigeriaFeatures,
  onSelect,
}: {
  visible?: GeoFeature[];
  onSelect: (stateName: string) => void;
}) {
  const activate = (event: KeyboardEvent<SVGElement>, stateName: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(stateName);
    }
  };

  return (
    <div className="geo-map-stage">
      <div className="map-label map-label-top">NIGERIA / ACTUAL STATE BOUNDARIES</div>
      <svg className="geo-map" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Interactive map of Nigeria states">
        <g className="geo-boundaries">
          {visible.map(feature => {
            const name = feature.properties.name;
            const label = displayName(name);
            return (
              <path
                key={feature.properties.id || name}
                d={pathFor(feature)}
                className="geo-state"
                role="button"
                tabIndex={0}
                aria-label={`View ${label}`}
                onClick={() => onSelect(name)}
                onKeyDown={event => activate(event, name)}
              >
                <title>{label}</title>
              </path>
            );
          })}
        </g>
        <g className="geo-markers">
          {visible.map(feature => {
            const name = feature.properties.name;
            const label = displayName(name);
            const [x, y] = centroidFor(feature);
            return (
              <g
                key={`marker-${feature.properties.id || name}`}
                className="geo-marker"
                transform={`translate(${x} ${y})`}
                role="button"
                tabIndex={0}
                aria-label={`View ${label}`}
                onClick={() => onSelect(name)}
                onKeyDown={event => activate(event, name)}
              >
                <circle className="marker-ring" r="11" />
                <circle className="marker-dot" r="4" />
                <text y="19" textAnchor="middle">{label}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="map-compass">N<br/><span>+</span></div>
      <div className="map-legend"><span><i className="legend-pulse"/> State signal</span><span><i/> Select a state</span></div>
    </div>
  );
}
