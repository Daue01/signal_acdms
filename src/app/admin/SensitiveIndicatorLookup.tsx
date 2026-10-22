'use client';

import {useState} from 'react';
import {supabase} from '@/lib/supabase';

type Indicator={household_id:string;electricity_access_type:string|null;electricity_hours_per_day:number|null;water_source:string|null;water_fetch_minutes:number|null;cars_owned:number;income_band:string|null};

export default function SensitiveIndicatorLookup({role}:{role:string|undefined}){
 const[householdId,setHouseholdId]=useState('');const[reason,setReason]=useState('');const[result,setResult]=useState<Indicator|null>(null);const[message,setMessage]=useState('');const[loading,setLoading]=useState(false);
 if(role!=='administrator'&&role!=='analyst')return null;
 async function lookup(){if(!householdId.trim()||reason.trim().length<5){setMessage('Enter a household UUID and a reason of at least five characters.');return}setLoading(true);setMessage('');const{data,error}=await supabase.rpc('get_household_indicators',{p_household_id:householdId.trim(),p_reason:reason.trim()});setLoading(false);if(error){setMessage(error.message);setResult(null)}else{const item=(Array.isArray(data)?data[0]:data) as Indicator|null;setResult(item);setMessage(item?'Lookup complete.':'No indicator record exists for that household.')}}
 return <section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">06 / Restricted data access</p><h2>Housing and wealth lookup</h2><p className="section-note">Administrator/analyst access only. Every lookup is recorded with its reason.</p></div></div><div className="ea-form"><input aria-label="Household UUID" placeholder="Household reference / UUID" value={householdId} onChange={event=>setHouseholdId(event.target.value)}/><input aria-label="Reason for sensitive lookup" placeholder="Reason for lookup (required)" value={reason} onChange={event=>setReason(event.target.value)}/><button disabled={loading} onClick={()=>void lookup()}>{loading?'Looking up…':'Look up indicators'}</button></div>{message&&<p className="admin-message">{message}</p>}{result&&<div className="admin-table-wrap"><table className="admin-table"><tbody><tr><th>Electricity</th><td>{result.electricity_access_type??'Not recorded'} ({result.electricity_hours_per_day??'Not recorded'} hours/day)</td></tr><tr><th>Water</th><td>{result.water_source??'Not recorded'} ({result.water_fetch_minutes??'Not recorded'} minutes)</td></tr><tr><th>Cars owned</th><td>{result.cars_owned}</td></tr><tr><th>Income band</th><td>{result.income_band??'Not recorded'}</td></tr></tbody></table></div>}</section>
}
