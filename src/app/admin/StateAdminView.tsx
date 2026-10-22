'use client';

import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';

type Enumerator={user_id:string;full_name:string;role:string;state_id:number|null;is_active:boolean;created_at:string};
type Area={ea_id:string;ea_code:string;state:string;lga:string;ward:string;assigned_enumerator_id:string|null;target_households:number};
type State={state_id:number;name:string};

export default function StateAdminView({stateId}:{stateId:number}){
 const[enumerators,setEnumerators]=useState<Enumerator[]>([]);
 const[areas,setAreas]=useState<Area[]>([]);
 const[state,setState]=useState<State|null>(null);
 const[selectedEnumerator,setSelectedEnumerator]=useState('');
 const[selectedAreas,setSelectedAreas]=useState<string[]>([]);
 const[message,setMessage]=useState('');
 const[busy,setBusy]=useState(false);

 async function load(){
  const[stateResult,enumeratorResult,areaResult]=await Promise.all([
   supabase.from('states').select('state_id,name').eq('state_id',stateId).single(),
   supabase.from('profiles').select('user_id,full_name,role,state_id,is_active,created_at').eq('state_id',stateId).in('role',['enumerator','state_admin']).order('full_name'),
   supabase.from('enumeration_areas').select('ea_id,ea_code,state,lga,ward,assigned_enumerator_id,target_households').order('ea_code'),
  ]);
  const failures=[stateResult.error,enumeratorResult.error,areaResult.error].filter(Boolean);
  if(failures.length){
   console.error('Could not load state administration data:',{state:stateResult.error,enumerators:enumeratorResult.error,areas:areaResult.error});
   setMessage(`Could not load state administration data: ${failures.map(error=>error?.message).join(' | ')}`);
   return false;
  }
  setState(stateResult.data as State);
  setEnumerators((enumeratorResult.data??[]) as Enumerator[]);
  setAreas((areaResult.data??[]) as Area[]);
  return true;
 }

 useEffect(()=>{void load()},[stateId]);

 async function setEnumeratorActive(enumerator:Enumerator){
  setBusy(true);
  try{
   const{data,error}=await supabase.from('profiles').update({is_active:!enumerator.is_active}).eq('user_id',enumerator.user_id).eq('role','enumerator').eq('state_id',stateId).select('user_id');
   if(error){
    console.error('Could not update enumerator state:',error);
    setMessage(`Could not ${enumerator.is_active?'deactivate':'approve'} ${enumerator.full_name}: ${error.message}`);
   }else if((data??[]).length!==1){
    setMessage(`No account status changed for ${enumerator.full_name}. Refresh the state roster and try again.`);
   }else{
    setMessage(`${enumerator.full_name} ${enumerator.is_active?'deactivated':'approved'}.`);
    await load();
   }
  }catch(error){
   console.error('Could not update enumerator state:',error);
   setMessage(`Could not ${enumerator.is_active?'deactivate':'approve'} ${enumerator.full_name}: ${error instanceof Error?error.message:'Unexpected error.'}`);
  }finally{
   setBusy(false);
  }
 }

 function toggleArea(areaId:string,checked:boolean){
  setSelectedAreas(current=>checked
   ?current.includes(areaId)?current:[...current,areaId]
   :current.filter(id=>id!==areaId));
 }

 async function assignAreas(){
  const assignee=enumerators.find(item=>item.user_id===selectedEnumerator&&item.is_active&&item.state_id===stateId);
  if(!assignee||!selectedAreas.length){setMessage('Choose an active enumerator and at least one area in your state.');return}
  const allowedAreas=areas.filter(area=>area.state===state?.name);
  if(selectedAreas.some(id=>!allowedAreas.some(area=>area.ea_id===id))){
   setMessage('Only areas within your state can be assigned. Refresh and select the areas again.');
   return;
  }
  setBusy(true);
  try{
   const{data,error}=await supabase.from('enumeration_areas').update({assigned_enumerator_id:assignee.user_id}).in('ea_id',selectedAreas).select('ea_id');
   if(error){setMessage(`Could not assign the selected areas: ${error.message}`);return}
   if((data??[]).length!==selectedAreas.length){setMessage(`Only ${(data??[]).length} of ${selectedAreas.length} areas were assigned. Refresh and check the assignments.`);return}
   const count=selectedAreas.length;
   setSelectedAreas([]);
   setMessage(`${count} area${count===1?'':'s'} assigned to ${assignee.full_name}.`);
   await load();
  }catch(error){
   console.error('Could not assign state areas:',error);
   setMessage(`Could not assign the selected areas: ${error instanceof Error?error.message:'Unexpected error.'}`);
  }finally{
   setBusy(false);
  }
 }

 const activeEnumerators=enumerators.filter(enumerator=>enumerator.is_active);
 const stateAreas=areas.filter(area=>area.state===state?.name);
 const nameFor=(userId:string|null)=>enumerators.find(enumerator=>enumerator.user_id===userId)?.full_name??'Unassigned';

 return <main className="admin-page">
  <div className="admin-heading">
   <div><p className="eyebrow">State operations</p><h1>{state?.name??'State'} control room</h1><p>Manage enumerators and enumeration areas assigned to your state.</p></div>
  </div>
  {message&&<p className="admin-message" role="status">{message}</p>}
  <section className="admin-panel">
   <div className="panel-heading"><div><p className="eyebrow">01 / Access control</p><h2>Enumerators in {state?.name??'your state'}</h2></div><span>{enumerators.length} enumerators</span></div>
   {enumerators.length?<div className="admin-table-wrap"><table className="admin-table">
    <thead><tr><th>Name</th><th>Signed up</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>{enumerators.map(enumerator=><tr key={enumerator.user_id}>
     <td>{enumerator.full_name}</td>
     <td>{new Date(enumerator.created_at).toLocaleDateString()}</td>
     <td>{enumerator.role==='state_admin'?'State administrator · active':enumerator.is_active?'Active':'Awaiting approval'}</td>
     <td>{enumerator.role==='enumerator'&&<button className="table-action" disabled={busy} onClick={()=>void setEnumeratorActive(enumerator)}>{enumerator.is_active?'Deactivate':'Approve enumerator'}</button>}</td>
    </tr>)}</tbody>
   </table></div>:<p className="empty-state">No enumerators are currently assigned to your state. Ask the system administrator to assign their state.</p>}
  </section>
  <section className="admin-panel">
   <div className="panel-heading"><div><p className="eyebrow">02 / Field management</p><h2>Assign or reassign areas</h2><p>Select one or more EAs in {state?.name??'your state'} and assign them to an active enumerator.</p></div><span>{stateAreas.length} areas</span></div>
   {stateAreas.length&&activeEnumerators.length?<>
    <div className="ea-assignment">
     <select aria-label="Enumerator to assign" value={selectedEnumerator} onChange={event=>setSelectedEnumerator(event.target.value)} disabled={busy}>
      <option value="">Select active enumerator</option>{activeEnumerators.map(enumerator=><option key={enumerator.user_id} value={enumerator.user_id}>{enumerator.full_name}{enumerator.role==='state_admin'?' (state admin)':''}</option>)}
     </select>
     <button onClick={()=>void assignAreas()} disabled={busy||!selectedEnumerator||!selectedAreas.length}>{busy?'Saving…':`Assign ${selectedAreas.length||''} area${selectedAreas.length===1?'':'s'}`}</button>
    </div>
    <div className="admin-table-wrap"><table className="admin-table">
     <thead><tr><th>Select</th><th>EA</th><th>LGA / Ward</th><th>Current enumerator</th></tr></thead>
     <tbody>{stateAreas.map(area=><tr key={area.ea_id}>
      <td><input aria-label={`Select EA ${area.ea_code}`} type="checkbox" checked={selectedAreas.includes(area.ea_id)} disabled={busy} onChange={event=>toggleArea(area.ea_id,event.target.checked)}/></td>
      <td>{area.ea_code}</td><td>{area.lga} / {area.ward}</td><td>{nameFor(area.assigned_enumerator_id)}</td>
     </tr>)}</tbody>
    </table></div>
   </>:<p className="empty-state">{stateAreas.length?'Approve an enumerator before assigning areas.':'No enumeration areas are registered in your state yet.'}</p>}
   <a className="text-link" href="/enumerator">Open your enumerator capture form <span>↗</span></a>
  </section>
 </main>;
}
