import { useEffect, useRef, useState } from 'react';
import type { OutputSnapshot } from './shared/types';
import { VisualEngine } from './engine/visual-engine';
export function OutputApp(){const canvas=useRef<HTMLCanvasElement>(null);const engine=useRef<VisualEngine|undefined>(undefined);const [empty,setEmpty]=useState(true);useEffect(()=>{engine.current=new VisualEngine(canvas.current!,true);const off=window.centopia.output.onState(snapshot=>{setEmpty(false);engine.current?.apply(snapshot);});return()=>{off();engine.current?.dispose();};},[]);return <main className="projector"><canvas ref={canvas}/>{empty&&<div className="projector-wait">CENTOPIA<br/><small>WAITING FOR OUTPUT</small></div>}</main>;}
