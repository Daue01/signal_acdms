'use client';

import {useEffect, useState} from 'react';
import {supabase} from '@/lib/supabase';
import {RequireRole} from '@/lib/guard';
import CitizenSubmissions from './CitizenSubmissions';

type EA={ea_id:string;ea_code:string;state:string;lga:string;ward:string;enumerator:string|null;target_households:number;registered_households:number;individuals:number;pct:number};
type Profile={user_id:string;full_name:string;role:string;is_active:boolean;created_at:string};
type DuplicateFlag={flag_id:string;kind:string;reason:string|null;status:string};
type AuditEntry={audit_id:number;table_name:string;record_id:string|null;action:string;changed_by:string|null;changed_at:string};

function AdminView(){
 const[eas,setEas]=useState<EA[]>([]);
 const[dups,setDups]=useState<DuplicateFlag[]>([]);
 const[profiles,setProfiles]=useState<Profile[]>([]);
 const[audit,setAudit]=useState<AuditEntry[]>([]);
 const[state,setState]=useState('');
 const[lga,setLga]=useState('');
 const[ward,setWard]=useState('');
 const[eaCode,setEaCode]=useState('');
 const[target,setTarget]=useState('120');
 const[msg,setMsg]=useState('');
 const[approving,setApproving]=useState<string|null>(null);

 async function load(){
  const[progress,flags,users,logs]=await Promise.all([
   supabase.from('ea_progress').select('*').order('ea_code'),
   supabase.from('duplicate_flags').select('*').eq('status','open').order('created_at',{ascending:false}),
   supabase.from('profiles').select('user_id,full_name,role,is_active,created_at').order('full_name'),
   supabase.from('audit_log').select('audit_id,table_name,record_id,action,changed_by,changed_at').order('changed_at',{ascending:false}).limit(30),
  ]);
  const failures=[progress.error,flags.error,users.error,logs.error].filter(Boolean);
  if(failures.length){
   console.error('Could not load admin dashboard data:',{progress:progress.error,duplicateFlags:flags.error,profiles:users.error,auditLog:logs.error});
   setMsg('Admin dashboard data is not fully set up. Run the Supabase SQL scripts listed in README.md, then refresh this page.');
  }else{
   setMsg('');
  }
  setEas((progress.data??[]) as EA[]);
  setDups((flags.data??[]) as DuplicateFlag[]);
  setProfiles((users.data??[]) as Profile[]);
  setAudit((logs.data??[]) as AuditEntry[]);
 }

 useEffect(()=>{
  void load();
  const channel=supabase.channel('admin-progress')
   .on('postgres_changes',{event:'*',schema:'public',table:'households'},()=>void load())
   .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},()=>void load())
   .subscribe();
  return()=>{void supabase.removeChannel(channel)};
 },[]);

 async function updateProfile(user_id:string,changes:Partial<Profile>){
  const{error}=await supabase.from('profiles').update(changes).eq('user_id',user_id);
  setMsg(error?.message??'Account updated.');
  if(!error)void load();
 }

 async function approveEnumerator(profile:Profile){
  setApproving(profile.user_id);
  const{error}=await supabase.from('profiles').update({is_active:true}).eq('user_id',profile.user_id).eq('role','enumerator').eq('is_active',false);
  setMsg(error?.message??`${profile.full_name} approved as an enumerator.`);
  setApproving(null);
  if(!error)void load();
 }

 async function createEA(){
  if(!eaCode||!state||!lga||!ward){setMsg('EA code, state, LGA and ward are required.');return}
  const{error}=await supabase.from('enumeration_areas').insert({ea_code:eaCode,state,lga,ward,target_households:+target});
  setMsg(error?.message??'Enumeration area created.');
  if(!error){setEaCode('');setState('');setLga('');setWard('');void load()}
 }

 async function review(id:string,status:'confirmed'|'dismissed'){
  const{data:{user}}=await supabase.auth.getUser();
  const{error}=await supabase.from('duplicate_flags').update({status,reviewed_by:user?.id}).eq('flag_id',id);
  setMsg(error?.message??`Duplicate ${status}.`);
  if(!error)void load();
 }

 function download(){
  const csv=['EA code,state,LGA,ward,target,registered,individuals,percent',...eas.map(e=>[e.ea_code,e.state,e.lga,e.ward,e.target_households,e.registered_households,e.individuals,e.pct].join(','))].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='acdms-enumeration-progress.csv';a.click();URL.revokeObjectURL(a.href);
 }

 return <main className="admin-page">
  <div className="admin-heading">
   <div><p className="eyebrow">Operations console</p><h1>Control room</h1><p>Accounts, field areas, progress, reports and audit trace.</p></div>
   <button className="button button-primary" onClick={download}>Download progress CSV <span>↓</span></button>
  </div>
  {msg&&<p className="admin-message">{msg}</p>}
  <section className="admin-panel">
   <div className="panel-heading"><div><p className="eyebrow">01 / Access control</p><h2>Enumerators awaiting approval</h2></div><span>{profiles.filter(profile=>profile.role==='enumerator'&&!profile.is_active).length} pending</span></div>
   {profiles.some(profile=>profile.role==='enumerator'&&!profile.is_active)?<div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>Name</th><th>Signed up</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>{profiles.filter(profile=>profile.role==='enumerator'&&!profile.is_active).map(profile=><tr key={profile.user_id}>
     <td>{profile.full_name}</td>
     <td>{new Date(profile.created_at).toLocaleDateString()}</td>
     <td>Awaiting approval</td>
     <td><button className="table-action" disabled={approving===profile.user_id} onClick={()=>void approveEnumerator(profile)}>{approving===profile.user_id?'Approving…':'Approve enumerator'}</button></td>
    </tr>)}</tbody>
   </table></div>:<p className="empty-state">No enumerators are awaiting approval.</p>}
  </section>
  <section className="admin-panel">
   <div className="panel-heading"><div><p className="eyebrow">02 / Field management</p><h2>Enumeration areas</h2></div><span>{eas.length} areas</span></div>
   <div className="ea-form">
    <input placeholder="EA code" value={eaCode} onChange={event=>setEaCode(event.target.value)}/>
    <input placeholder="State" value={state} onChange={event=>setState(event.target.value)}/>
    <input placeholder="LGA" value={lga} onChange={event=>setLga(event.target.value)}/>
    <input placeholder="Ward" value={ward} onChange={event=>setWard(event.target.value)}/>
    <input type="number" placeholder="Target HH" value={target} onChange={event=>setTarget(event.target.value)}/>
    <button onClick={createEA}>Create EA</button>
   </div>
   <div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>EA</th><th>Location</th><th>Enumerator</th><th>Progress</th><th>People</th></tr></thead>
    <tbody>{eas.map(e=><tr key={e.ea_id}><td>{e.ea_code}</td><td>{e.state} / {e.lga} / {e.ward}</td><td>{e.enumerator??'Unassigned'}</td><td>{e.registered_households}/{e.target_households} ({e.pct}%)</td><td>{e.individuals}</td></tr>)}</tbody>
   </table></div>
  </section>
  <section className="admin-panel">
   <div className="panel-heading"><div><p className="eyebrow">03 / Access control</p><h2>User accounts</h2></div><span>{profiles.length} profiles</span></div>
   <div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>{profiles.map(profile=><tr key={profile.user_id}>
     <td>{profile.full_name}</td>
     <td><select value={profile.role} onChange={event=>void updateProfile(profile.user_id,{role:event.target.value})}><option value="citizen">Citizen</option><option value="enumerator">Enumerator</option><option value="supervisor">Supervisor</option><option value="administrator">Administrator</option></select></td>
     <td>{profile.is_active?'Active':'Pending'}</td>
     <td><button className="table-action" onClick={()=>void updateProfile(profile.user_id,{is_active:!profile.is_active})}>{profile.is_active?'Deactivate':'Activate'}</button></td>
    </tr>)}</tbody>
   </table></div>
  </section>
  <CitizenSubmissions areas={eas} profiles={profiles}/>
  <div className="admin-columns">
   <section className="admin-panel">
    <div className="panel-heading"><div><p className="eyebrow">05 / Data quality</p><h2>Potential duplicates</h2></div><span>{dups.length} open</span></div>
    {dups.length?<div className="review-list">{dups.map(flag=><div className="review-item" key={flag.flag_id}><span>{flag.kind}: {flag.reason}</span><div><button onClick={()=>void review(flag.flag_id,'confirmed')}>Confirm</button><button onClick={()=>void review(flag.flag_id,'dismissed')}>Dismiss</button></div></div>)}</div>:<p className="empty-state">No open duplicate flags.</p>}
   </section>
   <section className="admin-panel">
    <div className="panel-heading"><div><p className="eyebrow">06 / Accountability</p><h2>Audit log</h2></div><span>Latest 30</span></div>
    <div className="audit-list">{audit.map(item=><div key={item.audit_id}><strong>{item.action}</strong><span>{item.table_name} · {new Date(item.changed_at).toLocaleString()}</span></div>)}</div>
   </section>
  </div>
 </main>
}

export default function Admin(){return <RequireRole allow={['administrator','supervisor']}><AdminView/></RequireRole>}
