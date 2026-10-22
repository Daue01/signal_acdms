import {z} from 'zod';
import {householdCensusResponsesSchema,individualCensusResponsesSchema} from './censusQuestionnaire';

export const individualSubmissionSchema=z.object({
 surname:z.string().trim().min(1).max(100),
 firstname:z.string().trim().min(1).max(100),
 sex:z.enum(['male','female']),
 date_of_birth:z.string().date().optional().or(z.literal('')),
 age:z.number().int().min(0).max(120).optional(),
 relationship_to_head:z.string().trim().max(50).optional(),
 education_level:z.string().trim().max(100).optional(),
 occupation:z.string().trim().max(100).optional(),
 disability_status:z.string().trim().max(100).optional(),
 census_responses:individualCensusResponsesSchema,
});

export const citizenSubmissionSchema=z.object({
 stateId:z.number().int().positive(),
 lgaId:z.number().int().positive(),
 wardId:z.number().int().positive(),
 locality:z.string().trim().max(160).optional().default(''),
 address:z.string().trim().min(3).max(500),
 housingType:z.string().trim().max(80).optional().default(''),
 ownershipStatus:z.string().trim().max(80).optional().default(''),
 electricityAccessType:z.enum(['grid','generator','solar','none']).optional(),
 electricityHoursPerDay:z.number().min(0).max(24).optional(),
 waterSource:z.enum(['piped','borehole','well','surface','vendor']).optional(),
 waterFetchMinutes:z.number().int().min(0).max(1440).optional(),
 carsOwned:z.number().int().min(0).max(50).optional().default(0),
 incomeBand:z.string().trim().max(80).optional(),
 latitude:z.number().min(-90).max(90).optional(),
 longitude:z.number().min(-180).max(180).optional(),
 census_responses:householdCensusResponsesSchema,
 individuals:z.array(individualSubmissionSchema).min(1).max(50),
 consentRecorded:z.literal(true),
 captchaToken:z.string().trim().max(4000).optional().default(''),
});

export type CitizenSubmissionInput=z.infer<typeof citizenSubmissionSchema>;

export const referenceCodeSchema=z.string().trim().regex(/^ACD-[A-Z0-9]{12}$/i,'Enter a valid reference code.');
