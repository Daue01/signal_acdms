import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {NextResponse} from 'next/server';

type CsvRow=Record<string,string>;
type LocalState={state_id:number;name:string};
type LocalLga={lga_id:number;state_id:number;name:string};
type LocalWard={ward_id:number;lga_id:number;name:string};
type LocalCounts={states:number;lgas:number;wards:number};

let dataPromise:Promise<{states:LocalState[];lgas:LocalLga[];wards:LocalWard[]}>|null=null;

function parseCsv(text:string):CsvRow[]{
 const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
 for(let i=0;i<text.length;i+=1){
  const char=text[i];
  if(quoted&&char==='"'&&text[i+1]==='"'){cell+='"';i+=1;continue}
  if(char==='"'){quoted=!quoted;continue}
  if(!quoted&&char===','){row.push(cell.trim());cell='';continue}
  if(!quoted&&(char==='\n'||char==='\r')){
   if(char==='\r'&&text[i+1]==='\n')i+=1;
   row.push(cell.trim());cell='';
   if(row.some(value=>value))rows.push(row);
   row=[];continue;
  }
  cell+=char;
 }
 if(quoted)throw new Error('Geography CSV has an unterminated quoted field.');
 row.push(cell.trim());if(row.some(value=>value))rows.push(row);
 const headers=rows.shift()?.map(value=>value.replace(/^\uFEFF/,''))??[];
 return rows.map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??''])));
}

async function loadData(){
 if(!dataPromise)dataPromise=(async()=>{
  const directory=path.join(process.cwd(),'data','geography');
  const [statesText,lgasText,wardsText]=await Promise.all([
   readFile(path.join(directory,'states.csv'),'utf8'),
   readFile(path.join(directory,'lgas.csv'),'utf8'),
   readFile(path.join(directory,'wards.csv'),'utf8'),
  ]);
  const stateRows=parseCsv(statesText);const lgaRows=parseCsv(lgasText);const wardRows=parseCsv(wardsText);
  const stateIds=new Map<string,number>();
  const states=stateRows.map((row,index)=>{const state_id=index+1;stateIds.set(row.state_name,state_id);return {state_id,name:row.state_name}});
  const lgaIds=new Map<string,number>();
  const lgas=lgaRows.map((row,index)=>{const lga_id=index+1;const state_id=stateIds.get(row.state_name)??0;lgaIds.set(`${row.state_name}\u0000${row.lga_name}`,lga_id);return {lga_id,state_id,name:row.lga_name}});
  const wards=wardRows.map((row,index)=>({ward_id:index+1,lga_id:lgaIds.get(`${row.state_name}\u0000${row.lga_name}`)??0,name:row.ward_name}));
  return {states,lgas,wards};
 })().catch(error=>{dataPromise=null;throw error});
 return dataPromise;
}

export async function GET(request:Request){
 try{
  const data=await loadData();const params=new URL(request.url).searchParams;const level=params.get('level');
  if(level==='summary'){
   const counts:LocalCounts={states:data.states.length,lgas:data.lgas.length,wards:data.wards.length};
   return NextResponse.json({data:counts});
  }
  if(level==='states')return NextResponse.json({data:data.states});
  if(level==='lgas')return NextResponse.json({data:data.lgas.filter(row=>String(row.state_id)===params.get('state_id'))});
  if(level==='wards')return NextResponse.json({data:data.wards.filter(row=>String(row.lga_id)===params.get('lga_id'))});
  return NextResponse.json({error:'A valid geography level is required.'},{status:400});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not load local geography.'},{status:500})}
}
