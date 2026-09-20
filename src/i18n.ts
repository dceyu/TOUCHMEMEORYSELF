import type { CueKind } from './shared/types';

export type Language='zh'|'en';
export const text=(language:Language,zh:string,en:string)=>language==='en'?en:zh;

const cueNames:Record<CueKind,{zh:string;en:string}>={
  doubt:{zh:'怀疑',en:'Doubt'},explore:{zh:'探索',en:'Exploration'},desire:{zh:'欲望',en:'Desire'},confidence:{zh:'自信',en:'Confidence'},conflict:{zh:'冲突',en:'Conflict'},void:{zh:'虚无',en:'Void'},acceptance:{zh:'接纳',en:'Acceptance'},
  finalDissolve:{zh:'结束 · 光芒消散',en:'End · Light Dissolve'}
};
export const cueLabel=(kind:CueKind,language:Language)=>cueNames[kind][language];
