import type { DrawingData, DrawingStroke } from "./qwt-store-model";

export const DRAWING_WIDTH = 720;
export const DRAWING_HEIGHT = 320;

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: DrawingStroke,
  scaleX: number,
  scaleY: number,
) {
  const [firstPoint, ...remainingPoints] = stroke.points;

  if (!firstPoint) {
    return;
  }

  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.size * Math.max(scaleX, scaleY);
  context.lineCap = "round";
  context.lineJoin = "round";

  if (!remainingPoints.length) {
    context.beginPath();
    context.arc(
      firstPoint.x * scaleX,
      firstPoint.y * scaleY,
      Math.max(1, (stroke.size * Math.max(scaleX, scaleY)) / 2),
      0,
      Math.PI * 2,
    );
    context.fill();
    return;
  }

  context.beginPath();
  context.moveTo(firstPoint.x * scaleX, firstPoint.y * scaleY);

  for (const point of remainingPoints) {
    context.lineTo(point.x * scaleX, point.y * scaleY);
  }

  context.stroke();
}

export function renderDrawing(
  context: CanvasRenderingContext2D,
  drawingData: DrawingData | null,
  options: { width?: number; height?: number } = {},
) {
  const width = options.width ?? DRAWING_WIDTH;
  const height = options.height ?? DRAWING_HEIGHT;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  if (!drawingData) {
    return;
  }

  const scaleX = width / drawingData.width;
  const scaleY = height / drawingData.height;

  for (const stroke of drawingData.strokes) {
    drawStroke(context, stroke, scaleX, scaleY);
  }
}
