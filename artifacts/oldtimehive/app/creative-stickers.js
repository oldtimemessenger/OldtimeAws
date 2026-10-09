import { roundBox, wrapLines } from "./creative-renderer.js";

export function drawSticker(ctx, layer) {
  const size = { width: layer.width || 560, height: layer.height || 180 };
  const x = -size.width / 2, y = -size.height / 2;
  ctx.fillStyle = layer.color || "#e5262f"; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 18;
  switch (layer.sticker) {
    case "heart":
      ctx.beginPath(); ctx.moveTo(0, 110);
      ctx.bezierCurveTo(-260,-40,-150,-200,0,-80); ctx.bezierCurveTo(150,-200,260,-40,0,110); ctx.fill();
      return { width: 390, height: 300 };
    case "arrow":
      ctx.beginPath(); ctx.moveTo(-220, 0); ctx.lineTo(170, 0); ctx.moveTo(70,-110); ctx.lineTo(180,0); ctx.lineTo(70,110);
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(); return { width: 480, height: 260 };
    case "circle":
      ctx.beginPath(); ctx.arc(0,0,160,0,Math.PI*2); ctx.fill(); return { width: 320, height: 320 };
    case "rectangle":
      roundBox(ctx,-220,-110,440,220,22); ctx.fill(); return { width: 440, height: 220 };
    case "star":
      ctx.beginPath();
      for (let i=0;i<10;i++) { const r=i%2?75:170, a=i*Math.PI/5-Math.PI/2; i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r); }
      ctx.closePath(); ctx.fill(); return { width: 350, height: 350 };
    default: {
      ctx.font = "700 44px Manrope, system-ui, sans-serif";
      const prefix = { location: "Location · ", mention: "@", hashtag: "#", music: "Audio · ", question: "Question · ", reaction: "" }[layer.sticker] || "";
      const text = prefix + (layer.text || "");
      const lines = wrapLines(ctx, text, size.width - 64);
      size.height = 64 + lines.length * 58 + (layer.sticker === "poll" ? 190 : 0);
      roundBox(ctx,x,-size.height/2,size.width,size.height,30); ctx.fillStyle = layer.background || "#fff"; ctx.fill();
      ctx.fillStyle = layer.color || "#17191d"; ctx.textAlign = "center";
      lines.forEach((line,i) => ctx.fillText(line,0,-size.height/2 + 65 + i*58));
      if (layer.sticker === "poll") {
        (layer.choices || ["Yes","No"]).slice(0,2).forEach((choice,i) => {
          const yy = -size.height/2 + 80 + lines.length*58 + i*76;
          roundBox(ctx,x+20,yy,size.width-40,64,18); ctx.fillStyle="#f2f3f5"; ctx.fill();
          const count=Object.values(layer.votes||{}).filter(value=>value===i).length;
          ctx.fillStyle=layer.color || "#17191d"; ctx.font="600 34px Manrope, sans-serif"; ctx.fillText(`${choice} · ${count}`,0,yy+43);
        });
      }
      return size;
    }
  }
}
