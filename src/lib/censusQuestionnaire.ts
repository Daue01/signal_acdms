import {z} from 'zod';

const yesNo=z.boolean().optional();
const shortAnswer=z.string().trim().max(160).optional();
const count=z.number().int().min(0).max(1000).optional();

export const difficultyResponseSchema=z.enum(['none','some','a_lot','cannot_do']);

export const individualCensusResponsesSchema=z.object({
 religion:z.enum(['christian','muslim','traditional','other','prefer_not_to_say']).optional(),
 ethnicity:z.string().trim().max(160).optional(),
 marital_status:z.enum(['never_married','married','separated','divorced','widowed']).optional(),
 can_read:z.boolean().optional(),
 can_write:z.boolean().optional(),
 currently_attending_school:yesNo,
 highest_education_level:shortAnswer,
 employment_status:z.enum(['employed','seeking_work','student','homemaker','retired','unable_to_work','other']).optional(),
 occupation:shortAnswer,
 industry:shortAnswer,
 country_of_birth:shortAnswer,
 state_of_birth:shortAnswer,
 previous_residence:shortAnswer,
 years_in_current_residence:z.number().int().min(0).max(120).optional(),
 owns_mobile_phone:yesNo,
 uses_internet:yesNo,
 uses_computer:yesNo,
 functional_difficulties:z.object({
  seeing:difficultyResponseSchema.optional(),
  hearing:difficultyResponseSchema.optional(),
  walking:difficultyResponseSchema.optional(),
  remembering:difficultyResponseSchema.optional(),
  self_care:difficultyResponseSchema.optional(),
  communication:difficultyResponseSchema.optional(),
 }).strict().default({}),
 children_ever_born:count,
 children_still_alive:count,
 births_last_12_months:count,
 last_child_survived:yesNo,
}).strict().default({});

export const householdCensusResponsesSchema=z.object({
 household_death_in_last_year:yesNo,
 household_deaths_count:count,
 building_type:shortAnswer,
 wall_material:shortAnswer,
 roof_material:shortAnswer,
 floor_material:shortAnswer,
 number_of_rooms:count,
 tenure_status:shortAnswer,
 main_drinking_water_source:shortAnswer,
 toilet_facility:shortAnswer,
 wastewater_disposal:shortAnswer,
 solid_waste_disposal:shortAnswer,
 cooking_fuel:shortAnswer,
 lighting_source:shortAnswer,
}).strict().default({});

export type IndividualCensusResponses=z.infer<typeof individualCensusResponsesSchema>;
export type HouseholdCensusResponses=z.infer<typeof householdCensusResponsesSchema>;

export function legacyHousingType(value:string|undefined){
 return ({detached:'Detached house',semi_detached:'Semi-detached house',flat:'Terrace / flat',compound:'Compound room',temporary:'Temporary shelter',other:'Other'} as Record<string,string>)[value??'']??'';
}

export function legacyOwnershipStatus(value:string|undefined){
 return ({owned:'Owner occupied',rented:'Rented',rent_free:'Rent free',other:'Other'} as Record<string,string>)[value??'']??'';
}
