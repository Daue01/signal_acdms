'use client';

import {useEffect, useState} from 'react';
import Image from 'next/image';
import pilotData from '@/data/states.json';
import {statePhotos, type StatePhoto} from '@/data/stateImages';
import {supabase, supabaseConfigured} from '@/lib/supabase';
import {loadLgas,loadStates,loadWards} from '@/lib/geography';
import NigeriaMap, {nigeriaFeatures as features, type GeoFeature} from '@/components/NigeriaMap';

type PilotState={slug:string;iso_code:string;name:string;capital:string;region:string;nickname:string;known_for:string[];history:string;economy:string;fun_facts:string[];sources:string[];images:{title:string;commons_url?:string;url?:string;license?:string;license_note?:string}[]};
type StateInfo={name:string;code:string;capital:string;zone:string;population:string;signal:string;story:string;images:StatePhoto[];pilot?:PilotState};

const zoneByState:Record<string,string>={Abia:'South East',Adamawa:'North East','Akwa Ibom':'South South',Anambra:'South East',Bauchi:'North East',Benue:'North Central',Borno:'North East',Bayelsa:'South South','Cross River':'South South',Delta:'South South',Ebonyi:'South East',Edo:'South South',Ekiti:'South West',Enugu:'South East','Federal Capital Territory':'North Central',Gombe:'North East',Imo:'South East',Jigawa:'North West',Kaduna:'North West',Kebbi:'North West',Kano:'North West',Kogi:'North Central',Katsina:'North West',Kwara:'North Central',Lagos:'South West',Nassarawa:'North Central',Nasarawa:'North Central',Niger:'North Central',Ogun:'South West',Ondo:'South West',Osun:'South West',Oyo:'South West',Plateau:'North Central',Rivers:'South South',Sokoto:'North West',Taraba:'North East',Yobe:'North East',Zamfara:'North West'};
const capitalByState:Record<string,string>={Abia:'Umuahia',Adamawa:'Yola','Akwa Ibom':'Uyo',Anambra:'Awka',Bauchi:'Bauchi',Benue:'Makurdi',Borno:'Maiduguri',Bayelsa:'Yenagoa','Cross River':'Calabar',Delta:'Asaba',Ebonyi:'Abakaliki',Edo:'Benin City',Ekiti:'Ado-Ekiti',Enugu:'Enugu','Federal Capital Territory':'Abuja',Gombe:'Gombe',Imo:'Owerri',Jigawa:'Dutse',Kaduna:'Kaduna',Kebbi:'Birnin Kebbi',Kano:'Kano',Kogi:'Lokoja',Katsina:'Katsina',Kwara:'Ilorin',Lagos:'Ikeja',Nassarawa:'Lafia',Nasarawa:'Lafia',Niger:'Minna',Ogun:'Abeokuta',Ondo:'Akure',Osun:'Osogbo',Oyo:'Ibadan',Plateau:'Jos',Rivers:'Port Harcourt',Sokoto:'Sokoto',Taraba:'Jalingo',Yobe:'Damaturu',Zamfara:'Gusau'};
const populationByState:Record<string,string>={Lagos:'22.0m',Kano:'15.5m',Oyo:'7.8m',Kaduna:'8.3m',Rivers:'7.0m',Katsina:'7.8m',default:'3.8m'};
const signalByZone:Record<string,string>={'North West':'Market index','North East':'Rainfall watch','North Central':'Green watch','South West':'City pulse','South East':'Enterprise pulse','South South':'Coastal pulse'};
const stories:Record<string,string>={Lagos:'Nigeria’s engine room: a restless, creative megacity on the Atlantic edge.',Kano:'A global northern city where commerce, fashion, enterprise and history meet.',Abuja:'Nigeria’s federal city: a fast-growing meeting point for people, ideas and opportunity.',default:'A place of layered history, community energy and everyday possibility.'};
const pilotByName=Object.fromEntries((pilotData as PilotState[]).map(state=>[state.name,state]));
pilotByName['Federal Capital Territory']=pilotByName['Federal Capital Territory (Abuja)'];
const info=(name:string):StateInfo=>{const clean=name==='Federal Capital Territory'?'FCT':name;const pilot=pilotByName[name]||pilotByName[clean];const zone=zoneByState[name]||zoneByState[clean]||'Nigeria';return{name:clean,code:clean==='FCT'?'FC':clean.slice(0,2).toUpperCase(),capital:pilot?.capital||capitalByState[name]||'Not available',zone,population:populationByState[name]||populationByState.default,signal:pilot?.known_for?.slice(0,2).join(' · ')||pilot?.nickname||signalByZone[zone]||'Community pulse',story:pilot?`${pilot.history} ${pilot.economy}`:stories[name]||stories.default,images:statePhotos[clean]||[],pilot}};

type LiveTotal={aggregate_key:string;approved_households:string;approved_individuals:string;electricity_level:string;water_level:string};
type LiveState={state_id:number;name:string};
type LiveLga={lga_id:number;state_id:number;name:string};
type LiveWard={ward_id:number;lga_id:number;name:string};
function LivePopulationSignal(){
 const[total,setTotal]=useState<LiveTotal|null>(null);const[loadError,setLoadError]=useState(false);const[states,setStates]=useState<LiveState[]>([]);const[lgas,setLgas]=useState<LiveLga[]>([]);const[wards,setWards]=useState<LiveWard[]>([]);const[stateId,setStateId]=useState('');const[lgaId,setLgaId]=useState('');const[wardId,setWardId]=useState('');
 useEffect(()=>{
  if(!supabaseConfigured)return;
   void loadStates().then(result=>setStates(result.data as LiveState[]));
 },[]);
 useEffect(()=>{setLgas([]);setWards([]);if(!stateId)return;let active=true;void loadLgas(Number(stateId)).then(result=>{if(active)setLgas(result.data as LiveLga[])});return()=>{active=false}},[stateId]);
 useEffect(()=>{setWards([]);if(!lgaId)return;let active=true;void loadWards(Number(lgaId)).then(result=>{if(active)setWards(result.data as LiveWard[])});return()=>{active=false}},[lgaId]);
 useEffect(()=>{if(!supabaseConfigured)return;let active=true;setLoadError(false);const scope=wardId?'ward':lgaId?'lga':stateId?'state':'national';const args:{p_scope:string;p_state_id?:number;p_lga_id?:number;p_ward_id?:number}={p_scope:scope};if(stateId)args.p_state_id=Number(stateId);if(lgaId)args.p_lga_id=Number(lgaId);if(wardId)args.p_ward_id=Number(wardId);const load=async()=>{try{const{data,error}=await supabase.rpc('public_population_totals',args);if(!active)return;if(error){console.error('Failed to load public population totals.',error);setLoadError(true);setTotal(null);return}const row=(data as LiveTotal[]|null)?.[0];setTotal(row??null)}catch(error){console.error('Failed to load public population totals.',error);if(active){setLoadError(true);setTotal(null)}}};void load();const channel=supabase.channel('public-population-totals').on('postgres_changes',{event:'*',schema:'public',table:'population_aggregates'},()=>void load()).subscribe();return()=>{active=false;void supabase.removeChannel(channel)}},[stateId,lgaId,wardId]);
 const selectedLgas=lgas.filter(item=>String(item.state_id)===stateId);const selectedWards=wards.filter(item=>String(item.lga_id)===lgaId);const areaName=wardId?selectedWards.find(item=>String(item.ward_id)===wardId)?.name:lgaId?selectedLgas.find(item=>String(item.lga_id)===lgaId)?.name:stateId?states.find(item=>String(item.state_id)===stateId)?.name:'Nigeria';
 const formatCount=(value:string|undefined)=>{if(value===undefined)return'Not available';const parsed=Number(value);return Number.isFinite(parsed)?parsed.toLocaleString('en-NG'):value};
 return <article className="live-approved-card">
  <div className="live-approved-heading">
   <div><p className="eyebrow">Approved records / provisional</p><h3>Live approved <em>records</em></h3></div>
   <span className="live-status"><i/>{loadError?'Unable to load totals':!supabaseConfigured?'Not connected':total?'Aggregate available':'Awaiting approved data'}</span>
  </div>
  <div className="live-scope-filters" aria-label="Choose an area">
   <select className="live-scope-select" aria-label="Live total state" value={stateId} onChange={event=>{setStateId(event.target.value);setLgaId('');setWardId('')}}><option value="">All Nigeria</option>{states.map(item=><option key={item.state_id} value={item.state_id}>{item.name}</option>)}</select>
   <select className="live-scope-select" aria-label="Live total LGA" value={lgaId} onChange={event=>{setLgaId(event.target.value);setWardId('')}} disabled={!stateId}><option value="">All LGAs</option>{selectedLgas.map(item=><option key={item.lga_id} value={item.lga_id}>{item.name}</option>)}</select>
   <select className="live-scope-select" aria-label="Live total ward" value={wardId} onChange={event=>setWardId(event.target.value)} disabled={!lgaId}><option value="">All wards</option>{selectedWards.map(item=><option key={item.ward_id} value={item.ward_id}>{item.name}</option>)}</select>
  </div>
  <div className="live-approved-metrics" aria-live="polite">
   <div className="live-primary-metric"><span>Approved individuals</span><strong>{formatCount(total?.approved_individuals)}</strong></div>
   <div className="live-secondary-metrics">
    <div><span>Households</span><strong>{formatCount(total?.approved_households)}</strong></div>
    <div><span>Electricity access</span><strong>{total?.electricity_level??'Not available'}</strong></div>
    <div><span>Improved water</span><strong>{total?.water_level??'Not available'}</strong></div>
   </div>
  </div>
  <div className="live-approved-foot"><span>Showing {areaName}</span><small>{loadError?'Live totals could not be loaded. Please try again later.':!supabaseConfigured?'Live aggregates are not configured for this deployment.':total?'Provisional enumeration counts, not official census results.':'No approved aggregate is available for this selection yet.'}</small></div>
 </article>
}


function RichLightbox({selected,onClose}:{selected:StateInfo;onClose:()=>void}){return <div className="lightbox-backdrop rich-lightbox" onClick={onClose}><article className="state-lightbox rich-state-lightbox" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button className="close-lightbox" onClick={onClose} aria-label="Close state details">×</button><div className="lightbox-visual"><span className="lightbox-code">{selected.code}</span><p>{selected.zone}</p></div><div className="lightbox-content"><p className="eyebrow">State signal / {selected.code}</p><h2>{selected.name}</h2><p className="lightbox-story">{selected.story}</p>{selected.pilot&&<><p className="pilot-nickname">{selected.pilot.nickname}</p><div className="pilot-facts">{selected.pilot.known_for.map(item=><span key={item}>{item}</span>)}</div></>}{selected.images.length>0?<div className="state-photo-grid">{selected.images.map(image=><figure key={image.src}><Image src={image.src} alt={image.alt} width={640} height={430} sizes="(max-width: 800px) 50vw, 230px"/><figcaption>{image.caption}</figcaption></figure>)}</div>:<p className="state-photo-note">No state-specific photo was included for this location.</p>}<div className="lightbox-facts"><div><span>Capital</span><strong>{selected.capital}</strong></div><div><span>Population</span><strong>{selected.population}</strong></div><div><span>Live read</span><strong>{selected.signal}</strong></div></div><a className="state-guide-link" href="/nigeria">Explore Nigeria’s geography and history <span>↗</span></a><button className="button button-primary" onClick={onClose}>Close signal <span>×</span></button></div></article></div>}

export default function Home(){const[selected,setSelected]=useState<StateInfo|null>(null);const[zone,setZone]=useState('All zones');const zones=['All zones','North West','North Central','North East','South West','South East','South South'];const shown=zone==='All zones'?features:features.filter(f=>(zoneByState[f.properties.name]||'')===zone);
 useEffect(()=>{const items=Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));if(!('IntersectionObserver'in window)){items.forEach(item=>item.classList.add('is-visible'));return}const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.12,rootMargin:'0px 0px -35px 0px'});document.body.classList.add('motion-ready');items.forEach(item=>observer.observe(item));return()=>{observer.disconnect();document.body.classList.remove('motion-ready')}},[]);
 useEffect(()=>{const handleKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setSelected(null)};window.addEventListener('keydown',handleKeyDown);return()=>window.removeEventListener('keydown',handleKeyDown)},[]);
 return <main className="site-shell">{selected&&<RichLightbox selected={selected} onClose={()=>setSelected(null)}/>}
 <section className="hero" id="top"><div className="hero-grid"/><div className="hero-copy" data-reveal><p className="eyebrow"><span className="live-dot"/> Live civic intelligence</p><h1>One country.<br/><em>Many signals.</em></h1><p className="hero-lede">A living guide to Nigeria, its places, people, patterns and possibilities. Tap a state to see what makes it move.</p><div className="hero-actions"><a href="#explore" className="button button-primary">Explore the map <span>↓</span></a><a href="/nigeria" className="text-link">Read Nigeria’s story <span>↗</span></a></div></div><div className="hero-visual" aria-label="Interactive globe centered on Nigeria" data-reveal><iframe className="globe-document" src="/nigeria-globe.html" title="Interactive rotating globe centered on Nigeria" loading="eager"/><span className="hero-coordinate">9°04′N &nbsp; 8°40′E</span></div><div className="hero-meta"><span>01</span><span className="meta-line"/><span>Scroll to discover</span></div><div className="hero-stat"><strong>923,768</strong><span>km² of stories</span></div></section>
 <section className="intro-strip"><p>Designed for the curious, the connected and the community-minded.</p><div><span className="tiny-bars"><i/><i/><i/><i/><i/></span><span>Signals update daily</span></div></section>
 <section className="national-context" aria-label="Nigeria's administrative structure">
  <div className="context-facts">
   <div><strong>36</strong><span>states</span></div>
   <div><strong>+1</strong><span>Federal Capital Territory</span></div>
   <div><strong>6</strong><span>geopolitical zones</span></div>
   <div><strong>774</strong><span>LGAs and FCT area councils</span></div>
  </div>
  <details className="context-history">
   <summary>How the federation took shape</summary>
   <p>States replaced the regions in 1967. The federation grew to 19 states in 1976 and 30 by 1991; the FCT was established separately in 1976. Changes in 1996 established today’s 36 states.</p>
   <a href="/nigeria">Explore Nigeria’s geography and history ↗</a>
  </details>
 </section>
 <section className="geo-map-section section-wrap" id="explore" data-reveal><div className="section-heading"><div><p className="eyebrow">01 / The real map</p><h2>Every state has a <em>signal.</em></h2></div><p className="section-note">Actual Nigeria state boundaries from the supplied GeoJSON. Select any state to open its details.</p></div><div className="zone-tabs">{zones.map(z=><button key={z} type="button" aria-pressed={zone===z} className={zone===z?'zone-active':''} onClick={()=>setZone(z)}>{z}</button>)}</div><NigeriaMap visible={shown} onSelect={name=>setSelected(info(name))}/><div className="map-footer"><span>Showing {shown.length} locations</span><span>Tap any state to go deeper <b>→</b></span></div></section>
 <section className="signals-section section-wrap" id="signals" data-reveal><div className="section-heading"><div><p className="eyebrow">02 / Live records</p><h2>What Nigeria is <em>telling us.</em></h2></div><p className="section-note">Explore the country’s administrative structure and approved, provisional household data.</p></div><div className="signal-grid">
  <article className="signal-card signal-card-dark dashboard-fact"><div className="card-top"><span>Federation</span><span className="card-icon">◌</span></div><strong>36<span> states</span></strong><p>Plus the Federal Capital Territory</p></article>
  <article className="signal-card signal-card-yellow dashboard-fact"><div className="card-top"><span>Regions</span><span className="card-icon">✦</span></div><strong>6<span> zones</span></strong><p>North Central, North East, North West, South East, South South and South West</p></article>
  <article className="signal-card signal-card-light dashboard-fact"><div className="card-top"><span>Local administration</span><span className="card-icon">↗</span></div><strong>774</strong><p>LGAs and FCT area councils</p></article>
  <LivePopulationSignal/>
 </div></section>
 <section className="stories-section section-wrap" id="stories" data-reveal><div className="section-heading"><div><p className="eyebrow">03 / The journal</p><h2>Go beyond the <em>headline.</em></h2></div><a className="text-link" href="#stories">View all stories <span>↗</span></a></div><div className="article-grid">{['The rivers that connect a nation','A living map of Nigerian cities','Reading the pulse of everyday life'].map((title,i)=><article className={`article-card article-${i}`} key={title} style={{'--card-index':i} as React.CSSProperties}><div className="article-art"><span className="art-number">0{i+1}</span><span className="art-shape"/><span className="art-caption">{i===0?'FLOW / 001':i===1?'CITY / 014':'DATA / 027'}</span></div><div className="article-copy"><p className="article-tag">{i===0?'Field notes':i===1?'People & place':'Data story'}</p><h3>{title}</h3><p>Explore the people, places, systems and signals that make Nigeria unmistakably itself.</p><a href="#about" className="read-link">Read story <span>→</span></a></div></article>)}</div></section>
 <section className="portal-section section-wrap" id="about"><div className="portal-card"><div><p className="eyebrow">04 / Join the signal</p><h2>Your Nigeria.<br/><em>Your contribution.</em></h2><p>Submit a household without an account, keep your reference code, or sign in to access the secure field and administration portals.</p></div><div className="portal-action"><div className="portal-orbit"><span>✦</span></div><a href="/citizen/form" className="button button-light">Submit household <span>↗</span></a><small><a href="/citizen/status">Track an existing submission</a></small></div></div></section>
 <footer className="footer"><a className="brand" href="#top" aria-label="Naija Signal home"><Image className="brand-logo" src="/naija-signal-logo.png" alt="Naija Signal" width={746} height={334}/></a><p>Made with curiosity for everyone who calls Nigeria home.</p><span>© 2026 / Explore responsibly</span></footer>
 </main>}
