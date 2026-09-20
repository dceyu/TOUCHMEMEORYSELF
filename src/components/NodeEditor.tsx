import { useMemo } from 'react';
import { Background, Connection, Controls, Edge, Handle, MiniMap, Node, NodeProps, Position, ReactFlow, applyEdgeChanges, applyNodeChanges, type EdgeChange, type NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { CueConfig, StudioEdge, StudioNode } from '../shared/types';
import { createsCycle } from '../runtime/graph';
import { cueLabel, text, type Language } from '../i18n';

type FlowData = { label: string; kind: string; value?: number };
function StudioNodeView({ data, selected }: NodeProps<Node<FlowData>>) {
  const input = ['effect','mapping','uv','output'].includes(data.kind);
  const output = !['output'].includes(data.kind);
  return <div className={`flow-node kind-${data.kind} ${selected?'selected':''}`}>
    {input && <Handle type="target" position={Position.Left}/>}<small>{data.kind}</small><strong>{data.label}</strong>
    {typeof data.value==='number' && <div className="node-meter"><i style={{width:`${data.value*100}%`}}/></div>}
    {output && <Handle type="source" position={Position.Right}/>} </div>;
}

const nodeTypes={studio:StudioNodeView};
export function NodeEditor({language,cues,nodes,edges,values,routingEnabled,onRouting,onChange,onSelect}:{language:Language;cues:CueConfig[];nodes:StudioNode[];edges:StudioEdge[];values:number[];routingEnabled:boolean;onRouting:(enabled:boolean)=>void;onChange:(nodes:StudioNode[],edges:StudioEdge[])=>void;onSelect:(id?:string)=>void}){
  const flowNodes=useMemo(()=>nodes.map(node=>({id:node.id,type:'studio',position:node.position,data:{label:typeof node.channel==='number'&&cues[node.channel]?`CH ${node.channel+1} · ${cueLabel(cues[node.channel].kind,language)}`:node.label,kind:node.kind,value:typeof node.channel==='number'?values[node.channel]:undefined}})),[nodes,values,cues,language]);
  const flowEdges=edges.map(edge=>({id:edge.id,source:edge.source,target:edge.target,animated:routingEnabled&&edge.enabled!==false,className:`studio-edge ${edge.enabled===false?'disabled':''}`,label:edge.enabled===false?'OFF':'ON'}));
  const onNodesChange=(changes:NodeChange<Node<FlowData>>[])=>{
    const next=applyNodeChanges(changes,flowNodes);onChange(nodes.map(node=>({...node,position:next.find(item=>item.id===node.id)?.position??node.position})),edges);
  };
  const onEdgesChange=(changes:EdgeChange<Edge>[])=>{const next=applyEdgeChanges(changes,flowEdges);const ids=new Set(next.map(edge=>edge.id));onChange(nodes,edges.filter(edge=>ids.has(edge.id)));};
  const onConnect=(connection:Connection)=>{if(!connection.source||!connection.target||createsCycle(nodes,edges,{source:connection.source,target:connection.target}))return;onChange(nodes,[...edges,{id:`edge-${crypto.randomUUID()}`,source:connection.source,target:connection.target,targetParam:'intensity',combine:'max',enabled:true}]);};
  const toggleEdge=(id:string)=>onChange(nodes,edges.map(edge=>edge.id===id?{...edge,enabled:edge.enabled===false}:edge));
  return <div className="node-editor"><div className="node-toolbar"><label><input type="checkbox" checked={routingEnabled} onChange={e=>onRouting(e.target.checked)}/> {text(language,'启用模块连线控制','ENABLE NODE ROUTING')}</label><span>{text(language,'双击连线可单独开启 / 关闭；关闭时 8 路 Cue 仍独立工作','Double-click a link to toggle it. The 8 one-shot cues remain independent while routing is off.')}</span></div><ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onEdgeDoubleClick={(_,edge)=>toggleEdge(edge.id)} onSelectionChange={({nodes:selected})=>onSelect(selected[0]?.id)} fitView colorMode="dark" minZoom={.2} maxZoom={1.8}>
    <Background gap={28} size={1}/><Controls/><MiniMap pannable zoomable nodeColor={node=>node.data.kind==='sensor'?'#9ccf63':node.data.kind==='effect'?'#ff795c':'#8296a9'}/>
  </ReactFlow></div>;
}
