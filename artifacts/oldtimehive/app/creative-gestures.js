import { hitLayer, transformGesture, createLayer, localPoint } from "./creative-project.js";
import {canvasGeometry} from "./creative-canvas-geometry.js";

export function bindCreativeGestures(canvas, { project, measurements, time, selected, select, changed, trash, remove, options, drawing, preview, checkpoint = () => {}, editText = () => {} }) {
  const pointers = new Map();
  let anchor = null, stroke = null, path = null, hold = null, origin = null, moved = false, lastTap = null;
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    const fit=canvasGeometry(rect,project,getComputedStyle(canvas).objectFit);
    return {x:(event.clientX-rect.left-fit.offsetX)/fit.scaleX,y:(event.clientY-rect.top-fit.offsetY)/fit.scaleY};
  };
  const cancelHold = () => { clearTimeout(hold); hold = null; };
  const resetAnchor = () => {
    const layer = project.layers.find(item => item.id === selected());
    anchor = layer ? { initial: { x: layer.x, y: layer.y, scale: layer.scale, rotation: layer.rotation }, before: [...pointers.values()] } : null;
  };
  const overTrash = event => {
    const rect = trash.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  };
  const down = event => {
    if (preview() || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault(); canvas.setPointerCapture(event.pointerId);
    const current = point(event); pointers.set(event.pointerId, current);
    if (drawing() && pointers.size === 1) {
      const brush = drawing(), existing = project.layers.find(item => item.id === selected());
      let layer = brush.mode === "eraser" ? (existing?.kind === "drawing" && !existing.locked ? existing : [...project.layers].reverse().find(item => item.kind === "drawing" && !item.locked && !item.hidden))
        : brush.mode === "handwriting" && existing?.handwriting && !existing.locked ? existing : null;
      if (brush.mode === "eraser" && !layer) { pointers.delete(event.pointerId); return; }
      checkpoint();
      if (!layer) {
        layer = createLayer("drawing", { width: project.width, height: project.height, strokes: [],
          color: brush.color, strokeWidth: brush.width, handwriting: brush.mode === "handwriting", startTime: 0, endTime: project.duration });
        project.layers.push(layer);
      }
      path = { points: [localPoint(layer,current,project)], color: brush.color, width: brush.width * (brush.mode==="marker"?1.4:1),
        opacity: brush.opacity * (brush.mode === "highlighter" ? .35 : 1), erase: brush.mode === "eraser" };
      layer.strokes.push(path); layer.revision = (layer.revision || 0) + 1;
      stroke = layer; select(layer.id); changed(false); return;
    }
    if (pointers.size === 1) {
      const layer = hitLayer(project, current, measurements(), time());
      select(layer?.id || null); origin = { x: event.clientX, y: event.clientY }; moved = false;
      if (layer) hold = setTimeout(() => { options(); anchor = null; }, 600);
    } else cancelHold();
    resetAnchor();
  };
  const move = event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault(); const current = point(event); pointers.set(event.pointerId, current);
    if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 5) cancelHold();
    if (stroke) { path.points.push(localPoint(stroke, current, project)); stroke.revision++; changed(false); return; }
    const layer = project.layers.find(item => item.id === selected());
    if (!layer || !anchor) return;
    if (!moved) { checkpoint(); moved = true; }
    transformGesture(layer, anchor.initial, anchor.before, [...pointers.values()], project);
    trash.classList.add("show"); trash.classList.toggle("is-over", overTrash(event)); changed(false);
    resetAnchor();
  };
  const up = event => {
    cancelHold();
    if (!pointers.has(event.pointerId)) return;
    if (!stroke && event.type !== "pointercancel" && trash.classList.contains("show") && overTrash(event)) remove();
    if (stroke && pointers.size === 1 && !path.erase) {
      const points = stroke.strokes.flatMap(item => Array.isArray(item) ? item : item.points);
      const ink=stroke.strokes.filter(item=>!item.erase).flatMap(item=>Array.isArray(item)?item:item.points);
      const minX = Math.min(...ink.map(p => p.x)), maxX = Math.max(...ink.map(p => p.x));
      const minY = Math.min(...ink.map(p => p.y)), maxY = Math.max(...ink.map(p => p.y));
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const angle=stroke.rotation*Math.PI/180;
      stroke.x += (cx*Math.cos(angle)-cy*Math.sin(angle))*stroke.scale/project.width;
      stroke.y += (cx*Math.sin(angle)+cy*Math.cos(angle))*stroke.scale/project.height;
      const padding=Math.max(stroke.strokeWidth,...stroke.strokes.map(item=>item.width||0))*2;
      stroke.width = Math.max(30, maxX - minX + padding);
      stroke.height = Math.max(30, maxY - minY + padding);
      points.forEach(p => { p.x -= cx; p.y -= cy; });
      stroke.revision++;
    }
    pointers.delete(event.pointerId);
    if (!pointers.size) {
      if (!stroke && !moved && event.type !== "pointercancel") {
        const id = selected(), now = performance.now();
        if (lastTap?.id === id && now-lastTap.at < 350) { editText(project.layers.find(item=>item.id===id)); lastTap=null; }
        else lastTap={id,at:now};
      }
      stroke = null; path = null; anchor = null; origin = null; trash.classList.remove("show", "is-over"); changed();
    }
    else resetAnchor();
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.style.touchAction = "none";
  for (const [name, callback] of [["pointerdown", down], ["pointermove", move], ["pointerup", up], ["pointercancel", up]]) canvas.addEventListener(name, callback);
  return () => {
    cancelHold(); pointers.clear();
    for (const [name, callback] of [["pointerdown", down], ["pointermove", move], ["pointerup", up], ["pointercancel", up]]) canvas.removeEventListener(name, callback);
  };
}
