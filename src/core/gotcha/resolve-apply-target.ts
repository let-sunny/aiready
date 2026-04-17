import type { InstanceContext } from "../contracts/gotcha-survey.js";
import { isInstanceChildNodeId } from "../adapters/instance-id-parser.js";

/**
 * Resolved targets for applying gotcha fixes in Figma (Plugin API or MCP `use_figma`).
 *
 * Survey questions may include `instanceContext` when the violation `nodeId` is an
 * instance-child id (`I...;...`). Property overrides often fail on those scene nodes;
 * the definition node id is the usual write target after user confirmation.
 */
export type GotchaApplyResolution = {
  /** Scene node id from the survey (`question.nodeId`). */
  sceneNodeId: string;
  /** Source definition node id from `instanceContext.sourceNodeId`, when known. */
  definitionNodeId: string | undefined;
  /**
   * When true, layout and size-constraint style writes should use the definition path
   * (after explicit user confirmation) because instance overrides are commonly rejected.
   */
  shouldPreferDefinitionForLayoutProps: boolean;
  /** Human-readable note for skills, UI, or logs. */
  guidance: string;
};

/**
 * Resolve which node ids and policy apply for a gotcha survey question.
 */
export function resolveGotchaApplyTarget(
  nodeId: string,
  instanceContext: InstanceContext | undefined,
): GotchaApplyResolution {
  if (instanceContext) {
    const label = instanceContext.sourceComponentName ?? "the source component";
    return {
      sceneNodeId: nodeId,
      definitionNodeId: instanceContext.sourceNodeId,
      shouldPreferDefinitionForLayoutProps: true,
      guidance:
        `This question targets a node inside an instance. Overrides may fail on the scene node. ` +
        `For layout and min/max sizing, apply changes on definition node ${instanceContext.sourceNodeId} ` +
        `in ${label} (parent instance ${instanceContext.parentInstanceNodeId}). ` +
        `Confirm with the user first — definition edits propagate to every instance of that component in the file.`,
    };
  }

  if (isInstanceChildNodeId(nodeId)) {
    return {
      sceneNodeId: nodeId,
      definitionNodeId: undefined,
      shouldPreferDefinitionForLayoutProps: true,
      guidance:
        "The node id looks like a Figma instance child (`I...;...`) but no `instanceContext` was attached. " +
        "Parse the segment after the last `;` as the source definition id, resolve the parent INSTANCE, " +
        "and use `getMainComponentAsync()` when `figma.getNodeById(sourceId)` is not enough (e.g. nested instances).",
    };
  }

  return {
    sceneNodeId: nodeId,
    definitionNodeId: undefined,
    shouldPreferDefinitionForLayoutProps: false,
    guidance: "",
  };
}
