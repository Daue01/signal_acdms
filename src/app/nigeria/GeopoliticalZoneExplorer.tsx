'use client';

import {useState} from 'react';
import Image from 'next/image';
import NigeriaMap, {nigeriaFeatures} from '@/components/NigeriaMap';

type Zone = {
  name: string;
  states: string;
  note: string;
  focus: string;
  history: string;
  accent: string;
};

type EraMap = {
  period: string;
  label: string;
  title: string;
  summary: string;
  src: string;
};

const zones: Zone[] = [
  {
    name: 'North West',
    states: 'Jigawa, Kaduna, Kano, Katsina, Kebbi, Sokoto and Zamfara',
    note: 'A broad inland region of Hausa speaking cities, historic trade routes, farming landscapes and the Sokoto basin.',
    focus: 'Trade, scholarship and dryland farming',
    history: 'The North West connects long standing Hausa city traditions with the legacy of the Sokoto Caliphate and modern commercial networks.',
    accent: '#d9f25b',
  },
  {
    name: 'North East',
    states: 'Adamawa, Bauchi, Borno, Gombe, Taraba and Yobe',
    note: 'From the Lake Chad basin and drylands to high plateaus and headwaters near the Cameroon border.',
    focus: 'Lake Chad, highlands and resilience',
    history: 'The North East holds the deep history of Kanem Borno, lake basin trade, farming communities and important eastern highlands.',
    accent: '#ff9d7f',
  },
  {
    name: 'North Central',
    states: 'Benue, Kogi, Kwara, Nasarawa, Niger and Plateau, plus the FCT',
    note: 'Nigeria’s central transition belt includes the Niger and Benue confluence, the Jos Plateau and the federal capital.',
    focus: 'Confluence, plateaus and the capital',
    history: 'The North Central zone is a meeting ground of river systems, farming belts, uplands and the administrative heart of the federation.',
    accent: '#8ec5a0',
  },
  {
    name: 'South West',
    states: 'Ekiti, Lagos, Ogun, Ondo, Osun and Oyo',
    note: 'A Yoruba majority region spanning Atlantic lagoons and coastal forests through inland hills and savanna.',
    focus: 'Cities, culture and coastal gateways',
    history: 'The South West brings together Yoruba cities and kingdoms, major ports, creative industries, farms and a fast changing urban corridor.',
    accent: '#ffc85a',
  },
  {
    name: 'South East',
    states: 'Abia, Anambra, Ebonyi, Enugu and Imo',
    note: 'A densely settled region of Igbo communities, uplands, river valleys, commercial towns and agricultural land.',
    focus: 'Enterprise, hills and river valleys',
    history: 'The South East is shaped by Igbo community networks, trading towns, agricultural landscapes and a strong culture of enterprise.',
    accent: '#9dc9d2',
  },
  {
    name: 'South South',
    states: 'Akwa Ibom, Bayelsa, Cross River, Delta, Edo and Rivers',
    note: 'The Niger Delta and Gulf of Guinea coast combine mangrove waterways, rainforest, ports, oil and gas infrastructure, and diverse communities.',
    focus: 'Delta waterways and Atlantic coast',
    history: 'The South South follows the rivers to the sea, where mangroves, rainforest, ports, energy infrastructure and coastal communities meet.',
    accent: '#85b8a6',
  },
];

const statesInZone = (zone: Zone) => {
  const stateNames = zone.states
    .replace(', plus the FCT', '')
    .replace(/\s+and\s+/g, ', ')
    .split(',')
    .map(state => state.trim());
  if (zone.name === 'North Central') stateNames.push('Federal Capital Territory');
  return stateNames;
};

const eraMaps: EraMap[] = [
  {period: '1960 to 1963', label: 'Regions', title: 'The regional federation', summary: 'At independence, Nigeria was organised around three large regions and the Mid Western Region.', src: '/nigeria-guide/history/nigeria-1960-1963.png'},
  {period: '1963 to 1967', label: 'Regions', title: 'A new republic', summary: 'The map shows the four regions that shaped the First Republic before state creation began.', src: '/nigeria-guide/history/nigeria-1963-1967.png'},
  {period: '1967 to 1976', label: '12 states', title: 'The first state structure', summary: 'The regions were replaced by states, changing how the federation was administered.', src: '/nigeria-guide/history/nigeria-1967-1976.png'},
  {period: '1976 to 1987', label: '19 states', title: 'A wider federation', summary: 'Further state creation brought government closer to more communities and established the FCT separately.', src: '/nigeria-guide/history/nigeria-1976-1987.png'},
  {period: '1987 to 1991', label: '21 states', title: 'Another expansion', summary: 'The federation continued to change as new states were created across the country.', src: '/nigeria-guide/history/nigeria-1987-1991.png'},
  {period: '1991 to 1996', label: '30 states', title: 'The modern map takes shape', summary: 'This period shows the country just before the creation of today’s final six states in 1996.', src: '/nigeria-guide/history/nigeria-1991-1996.png'},
];

export default function GeopoliticalZoneExplorer() {
  const [activeZone, setActiveZone] = useState(0);
  const [activeEra, setActiveEra] = useState(eraMaps.length - 1);
  const zone = zones[activeZone];
  const era = eraMaps[activeEra];
  const zoneStates = statesInZone(zone);
  const visibleStates = nigeriaFeatures.filter(feature => zoneStates.includes(feature.properties.name));

  function selectState(stateName: string) {
    const selectedZone = zones.findIndex(item => statesInZone(item).includes(stateName));
    if (selectedZone >= 0) setActiveZone(selectedZone);
  }
  const zoneImage = activeZone === 0 ? '/nigeria-guide/kwatarkwashi.jpg' : era.src;
  const zoneImageAlt = activeZone === 0 ? 'Mountain Kwatarkwashi in Zamfara State' : `${era.title} map of Nigeria`;

  function selectEra(index: number) {
    setActiveEra(index);
  }

  function moveEra(direction: number) {
    setActiveEra((current) => (current + direction + eraMaps.length) % eraMaps.length);
  }

  return (
    <section className="zone-explorer" aria-labelledby="zone-explorer-title">
      <div className="zone-explorer-heading">
        <div>
          <p className="eyebrow">Interactive atlas</p>
          <h3 id="zone-explorer-title">Six zones, <em>many connections.</em></h3>
        </div>
        <p>Choose a zone to explore its character, then move through the historical maps to see how the federation changed over time.</p>
      </div>

      <div className="zone-explorer-layout">
        <div className="zone-map-column">
          <div className="zone-selector" role="tablist" aria-label="Choose a geopolitical zone">
            {zones.map((item, index) => (
              <button
                key={item.name}
                className={index === activeZone ? 'zone-selector-button is-active' : 'zone-selector-button'}
                type="button"
                role="tab"
                aria-selected={index === activeZone}
                aria-controls="zone-detail-panel"
                onClick={() => setActiveZone(index)}
                style={{'--zone-accent': item.accent} as React.CSSProperties}
              >
                <span>0{index + 1}</span>
                <strong>{item.name}</strong>
                <small>{item.focus}</small>
              </button>
            ))}
          </div>
          <NigeriaMap visible={visibleStates} onSelect={selectState} />
        </div>

        <article
          className="zone-detail-panel"
          id="zone-detail-panel"
          role="tabpanel"
          style={{'--zone-accent': zone.accent} as React.CSSProperties}
        >
          <div className="zone-detail-copy">
            <p className="zone-detail-kicker">Selected zone / 0{activeZone + 1}</p>
            <h4>{zone.name}</h4>
            <p className="zone-detail-note">{zone.note}</p>
            <p>{zone.history}</p>
            <div className="zone-detail-meta">
              <div><span>States and territory</span><strong>{zone.states}</strong></div>
              <div><span>Read this landscape through</span><strong>{zone.focus}</strong></div>
            </div>
          </div>
          <figure className="zone-detail-image">
            <Image src={zoneImage} alt={zoneImageAlt} width={900} height={760} sizes="(max-width: 760px) 100vw, 44vw" />
            <figcaption>{activeZone === 0 ? 'Kwatarkwashi, Zamfara State' : `${era.label}, ${era.period}`}</figcaption>
          </figure>
        </article>
      </div>

      <div className="history-browser">
        <div className="history-browser-heading">
          <div>
            <p className="eyebrow">Map the change</p>
            <h4>How the federation <em>took shape.</em></h4>
          </div>
          <p>Use the timeline or the arrow controls to move from the regional map of independence to the state structure that preceded today’s 36 states.</p>
        </div>
        <div className="history-browser-controls">
          <button type="button" className="history-arrow" onClick={() => moveEra(-1)} aria-label="Show previous historical map">←</button>
          <div className="history-era-tabs" role="tablist" aria-label="Historical maps of Nigeria">
            {eraMaps.map((item, index) => (
              <button key={item.period} type="button" role="tab" aria-selected={index === activeEra} aria-controls="history-map-panel" className={index === activeEra ? 'history-era-tab is-active' : 'history-era-tab'} onClick={() => selectEra(index)}>
                <span>{item.period}</span>
                <small>{item.label}</small>
              </button>
            ))}
          </div>
          <button type="button" className="history-arrow" onClick={() => moveEra(1)} aria-label="Show next historical map">→</button>
        </div>
        <div className="history-map-stage" id="history-map-panel" role="tabpanel" aria-live="polite" aria-label={`${era.title}, ${era.period}`}>
          <Image src={era.src} alt={`${era.title}, Nigeria ${era.period}`} width={1869} height={1658} sizes="(max-width: 900px) 100vw, 68vw" priority={activeEra === eraMaps.length - 1} />
          <div className="history-map-label"><span>{era.period}</span><strong>{era.title}</strong><small>{era.summary}</small></div>
        </div>
      </div>
    </section>
  );
}
