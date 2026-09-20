import type { MappingQuad, StudioProject } from '../shared/types';

const quadKeys=(['topLeft','topRight','bottomRight','bottomLeft'] as const);
type Mapping=StudioProject['mapping'];

export function MappingEditor({mapping,onChange}:{mapping:Mapping;onChange:(value:Partial<Mapping>)=>void}){
  const drag=(start:React.PointerEvent,updatePoint:(point:[number,number])=>void)=>{
    if(mapping.locked)return;
    const target=start.currentTarget as HTMLElement;target.setPointerCapture(start.pointerId);const parent=target.closest('.mapping-overlay') as HTMLElement;
    const update=(event:PointerEvent)=>{const rect=parent.getBoundingClientRect();updatePoint([Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))]);};
    const done=()=>{if(target.hasPointerCapture(start.pointerId))target.releasePointerCapture(start.pointerId);window.removeEventListener('pointermove',update);window.removeEventListener('pointerup',done);};
    window.addEventListener('pointermove',update);window.addEventListener('pointerup',done);
  };
  if(mapping.editorLayer==='source'){
    const frame=mapping.sourceFrame;
    const move=(event:React.PointerEvent)=>{const ox=event.clientX,oy=event.clientY,start={...frame},parent=(event.currentTarget as HTMLElement).parentElement!,rect=parent.getBoundingClientRect();drag(event,point=>{const dx=(point[0]*rect.width-(ox-rect.left))/rect.width,dy=(point[1]*rect.height-(oy-rect.top))/rect.height;onChange({sourceFrame:{...start,x:Math.max(0,Math.min(1-start.width,start.x+dx)),y:Math.max(0,Math.min(1-start.height,start.y+dy))}});});};
    const resize=(event:React.PointerEvent)=>drag(event,point=>onChange({sourceFrame:{...frame,width:Math.max(.05,Math.min(1-frame.x,point[0]-frame.x)),height:Math.max(.05,Math.min(1-frame.y,point[1]-frame.y))}}));
    return <div className="mapping-overlay source-editor"><div className="source-shade"/><button className="source-frame" style={{left:`${frame.x*100}%`,top:`${frame.y*100}%`,width:`${frame.width*100}%`,height:`${frame.height*100}%`}} onPointerDown={move}>{`FRAME ${Math.round(frame.width*100)}×${Math.round(frame.height*100)}%`}<i onPointerDown={e=>{e.stopPropagation();resize(e);}}/></button></div>;
  }
  if(mapping.controlMode==='basic'){
    const move=(key:keyof MappingQuad,event:React.PointerEvent)=>drag(event,point=>onChange({quad:{...mapping.quad,[key]:point}}));
    return <div className="mapping-overlay"><div className="mapping-grid"/><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points={quadKeys.map(key=>`${mapping.quad[key][0]*100},${mapping.quad[key][1]*100}`).join(' ')}/></svg>{quadKeys.map((key,index)=><button key={key} className="uv-handle" style={{left:`${mapping.quad[key][0]*100}%`,top:`${mapping.quad[key][1]*100}%`}} onPointerDown={event=>move(key,event)}>{index+1}</button>)}</div>;
  }
  const {columns,rows,points}=mapping.grid;
  const lines=[...Array.from({length:rows},(_,row)=>Array.from({length:columns},(_,column)=>points[row*columns+column])),...Array.from({length:columns},(_,column)=>Array.from({length:rows},(_,row)=>points[row*columns+column]))];
  const move=(index:number,event:React.PointerEvent)=>drag(event,point=>onChange({grid:{...mapping.grid,points:points.map((item,itemIndex)=>itemIndex===index?point:item)}}));
  return <div className="mapping-overlay complex"><svg className="grid-lines" viewBox="0 0 100 100" preserveAspectRatio="none">{lines.map((line,index)=><polyline key={index} points={line.map(point=>`${point[0]*100},${point[1]*100}`).join(' ')} fill="none" stroke="#b7e774" strokeWidth=".3" vectorEffect="non-scaling-stroke"/>)}</svg>{points.map((point,index)=><button key={index} className="uv-handle grid-point" style={{left:`${point[0]*100}%`,top:`${point[1]*100}%`}} onPointerDown={event=>move(index,event)}>{index+1}</button>)}</div>;
}
