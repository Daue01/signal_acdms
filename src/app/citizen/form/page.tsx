'use client';

import {useEffect, useState, type FormEvent} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase';
import {citizenSubmissionSchema, type CitizenSubmissionInput} from '@/lib/citizenSubmission';
import {loadLgas,loadStates,loadWards} from '@/lib/geography';
import Npc01Questionnaire from '@/components/Npc01Questionnaire';
import {legacyHousingType,legacyOwnershipStatus,type HouseholdCensusResponses,type IndividualCensusResponses} from '@/lib/censusQuestionnaire';
import type {IndividualField} from '@/lib/validation';

type State={state_id:number;name:string};
type Lga={lga_id:number;state_id:number;name:string};
type Ward={ward_id:number;lga_id:number;name:string};
type Person=CitizenSubmissionInput['individuals'][number];
const blank:Person={surname:'',firstname:'',sex:'male',census_responses:{functional_difficulties:{}}};
const defaultIncomeBands=['below_50000','50000_99999','100000_249999','250000_plus'];
const incomeBandLabel=(band:string)=>band.replace(/_/g,' ').replace(/(^| )\S/g,letter=>letter.toUpperCase());
const input='border border-gray-300 p-2 rounded w-full bg-white';

export default function CitizenForm(){
 const[states,setStates]=useState<State[]>([]);const[lgas,setLgas]=useState<Lga[]>([]);const[wards,setWards]=useState<Ward[]>([]);const[incomeBands,setIncomeBands]=useState(defaultIncomeBands);
 const[stateId,setStateId]=useState('');const[lgaId,setLgaId]=useState('');const[wardId,setWardId]=useState('');
 const[locality,setLocality]=useState('');const[address,setAddress]=useState('');const[housingType,setHousingType]=useState('');const[ownershipStatus,setOwnershipStatus]=useState('');
 const[electricityAccessType,setElectricityAccessType]=useState<CitizenSubmissionInput['electricityAccessType']>();const[electricityHours,setElectricityHours]=useState('');
 const[waterSource,setWaterSource]=useState<CitizenSubmissionInput['waterSource']>();const[waterMinutes,setWaterMinutes]=useState('');const[carsOwned,setCarsOwned]=useState('0');const[incomeBand,setIncomeBand]=useState('');
 const[latitude,setLatitude]=useState('');const[longitude,setLongitude]=useState('');const[consent,setConsent]=useState(false);const[people,setPeople]=useState<Person[]>([{...blank}]);
 const[censusResponses,setCensusResponses]=useState<HouseholdCensusResponses>({});
 const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);const[error,setError]=useState('');const[result,setResult]=useState<{referenceCode:string;status:string;routingReason:string|null}|null>(null);

 useEffect(()=>{void Promise.all([
  loadStates(),
  supabase.from('census_indicator_config').select('key,value').eq('key','income_bands').maybeSingle(),
 ]).then(([geography,configResult])=>{
  setStates(geography.data as State[]);
  if(geography.error)setError(geography.error);
  else if(!geography.data.length)setError('No states are loaded. Run supabase/009_refresh_geography.sql after importing enumeration areas.');
  if(!configResult.error&&Array.isArray(configResult.data?.value))setIncomeBands(configResult.data.value.filter((band):band is string=>typeof band==='string'));
 }).finally(()=>setLoading(false))},[]);

 useEffect(()=>{setLgas([]);setWards([]);setLgaId('');setWardId('');if(!stateId)return;let active=true;void loadLgas(Number(stateId)).then(result=>{if(!active)return;if(result.error)setError(result.error);setLgas(result.data as Lga[])});return()=>{active=false}},[stateId]);
 useEffect(()=>{setWards([]);setWardId('');if(!lgaId)return;let active=true;void loadWards(Number(lgaId)).then(result=>{if(!active)return;if(result.error)setError(result.error);setWards(result.data as Ward[])});return()=>{active=false}},[lgaId]);

 const updatePerson=(index:number,key:IndividualField,value:string|number|undefined)=>setPeople(current=>current.map((person,i)=>i===index?{...person,[key]:value}:person));
 const updatePersonResponse=<K extends keyof IndividualCensusResponses>(index:number,key:K,value:IndividualCensusResponses[K]|undefined)=>setPeople(current=>current.map((person,i)=>i===index?{...person,census_responses:{...person.census_responses,[key]:value}}:person));
 const updateHouseholdResponse=<K extends keyof HouseholdCensusResponses>(key:K,value:HouseholdCensusResponses[K]|undefined)=>{
  setCensusResponses(current=>({...current,[key]:value}));
  if(key==='building_type')setHousingType(legacyHousingType(typeof value==='string'?value:undefined));
  if(key==='tenure_status')setOwnershipStatus(legacyOwnershipStatus(typeof value==='string'?value:undefined));
 };
 const selectedLgas=lgas.filter(item=>String(item.state_id)===stateId);const selectedWards=wards.filter(item=>String(item.lga_id)===lgaId);
 function locate(){if(!navigator.geolocation){setError('Location is not available on this device.');return}navigator.geolocation.getCurrentPosition(position=>{setLatitude(position.coords.latitude.toFixed(6));setLongitude(position.coords.longitude.toFixed(6));setError('')},()=>setError('Location permission was not granted.'))}

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError('');setResult(null);
  setSaving(true);
  const payload={stateId:Number(stateId),lgaId:Number(lgaId),wardId:Number(wardId),locality,address,housingType,ownershipStatus,census_responses:censusResponses,
   electricityAccessType,electricityHoursPerDay:electricityHours===''?undefined:Number(electricityHours),waterSource,waterFetchMinutes:waterMinutes===''?undefined:Number(waterMinutes),carsOwned:Number(carsOwned),incomeBand,
   latitude:latitude===''?undefined:Number(latitude),longitude:longitude===''?undefined:Number(longitude),individuals:people,consentRecorded:consent,captchaToken:''};
  const parsed=citizenSubmissionSchema.safeParse(payload);
  if(!parsed.success){setError(parsed.error.issues[0]?.message??'Please complete the required fields.');setSaving(false);return}
  try{
   const response=await fetch('/api/citizen/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data)});
   const body=await response.json() as {error?:string;referenceCode?:string;status?:string;routingReason?:string|null};
   if(!response.ok)throw new Error(body.error??'Unable to submit the household.');
   setResult({referenceCode:body.referenceCode??'',status:body.status??'needs_admin',routingReason:body.routingReason??null});
   setPeople([{...blank}]);setAddress('');setLocality('');setConsent(false);setCensusResponses({});
  }catch(submitError){setError(submitError instanceof Error?submitError.message:'Unable to submit the household.')}finally{setSaving(false)}
 }

 return <main className="field-page">
  <div className="field-header"><div><p className="eyebrow">Public citizen intake</p><h1>Household form</h1><p>Submit your household details without creating an account. Keep the reference code to track progress.</p></div><Link className="auth-home" href="/">← Back to Naija / Signal</Link></div>
  {loading?<p className="field-alert">Loading official geography lists…</p>:null}
  {result?<section className="capture-card"><div className="section-title"><h2>Submission received</h2><span>{result.status.replace(/_/g,' ')}</span></div><p className="capture-message">Your reference code is <strong>{result.referenceCode}</strong>. Save it to check your status.</p>{result.routingReason&&<p className="field-alert">This entry needs an administrator to resolve its enumeration area before review.</p>}<Link className="button button-primary" href={`/citizen/status?reference=${encodeURIComponent(result.referenceCode)}`}>Track this submission <span>↗</span></Link></section>:null}
  {!result?<form onSubmit={submit}>
   <section className="capture-card"><div className="section-title"><h2>Household location</h2></div>
    <div className="field-grid">
     <label className="field-label">State<select className={input} required value={stateId} onChange={event=>{setStateId(event.target.value);setLgaId('');setWardId('')}}><option value="">Select state</option>{states.map(item=><option key={item.state_id} value={item.state_id}>{item.name}</option>)}</select></label>
     <label className="field-label">LGA<select className={input} required value={lgaId} onChange={event=>{setLgaId(event.target.value);setWardId('')}} disabled={!stateId}><option value="">Select LGA</option>{selectedLgas.map(item=><option key={item.lga_id} value={item.lga_id}>{item.name}</option>)}</select></label>
     <label className="field-label">Ward<select className={input} required value={wardId} onChange={event=>setWardId(event.target.value)} disabled={!lgaId}><option value="">Select ward</option>{selectedWards.map(item=><option key={item.ward_id} value={item.ward_id}>{item.name}</option>)}</select></label>
     <label className="field-label">Locality or EA label (optional)<input className={input} value={locality} onChange={event=>setLocality(event.target.value)} placeholder="Street, village or known EA label" /></label>
    </div>
    <label className="field-label">Household address<input className={input} required value={address} onChange={event=>setAddress(event.target.value)} placeholder="House number, street or local description" /></label>
    <div className="field-grid"><label className="field-label">Latitude (optional)<input className={input} value={latitude} onChange={event=>setLatitude(event.target.value)} /></label><label className="field-label">Longitude (optional)<input className={input} value={longitude} onChange={event=>setLongitude(event.target.value)} /></label></div>
    <button type="button" className="add-member" onClick={locate}>Use current location</button>
   </section>
   <section className="capture-card"><div className="section-title"><h2>Supplementary household indicators</h2><span>Optional ACDMS fields</span></div>
    <div className="field-grid"><label className="field-label">Electricity access<select className={input} value={electricityAccessType??''} onChange={event=>setElectricityAccessType((event.target.value||undefined) as CitizenSubmissionInput['electricityAccessType'])}><option value="">Select</option><option value="grid">Grid</option><option value="generator">Generator</option><option value="solar">Solar</option><option value="none">None</option></select></label><label className="field-label">Typical electricity hours/day<input className={input} type="number" min="0" max="24" value={electricityHours} onChange={event=>setElectricityHours(event.target.value)} /></label><label className="field-label">Water source<select className={input} value={waterSource??''} onChange={event=>setWaterSource((event.target.value||undefined) as CitizenSubmissionInput['waterSource'])}><option value="">Select</option><option value="piped">Piped</option><option value="borehole">Borehole</option><option value="well">Well</option><option value="surface">Surface water</option><option value="vendor">Vendor</option></select></label><label className="field-label">Minutes to fetch water<input className={input} type="number" min="0" max="1440" value={waterMinutes} onChange={event=>setWaterMinutes(event.target.value)} /></label><label className="field-label">Cars owned<input className={input} type="number" min="0" max="50" value={carsOwned} onChange={event=>setCarsOwned(event.target.value)} /></label><label className="field-label">Monthly income band<select className={input} value={incomeBand} onChange={event=>setIncomeBand(event.target.value)}><option value="">Prefer not to say</option>{incomeBands.map(band=><option key={band} value={band}>{incomeBandLabel(band)}</option>)}</select></label></div>
   </section>
   <Npc01Questionnaire people={people} householdResponses={censusResponses} inputClass={input} onPersonChange={updatePerson} onPersonResponseChange={updatePersonResponse} onHouseholdResponseChange={updateHouseholdResponse} onAddPerson={()=>setPeople(current=>[...current,{...blank}])} onRemovePerson={index=>setPeople(current=>current.filter((_,i)=>i!==index))}/>
   <label className="consent"><input type="checkbox" required checked={consent} onChange={event=>setConsent(event.target.checked)}/> I understand this form may contain sensitive personal and household details, and consent to submit it for census review.</label>
   <p className="field-alert">This prototype requires a data protection impact assessment (DPIA) before real data collection under NDPA 2023.</p>
   <button type="submit" disabled={saving||loading} className="button button-primary save-capture">{saving?'Submitting…':'Submit household'} <span>↗</span></button>
   {error&&<p className="auth-error" role="alert">{error}</p>}
  </form>:null}
 </main>
}
