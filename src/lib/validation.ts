// Shared by browser and server: the server never trusts client-side checks.
import {householdCensusResponsesSchema,individualCensusResponsesSchema,type IndividualCensusResponses,type HouseholdCensusResponses} from './censusQuestionnaire';

export type Individual={surname:string;firstname:string;sex:string;date_of_birth?:string;age?:number;relationship_to_head?:string;education_level?:string;occupation?:string;disability_status?:string;census_responses:IndividualCensusResponses};
export type IndividualField=Exclude<keyof Individual,'census_responses'>;
export type Household={ea_id:string;address:string;housing_type?:string;ownership_status?:string;utilities?:Record<string,boolean>;consent_recorded:boolean;census_responses:HouseholdCensusResponses};
export type Submission={client_id:string;household:Household;individuals:Individual[]};
const ageFrom=(dob:string,t=new Date())=>{const b=new Date(dob);let a=t.getFullYear()-b.getFullYear();
 if(t.getMonth()<b.getMonth()||(t.getMonth()===b.getMonth()&&t.getDate()<b.getDate()))a--;return a};
export function validateSubmission(s:Submission){const e:string[]=[];
 if(!s.client_id)e.push('client_id required'); if(!s.household?.ea_id)e.push('Enumeration area is required');
 if(!s.household?.address?.trim())e.push('Household address is required');
 if(!s.household?.consent_recorded)e.push('Respondent consent must be recorded (NDPA 2023)');
 if(!householdCensusResponsesSchema.safeParse(s.household?.census_responses??{}).success)e.push('Household questionnaire responses are invalid');
 if(!s.individuals?.length)e.push('At least one household member is required');
 s.individuals?.forEach((p,i)=>{const n=`Member ${i+1}: `;
  if(!p.surname?.trim())e.push(n+'surname required'); if(!p.firstname?.trim())e.push(n+'first name required');
  if(!['male','female'].includes(p.sex))e.push(n+'sex required');
  if(p.age!==undefined&&(p.age<0||p.age>120))e.push(n+'age must be 0-120');
  if(p.date_of_birth){const d=new Date(p.date_of_birth);
   if(isNaN(+d)||d>new Date())e.push(n+'invalid date of birth');
   else if(p.age!==undefined&&Math.abs(ageFrom(p.date_of_birth)-p.age)>1)e.push(n+'age does not match date of birth')}
  const responses=individualCensusResponsesSchema.safeParse(p.census_responses);
  if(!responses.success)e.push(n+'questionnaire responses are invalid');
  else{
   if(responses.data.children_ever_born!==undefined&&responses.data.children_still_alive!==undefined&&responses.data.children_still_alive>responses.data.children_ever_born)e.push(n+'living children cannot exceed children ever born');
   if(responses.data.children_ever_born!==undefined&&responses.data.births_last_12_months!==undefined&&responses.data.births_last_12_months>responses.data.children_ever_born)e.push(n+'births in the past 12 months cannot exceed children ever born');
  }});
 const householdDeaths=s.household?.census_responses?.household_deaths_count;
 if(householdDeaths!==undefined&&householdDeaths>0&&s.household?.census_responses?.household_death_in_last_year===false)e.push('Household death count conflicts with the reported mortality response');
 return{valid:!e.length,errors:e}}
