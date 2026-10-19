'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {RequireRole} from '@/lib/guard';
import {loadAssignedAreas, pendingCount, syncAll, submitOrQueue, type CachedArea} from '@/lib/offline';
import {validateSubmission, type Individual} from '@/lib/validation';

const blank:Individual={surname:'',firstname:'',sex:''};
const input='border border-gray-300 p-2 rounded w-full bg-white';

function EnumeratorView(){
 const[areas,setAreas]=useState<CachedArea[]>([]);
 const[eaId,setEaId]=useState('');
 const[addr,setAddr]=useState('');
 const[housing,setHousing]=useState('');
 const[ownership,setOwnership]=useState('');
 const[utilities,setUtilities]=useState<Record<string,boolean>>({water:false,electricity:false,sanitation:false});
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
 const updatePerson=(index:number,key:keyof Individual,value:string|number|undefined)=>
  setPeople(current=>current.map((person,i)=>i===index?{...person,[key]:value}:person));

 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  setMsg('');
  const submission={client_id:crypto.randomUUID(),household:{ea_id:eaId,address:addr,housing_type:housing,ownership_status:ownership,utilities,consent_recorded:consent},individuals:people};
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
    <p>{ea?`${ea.ea_code} · ${ea.state} · ${ea.lga} · ${ea.ward}`:'No assigned enumeration area cached'}</p><p><a className="text-link" href="/enumerator/review">Review citizen submissions ↗</a></p>
   </div>
   <div className={online?'connection online':'connection'}><span/>{online?'Online':'Offline'}<button type="button" onClick={()=>void sync()}>Pending: {pending} · Sync</button></div>
  </div>
  {!areas.length&&<div className="field-alert">No enumeration area is available on this device. Connect once to download your assignment before entering a remote area.</div>}
  <form onSubmit={save}>
   <section className="capture-card">
    <div className="section-title"><h2>Household details</h2><span>Provided by the respondent</span></div>
    <label className="field-label">Enumeration area
     <select className={input} required value={eaId} onChange={event=>setEaId(event.target.value)}>
      <option value="">Select assigned area</option>
      {areas.map(area=><option key={area.ea_id} value={area.ea_id}>{area.ea_code} · {area.state} · {area.lga} · {area.ward}</option>)}
     </select>
    </label>
    <label className="field-label">Household address
     <input className={input} required value={addr} onChange={event=>setAddr(event.target.value)} placeholder="House number, street or local description"/>
    </label>
    <div className="field-grid">
     <label className="field-label">Housing type
      <select className={input} value={housing} onChange={event=>setHousing(event.target.value)}><option value="">Select</option><option>Detached house</option><option>Terrace / flat</option><option>Compound room</option><option>Temporary shelter</option><option>Other</option></select>
     </label>
     <label className="field-label">Ownership status
      <select className={input} value={ownership} onChange={event=>setOwnership(event.target.value)}><option value="">Select</option><option>Owner occupied</option><option>Rented</option><option>Rent free</option><option>Other</option></select>
     </label>
    </div>
    <div className="field-label">Utilities available
     <div className="checks">{Object.keys(utilities).map(key=><label key={key}><input type="checkbox" checked={utilities[key]} onChange={event=>setUtilities(current=>({...current,[key]:event.target.checked}))}/>{key}</label>)}</div>
    </div>
   </section>
   <section className="capture-card">
    <div className="section-title"><h2>Household members</h2><span>{people.length} member{people.length===1?'':'s'}</span></div>
    {people.map((person,index)=><div className="person-card" key={index}>
     <div className="person-heading"><strong>Member {index+1}</strong>{people.length>1&&<button type="button" onClick={()=>setPeople(current=>current.filter((_,i)=>i!==index))}>Remove</button>}</div>
     <div className="field-grid">
      <input className={input} required placeholder="Surname" value={person.surname} onChange={event=>updatePerson(index,'surname',event.target.value)}/>
      <input className={input} required placeholder="First name" value={person.firstname} onChange={event=>updatePerson(index,'firstname',event.target.value)}/>
      <select className={input} required value={person.sex} onChange={event=>updatePerson(index,'sex',event.target.value)}><option value="">Sex</option><option value="male">Male</option><option value="female">Female</option></select>
      <input className={input} type="number" min="0" max="120" placeholder="Age" value={person.age??''} onChange={event=>updatePerson(index,'age',event.target.value===''?undefined:+event.target.value)}/>
      <input className={input} type="date" value={person.date_of_birth??''} onChange={event=>updatePerson(index,'date_of_birth',event.target.value||undefined)}/>
      <select className={input} value={person.relationship_to_head??''} onChange={event=>updatePerson(index,'relationship_to_head',event.target.value)}><option value="">Relationship</option><option>head</option><option>spouse</option><option>child</option><option>parent</option><option>sibling</option><option>other_relative</option><option>non_relative</option></select>
      <input className={input} placeholder="Education level" value={person.education_level??''} onChange={event=>updatePerson(index,'education_level',event.target.value)}/>
      <input className={input} placeholder="Occupation" value={person.occupation??''} onChange={event=>updatePerson(index,'occupation',event.target.value)}/>
      <input className={`${input} col-span-2`} placeholder="Disability status (optional)" value={person.disability_status??''} onChange={event=>updatePerson(index,'disability_status',event.target.value)}/>
     </div>
    </div>)}
    <button className="add-member" type="button" onClick={()=>setPeople(current=>[...current,{...blank}])}>+ Add household member</button>
   </section>
   <label className="consent"><input type="checkbox" required checked={consent} onChange={event=>setConsent(event.target.checked)}/> I confirm the respondent was informed and consents to this interview.</label>
   <button type="submit" disabled={saving} className="button button-primary save-capture">{saving?'Saving interview…':'Save interview'} <span>↗</span></button>
   {msg&&<p className="capture-message" role="status">{msg}</p>}
  </form>
 </main>
}

export default function Enumerator(){return <RequireRole allow={['enumerator']}><EnumeratorView/></RequireRole>}
