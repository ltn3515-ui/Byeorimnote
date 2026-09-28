export type Tool = 'pen'|'highlighter'|'eraser'|'select'|'note'|'rect'|'ellipse'|'frame'|'arrow'|'text'
export type Point = { x:number; y:number; p:number }

export type StrokeItem = {
  id:string; type:'stroke'; points:Point[]; color:string; width:number; opacity:number; tool:'pen'|'highlighter'|'eraser'
}
export type NoteItem = {
  id:string; type:'note'; x:number; y:number; w:number; h:number; text:string; color:string
}
export type ShapeItem = {
  id:string; type:'rect'|'ellipse'|'frame'; x:number; y:number; w:number; h:number; color:string
}
export type ArrowItem = {
  id:string; type:'arrow'; x1:number; y1:number; x2:number; y2:number; color:string
}
export type TextItem = {
  id:string; type:'text'; x:number; y:number; text:string; color:string; size:number
}
export type BoardItem = StrokeItem|NoteItem|ShapeItem|ArrowItem|TextItem
export type Page = { id:string; name:string; items:BoardItem[] }
export type Project = { title:string; pages:Page[]; activePageId:string; updatedAt:number }

export type PlanningReport = {
  problem:string
  audience:string
  situation:string
  coreValue:string
  mvp:string[]
  later:string[]
  retention:string[]
  revenue:string[]
  risks:string[]
}
