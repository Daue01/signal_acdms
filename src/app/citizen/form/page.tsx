'use client';

import {useState, type FormEvent} from 'react';
import {RequireRole} from '@/lib/guard';
import {supabase} from '@/lib/supabase';
import type {Individual} from '@/lib/validation';

const blank:Individual={surname:'',firstname:'',sex:''};
const input='border border-gray-300 p-2 rounded w-full bg-white';

function CitizenFormView(){
 const[state,setState]=useState('');const[lga,setLga]=useState('');const[ward,setWard]=useState('');const[address,setAddress]=useState('');const[housing,setHousing]=useState('');const[ownership,setOwnership]=useState('');const[utilities,setUtilities]=useState<Record<string,boolean>>({water:false,electricity:false,sanitation:false});const[consent,setConsent]=useState(false);const[people,setPeople]=useState<Individual[]>([{...blank}]);const[msg,setMsg]=useState('');const[error,setError]=useState('');const[saving,setSaving]=useState(false);
 const updatePerson=(index:number,key:keyof Individual,value:string|number|undefined)=>setPeople(current=>current.map((person,i)=>i===index?{...person,[key]:value}:person));

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setMsg('');setError('');
  if(!consent)return setError('Respondent consent must be recorded before submitting.');
  if(!people.length||people.some(person=>!person.surname.trim()||!person.firstname.trim()||!['male','female'].includes(person.sex)))return setError('Enter each household member’s surname, first name and sex.');
  setSaving(true);
  try{
   const{data:{user},error:userError}=await supabase.auth.getUser();
   if(userError)throw userError;
   if(!user)throw new Error('Sign in with a verified citizen account before submitting.');
   if(!user.email_confirmed_at)throw new Error('Verify your email before submitting a household.');
   const{error:submitError}=await supabase.from('citizen_submissions').insert({
    user_id:user.id,
    state:state.trim(),
    lga:lga.trim(),
    ward:ward.trim(),
    address:address.trim(),
    housing_type:housing||null,
    ownership_status:ownership||null,
    utilities,
    individuals:people.map(person=>({...person,date_of_birth:person.date_of_birth||null})),
    consent_recorded:consent,
   });
   if(submitError)throw submitError;
   setMsg('Your household details were submitted for review. They will not enter the census until an administrator approves them.');
   setState('');setLga('');setWard('');setAddress('');setHousing('');setOwnership('');setUtilities({water:false,electricity:false,sanitation:false});setConsent(false);setPeople([{...blank}]);
  }catch(submitError){
   setError(submitError instanceof Error?submitError.message:'Unable to submit the household.');
  }finally{
   setSaving(false);
  }
 }

 return <main className="field-page">
  <div className="field-header"><div><p className="eyebrow">Citizen workspace</p><h1>Household form</h1><p>Submit your household details for review. Email-verified citizen accounts can submit without administrator account approval.</p></div><a className="auth-home" href="/">← Back to Naija / Signal</a></div>
  <form onSubmit={submit}>
   <section className="capture-card">
    <div className="section-title"><h2>Household location</h2><span>Required</span></div>
    <div className="field-grid">
     <label className="field-label">State<input className={input} required value={state} onChange={event=>setState(event.target.value)} /></label>
     <label className="field-label">LGA<input className={input} required value={lga} onChange={event=>setLga(event.target.value)} /></label>
     <label className="field-label">Ward<input className={input} required value={ward} onChange={event=>setWard(event.target.value)} /></label>
     <label className="field-label">Household address<input className={input} required value={address} onChange={event=>setAddress(event.target.value)} placeholder="House number, street or local description" /></label>
    </div>
    <div className="field-grid">
     <label className="field-label">Housing type<select className={input} value={housing} onChange={event=>setHousing(event.target.value)}><option value="">Select</option><option>Detached house</option><option>Terrace / flat</option><option>Compound room</option><option>Temporary shelter</option><option>Other</option></select></label>
     <label className="field-label">Ownership status<select className={input} value={ownership} onChange={event=>setOwnership(event.target.value)}><option value="">Select</option><option>Owner occupied</option><option>Rented</option><option>Rent free</option><option>Other</option></select></label>
    </div>
    <div className="field-label">Utilities available<div className="checks">{Object.keys(utilities).map(key=><label key={key}><input type="checkbox" checked={utilities[key]} onChange={event=>setUtilities(current=>({...current,[key]:event.target.checked}))}/>{key}</label>)}</div></div>
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
   <label className="consent"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/> I am informed and consent to submit these household details for census review.</label>
   <button type="submit" disabled={saving} className="button button-primary save-capture">{saving?'Submitting…':'Submit household for review'} <span>↗</span></button>
   {error&&<p className="auth-error">{error}</p>}{msg&&<p className="capture-message">{msg}</p>}
  </form>
 </main>
}

export default function CitizenForm(){return <RequireRole allow={['citizen']}><CitizenFormView/></RequireRole>}
