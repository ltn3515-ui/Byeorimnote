import { useEffect, useMemo, useRef, useState } from 'react'
import type { BoardItem, Page, Point, Project, StrokeItem, Tool } from './types'
import { buildMasterPrompt, planFromBoard } from './planner'

const uid=()=>Math.random().toString(36).slice(2,10)
const initialPage=():Page=>({id:uid(),name:'아이디어 1',items:[]})
const initialProject=():Project=>{const p=initialPage();return{title:'새 기획',pages:[p],activePageId:p.id,updatedAt:Date.now()}}
const deep=<T,>(v:T):T=>JSON.parse(JSON.stringify(v))
const colors=['#1f2937','#e45858','#2d7a68','#3564a8','#8b5e34','#f1b733']

type InstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
type PanState={x:number;y:number;zoom:number}
type DragState={kind:'pan';sx:number;sy:number;px:number;py:number}|null
type PinchState={distance:number;zoom:number;cx:number;cy:number;px:number;py:number}|null
type PwaCheck = { label:string; ok:boolean; detail:string }
type PwaReport = { checks:PwaCheck[]; installable:boolean; installed:boolean; browser:string; recommendation:string }

export default function App(){
  const [project,setProject]=useState<Project>(()=>{
    try{
      const saved=localStorage.getItem('byeorim-note-project')
      return saved?JSON.parse(saved):initialProject()
    }catch{return initialProject()}
  })
  const [tool,setTool]=useState<Tool>('pen')
  const [color,setColor]=useState('#1f2937')
  const [width,setWidth]=useState(5)
  const [pan,setPan]=useState<PanState>({x:80,y:70,zoom:1})
  const [selected,setSelected]=useState<string|null>(null)
  const [draft,setDraft]=useState<StrokeItem|null>(null)
  const [savedAt,setSavedAt]=useState(Date.now())
  const [installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null)
  const [showPwa,setShowPwa]=useState(false)
  const [pwaReport,setPwaReport]=useState<PwaReport|null>(null)
  const [rightOpen,setRightOpen]=useState(true)
  const [showHelp,setShowHelp]=useState(false)
  const [toast,setToast]=useState('')
  const svgRef=useRef<SVGSVGElement|null>(null)
  const drawingRef=useRef(false)
  const dragRef=useRef<DragState>(null)
  const touchesRef=useRef(new Map<number,{x:number;y:number}>())
  const pinchRef=useRef<PinchState>(null)
  const penUntilRef=useRef(0)
  const undoRef=useRef<BoardItem[][]>([])
  const redoRef=useRef<BoardItem[][]>([])

  const page=project.pages.find(p=>p.id===project.activePageId)??project.pages[0]
  const items=page?.items??[]
  const planning=useMemo(()=>planFromBoard(items,project.title),[items,project.title])

  useEffect(()=>{
    const timer=window.setTimeout(()=>{
      localStorage.setItem('byeorim-note-project',JSON.stringify({...project,updatedAt:Date.now()}))
      setSavedAt(Date.now())
    },180)
    return()=>window.clearTimeout(timer)
  },[project])

  useEffect(()=>{
    const handler=(e:Event)=>{e.preventDefault();setInstallPrompt(e as InstallPromptEvent)}
    const installed=()=>{setInstallPrompt(null);setToast('벼림노트 설치가 완료됐어요')}
    window.addEventListener('beforeinstallprompt',handler)
    window.addEventListener('appinstalled',installed)
    return()=>{
      window.removeEventListener('beforeinstallprompt',handler)
      window.removeEventListener('appinstalled',installed)
    }
  },[])

  const runPwaDiagnostics=async()=>{
    const checks:PwaCheck[]=[]
    const secure=window.isSecureContext||location.hostname==='localhost'
    checks.push({label:'HTTPS / 보안 컨텍스트',ok:secure,detail:secure?'정상':'HTTPS 주소로 접속해야 PWA 설치가 가능합니다.'})

    let manifestOk=false
    try{
      const res=await fetch('/manifest.webmanifest',{cache:'no-store'})
      const data=await res.json()
      manifestOk=res.ok&&Boolean(data?.name)&&Boolean(data?.start_url)&&Array.isArray(data?.icons)&&data.icons.length>0
      checks.push({label:'Web App Manifest',ok:manifestOk,detail:manifestOk?'정상 · '+data.short_name:'manifest 파일 또는 필수 항목을 확인해야 합니다.'})
    }catch{
      checks.push({label:'Web App Manifest',ok:false,detail:'manifest.webmanifest를 불러오지 못했습니다.'})
    }

    const swSupported='serviceWorker' in navigator
    checks.push({label:'Service Worker 지원',ok:swSupported,detail:swSupported?'브라우저 지원':'이 브라우저는 Service Worker를 지원하지 않습니다.'})

    let swReady=false
    if(swSupported){
      try{
        const reg=await navigator.serviceWorker.getRegistration('/')
        if(reg){
          await navigator.serviceWorker.ready
          swReady=true
        }
      }catch{}
    }
    checks.push({label:'Service Worker 등록',ok:swReady,detail:swReady?'정상 등록됨':'등록되지 않았습니다. 새로고침 후 다시 진단해 보세요.'})

    const standalone=window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator & {standalone?:boolean}).standalone===true
    checks.push({label:'현재 설치 상태',ok:standalone,detail:standalone?'설치된 PWA로 실행 중':'브라우저에서 실행 중'})

    const ua=navigator.userAgent
    const browser=/SamsungBrowser/i.test(ua)?'Samsung Internet':/Edg/i.test(ua)?'Microsoft Edge':/Chrome/i.test(ua)?'Chrome':/Firefox/i.test(ua)?'Firefox':'기타 브라우저'
    const installable=Boolean(installPrompt)
    checks.push({label:'브라우저 설치 이벤트',ok:installable||standalone,detail:standalone?'이미 설치됨':installable?'설치 프롬프트 사용 가능':'beforeinstallprompt 이벤트가 아직 제공되지 않았습니다.'})

    let recommendation='PWA 설치 조건이 정상입니다. 앱 설치 버튼을 눌러 설치하세요.'
    if(standalone)recommendation='현재 벼림노트는 이미 설치된 앱 모드로 실행 중입니다.'
    else if(!secure)recommendation='HTTPS Vercel 주소로 접속한 뒤 다시 진단하세요.'
    else if(!manifestOk)recommendation='Manifest 로딩 문제를 해결해야 합니다.'
    else if(!swReady)recommendation='페이지를 새로고침한 뒤 Service Worker 등록 상태를 다시 확인하세요.'
    else if(!installable)recommendation=browser==='Samsung Internet'
      ?'Samsung Internet 메뉴에서 “현재 페이지 추가 → 홈 화면” 또는 “앱 설치”를 확인하세요.'
      :browser==='Chrome'
        ?'Chrome 우측 상단 메뉴에서 “앱 설치” 또는 “홈 화면에 추가”를 확인하세요. 메뉴에도 없다면 사이트 데이터를 삭제 후 다시 접속하세요.'
        :'브라우저 메뉴에서 “앱 설치/홈 화면에 추가”를 확인하거나 Chrome으로 다시 시도하세요.'

    setPwaReport({checks,installable,installed:standalone,browser,recommendation})
    setShowPwa(true)
  }

  const notify=(msg:string)=>{setToast(msg);window.setTimeout(()=>setToast(''),1500)}
  const updatePage=(newItems:BoardItem[],record=true)=>{
    if(record){undoRef.current.push(deep(items));if(undoRef.current.length>60)undoRef.current.shift();redoRef.current=[]}
    setProject(p=>({...p,pages:p.pages.map(pg=>pg.id===p.activePageId?{...pg,items:newItems}:pg),updatedAt:Date.now()}))
  }
  const undo=()=>{const prev=undoRef.current.pop();if(!prev)return;redoRef.current.push(deep(items));updatePage(prev,false)}
  const redo=()=>{const next=redoRef.current.pop();if(!next)return;undoRef.current.push(deep(items));updatePage(next,false)}

  const world=(clientX:number,clientY:number)=>{
    const r=svgRef.current?.getBoundingClientRect()
    if(!r)return{x:0,y:0}
    return{x:(clientX-r.left-pan.x)/pan.zoom,y:(clientY-r.top-pan.y)/pan.zoom}
  }
  const point=(e:React.PointerEvent):Point=>{
    const w=world(e.clientX,e.clientY)
    return{x:w.x,y:w.y,p:e.pressure>0?e.pressure:.5}
  }

  const beginStroke=(e:React.PointerEvent)=>{
    const p=point(e)
    const isHigh=tool==='highlighter'
    const stroke:StrokeItem={
      id:uid(),type:'stroke',points:[p],
      color:tool==='eraser'?'#ffffff':color,
      width:tool==='eraser'?28:isHigh?18:width,
      opacity:isHigh ? .32 : 1,
      tool:tool as 'pen'|'highlighter'|'eraser'
    }
    setDraft(stroke);drawingRef.current=true
  }

  const addObject=(e:React.PointerEvent)=>{
    const p=point(e)
    if(tool==='note'){
      updatePage([...items,{id:uid(),type:'note',x:p.x,y:p.y,w:220,h:130,text:'새 메모',color:'#fff3b0'}]);return
    }
    if(tool==='rect'||tool==='ellipse'){
      updatePage([...items,{id:uid(),type:tool,x:p.x,y:p.y,w:230,h:140,color}]);return
    }
    if(tool==='frame'){
      updatePage([...items,{id:uid(),type:'frame',x:p.x,y:p.y,w:300,h:540,color:'#5b6472'}]);return
    }
    if(tool==='arrow'){
      updatePage([...items,{id:uid(),type:'arrow',x1:p.x,y1:p.y,x2:p.x+190,y2:p.y+80,color}]);return
    }
    if(tool==='text'){
      const value=window.prompt('텍스트 입력','새 텍스트')
      if(value)updatePage([...items,{id:uid(),type:'text',x:p.x,y:p.y,text:value,color,size:24}])
    }
  }

  const onPointerDown=(e:React.PointerEvent<SVGSVGElement>)=>{
    ;(e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId)
    if(e.pointerType==='pen')penUntilRef.current=Date.now()+1200
    if(e.pointerType==='touch'){
      if(Date.now()<penUntilRef.current)return
      touchesRef.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
      if(touchesRef.current.size===2){
        const [a,b]=[...touchesRef.current.values()]
        pinchRef.current={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:pan.zoom,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,px:pan.x,py:pan.y}
        dragRef.current=null
      }else{
        dragRef.current={kind:'pan',sx:e.clientX,sy:e.clientY,px:pan.x,py:pan.y}
      }
      return
    }
    if(tool==='select'){setSelected(null);return}
    if(['pen','highlighter','eraser'].includes(tool)){beginStroke(e);return}
    addObject(e)
  }

  const onPointerMove=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(e.pointerType==='pen')penUntilRef.current=Date.now()+1200
    if(e.pointerType==='touch'){
      if(Date.now()<penUntilRef.current)return
      if(!touchesRef.current.has(e.pointerId))return
      touchesRef.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
      if(touchesRef.current.size===2&&pinchRef.current){
        const [a,b]=[...touchesRef.current.values()]
        const d=Math.hypot(a.x-b.x,a.y-b.y)
        const next=Math.min(3,Math.max(.35,pinchRef.current.zoom*(d/pinchRef.current.distance)))
        const rect=svgRef.current?.getBoundingClientRect()
        if(rect){
          const sx=pinchRef.current.cx-rect.left
          const sy=pinchRef.current.cy-rect.top
          const worldX=(sx-pinchRef.current.px)/pinchRef.current.zoom
          const worldY=(sy-pinchRef.current.py)/pinchRef.current.zoom
          setPan({zoom:next,x:sx-worldX*next,y:sy-worldY*next})
        }
      }else if(dragRef.current?.kind==='pan'){
        setPan(p=>({...p,x:dragRef.current!.px+e.clientX-dragRef.current!.sx,y:dragRef.current!.py+e.clientY-dragRef.current!.sy}))
      }
      return
    }
    if(drawingRef.current&&draft){
      setDraft({...draft,points:[...draft.points,point(e)]})
    }
  }

  const finishPointer=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(e.pointerType==='touch'){
      touchesRef.current.delete(e.pointerId)
      if(touchesRef.current.size<2)pinchRef.current=null
      if(touchesRef.current.size===0)dragRef.current=null
      return
    }
    if(drawingRef.current&&draft&&draft.points.length>1){
      updatePage([...items,draft])
    }
    drawingRef.current=false;setDraft(null)
  }

  const onWheel=(e:React.WheelEvent<SVGSVGElement>)=>{
    e.preventDefault()
    const rect=svgRef.current?.getBoundingClientRect();if(!rect)return
    const sx=e.clientX-rect.left,sy=e.clientY-rect.top
    const worldX=(sx-pan.x)/pan.zoom,worldY=(sy-pan.y)/pan.zoom
    const next=Math.min(3,Math.max(.35,pan.zoom*(e.deltaY>0?.9:1.1)))
    setPan({zoom:next,x:sx-worldX*next,y:sy-worldY*next})
  }

  const deleteSelected=()=>{if(!selected)return;updatePage(items.filter(i=>i.id!==selected));setSelected(null)}
  const clearPage=()=>{if(items.length&&window.confirm('현재 페이지의 모든 내용을 지울까요?'))updatePage([])}
  const addPlanningTemplate=()=>{
    const startX=120,startY=120
    const labels=['문제','사용자','핵심 가치','MVP','재방문','수익화']
    const notes=labels.map((label,i)=>({id:uid(),type:'note' as const,x:startX+(i%3)*250,y:startY+Math.floor(i/3)*170,w:220,h:135,text:label+'\n\n여기에 생각을 적어보세요.',color:i<3?'#fff3b0':'#e5f3ff'}))
    updatePage([...items,...notes]);notify('기획 카드 6개를 추가했어요')
  }
  const newPage=()=>{
    const p=initialPage();p.name='아이디어 '+(project.pages.length+1)
    setProject(v=>({...v,pages:[...v.pages,p],activePageId:p.id}));undoRef.current=[];redoRef.current=[]
  }
  const selectPage=(id:string)=>{setProject(v=>({...v,activePageId:id}));setSelected(null);undoRef.current=[];redoRef.current=[]}
  const deletePage=(id:string)=>{
    if(project.pages.length===1)return notify('페이지는 최소 1개가 필요해요')
    const next=project.pages.filter(p=>p.id!==id)
    setProject(v=>({...v,pages:next,activePageId:v.activePageId===id?next[0].id:v.activePageId}))
  }

  const editItem=(item:BoardItem)=>{
    if(item.type!=='note'&&item.type!=='text')return
    const value=window.prompt('내용 수정',item.text)
    if(value===null)return
    updatePage(items.map(x=>x.id===item.id?{...x,text:value}:x))
  }

  const install=async()=>{if(!installPrompt){notify('브라우저 메뉴의 “앱 설치” 또는 “홈 화면에 추가”를 이용해 주세요');return}
    await installPrompt.prompt();await installPrompt.userChoice;setInstallPrompt(null)
  }

  const exportJson=()=>{
    const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='byeorim-note.json';a.click();URL.revokeObjectURL(a.href)
  }

  const exportPng=async()=>{
    const svg=svgRef.current;if(!svg)return
    const clone=svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('width',String(svg.clientWidth));clone.setAttribute('height',String(svg.clientHeight))
    const serializer=new XMLSerializer()
    const data='<?xml version="1.0" standalone="no"?>\r\n'+serializer.serializeToString(clone)
    const blob=new Blob([data],{type:'image/svg+xml;charset=utf-8'})
    const url=URL.createObjectURL(blob),img=new Image()
    img.onload=()=>{
      const canvas=document.createElement('canvas');canvas.width=svg.clientWidth*2;canvas.height=svg.clientHeight*2
      const ctx=canvas.getContext('2d')!;ctx.scale(2,2);ctx.fillStyle='#ffffff';ctx.fillRect(0,0,svg.clientWidth,svg.clientHeight);ctx.drawImage(img,0,0)
      canvas.toBlob(b=>{if(!b)return;const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(project.title||'byeorim-note')+'.png';a.click();URL.revokeObjectURL(a.href)},'image/png')
      URL.revokeObjectURL(url)
    }
    img.src=url
  }

  const printPdf=()=>{
    const svg=svgRef.current;if(!svg)return
    const data=new XMLSerializer().serializeToString(svg)
    const w=window.open('','_blank');if(!w)return notify('팝업 허용 후 다시 시도해 주세요')
    w.document.write('<html><head><title>'+project.title+'</title><style>body{margin:0}svg{width:100vw;height:100vh}@media print{@page{size:landscape;margin:0}}</style></head><body>'+data+'<script>onload=()=>print()<\/script></body></html>');w.document.close()
  }

  const copyPrompt=async()=>{await navigator.clipboard.writeText(buildMasterPrompt(planning,project.title));notify('개발용 기획 프롬프트를 복사했어요')}

  const renderStroke=(s:StrokeItem)=>{
    const pts=s.points
    return <g key={s.id} opacity={s.opacity} onPointerDown={e=>{e.stopPropagation();if(tool==='select')setSelected(s.id)}}>
      {pts.slice(1).map((p,i)=>{
        const prev=pts[i],pressure=Math.max(.25,(p.p+prev.p)/2)
        return <line key={i} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} stroke={s.color} strokeWidth={s.width*(.55+pressure*.9)} strokeLinecap="round" strokeLinejoin="round"/>
      })}
    </g>
  }

  const renderItem=(item:BoardItem)=>{
    const selectedStyle=selected===item.id?'selectedItem':''
    const common={onPointerDown:(e:React.PointerEvent)=>{e.stopPropagation();if(tool==='eraser'){updatePage(items.filter(x=>x.id!==item.id));return}if(tool==='select')setSelected(item.id)},onDoubleClick:(e:React.MouseEvent)=>{e.stopPropagation();editItem(item)}}
    if(item.type==='stroke')return renderStroke(item)
    if(item.type==='note')return <g key={item.id} className={selectedStyle} {...common}>
      <rect x={item.x} y={item.y} width={item.w} height={item.h} rx="18" fill={item.color} stroke="#d5c978"/>
      <text x={item.x+18} y={item.y+30} fontSize="18" fill="#27303d">
        {item.text.split('\n').slice(0,5).map((line,i)=><tspan key={i} x={item.x+18} dy={i===0?0:24}>{line.slice(0,24)}</tspan>)}
      </text>
    </g>
    if(item.type==='rect')return <rect key={item.id} className={selectedStyle} {...common} x={item.x} y={item.y} width={item.w} height={item.h} rx="16" fill="transparent" stroke={item.color} strokeWidth="3"/>
    if(item.type==='ellipse')return <ellipse key={item.id} className={selectedStyle} {...common} cx={item.x+item.w/2} cy={item.y+item.h/2} rx={item.w/2} ry={item.h/2} fill="transparent" stroke={item.color} strokeWidth="3"/>
    if(item.type==='frame')return <g key={item.id} className={selectedStyle} {...common}>
      <rect x={item.x} y={item.y} width={item.w} height={item.h} rx="28" fill="#fff" stroke={item.color} strokeWidth="4"/>
      <rect x={item.x+95} y={item.y+12} width={110} height={9} rx="5" fill={item.color} opacity=".45"/>
      <text x={item.x+20} y={item.y+56} fontSize="14" fill="#7b8190">모바일 화면</text>
    </g>
    if(item.type==='arrow')return <g key={item.id} className={selectedStyle} {...common}>
      <defs><marker id={'arrow-'+item.id} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill={item.color}/></marker></defs>
      <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke={item.color} strokeWidth="3" markerEnd={'url(#arrow-'+item.id+')'}/>
    </g>
    if(item.type==='text')return <text key={item.id} className={selectedStyle} {...common} x={item.x} y={item.y} fill={item.color} fontSize={item.size} fontWeight="700">{item.text}</text>
    return null
  }

  const tools:{id:Tool;icon:string;label:string}[]=[
    {id:'select',icon:'⌁',label:'선택'},{id:'pen',icon:'✎',label:'펜'},{id:'highlighter',icon:'▰',label:'형광펜'},
    {id:'eraser',icon:'⌫',label:'지우개'},{id:'note',icon:'▣',label:'메모'},{id:'text',icon:'T',label:'텍스트'},
    {id:'rect',icon:'□',label:'사각형'},{id:'ellipse',icon:'○',label:'원'},{id:'arrow',icon:'→',label:'연결'},
    {id:'frame',icon:'▯',label:'화면'}
  ]

  return <div className="app">
    <header className="topbar">
      <div className="brand"><div className="brandMark">벼</div><div><b>벼림노트</b><small>Byeorim Note · S Pen Planning Canvas</small></div></div>
      <input className="projectTitle" value={project.title} onChange={e=>setProject(p=>({...p,title:e.target.value}))}/>
      <div className="topActions">
        <span className="saveState">● 자동 저장 {new Date(savedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
        <button onClick={install}>앱 설치</button>
        <button onClick={runPwaDiagnostics}>PWA 진단</button>
        <button onClick={()=>setShowHelp(true)}>?</button>
      </div>
    </header>

    <aside className="pages">
      <button className="newPage" onClick={newPage}>＋ 새 페이지</button>
      {project.pages.map((p,i)=><button key={p.id} className={'pageCard '+(p.id===page.id?'active':'')} onClick={()=>selectPage(p.id)}>
        <span>{i+1}</span><b>{p.name}</b><small>{p.items.length}개 요소</small>
        {project.pages.length>1&&<i onClick={e=>{e.stopPropagation();deletePage(p.id)}}>×</i>}
      </button>)}
      <div className="pageFooter">
        <button onClick={addPlanningTemplate}>기획 카드</button>
        <button onClick={exportJson}>백업</button>
      </div>
    </aside>

    <main className="boardWrap">
      <div className="toolbar">
        {tools.map(t=><button key={t.id} className={tool===t.id?'active':''} onClick={()=>setTool(t.id)} title={t.label}><span>{t.icon}</span><small>{t.label}</small></button>)}
        <i/>
        <button onClick={undo} title="실행 취소">↶<small>Undo</small></button>
        <button onClick={redo} title="다시 실행">↷<small>Redo</small></button>
        <button onClick={()=>setPan({x:80,y:70,zoom:1})}>100%<small>맞춤</small></button>
      </div>
      <div className="subbar">
        <div className="colorRow">{colors.map(c=><button key={c} className={color===c?'on':''} style={{background:c}} onClick={()=>setColor(c)} aria-label={c}/>)}</div>
        <label>굵기 <input type="range" min="2" max="14" value={width} onChange={e=>setWidth(Number(e.target.value))}/></label>
        <span>줌 {Math.round(pan.zoom*100)}%</span>
        {selected&&<button className="danger" onClick={deleteSelected}>선택 삭제</button>}
        <button onClick={clearPage}>페이지 비우기</button>
        <div className="exportGroup"><button onClick={exportPng}>PNG</button><button onClick={printPdf}>PDF/인쇄</button></div>
      </div>

      <svg ref={svgRef} className="canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} onWheel={onWheel}>
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d7d9dd"/></pattern>
        </defs>
        <rect width="100%" height="100%" fill="#fcfcfb"/>
        <rect width="100%" height="100%" fill="url(#grid)" opacity=".58"/>
        <g transform={'translate('+pan.x+' '+pan.y+') scale('+pan.zoom+')'}>
          {items.map(renderItem)}
          {draft&&renderStroke(draft)}
        </g>
      </svg>
      <div className="penHint">S펜: 그리기 · 손가락: 이동/두 손가락 확대 · 더블탭: 메모 수정</div>
    </main>

    <aside className={'planner '+(rightOpen?'open':'closed')}>
      <button className="plannerToggle" onClick={()=>setRightOpen(v=>!v)}>{rightOpen?'›':'‹'}</button>
      {rightOpen&&<>
        <div className="plannerHead"><span>PLAN</span><div><b>기획 정리</b><small>캔버스의 메모를 제품 기획 구조로 정리합니다.</small></div></div>
        <section><label>문제</label><p>{planning.problem}</p></section>
        <section><label>핵심 사용자</label><p>{planning.audience}</p></section>
        <section><label>사용 상황</label><p>{planning.situation}</p></section>
        <section className="value"><label>핵심 가치</label><p>{planning.coreValue}</p></section>
        <section><label>MVP Cutter</label><div className="chips">{planning.mvp.map(x=><span key={x}>{x}</span>)}</div></section>
        <section><label>2차 기능</label><div className="mutedList">{planning.later.map(x=><span key={x}>{x}</span>)}</div></section>
        <section><label>재방문</label><ul>{planning.retention.map(x=><li key={x}>{x}</li>)}</ul></section>
        <section><label>수익화</label><ul>{planning.revenue.map(x=><li key={x}>{x}</li>)}</ul></section>
        <section className="risk"><label>기획 체크</label><ul>{planning.risks.map(x=><li key={x}>{x}</li>)}</ul></section>
        <button className="primary" onClick={copyPrompt}>벼림 개발 프롬프트 복사</button>
        <small className="plannerNote">현재 v1은 오프라인에서도 동작하는 로컬 기획 엔진입니다. 추후 Prompt Engine API를 연결하면 AI 심화 기획으로 확장할 수 있습니다.</small>
      </>}
    </aside>

    {showPwa&&<div className="modal" onClick={()=>setShowPwa(false)}><div className="help pwaDiag" onClick={e=>e.stopPropagation()}>
      <button className="close" onClick={()=>setShowPwa(false)}>×</button>
      <h2>PWA 설치 진단</h2>
      <p className="diagBrowser">브라우저: <b>{pwaReport?.browser??'확인 중'}</b></p>
      <div className="diagList">
        {pwaReport?.checks.map(check=><div key={check.label} className={'diagRow '+(check.ok?'pass':'fail')}>
          <span className="diagIcon">{check.ok?'✓':'!'}</span>
          <div><b>{check.label}</b><small>{check.detail}</small></div>
        </div>)}
      </div>
      <div className="diagRecommendation">
        <b>다음 조치</b>
        <p>{pwaReport?.recommendation}</p>
      </div>
      {!pwaReport?.installed&&pwaReport?.installable&&<button className="primary" onClick={install}>지금 설치</button>}
    </div></div>}
    {showHelp&&<div className="modal" onClick={()=>setShowHelp(false)}><div className="help" onClick={e=>e.stopPropagation()}>
      <button className="close" onClick={()=>setShowHelp(false)}>×</button>
      <h2>벼림노트 사용법</h2>
      <div className="helpGrid">
        <article><b>S펜</b><p>펜/형광펜/지우개를 선택해 바로 그립니다. 필압값을 받아 선 굵기에 반영합니다.</p></article>
        <article><b>손가락</b><p>한 손가락으로 캔버스를 이동하고 두 손가락으로 확대·축소합니다. S펜 사용 직후 터치는 무시해 손바닥 오입력을 줄입니다.</p></article>
        <article><b>기획</b><p>스티키 메모와 화면 프레임으로 흐름을 만든 뒤 오른쪽 기획 패널에서 MVP·재방문·수익화를 정리합니다.</p></article>
        <article><b>PWA</b><p>Chrome 또는 Samsung Internet에서 앱 설치를 누르면 홈 화면 앱처럼 실행할 수 있습니다.</p></article>
      </div>
    </div></div>}
    {toast&&<div className="toast">{toast}</div>}
  </div>
}
