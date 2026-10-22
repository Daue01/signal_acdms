'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {RequireRole} from '@/lib/guard';
import {loadAssignedAreas, pendingCount, syncAll, submitOrQueue, type CachedArea} from '@/lib/offline';
import {validateSubmission, type Individual,type IndividualField} from '@/lib/validation';
import Npc01Questionnaire from '@/components/Npc01Questionnaire';
import {legacyHousingType,legacyOwnershipStatus,type HouseholdCensusResponses,type IndividualCensusResponses} from '@/lib/censusQuestionnaire';

const blank:Individual={surname:'',firstname:'',sex:'',census_responses:{functional_difficulties:{}}};
const input='border border-gray-300 p-2 rounded w-full bg-white';

function EnumeratorView(){
 const[areas,setAreas]=useState<CachedArea[]>([]);
 const[eaId,setEaId]=useState('');
 const[addr,setAddr]=useState('');
 const[housing,setHousing]=useState('');
 const[ownership,setOwnership]=useState('');
 const[utilities,setUtilities]=useState<Record<string,boolean>>({water:false,electricity:false,sanitation:false});
 const[censusResponses,setCensusResponses]=useState<HouseholdCensusResponses>({});
 const[consent,setConsent]=useState(false);
 const[people,setPeople]=useState<Individual[]>([{...blank}]);
 const[msg,setMsg]=useState('');
 const[pending,setPending]=useState(0);
 const[online,setOnline]=useState(true);
 const[saving,setSaving]=useState(false);

 const refresh=async()=>{
  const next=await loadAssignedAreas();
  setAreas(next);
  setEaId(current=>current||next[0]?.ea_id||'');
  setPending(await pendingCount());
 };

 useEffect(()=>{
  setOnline(navigator.onLine);
  void refresh();
  const onOnline=()=>{setOnline(true);void refresh()};
  const onOffline=()=>setOnline(false);
  window.addEventListener('online',onOnline);
  window.addEventListener('offline',onOffline);
  return()=>{window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline)};
 },[]);

 const ea=areas.find(area=>area.ea_id===eaId);
 const assignedStates=[...new Set(areas.map(area=>area.state))];
 const updatePerson=(index:number,key:IndividualField,value:string|number|undefined)=>
  setPeople(current=>current.map((person,i)=>i===index?{...person,[key]:value}:person));
 const updatePersonResponse=<K extends keyof IndividualCensusResponses>(index:number,key:K,value:IndividualCensusResponses[K]|undefined)=>
  setPeople(current=>current.map((person,i)=>i===index?{...person,census_responses:{...person.census_responses,[key]:value}}:person));
 const updateHouseholdResponse=<K extends keyof HouseholdCensusResponses>(key:K,value:HouseholdCensusResponses[K]|undefined)=>{
  setCensusResponses(current=>({...current,[key]:value}));
  if(key==='building_type')setHousing(legacyHousingType(typeof value==='string'?value:undefined));
  if(key==='tenure_status')setOwnership(legacyOwnershipStatus(typeof value==='string'?value:undefined));
 };

 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  setMsg('');
  const submission={client_id:crypto.randomUUID(),household:{ea_id:eaId,address:addr,housing_type:housing,ownership_status:ownership,utilities,consent_recorded:consent,census_responses:censusResponses},individuals:people};
  const result=validateSubmission(submission);
  if(!result.valid){setMsg(result.errors.join('; '));return}

  setSaving(true);
  try{
   const outcome=await submitOrQueue(submission);
   setPending(outcome.pending);
   setMsg(outcome.pending
    ?`Interview saved on this device. ${outcome.pending} record(s) are waiting to synchronize when you have internet.`
    :'Interview synchronized successfully.');
   setAddr('');
   setHousing('');
   setOwnership('');
   setUtilities({water:false,electricity:false,sanitation:false});
   setCensusResponses({});
   setConsent(false);
   setPeople([{...blank}]);
  }catch(error){
   setMsg(error instanceof Error?`Could not save interview: ${error.message}`:'Could not save interview.');
  }finally{
   setSaving(false);
  }
 }

 async function sync(){
  const outcome=await syncAll();
  setPending(outcome.pending);
  setMsg(outcome.failed?`${outcome.uploaded} uploaded; ${outcome.failed} still waiting to synchronize.`:`${outcome.uploaded} record(s) synchronized.`);
 }

 return <main className="field-page">
  <div className="field-header">
   <div>
    <p className="eyebrow">Enumerator workspace</p>
    <h1>Citizen interviews</h1>
    <p>Record household answers on behalf of residents in your assigned area. Interviews can be saved offline and synchronized when you reconnect.</p>
    <p>{assignedStates.length?`Assigned state${assignedStates.length>1?'s':''}: ${assignedStates.join(', ')} · ${areas.length} assigned EA${areas.length===1?'':'s'}`:'No assigned enumeration area cached'}</p><p>{ea?`Current EA: ${ea.ea_code} · ${ea.state} · ${ea.lga} · ${ea.ward}`:'Select an assigned EA below.'}</p><p><a className="text-link" href="/enumerator/review">Review citizen submissions ↗</a></p>
   </div>
   <div className={online?'connection online':'connection'}><span/>{online?'Online':'Offline'}<button type="button" onClick={()=>void sync()}>Pending: {pending} · Sync</button></div>
  </div>
  {!areas.length&&<div className="field-alert">No enumeration area is available on this device. Connect once to download your assignment before entering a remote area.</div>}
  <form onSubmit={save}>
   <section className="capture-card">
    <div className="section-title"><h2>Household identification and supplementary indicators</h2><span>Provided by the respondent</span></div>
    <label className="field-label">Enumeration area
     <select className={input} required value={eaId} onChange={event=>setEaId(event.target.value)}>
      <option value="">Select assigned area</option>
      {areas.map(area=><option key={area.ea_id} value={area.ea_id}>{area.ea_code} · {area.state} · {area.lga} · {area.ward}</option>)}
     </select>
    </label>
    <label className="field-label">Household address
     <input className={input} required value={addr} onChange={event=>setAddr(event.target.value)} placeholder="House number, street or local description"/>
    </label>
    <div className="field-label">Utilities available
     <div className="checks">{Object.keys(utilities).map(key=><label key={key}><input type="checkbox" checked={utilities[key]} onChange={event=>setUtilities(current=>({...current,[key]:event.target.checked}))}/>{key}</label>)}</div>
    </div>
   </section>
   <Npc01Questionnaire people={people} householdResponses={censusResponses} inputClass={input} onPersonChange={updatePerson} onPersonResponseChange={updatePersonResponse} onHouseholdResponseChange={updateHouseholdResponse} onAddPerson={()=>setPeople(current=>[...current,{...blank}])} onRemovePerson={index=>setPeople(current=>current.filter((_,i)=>i!==index))}/>
   <label className="consent"><input type="checkbox" required checked={consent} onChange={event=>setConsent(event.target.checked)}/> I confirm the respondent was informed and consents to this interview, including the optional personal and household questions.</label>
   <button type="submit" disabled={saving} className="button button-primary save-capture">{saving?'Saving interview…':'Save interview'} <span>↗</span></button>
   {msg&&<p className="capture-message" role="status">{msg}</p>}
  </form>
 </main>
}

export default function Enumerator(){return <RequireRole allow={['enumerator','state_admin']}><EnumeratorView/></RequireRole>}
