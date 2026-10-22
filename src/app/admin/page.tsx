'use client';

import {useEffect, useState} from 'react';
import {supabase} from '@/lib/supabase';
import {RequireRole} from '@/lib/guard';
import AdminResolutionQueue from './AdminResolutionQueue';
import AdminSearch from './AdminSearch';
import PopulationAggregates from './PopulationAggregates';
import SensitiveIndicatorLookup from './SensitiveIndicatorLookup';
import StateAdminView from './StateAdminView';
import {loadLgas,loadStates,loadWards, type GeographySource} from '@/lib/geography';

type EA={ea_id:string;ea_code:string;state:string;lga:string;ward:string;enumerator:string|null;target_households:number;registered_households:number;individuals:number;pct:number};
type Profile={user_id:string;full_name:string;role:string;state_id:number|null;is_active:boolean;created_at:string};
type GeoState={state_id:number;name:string};
type GeoLga={lga_id:number;state_id:number;name:string};
type GeoWard={ward_id:number;lga_id:number;name:string};
type DuplicateFlag={flag_id:string;kind:string;reason:string|null;status:string};
type AuditEntry={audit_id:number;table_name:string;record_id:string|null;action:string;changed_by:string|null;changed_at:string};

function AdminView(){
 const[eas,setEas]=useState<EA[]>([]);
 const[dups,setDups]=useState<DuplicateFlag[]>([]);
 const[profiles,setProfiles]=useState<Profile[]>([]);
 const[audit,setAudit]=useState<AuditEntry[]>([]);
 const[geoStates,setGeoStates]=useState<GeoState[]>([]);const[geoLgas,setGeoLgas]=useState<GeoLga[]>([]);const[geoWards,setGeoWards]=useState<GeoWard[]>([]);
 const[accountStates,setAccountStates]=useState<GeoState[]>([]);
 const[stateId,setStateId]=useState('');
 const[lgaId,setLgaId]=useState('');
 const[wardId,setWardId]=useState('');
 const[eaCode,setEaCode]=useState('');
 const[target,setTarget]=useState('120');
 const[assignmentState,setAssignmentState]=useState('');
 const[assignmentSearch,setAssignmentSearch]=useState('');
 const[assignmentEAs,setAssignmentEAs]=useState<string[]>([]);
 const[assignmentEnumerator,setAssignmentEnumerator]=useState('');
 const[msg,setMsg]=useState('');
 const[geoSource,setGeoSource]=useState<GeographySource>('local');
 const[approving,setApproving]=useState<string|null>(null);
 const[assigning,setAssigning]=useState(false);
 const[currentUserId,setCurrentUserId]=useState<string|null>(null);

 async function load(){
  const[progress,flags,users,logs]=await Promise.all([
   supabase.from('ea_progress').select('*').order('ea_code'),
   supabase.from('duplicate_flags').select('*').eq('status','open').order('created_at',{ascending:false}),
   supabase.from('profiles').select('user_id,full_name,role,state_id,is_active,created_at').order('full_name'),
   supabase.from('audit_log').select('audit_id,table_name,record_id,action,changed_by,changed_at').order('changed_at',{ascending:false}).limit(30),
  ]);
  setEas((progress.data??[]) as EA[]);
  setDups((flags.data??[]) as DuplicateFlag[]);
  setProfiles((users.data??[]) as Profile[]);
  setAudit((logs.data??[]) as AuditEntry[]);
  const failures=[progress.error,flags.error,users.error,logs.error].filter(Boolean);
  if(failures.length){
   console.error('Could not load admin dashboard data:',{progress:progress.error,duplicateFlags:flags.error,profiles:users.error,auditLog:logs.error});
   const details=[
    progress.error&&`ea_progress: ${progress.error.message}`,
    flags.error&&`duplicate_flags: ${flags.error.message}`,
    users.error&&`profiles: ${users.error.message}`,
    logs.error&&`audit_log: ${logs.error.message}`,
   ].filter(Boolean).join(' | ');
   setMsg(`Admin dashboard setup error: ${details} Run the Supabase SQL scripts listed in README.md, then refresh this page.`);
   return false;
  }else{
   setMsg('');
  }
  return true;
 }

 useEffect(()=>{
  void supabase.auth.getUser().then(({data})=>setCurrentUserId(data.user?.id??null));
  void load();
  void supabase.from('states').select('state_id,name').order('name').then(({data,error})=>{
   if(error){console.error('Could not load account state options:',error);setMsg(`Could not load account state options: ${error.message}`);return}
   setAccountStates((data??[]) as GeoState[]);
  });
  const channel=supabase.channel('admin-progress')
   .on('postgres_changes',{event:'*',schema:'public',table:'households'},()=>void load())
   .on('postgres_changes',{event:'*',schema:'public',table:'population_aggregates'},()=>void load())
   .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},()=>void load())
   .subscribe();
  return()=>{void supabase.removeChannel(channel)};
 },[]);

 useEffect(()=>{let active=true;void loadStates().then(result=>{if(!active)return;if(result.error)setMsg(result.error);setGeoSource(result.source);setGeoStates(result.data as GeoState[])});return()=>{active=false}},[]);
 useEffect(()=>{setGeoLgas([]);setGeoWards([]);if(!stateId)return;let active=true;void loadLgas(Number(stateId)).then(result=>{if(!active)return;if(result.error)setMsg(result.error);setGeoLgas(result.data as GeoLga[])});return()=>{active=false}},[stateId]);
 useEffect(()=>{setGeoWards([]);if(!lgaId)return;let active=true;void loadWards(Number(lgaId)).then(result=>{if(!active)return;if(result.error)setMsg(result.error);setGeoWards(result.data as GeoWard[])});return()=>{active=false}},[lgaId]);

 async function updateProfile(user_id:string,changes:Partial<Profile>){
  const target=profiles.find(profile=>profile.user_id===user_id);
  if(changes.role==='state_admin'&&!(changes.state_id??target?.state_id)){setMsg('Select a state before designating a state administrator.');return}
  if(target?.role==='state_admin'&&changes.state_id===null){setMsg('A state administrator must remain assigned to a state.');return}
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
  const selectedState=geoStates.find(item=>String(item.state_id)===stateId);const selectedLga=geoLgas.find(item=>String(item.lga_id)===lgaId);const selectedWard=geoWards.find(item=>String(item.ward_id)===wardId);
  if(!eaCode||!selectedState||!selectedLga||!selectedWard){setMsg('EA code, state, LGA and ward are required.');return}
  if(geoSource!=='database'){setMsg('These lists are a local reference preview. Sync complete geography to Supabase before creating an enumeration area.');return}
  const{error}=await supabase.from('enumeration_areas').insert({ea_code:eaCode,state:selectedState.name,lga:selectedLga.name,ward:selectedWard.name,ward_id:selectedWard.ward_id,target_households:+target});
  setMsg(error?.message??'Enumeration area created.');
  if(!error){setEaCode('');setStateId('');setLgaId('');setWardId('');void load()}
 }

 async function assignEA(){
  if(profiles.find(profile=>profile.user_id===currentUserId)?.role!=='administrator'){setMsg('Only administrators can assign enumeration areas.');return}
  const selectedProfile=profiles.find(profile=>profile.user_id===assignmentEnumerator&&['enumerator','state_admin'].includes(profile.role)&&profile.is_active&&profile.state_id===Number(assignmentState));
  if(!assignmentState||!assignmentEAs.length||!selectedProfile){setMsg('Choose a state, one or more enumeration areas, and an active enumerator assigned to that state.');return}
  if(assignmentEAs.some(id=>!assignmentAreas.some(area=>area.ea_id===id))){setMsg('Selected areas must all belong to the selected state. Choose the state and areas again.');return}
  const selectedAreaIds=[...assignmentEAs];
  setAssigning(true);
  try{
   const{data,error}=await supabase.from('enumeration_areas')
    .update({assigned_enumerator_id:assignmentEnumerator})
    .in('ea_id',selectedAreaIds)
    .select('ea_id');
   if(error){setMsg(`Could not assign the selected areas: ${error.message}`);return}
   if((data??[]).length!==selectedAreaIds.length){setMsg(`Only ${(data??[]).length} of ${selectedAreaIds.length} selected areas were updated. Refresh the dashboard and review the assignments.`);return}
   setAssignmentEAs([]);
   try{
    const refreshed=await load();
    if(refreshed)setMsg(`${selectedAreaIds.length} area${selectedAreaIds.length===1?'':'s'} assigned to ${selectedProfile.full_name} in ${selectedAssignmentState?.name}.`);
   }catch(error){
    console.error('Enumeration areas were assigned but the dashboard could not refresh:',error);
    setMsg(`Areas were assigned to ${selectedProfile.full_name}, but the dashboard could not refresh: ${error instanceof Error?error.message:'Unexpected error.'}`);
   }
  }catch(error){
   console.error('Could not assign enumeration areas:',error);
   setMsg(`Could not assign the selected areas: ${error instanceof Error?error.message:'Unexpected error.'}`);
  }finally{
   setAssigning(false);
  }
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

 const selectedAssignmentState=accountStates.find(item=>String(item.state_id)===assignmentState);
 const assignmentAreas=eas.filter(e=>e.state===selectedAssignmentState?.name);
 const assignmentQuery=assignmentSearch.trim().toLocaleLowerCase();
 const visibleAssignmentAreas=assignmentAreas.filter(area=>!assignmentQuery||`${area.ea_code} ${area.lga} ${area.ward}`.toLocaleLowerCase().includes(assignmentQuery));
 const assignmentEnumerators=profiles.filter(profile=>['enumerator','state_admin'].includes(profile.role)&&profile.is_active&&profile.state_id===Number(assignmentState));

 function selectVisibleAssignmentAreas(){
  setAssignmentEAs(current=>[...new Set([...current,...visibleAssignmentAreas.map(area=>area.ea_id)])]);
 }

 function toggleAssignmentEA(eaId:string,checked:boolean){
  setAssignmentEAs(current=>checked
   ?current.includes(eaId)?current:[...current,eaId]
   :current.filter(id=>id!==eaId));
 }

 return <main className="admin-page">
  <div className="admin-heading">
   <div><p className="eyebrow">Operations console</p><h1>Control room</h1><p>Accounts, field areas, progress, reports and audit trace.</p><AdminSearch/></div>
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
   <div className="panel-heading"><div><p className="eyebrow">02 / Field management</p><h2>Enumeration areas</h2><a className="text-link" href="https://www.nationalpopulation.gov.ng/EAD?utm_source=chatgpt.com" target="_blank" rel="noreferrer">Open NPC EAD source <span>↗</span></a></div><span>{eas.length} areas</span></div>
   <div className="ea-form">
    <input placeholder="EA code" value={eaCode} onChange={event=>setEaCode(event.target.value)}/>
    <select aria-label="EA state" value={stateId} onChange={event=>{setStateId(event.target.value);setLgaId('');setWardId('')}}><option value="">Select state</option>{geoStates.map(item=><option key={item.state_id} value={item.state_id}>{item.name}</option>)}</select>
    <select aria-label="EA LGA" value={lgaId} disabled={!stateId} onChange={event=>{setLgaId(event.target.value);setWardId('')}}><option value="">Select LGA</option>{geoLgas.filter(item=>String(item.state_id)===stateId).map(item=><option key={item.lga_id} value={item.lga_id}>{item.name}</option>)}</select>
    <select aria-label="EA ward" value={wardId} disabled={!lgaId} onChange={event=>setWardId(event.target.value)}><option value="">Select ward</option>{geoWards.filter(item=>String(item.lga_id)===lgaId).map(item=><option key={item.ward_id} value={item.ward_id}>{item.name}</option>)}</select>
    <input type="number" placeholder="Target HH" value={target} onChange={event=>setTarget(event.target.value)}/>
    <button onClick={createEA}>Create EA</button>
   </div>
   <div className="ea-assignment">
    <div><p className="eyebrow">Assign fieldwork</p><strong>Assign or reassign areas</strong><span>Select one or more EAs in a state and assign them to the same active enumerator. Existing assignments are replaced.</span></div>
    <select aria-label="Assignment state" value={assignmentState} onChange={event=>{setAssignmentState(event.target.value);setAssignmentEAs([]);setAssignmentEnumerator('');setAssignmentSearch('')}} disabled={assigning}>
     <option value="">Select state</option>{accountStates.map(state=><option key={state.state_id} value={state.state_id}>{state.name}</option>)}
    </select>
    <select aria-label="Enumerator to assign" value={assignmentEnumerator} onChange={event=>setAssignmentEnumerator(event.target.value)} disabled={assigning||!assignmentEnumerators.length}>
     <option value="">Select active enumerator</option>
     {assignmentEnumerators.map(profile=><option key={profile.user_id} value={profile.user_id}>{profile.full_name}</option>)}
    </select>
    <input aria-label="Search EAs by code, LGA, or ward" placeholder="Filter by EA, LGA, or ward" value={assignmentSearch} onChange={event=>setAssignmentSearch(event.target.value)} disabled={assigning||!assignmentState}/>
    <button onClick={()=>void assignEA()} disabled={assigning||!assignmentEAs.length||!assignmentEnumerator||profiles.find(profile=>profile.user_id===currentUserId)?.role!=='administrator'}>{assigning?'Assigning…':`Assign ${assignmentEAs.length||''} area${assignmentEAs.length===1?'':'s'}`}</button>
   </div>
   {assignmentState&&<div className="ea-assignment-selection">
    <div className="ea-assignment-tools">
     <span>{assignmentEAs.length} selected · {visibleAssignmentAreas.length} shown in {selectedAssignmentState?.name}</span>
     <button type="button" onClick={selectVisibleAssignmentAreas} disabled={assigning||!visibleAssignmentAreas.length}>Select shown</button>
     <button type="button" onClick={()=>setAssignmentEAs([])} disabled={assigning||!assignmentEAs.length}>Clear selection</button>
    </div>
    {assignmentAreas.length?<div className="admin-table-wrap"><table className="admin-table">
     <thead><tr><th>Select</th><th>EA</th><th>LGA / Ward</th><th>Current enumerator</th></tr></thead>
     <tbody>{visibleAssignmentAreas.map(area=><tr key={area.ea_id}>
      <td><input aria-label={`Select EA ${area.ea_code}`} type="checkbox" checked={assignmentEAs.includes(area.ea_id)} disabled={assigning} onChange={event=>toggleAssignmentEA(area.ea_id,event.target.checked)}/></td>
      <td>{area.ea_code}</td><td>{area.lga} / {area.ward}</td><td>{area.enumerator??'Unassigned'}</td>
     </tr>)}</tbody>
    </table>{!visibleAssignmentAreas.length&&<p className="empty-state">No EAs match this filter in the selected state.</p>}</div>:<p className="empty-state">No enumeration areas are registered in this state yet.</p>}
   </div>}
   {!profiles.some(profile=>['enumerator','state_admin'].includes(profile.role)&&profile.is_active)&&<p className="empty-state">Approve an active enumerator before assigning an area.</p>}
   <div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>EA</th><th>Location</th><th>Enumerator</th><th>Progress</th><th>People</th></tr></thead>
    <tbody>{eas.map(e=><tr key={e.ea_id}><td>{e.ea_code}</td><td>{e.state} / {e.lga} / {e.ward}</td><td>{e.enumerator??'Unassigned'}</td><td>{e.registered_households}/{e.target_households} ({e.pct}%)</td><td>{e.individuals}</td></tr>)}</tbody>
   </table></div>
  </section>
  <section className="admin-panel">
   <div className="panel-heading"><div><p className="eyebrow">03 / Access control</p><h2>User accounts</h2></div><span>{profiles.length} profiles</span></div>
   <div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>Name</th><th>Role</th><th>State scope</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>{profiles.map(profile=><tr key={profile.user_id}>
     <td>{profile.full_name}</td>
     <td><select value={profile.role} onChange={event=>void updateProfile(profile.user_id,{role:event.target.value})}><option value="citizen">Citizen</option><option value="enumerator">Enumerator</option><option value="state_admin">State administrator</option><option value="supervisor">Supervisor</option><option value="analyst">Analyst</option><option value="administrator">Administrator</option></select></td>
     <td><select aria-label={`State scope for ${profile.full_name}`} value={profile.state_id??''} onChange={event=>void updateProfile(profile.user_id,{state_id:event.target.value?Number(event.target.value):null})}><option value="">No state assigned</option>{accountStates.map(state=><option key={state.state_id} value={state.state_id}>{state.name}</option>)}</select></td>
     <td>{profile.is_active?'Active':'Pending'}</td>
     <td><button className="table-action" onClick={()=>void updateProfile(profile.user_id,{is_active:!profile.is_active})}>{profile.is_active?'Deactivate':'Activate'}</button></td>
    </tr>)}</tbody>
   </table></div>
  </section>
  <AdminResolutionQueue areas={eas} profiles={profiles}/>
  <PopulationAggregates/>
  <SensitiveIndicatorLookup role={profiles.find(profile=>profile.user_id===currentUserId)?.role}/>
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

function AdminDashboard(){
 const[scope,setScope]=useState<{role:string;stateId:number|null}|null>(null);
 const[scopeError,setScopeError]=useState('');
 function dashboardAccessError(error:{code?:string;message:string}){
  console.error('Could not resolve dashboard role:',error);
  if((error.code==='42703'||error.code==='PGRST204')&&/profiles\.state_id|state_id/i.test(error.message)){
   return 'This Supabase database is missing profiles.state_id. Apply supabase/012a_add_state_admin_role.sql, then supabase/012b_state_admin_access.sql in the Supabase SQL Editor, and refresh.';
  }
  return `Could not load your dashboard access: ${error.message}`;
 }
 useEffect(()=>{void(async()=>{
  const{data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user){setScopeError(userError?.message??'Your signed-in account could not be found.');return}
  const{data,error}=await supabase.from('profiles').select('role,state_id').eq('user_id',user.id).single();
  if(error){setScopeError(dashboardAccessError(error));return}
  setScope({role:data.role,stateId:data.state_id});
 })()},[]);
 if(scopeError)return <p className="admin-message" role="alert">{scopeError}</p>;
 if(!scope)return <p className="admin-message">Loading your control room…</p>;
 if(scope.role==='state_admin')return scope.stateId?<StateAdminView stateId={scope.stateId}/>:<p className="admin-message">This state administrator account has no state assigned. Contact the system administrator.</p>;
 return <AdminView/>;
}

export default function Admin(){return <RequireRole allow={['administrator','state_admin','supervisor','analyst']}><AdminDashboard/></RequireRole>}
