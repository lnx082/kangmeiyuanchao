/** 战役结果类型 */
export type BattleResult = 'victory' | 'stalemate' | 'defeat';

/** 地理坐标 */
export interface GeoCoordinates {
  lat: number;
  lng: number;
}

/** 视角模式 */
export type ViewMode = 'calendar' | 'map';

/** 战役数据接口 */
export interface BattleCampaign {
  /** 唯一标识 */
  id: string;
  /** 战役名称（中文） */
  name: string;
  /** 战役名称（英文/韩文） */
  nameEn: string;
  /** 开始日期 (YYYY-MM-DD) */
  startDate: string;
  /** 结束日期 (YYYY-MM-DD) */
  endDate: string;
  /** 朝鲜半岛经纬度坐标 */
  coordinates: GeoCoordinates;
  /** 地点名称 */
  location: string;
  /** 战役结果 */
  result: BattleResult;
  /** 战果简述 */
  resultSummary: string;
  /** 日记体第一人称/纪实视角战役描述 */
  diaryEntry: string;
  /** 参战部队 */
  participatingUnits: string[];
  /** 历史意义 */
  significance: string;
  /** 战役主图 URL（后续接入） */
  imageUrl?: string;
}
