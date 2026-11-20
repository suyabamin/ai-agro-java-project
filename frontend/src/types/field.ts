export type FieldStatus = 'ACTIVE' | 'FALLOW' | 'PREPARATION' | 'ARCHIVED';

export type CropType =
  | 'RICE'
  | 'WHEAT'
  | 'JUTE'
  | 'MAIZE'
  | 'POTATO'
  | 'TEA'
  | 'VEGETABLES'
  | 'OTHER';

export type SoilType =
  | 'CLAY'
  | 'SANDY'
  | 'LOAMY'
  | 'SILTY'
  | 'PEATY'
  | 'CHALKY';

export type IrrigationType =
  | 'RAIN_FED'
  | 'CANAL'
  | 'DRIP'
  | 'SPRINKLER'
  | 'GROUNDWATER_TUBEWELL';

export interface Field {
  fieldId: string;
  localFieldId: string;
  farmId: string;
  name: string;
  cropType: CropType;
  soilType?: SoilType | null;
  irrigationType?: IrrigationType | null;
  areaHectares: number;
  status: FieldStatus;
  notes?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface CreateFieldPayload {
  localFieldId: string;
  name: string;
  cropType: CropType;
  soilType?: SoilType;
  irrigationType?: IrrigationType;
  areaHectares: number;
  status?: FieldStatus;
  notes?: string;
}

export interface UpdateFieldPayload {
  name: string;
  cropType: CropType;
  soilType?: SoilType;
  irrigationType?: IrrigationType;
  areaHectares: number;
  status: FieldStatus;
  notes?: string;
  expectedVersion: number;
}
