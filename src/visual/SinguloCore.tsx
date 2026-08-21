import { useEffect, useRef } from "react";
import { SinguloCoreEngine } from "./core-engine";
import { useSettings } from "@/config/settings";
import { useSingulo } from "@/lib/state/singulo";

export function SinguloCore({
  onReady,
}: {
  onReady?: (engine: SinguloCoreEngine | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SinguloCoreEngine | null>(null);
  const appearance = useSettings((s) => s.appearance);
  const aiState = useSingulo((s) => s.aiState);
  const micLevel = useSingulo((s) => s.micLevel);
  const speechLevel = useSingulo((s) => s.speechLevel);

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new SinguloCoreEngine({
      intensity: appearance.intensity,
      particleDensity: appearance.particleDensity,
      animationIntensity: appearance.animationIntensity,
      reducedMotion: appearance.reducedMotion,
    });
    engine.mount(canvasRef.current);
    engineRef.current = engine;
    onReady?.(engine);

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      onReady?.(null);
      engineRef.current = null;
      engine.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setOptions({
      intensity: appearance.intensity,
      particleDensity: appearance.particleDensity,
      animationIntensity: appearance.animationIntensity,
      reducedMotion: appearance.reducedMotion,
    });
  }, [appearance]);

  useEffect(() => engineRef.current?.setState(aiState), [aiState]);
  useEffect(() => engineRef.current?.setLevels(micLevel, speechLevel), [micLevel, speechLevel]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    let dragging = false;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      engineRef.current?.zoomBy(-dy * 0.0015);
    };
    const onDown = (event: PointerEvent) => {
      dragging = true;
      element.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      engineRef.current?.setPointer({
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      });
      if (!dragging) return;
      engineRef.current?.rotateBy(event.movementX / rect.width, event.movementY / rect.height);
    };
    const onUp = () => {
      dragging = false;
    };
    const onLeave = () => engineRef.current?.setPointer(null);
    const onDouble = () => engineRef.current?.reset();

    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointerleave", onLeave);
    element.addEventListener("dblclick", onDouble);
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointerleave", onLeave);
      element.removeEventListener("dblclick", onDouble);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />;
}