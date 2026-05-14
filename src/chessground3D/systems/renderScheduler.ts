type SceneRenderStep = () => void;

const activeSceneRenderSteps = new Set<SceneRenderStep>();
let sharedAnimationFrameId: number | undefined;

function runSharedAnimationFrame() {
  if (activeSceneRenderSteps.size === 0) {
    sharedAnimationFrameId = undefined;
    return;
  }

  for (const renderStep of activeSceneRenderSteps) {
    renderStep();
  }

  sharedAnimationFrameId = requestAnimationFrame(runSharedAnimationFrame);
}

export function registerSceneRenderStep(renderStep: SceneRenderStep): () => void {
  activeSceneRenderSteps.add(renderStep);

  if (sharedAnimationFrameId === undefined) {
    sharedAnimationFrameId = requestAnimationFrame(runSharedAnimationFrame);
  }

  return () => {
    activeSceneRenderSteps.delete(renderStep);
    if (activeSceneRenderSteps.size === 0 && sharedAnimationFrameId !== undefined) {
      cancelAnimationFrame(sharedAnimationFrameId);
      sharedAnimationFrameId = undefined;
    }
  };
}
