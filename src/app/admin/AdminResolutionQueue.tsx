'use client';

import {useEffect, useState} from 'react';
import {supabase} from '@/lib/supabase';

type EA={ea_id:string;ea_code:string;state:string;lga:string;ward:string};
type Profile={user_id:string;full_name:string;role:string;is_active:boolean};
type Person={surname?:string;firstname?:string;sex?:string;age?:number};
type Submission={
 submission_id:string;
 reference_code:string;
 status:'needs_admin'|'pending_enumerator';
 state:string;
 lga:string;
 ward:string;
 address:string;
 routing_reason:string|null;
 assigned_enumerator_id:string|null;
 payload:Record<string,unknown>|null;
 submitted_at:string;
};

const same=(left:string,right:string)=>left.trim().toLowerCase()===right.trim().toLowerCase();

export default function AdminResolutionQueue({areas,profiles}:{areas:EA[];profiles:Profile[]}){
 const[items,setItems]=useState<Submission[]>([]);
 const[eaSelection,setEaSelection]=useState<Record<string,string>>({});
 const[enumeratorSelection,setEnumeratorSelection]=useState<Record<string,string>>({});
 const[working,setWorking]=useState<string|null>(null);
 const[message,setMessage]=useState('');
 const activeEnumerators=profiles.filter(profile=>profile.role==='enumerator'&&profile.is_active);

 async function load(){
  const{data,error}=await supabase
   .from('citizen_submissions')
   .select('submission_id,reference_code,status,state,lga,ward,address,routing_reason,assigned_enumerator_id,payload,submitted_at')
   .in('status',['needs_admin','pending_enumerator'])
   .order('submitted_at',{ascending:false});
  if(error)setMessage(`Could not load citizen submissions: ${error.message}`);
  else setItems((data??[]) as Submission[]);
 }

 useEffect(()=>{
  void load();
  const channel=supabase.channel('admin-citizen-submissions')
   .on('postgres_changes',{event:'*',schema:'public',table:'citizen_submissions'},()=>void load())
   .subscribe();
  return()=>{void supabase.removeChannel(channel)};
 },[]);

 async function route(item:Submission){
  const eaId=eaSelection[item.submission_id];
  const enumeratorId=enumeratorSelection[item.submission_id];
  if(!eaId||!enumeratorId){setMessage('Choose an enumeration area and an active enumerator.');return}
  setWorking(item.submission_id);setMessage('');
  const{error}=await supabase.rpc('resolve_citizen_submission',{p_submission_id:item.submission_id,p_ea_id:eaId,p_enumerator_id:enumeratorId});
  setMessage(error?.message??`${item.reference_code} was sent to the enumerator.`);
  setWorking(null);
  if(!error)void load();
 }

 async function reject(item:Submission){
  setWorking(item.submission_id);setMessage('');
  const{error}=await supabase.rpc('reject_citizen_submission',{p_submission_id:item.submission_id,p_review_note:'Rejected by administrator during routing.'});
  setMessage(error?.message??`${item.reference_code} was rejected.`);
  setWorking(null);
  if(!error)void load();
 }

 return <section className="admin-panel">
  <div className="panel-heading">
   <div><p className="eyebrow">04 / Citizen forms</p><h2>Submitted household entries</h2><p className="section-note">Review each entry here. Entries with a matching assignment go to the enumerator for final approval.</p></div>
   <span>{items.length} open</span>
  </div>
  {message&&<p className="admin-message">{message}</p>}
  {items.length?items.map(item=>{
   const matches=areas.filter(area=>same(area.state,item.state)&&same(area.lga,item.lga)&&same(area.ward,item.ward));
   const members=Array.isArray(item.payload?.individuals)?item.payload?.individuals as Person[]:[];
   const enumerator=profiles.find(profile=>profile.user_id===item.assigned_enumerator_id)?.full_name;
   return <article className="review-item" key={item.submission_id}>
    <div>
     <strong>{item.reference_code}</strong>
     <p>{item.state} / {item.lga} / {item.ward}</p>
     <small>{item.address}</small>
     {item.routing_reason&&<small>{item.routing_reason}</small>}
     <details><summary>{members.length} household member{members.length===1?'':'s'}</summary><ul>{members.map((person,index)=><li key={`${item.submission_id}-${index}`}>{person.firstname} {person.surname}{person.sex?` · ${person.sex}`:''}{person.age===undefined?'':` · age ${person.age}`}</li>)}</ul></details>
    </div>
    {item.status==='pending_enumerator'?<div className="routing-actions"><strong>Waiting for {enumerator??'assigned enumerator'}</strong></div>:<div className="routing-actions">
     <select aria-label={`EA for ${item.reference_code}`} value={eaSelection[item.submission_id]??''} onChange={event=>setEaSelection(current=>({...current,[item.submission_id]:event.target.value}))} disabled={working===item.submission_id}>
      <option value="">Select matching EA</option>{matches.map(area=><option key={area.ea_id} value={area.ea_id}>{area.ea_code}</option>)}
     </select>
     <select aria-label={`Enumerator for ${item.reference_code}`} value={enumeratorSelection[item.submission_id]??''} onChange={event=>setEnumeratorSelection(current=>({...current,[item.submission_id]:event.target.value}))} disabled={working===item.submission_id}>
      <option value="">Select active enumerator</option>{activeEnumerators.map(profile=><option key={profile.user_id} value={profile.user_id}>{profile.full_name}</option>)}
     </select>
     {!matches.length&&<small>No matching EA has been created for this location.</small>}
     <button disabled={working===item.submission_id||!matches.length} onClick={()=>void route(item)}>{working===item.submission_id?'Routing…':'Send to enumerator'}</button>
     <button disabled={working===item.submission_id} onClick={()=>void reject(item)}>Reject</button>
    </div>}
   </article>
  }):!message&&<p className="empty-state">No open citizen form entries.</p>}
 </section>
}
