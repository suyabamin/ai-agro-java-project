export type JobStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';

export type JobCategory =
  | 'CROP_FARMING'
  | 'LIVESTOCK'
  | 'IRRIGATION'
  | 'HARVESTING'
  | 'EQUIPMENT_OPERATION'
  | 'GENERAL_LABOR'
  | 'AGRONOMY_TECH';

export type EmploymentType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'SEASONAL'
  | 'DAILY_WAGE'
  | 'CONTRACT';

export type SalaryType =
  | 'FIXED'
  | 'HOURLY'
  | 'DAILY'
  | 'MONTHLY'
  | 'PER_HECTARE'
  | 'NEGOTIABLE';

export type ApplicationStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface Job {
  jobId: string;
  farmId: string;
  title: string;
  description: string;
  jobCategory: JobCategory;
  employmentType: EmploymentType;
  requiredSkills: string[];
  experienceRequirements?: string | null;
  numberOfPositions: number;
  salaryType: SalaryType;
  minimumSalary?: number | null;
  maximumSalary?: number | null;
  currency: string;
  locationSummary?: string | null;
  status: JobStatus;
  applicationDeadline?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  totalApplicationsCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  closedAt?: string | null;
}

export interface PublicJob {
  jobId: string;
  farmId: string;
  farmName: string;
  farmDistrict: string;
  farmDivision: string;
  title: string;
  description: string;
  jobCategory: JobCategory;
  employmentType: EmploymentType;
  requiredSkills: string[];
  experienceRequirements?: string | null;
  numberOfPositions: number;
  salaryType: SalaryType;
  minimumSalary?: number | null;
  maximumSalary?: number | null;
  currency: string;
  locationSummary?: string | null;
  applicationDeadline?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  publishedAt?: string | null;
}

export interface JobApplication {
  applicationId: string;
  jobId: string;
  farmId: string;
  applicantUid: string;
  applicantSafeUid: string;
  applicantName: string;
  applicantEmail: string;
  coverLetter?: string | null;
  experienceYears?: number | null;
  relevantSkills?: string[];
  expectedSalary?: number | null;
  earliestStartDate?: string | null;
  status: ApplicationStatus;
  reviewNotes?: string | null;
  reviewedByUid?: string | null;
  reviewedAt?: string | null;
  version: number;
  submittedAt: string;
  updatedAt: string;
}

export interface ApplicationHistory {
  historyId: string;
  applicationId: string;
  jobId: string;
  farmId: string;
  applicantUid: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  performedByUid: string;
  note?: string | null;
  timestamp: string;
}

export interface ApplicationMessage {
  messageId: string;
  applicationId: string;
  jobId: string;
  farmId: string;
  applicantUid: string;
  senderUid: string;
  senderName: string;
  message: string;
  sentAt: string;
}

export interface CreateJobPayload {
  title: string;
  description: string;
  jobCategory: JobCategory;
  employmentType: EmploymentType;
  requiredSkills?: string[];
  experienceRequirements?: string;
  numberOfPositions?: number;
  salaryType?: SalaryType;
  minimumSalary?: number;
  maximumSalary?: number;
  currency?: string;
  locationSummary?: string;
  applicationDeadline?: string;
  startDate?: string;
  endDate?: string;
  publishImmediately?: boolean;
}

export interface UpdateJobPayload {
  title: string;
  description: string;
  jobCategory: JobCategory;
  employmentType: EmploymentType;
  requiredSkills?: string[];
  experienceRequirements?: string;
  numberOfPositions?: number;
  salaryType?: SalaryType;
  minimumSalary?: number;
  maximumSalary?: number;
  currency?: string;
  locationSummary?: string;
  applicationDeadline?: string;
  startDate?: string;
  endDate?: string;
  version: number;
}

export interface CreateApplicationPayload {
  coverLetter?: string;
  experienceYears?: number;
  relevantSkills?: string[];
  expectedSalary?: number;
  earliestStartDate?: string;
}

export interface ApplicationDecisionPayload {
  note?: string;
  version: number;
}

export interface SendMessagePayload {
  message: string;
}
