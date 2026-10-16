'use client';

import {useEffect, useState} from 'react';
import {supabase} from '@/lib/supabase';
import styles from './CitizenSubmissions.module.css';

type EA={ea_id:string;ea_code:string;state:string;lga:string;ward:string};
type Profile={user_id:string;full_name:string};
type Person={surname:string;firstname:string;sex:string;age?:number;date_of_birth?:string;relationship_to_head?:string;education_level?:string;occupation?:string;disability_status?:string};
type CitizenSubmission={
 submission_id:string;
 user_id:string;
 state:string;
 lga:string;
 ward:string;
 address:string;
 housing_type:string|null;
 ownership_status:string|null;
 utilities:Record<string,boolean>;
 individuals:Person[];
 submitted_at:string;
};

const sameLocation=(left:string,right:string)=>left.trim().toLocaleLowerCase()===right.trim().toLocaleLowerCase();

export default function CitizenSubmissions({areas,profiles}:{areas:EA[];profiles:Profile[]}){
 const[items,setItems]=useState<CitizenSubmission[]>([]);const[message,setMessage]=useState('');const[working,setWorking]=useState<string|null>(null);const[selection,setSelection]=useState<Record<string,string>>({});

 async function load(){
  const{data,error}=await supabase.from('citizen_submissions').select('submission_id,user_id,state,lga,ward,address,housing_type,ownership_status,utilities,individuals,submitted_at').eq('status','pending').order('submitted_at',{ascending:false});
  if(error){setMessage(`Could not load citizen submissions: ${error.message}`);return}
  setItems((data??[]) as CitizenSubmission[]);
 }

 useEffect(()=>{
  void load();
  const channel=supabase.channel('citizen-submissions')
   .on('postgres_changes',{event:'*',schema:'public',table:'citizen_submissions'},()=>void load())
   .subscribe();
  return()=>{void supabase.removeChannel(channel)};
 },[]);

 const matchingAreas=(submission:CitizenSubmission)=>areas.filter(area=>
  sameLocation(area.state,submission.state)&&sameLocation(area.lga,submission.lga)&&sameLocation(area.ward,submission.ward)
 );

 async function approve(submission:CitizenSubmission){
  const matching=matchingAreas(submission);
  const eaId=selection[submission.submission_id]||matching[0]?.ea_id;
  if(!eaId){setMessage('Create an enumeration area matching this submission’s state, LGA and ward before approving it.');return}
  setWorking(submission.submission_id);setMessage('');
  const{error}=await supabase.rpc('approve_citizen_submission',{p_submission_id:submission.submission_id,p_ea_id:eaId});
  if(error)setMessage(`Could not approve submission: ${error.message}`);
  else setMessage('Citizen submission approved and added to census records.');
  setWorking(null);
  await load();
 }

 async function reject(submission:CitizenSubmission){
  setWorking(submission.submission_id);setMessage('');
  const{data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user){setMessage(`Could not verify administrator: ${userError?.message??'Sign in again.'}`);setWorking(null);return}
  const{data,error}=await supabase.from('citizen_submissions').update({status:'rejected',reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq('submission_id',submission.submission_id).eq('status','pending').select('submission_id').maybeSingle();
  if(error)setMessage(`Could not reject submission: ${error.message}`);
  else if(!data)setMessage('This submission has already been reviewed.');
  else setMessage('Citizen submission rejected.');
  setWorking(null);
  await load();
 }

 return <section className="admin-panel">
  <div className="panel-heading"><div><p className="eyebrow">03 / Citizen intake</p><h2>Pending household submissions</h2></div><span>{items.length} pending</span></div>
  {message&&<p className="admin-message">{message}</p>}
  {items.length? <div className={styles.list}>{items.map(submission=>{
   const matches=matchingAreas(submission);
   const name=profiles.find(profile=>profile.user_id===submission.user_id)?.full_name??'Citizen';
   return <article className={styles.card} key={submission.submission_id}>
    <div className={styles.heading}><div><strong>{name}</strong><span>{submission.state} / {submission.lga} / {submission.ward}</span></div><small>{new Date(submission.submitted_at).toLocaleString()}</small></div>
    <p><strong>Address:</strong> {submission.address}</p>
    <p><strong>Housing:</strong> {submission.housing_type||'Not provided'} · <strong>Ownership:</strong> {submission.ownership_status||'Not provided'}</p>
    <details><summary>{submission.individuals.length} household member{submission.individuals.length===1?'':'s'}</summary><ul>{submission.individuals.map((person,index)=><li key={`${submission.submission_id}-${index}`}>{person.firstname} {person.surname} · {person.sex}{person.age===undefined?'':` · age ${person.age}`}{person.relationship_to_head?` · ${person.relationship_to_head}`:''}</li>)}</ul></details>
    <div className={styles.actions}>
     <select aria-label={`Enumeration area for ${name}'s submission`} value={selection[submission.submission_id]??matches[0]?.ea_id??''} onChange={event=>setSelection(current=>({...current,[submission.submission_id]:event.target.value}))} disabled={!matches.length||working===submission.submission_id}>
      <option value="">No matching enumeration area</option>{matches.map(area=><option key={area.ea_id} value={area.ea_id}>{area.ea_code} · {area.state} / {area.lga} / {area.ward}</option>)}
     </select>
     {!matches.length&&<small>Create a matching enumeration area before approval.</small>}
     <button disabled={working===submission.submission_id||!matches.length} onClick={()=>void approve(submission)}>{working===submission.submission_id?'Working…':'Approve'}</button>
     <button className={styles.reject} disabled={working===submission.submission_id} onClick={()=>void reject(submission)}>Reject</button>
    </div>
   </article>
  })}</div>:!message&&<p className="empty-state">No citizen submissions are waiting for review.</p>}
 </section>
}
