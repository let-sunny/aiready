// canicode-roundtrip helpers installer (auto-generated — see scripts/bundle-roundtrip-cache.ts)
// Prepend to the FIRST use_figma batch of a roundtrip session. Caches the helpers source on
// figma.root via setSharedPluginData so subsequent batches can prepend the much smaller
// helpers-bootstrap.js instead of re-pasting ~31KB every call (#424, ADR-020).
var __CANICODE_HELPERS_SRC__ = "var CanICodeRoundtrip = (function (exports) {\n  'use strict';\n\n  // src/core/roundtrip/annotations.ts\n  function stripAnnotations(annotations) {\n    const input = annotations ?? [];\n    const out = [];\n    for (const a of input) {\n      const hasLM = typeof a.labelMarkdown === \"string\" && a.labelMarkdown.length > 0;\n      const hasLabel = typeof a.label === \"string\" && a.label.length > 0;\n      if (!hasLM && !hasLabel) continue;\n      const base = hasLM ? { labelMarkdown: a.labelMarkdown } : { label: a.label };\n      if (a.categoryId) base.categoryId = a.categoryId;\n      if (Array.isArray(a.properties) && a.properties.length > 0) {\n        base.properties = a.properties;\n      }\n      out.push(base);\n    }\n    return out;\n  }\n  async function ensureCanicodeCategories() {\n    const api = figma.annotations;\n    const existing = await api.getAnnotationCategoriesAsync();\n    const byLabel = new Map(existing.map((c) => [c.label, c.id]));\n    async function ensure(label, color) {\n      const cached = byLabel.get(label);\n      if (cached) return cached;\n      const created = await api.addAnnotationCategoryAsync({ label, color });\n      byLabel.set(label, created.id);\n      return created.id;\n    }\n    const result = {\n      gotcha: await ensure(\"canicode:gotcha\", \"blue\"),\n      flag: await ensure(\"canicode:flag\", \"green\"),\n      fallback: await ensure(\"canicode:fallback\", \"yellow\")\n    };\n    const legacyAutoFix = byLabel.get(\"canicode:auto-fix\");\n    if (legacyAutoFix) result.legacyAutoFix = legacyAutoFix;\n    return result;\n  }\n  function upsertCanicodeAnnotation(node, input) {\n    if (!node || !(\"annotations\" in node)) return false;\n    const { ruleId, markdown, categoryId, properties } = input;\n    const legacyPrefix = `**[canicode] ${ruleId}**`;\n    const footer = `\\u2014 *${ruleId}*`;\n    let bodyText = markdown;\n    if (bodyText.startsWith(legacyPrefix)) {\n      bodyText = bodyText.slice(legacyPrefix.length).replace(/^\\s*\\n+/, \"\");\n    }\n    const trimmed = bodyText.replace(/\\s+$/, \"\");\n    const body = trimmed.endsWith(footer) ? trimmed : `${trimmed}\n\n${footer}`;\n    const existing = stripAnnotations(node.annotations);\n    const entry = { labelMarkdown: body };\n    if (categoryId) entry.categoryId = categoryId;\n    if (properties && properties.length > 0) entry.properties = properties;\n    const matchesRuleId = (text) => {\n      if (typeof text !== \"string\") return false;\n      return text.startsWith(legacyPrefix) || text.includes(footer);\n    };\n    const idx = existing.findIndex(\n      (a) => matchesRuleId(a.labelMarkdown) || matchesRuleId(a.label)\n    );\n    if (idx >= 0) existing[idx] = entry;\n    else existing.push(entry);\n    try {\n      node.annotations = existing;\n      return true;\n    } catch (e) {\n      const msg = String(e?.message ?? e);\n      const isNodeTypeReject = /invalid property .+ for a .+ node/i.test(msg);\n      if (!entry.properties || !isNodeTypeReject) throw e;\n      delete entry.properties;\n      if (idx >= 0) existing[idx] = entry;\n      node.annotations = existing;\n      return true;\n    }\n  }\n\n  // src/core/roundtrip/annotation-payload.ts\n  var CANICODE_JSON_FENCE = \"```canicode-json\";\n  function formatIntentValueForDisplay(value) {\n    if (value === void 0) return \"undefined\";\n    if (value === null) return \"null\";\n    if (typeof value === \"object\") {\n      try {\n        return `\\`${JSON.stringify(value)}\\``;\n      } catch {\n        return String(value);\n      }\n    }\n    return `\\`${String(value)}\\``;\n  }\n  function buildCodegenDirective(args) {\n    const { sceneNodeId, intent } = args;\n    const val = intent.value === void 0 ? \"undefined\" : JSON.stringify(intent.value);\n    return `When generating code for node ${sceneNodeId}, set ${intent.field} to ${val} (user intent, scope: ${intent.scope}). Prefer this over the current Figma scene value when they disagree.`;\n  }\n  function sceneOutcomeToAck(result, reason) {\n    return reason !== void 0 ? { result, reason } : { result };\n  }\n  function buildOutcomeHumanLine(args) {\n    if (args.skippedDefinitionDueToAdr012) {\n      const adrHint = \" Canicode skipped writing the source component without `allowDefinitionWrite: true` (ADR-012 safer default). The instance-level change did not apply as intended in the scene.\";\n      if (args.reason === \"silent-ignore\") {\n        return \"**Scene write outcome:** The write ran, but the property value did not change on this instance (silent-ignore).\" + adrHint;\n      }\n      return \"**Scene write outcome:** Figma rejected an instance-level change\" + (args.errorMessage ? `: ${args.errorMessage}` : \"\") + \".\" + adrHint;\n    }\n    if (args.reason === \"silent-ignore\") {\n      return \"**Scene write outcome:** The write ran, but the property value did not change on this instance (silent-ignore). No source definition was available to escalate.\";\n    }\n    if (args.reason === \"override-error\") {\n      return \"**Scene write outcome:** Figma rejected an instance-level change\" + (args.errorMessage ? `: ${args.errorMessage}` : \"\") + \". No source definition was available to escalate.\";\n    }\n    return \"**Scene write outcome:** Could not apply automatically\" + (args.errorMessage ? `: ${args.errorMessage}` : \"\") + \".\";\n  }\n  function buildAdr012PropagationParagraph(args) {\n    const { componentName, replicaCount } = args;\n    const fanOutHint = typeof replicaCount === \"number\" && replicaCount >= 2 ? ` This batched question covers ${replicaCount} instance scenes \\u2014 changing **${componentName}** at the definition still affects every inheriting instance, not just one row in the batch.` : \"\";\n    return `Canicode's safer default (ADR-012) is to skip writing the source component **${componentName}** without explicit opt-in, because that write propagates to every non-overridden instance of **${componentName}** in the file.${fanOutHint} Prefer a manual override on **this** instance when you only need a local fix. Use \\`allowDefinitionWrite: true\\` only when you intend to change **${componentName}** for all inheriting instances \\u2014 it is not a neutral shortcut for a single-instance tweak.`;\n  }\n  function buildDefinitionWriteSkippedBody(args) {\n    const {\n      ruleId,\n      sceneNodeId,\n      componentName,\n      reason,\n      errorMessage,\n      replicaCount,\n      intent\n    } = args;\n    const ackIntent = intent ? {\n      field: intent.field,\n      value: intent.value,\n      scope: intent.scope\n    } : void 0;\n    const sceneWriteOutcome = sceneOutcomeToAck(\"user-declined-propagation\", \"adr-012-opt-in-disabled\");\n    const codegenDirective = intent !== void 0 ? buildCodegenDirective({ sceneNodeId, intent }) : void 0;\n    const jsonBlock = {\n      v: 1,\n      ruleId,\n      nodeId: sceneNodeId,\n      ...ackIntent ? { intent: ackIntent } : {},\n      sceneWriteOutcome,\n      ...codegenDirective ? { codegenDirective } : {}\n    };\n    const userAnswerLine = intent !== void 0 ? `**User answered:** ${formatIntentValueForDisplay(intent.value)} for **${intent.field}** (scope: ${intent.scope}).` : null;\n    const outcomeLine = buildOutcomeHumanLine({\n      reason,\n      ...errorMessage !== void 0 ? { errorMessage } : {},\n      skippedDefinitionDueToAdr012: true\n    });\n    const adrBlock = buildAdr012PropagationParagraph({\n      componentName,\n      ...replicaCount !== void 0 ? { replicaCount } : {}\n    });\n    const proseParts = [userAnswerLine, outcomeLine, adrBlock].filter(\n      (p) => p !== null\n    );\n    const prose = proseParts.join(\"\\n\\n\");\n    return appendJsonFenceAndFooter(prose, jsonBlock, ruleId);\n  }\n  function buildNoDefinitionFallbackBody(args) {\n    const { ruleId, sceneNodeId, reason, errorMessage, intent } = args;\n    const ackIntent = intent ? { field: intent.field, value: intent.value, scope: intent.scope } : void 0;\n    const outcomeResult = reason === \"silent-ignore\" ? \"silent-ignored\" : reason === \"override-error\" ? \"api-rejected\" : \"api-rejected\";\n    const sceneWriteOutcome = sceneOutcomeToAck(\n      outcomeResult,\n      reason === \"silent-ignore\" ? \"silent-ignore-no-definition\" : \"no-definition-escalation\"\n    );\n    const codegenDirective = intent !== void 0 ? buildCodegenDirective({ sceneNodeId, intent }) : void 0;\n    const jsonBlock = {\n      v: 1,\n      ruleId,\n      nodeId: sceneNodeId,\n      ...ackIntent ? { intent: ackIntent } : {},\n      sceneWriteOutcome,\n      ...codegenDirective ? { codegenDirective } : {}\n    };\n    const userAnswerLine = intent !== void 0 ? `**User answered:** ${formatIntentValueForDisplay(intent.value)} for **${intent.field}** (scope: ${intent.scope}).` : null;\n    const outcomeLine = buildOutcomeHumanLine({\n      reason,\n      ...errorMessage !== void 0 ? { errorMessage } : {},\n      skippedDefinitionDueToAdr012: false\n    });\n    const prose = [userAnswerLine, outcomeLine].filter((p) => p !== null).join(\"\\n\\n\");\n    return appendJsonFenceAndFooter(prose, jsonBlock, ruleId);\n  }\n  function buildDefinitionTierFailureBody(args) {\n    const { ruleId, sceneNodeId, intent, kind, errorMessage } = args;\n    const sceneWriteOutcome = sceneOutcomeToAck(\n      kind === \"read-only-library\" ? \"api-rejected\" : \"api-rejected\",\n      kind === \"read-only-library\" ? \"definition-read-only\" : \"definition-write-failed\"\n    );\n    const codegenDirective = intent !== void 0 ? buildCodegenDirective({ sceneNodeId, intent }) : void 0;\n    const jsonBlock = {\n      v: 1,\n      ruleId,\n      nodeId: sceneNodeId,\n      ...intent ? {\n        intent: {\n          field: intent.field,\n          value: intent.value,\n          scope: intent.scope\n        }\n      } : {},\n      sceneWriteOutcome,\n      ...codegenDirective ? { codegenDirective } : {}\n    };\n    const human = kind === \"read-only-library\" ? \"source component lives in an external library and is read-only from this file \\u2014 apply the fix in the library file itself.\" : `could not apply at source definition: ${errorMessage}`;\n    const userAnswerLine = intent !== void 0 ? `**User answered:** ${formatIntentValueForDisplay(intent.value)} for **${intent.field}** (scope: ${intent.scope}).` : null;\n    const outcomeLine = `**Scene write outcome:** ${human}`;\n    const prose = [userAnswerLine, outcomeLine].filter((p) => p !== null).join(\"\\n\\n\");\n    return appendJsonFenceAndFooter(prose, jsonBlock, ruleId);\n  }\n  function appendJsonFenceAndFooter(prose, jsonBlock, ruleId) {\n    const footer = `\\u2014 *${ruleId}*`;\n    const hasIntent = jsonBlock.intent !== void 0;\n    if (!hasIntent) {\n      return `${prose}\n\n${footer}`;\n    }\n    const jsonText = JSON.stringify(jsonBlock, null, 0);\n    return `${prose}\n\n${CANICODE_JSON_FENCE}\n${jsonText}\n\\`\\`\\`\n\n${footer}`;\n  }\n  var FENCED_JSON_RE = new RegExp(\n    `${CANICODE_JSON_FENCE.replace(/[.*+?^${}()|[\\]\\\\]/g, \"\\\\$&\")}\\\\s*([\\\\s\\\\S]*?)\\\\s*\\`\\`\\``,\n    \"m\"\n  );\n  function parseCanicodeJsonPayloadFromMarkdown(text) {\n    const m = FENCED_JSON_RE.exec(text);\n    if (!m?.[1]) return void 0;\n    try {\n      const raw = JSON.parse(m[1].trim());\n      if (!raw || typeof raw !== \"object\") return void 0;\n      const o = raw;\n      if (o.v !== 1 || typeof o.ruleId !== \"string\") return void 0;\n      return raw;\n    } catch {\n      return void 0;\n    }\n  }\n\n  // src/core/roundtrip/apply-with-instance-fallback.ts\n  var DEFINITION_WRITE_SKIPPED_EVENT = \"cic_roundtrip_definition_write_skipped\";\n  function categoryIdForAnnotate(categories, kind, roundtripIntent) {\n    if (kind === \"adr012-definition-skipped\") {\n      return categories.fallback;\n    }\n    if (roundtripIntent !== void 0) {\n      return categories.gotcha;\n    }\n    return categories.flag;\n  }\n  function resolveSourceComponentName(definition, question) {\n    if (definition && typeof definition.name === \"string\" && definition.name) {\n      return definition.name;\n    }\n    const ic = question.instanceContext;\n    if (ic && typeof ic.sourceComponentName === \"string\" && ic.sourceComponentName) {\n      return ic.sourceComponentName;\n    }\n    return \"the source component\";\n  }\n  async function routeToDefinitionOrAnnotate(definition, writeFn, ctx) {\n    if (definition && !ctx.allowDefinitionWrite && ctx.reason !== \"non-override-error\") {\n      const componentName = resolveSourceComponentName(definition, ctx.question);\n      const replicaCount = typeof ctx.question.replicas === \"number\" && Number.isInteger(ctx.question.replicas) ? ctx.question.replicas : void 0;\n      if (ctx.categories) {\n        upsertCanicodeAnnotation(ctx.scene, {\n          ruleId: ctx.question.ruleId,\n          markdown: buildDefinitionWriteSkippedBody({\n            ruleId: ctx.question.ruleId,\n            sceneNodeId: ctx.scene.id,\n            componentName,\n            reason: ctx.reason,\n            ...ctx.errorMessage !== void 0 ? { errorMessage: ctx.errorMessage } : {},\n            ...replicaCount !== void 0 ? { replicaCount } : {},\n            ...ctx.roundtripIntent !== void 0 ? { intent: ctx.roundtripIntent } : {}\n          }),\n          categoryId: categoryIdForAnnotate(\n            ctx.categories,\n            \"adr012-definition-skipped\",\n            ctx.roundtripIntent\n          )\n        });\n      }\n      ctx.telemetry?.(DEFINITION_WRITE_SKIPPED_EVENT, {\n        ruleId: ctx.question.ruleId,\n        reason: ctx.reason\n      });\n      return {\n        icon: \"\\u{1F4DD}\",\n        label: \"definition write skipped (opt-in disabled)\"\n      };\n    }\n    if (!definition) {\n      if (ctx.categories) {\n        const markdown = buildNoDefinitionFallbackBody({\n          ruleId: ctx.question.ruleId,\n          sceneNodeId: ctx.scene.id,\n          reason: ctx.reason,\n          ...ctx.errorMessage !== void 0 ? { errorMessage: ctx.errorMessage } : {},\n          ...ctx.roundtripIntent !== void 0 ? { intent: ctx.roundtripIntent } : {}\n        });\n        upsertCanicodeAnnotation(ctx.scene, {\n          ruleId: ctx.question.ruleId,\n          markdown,\n          categoryId: categoryIdForAnnotate(\n            ctx.categories,\n            \"other-failure\",\n            ctx.roundtripIntent\n          )\n        });\n      }\n      return ctx.reason === \"silent-ignore\" ? { icon: \"\\u{1F4DD}\", label: \"silent-ignore, annotated\" } : { icon: \"\\u{1F4DD}\", label: `error: ${ctx.errorMessage ?? \"\"}` };\n    }\n    try {\n      await writeFn(definition);\n      return {\n        icon: \"\\u{1F310}\",\n        label: ctx.reason === \"silent-ignore\" ? \"source definition (silent-ignore fallback)\" : \"source definition\"\n      };\n    } catch (defErr) {\n      const defMsg = String(defErr?.message ?? defErr);\n      const isRemoteReadOnly = definition.remote === true || /read-only/i.test(defMsg);\n      if (ctx.categories) {\n        upsertCanicodeAnnotation(ctx.scene, {\n          ruleId: ctx.question.ruleId,\n          markdown: buildDefinitionTierFailureBody({\n            ruleId: ctx.question.ruleId,\n            sceneNodeId: ctx.scene.id,\n            ...ctx.roundtripIntent !== void 0 ? { intent: ctx.roundtripIntent } : {},\n            kind: isRemoteReadOnly ? \"read-only-library\" : \"definition-error\",\n            errorMessage: defMsg\n          }),\n          categoryId: categoryIdForAnnotate(\n            ctx.categories,\n            \"other-failure\",\n            ctx.roundtripIntent\n          )\n        });\n      }\n      return {\n        icon: \"\\u{1F4DD}\",\n        label: isRemoteReadOnly ? \"external library (read-only)\" : `definition error: ${defMsg}`\n      };\n    }\n  }\n  async function applyWithInstanceFallback(question, writeFn, context = {}) {\n    const { categories, allowDefinitionWrite = false, telemetry, roundtripIntent } = context;\n    const scene = await figma.getNodeByIdAsync(question.nodeId);\n    if (!scene) return { icon: \"\\u{1F4DD}\", label: \"missing node\" };\n    const definition = question.sourceChildId ? await figma.getNodeByIdAsync(question.sourceChildId) : null;\n    try {\n      const changed = await writeFn(scene);\n      if (changed === false) {\n        return routeToDefinitionOrAnnotate(definition, writeFn, {\n          question,\n          scene,\n          categories,\n          reason: \"silent-ignore\",\n          allowDefinitionWrite,\n          telemetry,\n          ...roundtripIntent !== void 0 ? { roundtripIntent } : {}\n        });\n      }\n      return { icon: \"\\u2705\", label: \"instance/scene\" };\n    } catch (e) {\n      const msg = String(e?.message ?? e);\n      const looksLikeInstanceOverride = /cannot be overridden/i.test(msg) || /override/i.test(msg);\n      if (!looksLikeInstanceOverride) {\n        return routeToDefinitionOrAnnotate(null, writeFn, {\n          question,\n          scene,\n          categories,\n          reason: \"non-override-error\",\n          errorMessage: msg,\n          allowDefinitionWrite,\n          telemetry,\n          ...roundtripIntent !== void 0 ? { roundtripIntent } : {}\n        });\n      }\n      return routeToDefinitionOrAnnotate(definition, writeFn, {\n        question,\n        scene,\n        categories,\n        reason: \"override-error\",\n        errorMessage: msg,\n        allowDefinitionWrite,\n        telemetry,\n        ...roundtripIntent !== void 0 ? { roundtripIntent } : {}\n      });\n    }\n  }\n\n  // src/core/roundtrip/apply-property-mod.ts\n  async function resolveVariableByName(name) {\n    const locals = await figma.variables.getLocalVariablesAsync();\n    return locals.find((v) => v.name === name) ?? null;\n  }\n  function parseValue(raw) {\n    if (raw && typeof raw === \"object\" && \"variable\" in raw) {\n      const v = raw;\n      const parsed = { kind: \"binding\", name: v.variable };\n      if (\"fallback\" in v) parsed.fallback = v.fallback;\n      return parsed;\n    }\n    if (raw && typeof raw === \"object\" && \"fallback\" in raw) {\n      return { kind: \"scalar\", scalar: raw.fallback };\n    }\n    return { kind: \"scalar\", scalar: raw };\n  }\n  function isPaintProp(prop) {\n    return prop === \"fills\" || prop === \"strokes\";\n  }\n  function applyPropertyBinding(target, prop, variable) {\n    if (isPaintProp(prop)) {\n      const current = target[prop];\n      if (current === figma.mixed || !Array.isArray(current)) return false;\n      const paints = current;\n      const bound = paints.map(\n        (paint) => figma.variables.setBoundVariableForPaint(paint, \"color\", variable)\n      );\n      target[prop] = bound;\n      return true;\n    }\n    target.setBoundVariable(prop, variable);\n    return true;\n  }\n  function buildRoundtripIntentFromPropertyAnswer(question, answerValue) {\n    const raw = question.targetProperty;\n    if (raw === void 0) return void 0;\n    const props = Array.isArray(raw) ? raw : [raw];\n    if (props.length === 0) return void 0;\n    if (props.length === 1) {\n      const prop = props[0];\n      const perProp = answerValue && typeof answerValue === \"object\" && !(\"variable\" in answerValue) && !Array.isArray(answerValue) ? answerValue[prop] : answerValue;\n      const parsed = parseValueForIntent(perProp);\n      if (parsed === void 0) return void 0;\n      return { field: prop, value: parsed, scope: \"instance\" };\n    }\n    const obj = answerValue && typeof answerValue === \"object\" && !(\"variable\" in answerValue) && !Array.isArray(answerValue) ? answerValue : void 0;\n    const picked = {};\n    for (const p of props) {\n      if (obj && p in obj && obj[p] !== void 0) picked[p] = obj[p];\n    }\n    if (Object.keys(picked).length === 0) return void 0;\n    return {\n      field: props.join(\", \"),\n      value: picked,\n      scope: \"instance\"\n    };\n  }\n  function parseValueForIntent(raw) {\n    if (raw && typeof raw === \"object\" && \"variable\" in raw) {\n      return { variable: raw.variable };\n    }\n    if (raw && typeof raw === \"object\" && \"fallback\" in raw) {\n      return raw.fallback;\n    }\n    return raw;\n  }\n  function applyPropertyScalar(target, prop, scalar) {\n    const rec = target;\n    const before = rec[prop];\n    rec[prop] = scalar;\n    if (rec[prop] === before && before !== scalar) return false;\n    return true;\n  }\n  async function applyPropertyMod(question, answerValue, context = {}) {\n    const roundtripIntent = buildRoundtripIntentFromPropertyAnswer(\n      question,\n      answerValue\n    );\n    const props = Array.isArray(question.targetProperty) ? question.targetProperty : question.targetProperty !== void 0 ? [question.targetProperty] : [];\n    return applyWithInstanceFallback(\n      question,\n      async (target) => {\n        if (!target) return void 0;\n        let changed = void 0;\n        for (const prop of props) {\n          if (!(prop in target)) continue;\n          const perProp = answerValue && typeof answerValue === \"object\" && !(\"variable\" in answerValue) && !Array.isArray(answerValue) ? answerValue[prop] : answerValue;\n          const parsed = parseValue(perProp);\n          if (parsed.kind === \"binding\") {\n            const variable = await resolveVariableByName(parsed.name);\n            if (variable) {\n              applyPropertyBinding(target, prop, variable);\n              continue;\n            }\n            if (parsed.fallback !== void 0) {\n              if (!applyPropertyScalar(target, prop, parsed.fallback)) {\n                changed = false;\n              }\n            }\n            continue;\n          }\n          if (parsed.scalar === void 0) continue;\n          if (!applyPropertyScalar(target, prop, parsed.scalar)) {\n            changed = false;\n          }\n        }\n        return changed;\n      },\n      {\n        ...context,\n        ...roundtripIntent !== void 0 ? { roundtripIntent } : {}\n      }\n    );\n  }\n\n  // src/core/roundtrip/probe-definition-writability.ts\n  async function probeDefinitionWritability(questions) {\n    const verdict = /* @__PURE__ */ new Map();\n    const unwritableNames = [];\n    const seenName = /* @__PURE__ */ new Set();\n    for (const q of questions) {\n      const id = q.sourceChildId;\n      if (!id) continue;\n      if (verdict.has(id)) continue;\n      const node = await figma.getNodeByIdAsync(id);\n      const writability = resolveWritability(node);\n      const isUnwritable = writability.isUnwritable;\n      verdict.set(id, isUnwritable ? \"unwritable\" : \"writable\");\n      if (isUnwritable) {\n        const name = typeof writability.componentName === \"string\" && writability.componentName || typeof node?.name === \"string\" && node.name || q.instanceContext?.sourceComponentName || id;\n        if (!seenName.has(name)) {\n          seenName.add(name);\n          unwritableNames.push(name);\n        }\n      }\n    }\n    const totalCount = verdict.size;\n    let unwritableCount = 0;\n    for (const v of verdict.values()) if (v === \"unwritable\") unwritableCount++;\n    return {\n      totalCount,\n      unwritableCount,\n      unwritableSourceNames: unwritableNames,\n      allUnwritable: totalCount > 0 && unwritableCount === totalCount,\n      partiallyUnwritable: unwritableCount > 0 && unwritableCount < totalCount\n    };\n  }\n  function resolveWritability(node) {\n    if (node === null) return { isUnwritable: true };\n    if (\"remote\" in node && typeof node.remote === \"boolean\") {\n      return { isUnwritable: node.remote === true };\n    }\n    const containing = findContainingComponent(node);\n    if (!containing) {\n      return { isUnwritable: false };\n    }\n    const isUnwritable = \"remote\" in containing && containing.remote === true;\n    return {\n      isUnwritable,\n      ...isUnwritable && typeof containing.name === \"string\" ? { componentName: containing.name } : {}\n    };\n  }\n  function findContainingComponent(node) {\n    let cur = node;\n    for (let i = 0; i < 100 && cur; i++) {\n      if (cur.type === \"COMPONENT\" || cur.type === \"COMPONENT_SET\") return cur;\n      cur = cur.parent ?? null;\n    }\n    return null;\n  }\n\n  // src/core/roundtrip/read-acknowledgments.ts\n  var FOOTER_RE = /—\\s+\\*([A-Za-z0-9-]+)\\*\\s*$/;\n  var LEGACY_PREFIX_RE = /^\\*\\*\\[canicode\\]\\s+([A-Za-z0-9-]+)\\*\\*/;\n  function extractAcknowledgmentsFromNode(node, canicodeCategoryIds) {\n    if (!node || !(\"annotations\" in node)) return [];\n    const annotations = node.annotations ?? [];\n    if (annotations.length === 0) return [];\n    const out = [];\n    for (const a of annotations) {\n      const text = (typeof a.labelMarkdown === \"string\" && a.labelMarkdown.length > 0 ? a.labelMarkdown : \"\") || (typeof a.label === \"string\" && a.label.length > 0 ? a.label : \"\");\n      if (!text) continue;\n      if (canicodeCategoryIds) {\n        if (!a.categoryId || !canicodeCategoryIds.has(a.categoryId)) continue;\n      }\n      const ruleId = extractRuleId(text);\n      if (!ruleId) continue;\n      const payload = parseCanicodeJsonPayloadFromMarkdown(text);\n      const payloadAligned = payload && payload.ruleId === ruleId;\n      out.push({\n        nodeId: node.id,\n        ruleId,\n        ...payloadAligned && payload.intent ? { intent: payload.intent } : {},\n        ...payloadAligned && payload.sceneWriteOutcome ? { sceneWriteOutcome: payload.sceneWriteOutcome } : {},\n        ...payloadAligned && payload.codegenDirective ? { codegenDirective: payload.codegenDirective } : {}\n      });\n    }\n    return out;\n  }\n  function extractRuleId(text) {\n    const footer = FOOTER_RE.exec(text);\n    if (footer) return footer[1] ?? null;\n    const legacy = LEGACY_PREFIX_RE.exec(text);\n    if (legacy) return legacy[1] ?? null;\n    return null;\n  }\n  async function readCanicodeAcknowledgments(rootNodeId, categories) {\n    const root = await figma.getNodeByIdAsync(rootNodeId);\n    if (!root) return [];\n    const canicodeCategoryIds = categories ? new Set(\n      [\n        categories.gotcha,\n        categories.flag,\n        categories.fallback,\n        categories.legacyAutoFix\n      ].filter((id) => typeof id === \"string\" && id.length > 0)\n    ) : void 0;\n    const out = [];\n    walk(root, canicodeCategoryIds, out);\n    return out;\n  }\n  function safeChildren(node) {\n    try {\n      const c = node.children;\n      return Array.isArray(c) ? c : [];\n    } catch {\n      return [];\n    }\n  }\n  function walk(node, canicodeCategoryIds, out) {\n    try {\n      const local = extractAcknowledgmentsFromNode(node, canicodeCategoryIds);\n      for (const a of local) out.push(a);\n    } catch {\n    }\n    for (const child of safeChildren(node)) {\n      if (child && typeof child === \"object\") walk(child, canicodeCategoryIds, out);\n    }\n  }\n\n  // src/core/roundtrip/compute-roundtrip-tally.ts\n  function computeRoundtripTally(args) {\n    const { stepFourReport, reanalyzeResponse } = args;\n    const { resolved, annotated, definitionWritten, skipped } = stepFourReport;\n    const { issueCount, acknowledgedCount } = reanalyzeResponse;\n    if (acknowledgedCount > issueCount) {\n      throw new Error(\n        `computeRoundtripTally: reanalyzeResponse.acknowledgedCount (${acknowledgedCount}) cannot exceed issueCount (${issueCount}). Acknowledged issues are a subset of remaining issues.`\n      );\n    }\n    return {\n      X: resolved,\n      Y: annotated,\n      Z: definitionWritten,\n      W: skipped,\n      N: resolved + annotated + definitionWritten + skipped,\n      V: issueCount,\n      V_ack: acknowledgedCount,\n      V_open: issueCount - acknowledgedCount\n    };\n  }\n\n  // src/core/roundtrip/apply-auto-fix.ts\n  function pickNodeName(issue, resolved) {\n    if (resolved && typeof resolved.name === \"string\" && resolved.name.length > 0) {\n      return resolved.name;\n    }\n    if (typeof issue.nodePath === \"string\" && issue.nodePath.length > 0) {\n      const segments = issue.nodePath.split(/\\s*[›>/]\\s*/);\n      const tail = segments[segments.length - 1];\n      if (tail && tail.length > 0) return tail;\n    }\n    return issue.nodeId;\n  }\n  function mapInstanceFallbackIcon(result) {\n    if (result.icon === \"\\u2705\") return \"\\u{1F527}\";\n    return result.icon;\n  }\n  async function applyAutoFix(issue, context) {\n    const { categories } = context;\n    const ruleId = issue.ruleId;\n    if (issue.targetProperty === \"name\" && typeof issue.suggestedName === \"string\") {\n      const suggestedName = issue.suggestedName;\n      const question = {\n        nodeId: issue.nodeId,\n        ruleId,\n        ...issue.sourceChildId ? { sourceChildId: issue.sourceChildId } : {}\n      };\n      const result = await applyWithInstanceFallback(\n        question,\n        (target) => {\n          if (target) {\n            target.name = suggestedName;\n          }\n        },\n        {\n          categories,\n          ...context.allowDefinitionWrite !== void 0 ? { allowDefinitionWrite: context.allowDefinitionWrite } : {},\n          ...context.telemetry !== void 0 ? { telemetry: context.telemetry } : {}\n        }\n      );\n      const sceneAfter = await figma.getNodeByIdAsync(issue.nodeId);\n      return {\n        outcome: mapInstanceFallbackIcon(result),\n        nodeId: issue.nodeId,\n        nodeName: pickNodeName(issue, sceneAfter),\n        ruleId,\n        label: result.label\n      };\n    }\n    const scene = await figma.getNodeByIdAsync(issue.nodeId);\n    const markdown = issue.message ?? `Auto-flagged: ${ruleId}`;\n    if (scene) {\n      upsertCanicodeAnnotation(scene, {\n        ruleId,\n        markdown,\n        categoryId: categories.flag,\n        ...issue.annotationProperties && issue.annotationProperties.length > 0 ? { properties: issue.annotationProperties } : {}\n      });\n    }\n    return {\n      outcome: \"\\u{1F4DD}\",\n      nodeId: issue.nodeId,\n      nodeName: pickNodeName(issue, scene),\n      ruleId,\n      label: scene ? `annotation added to canicode:flag \\u2014 ${ruleId}` : `missing node (annotation skipped) \\u2014 ${ruleId}`\n    };\n  }\n  async function applyAutoFixes(issues, context) {\n    const out = [];\n    for (const issue of issues) {\n      if (issue.applyStrategy !== \"auto-fix\") {\n        out.push({\n          outcome: \"\\u23ED\\uFE0F\",\n          nodeId: issue.nodeId,\n          nodeName: pickNodeName(issue, null),\n          ruleId: issue.ruleId,\n          label: `skipped \\u2014 applyStrategy is ${issue.applyStrategy ?? \"absent\"}`\n        });\n        continue;\n      }\n      out.push(await applyAutoFix(issue, context));\n    }\n    return out;\n  }\n\n  // src/core/roundtrip/remove-canicode-annotations.ts\n  var LEGACY_CANICODE_PREFIX = \"**[canicode]\";\n  function isCanicodeAnnotation(annotation, categories) {\n    const canicodeIds = new Set(\n      [\n        categories.gotcha,\n        categories.flag,\n        categories.fallback,\n        categories.legacyAutoFix\n      ].filter((id) => Boolean(id))\n    );\n    if (annotation.categoryId && canicodeIds.has(annotation.categoryId)) {\n      return true;\n    }\n    if (annotation.labelMarkdown?.startsWith(LEGACY_CANICODE_PREFIX)) {\n      return true;\n    }\n    return false;\n  }\n  function removeCanicodeAnnotations(annotations, categories) {\n    return annotations.filter((a) => !isCanicodeAnnotation(a, categories));\n  }\n\n  exports.applyAutoFix = applyAutoFix;\n  exports.applyAutoFixes = applyAutoFixes;\n  exports.applyPropertyMod = applyPropertyMod;\n  exports.applyWithInstanceFallback = applyWithInstanceFallback;\n  exports.computeRoundtripTally = computeRoundtripTally;\n  exports.ensureCanicodeCategories = ensureCanicodeCategories;\n  exports.extractAcknowledgmentsFromNode = extractAcknowledgmentsFromNode;\n  exports.isCanicodeAnnotation = isCanicodeAnnotation;\n  exports.probeDefinitionWritability = probeDefinitionWritability;\n  exports.readCanicodeAcknowledgments = readCanicodeAcknowledgments;\n  exports.removeCanicodeAnnotations = removeCanicodeAnnotations;\n  exports.resolveVariableByName = resolveVariableByName;\n  exports.stripAnnotations = stripAnnotations;\n  exports.upsertCanicodeAnnotation = upsertCanicodeAnnotation;\n\n  return exports;\n\n})({});\n";
var __CANICODE_HELPERS_VERSION__ = "0.11.1";
var CanICodeRoundtrip = (function (exports) {
  'use strict';

  // src/core/roundtrip/annotations.ts
  function stripAnnotations(annotations) {
    const input = annotations ?? [];
    const out = [];
    for (const a of input) {
      const hasLM = typeof a.labelMarkdown === "string" && a.labelMarkdown.length > 0;
      const hasLabel = typeof a.label === "string" && a.label.length > 0;
      if (!hasLM && !hasLabel) continue;
      const base = hasLM ? { labelMarkdown: a.labelMarkdown } : { label: a.label };
      if (a.categoryId) base.categoryId = a.categoryId;
      if (Array.isArray(a.properties) && a.properties.length > 0) {
        base.properties = a.properties;
      }
      out.push(base);
    }
    return out;
  }
  async function ensureCanicodeCategories() {
    const api = figma.annotations;
    const existing = await api.getAnnotationCategoriesAsync();
    const byLabel = new Map(existing.map((c) => [c.label, c.id]));
    async function ensure(label, color) {
      const cached = byLabel.get(label);
      if (cached) return cached;
      const created = await api.addAnnotationCategoryAsync({ label, color });
      byLabel.set(label, created.id);
      return created.id;
    }
    const result = {
      gotcha: await ensure("canicode:gotcha", "blue"),
      flag: await ensure("canicode:flag", "green"),
      fallback: await ensure("canicode:fallback", "yellow")
    };
    const legacyAutoFix = byLabel.get("canicode:auto-fix");
    if (legacyAutoFix) result.legacyAutoFix = legacyAutoFix;
    return result;
  }
  function upsertCanicodeAnnotation(node, input) {
    if (!node || !("annotations" in node)) return false;
    const { ruleId, markdown, categoryId, properties } = input;
    const legacyPrefix = `**[canicode] ${ruleId}**`;
    const footer = `\u2014 *${ruleId}*`;
    let bodyText = markdown;
    if (bodyText.startsWith(legacyPrefix)) {
      bodyText = bodyText.slice(legacyPrefix.length).replace(/^\s*\n+/, "");
    }
    const trimmed = bodyText.replace(/\s+$/, "");
    const body = trimmed.endsWith(footer) ? trimmed : `${trimmed}

${footer}`;
    const existing = stripAnnotations(node.annotations);
    const entry = { labelMarkdown: body };
    if (categoryId) entry.categoryId = categoryId;
    if (properties && properties.length > 0) entry.properties = properties;
    const matchesRuleId = (text) => {
      if (typeof text !== "string") return false;
      return text.startsWith(legacyPrefix) || text.includes(footer);
    };
    const idx = existing.findIndex(
      (a) => matchesRuleId(a.labelMarkdown) || matchesRuleId(a.label)
    );
    if (idx >= 0) existing[idx] = entry;
    else existing.push(entry);
    try {
      node.annotations = existing;
      return true;
    } catch (e) {
      const msg = String(e?.message ?? e);
      const isNodeTypeReject = /invalid property .+ for a .+ node/i.test(msg);
      if (!entry.properties || !isNodeTypeReject) throw e;
      delete entry.properties;
      if (idx >= 0) existing[idx] = entry;
      node.annotations = existing;
      return true;
    }
  }

  // src/core/roundtrip/annotation-payload.ts
  var CANICODE_JSON_FENCE = "```canicode-json";
  function formatIntentValueForDisplay(value) {
    if (value === void 0) return "undefined";
    if (value === null) return "null";
    if (typeof value === "object") {
      try {
        return `\`${JSON.stringify(value)}\``;
      } catch {
        return String(value);
      }
    }
    return `\`${String(value)}\``;
  }
  function buildCodegenDirective(args) {
    const { sceneNodeId, intent } = args;
    const val = intent.value === void 0 ? "undefined" : JSON.stringify(intent.value);
    return `When generating code for node ${sceneNodeId}, set ${intent.field} to ${val} (user intent, scope: ${intent.scope}). Prefer this over the current Figma scene value when they disagree.`;
  }
  function sceneOutcomeToAck(result, reason) {
    return reason !== void 0 ? { result, reason } : { result };
  }
  function buildOutcomeHumanLine(args) {
    if (args.skippedDefinitionDueToAdr012) {
      const adrHint = " Canicode skipped writing the source component without `allowDefinitionWrite: true` (ADR-012 safer default). The instance-level change did not apply as intended in the scene.";
      if (args.reason === "silent-ignore") {
        return "**Scene write outcome:** The write ran, but the property value did not change on this instance (silent-ignore)." + adrHint;
      }
      return "**Scene write outcome:** Figma rejected an instance-level change" + (args.errorMessage ? `: ${args.errorMessage}` : "") + "." + adrHint;
    }
    if (args.reason === "silent-ignore") {
      return "**Scene write outcome:** The write ran, but the property value did not change on this instance (silent-ignore). No source definition was available to escalate.";
    }
    if (args.reason === "override-error") {
      return "**Scene write outcome:** Figma rejected an instance-level change" + (args.errorMessage ? `: ${args.errorMessage}` : "") + ". No source definition was available to escalate.";
    }
    return "**Scene write outcome:** Could not apply automatically" + (args.errorMessage ? `: ${args.errorMessage}` : "") + ".";
  }
  function buildAdr012PropagationParagraph(args) {
    const { componentName, replicaCount } = args;
    const fanOutHint = typeof replicaCount === "number" && replicaCount >= 2 ? ` This batched question covers ${replicaCount} instance scenes \u2014 changing **${componentName}** at the definition still affects every inheriting instance, not just one row in the batch.` : "";
    return `Canicode's safer default (ADR-012) is to skip writing the source component **${componentName}** without explicit opt-in, because that write propagates to every non-overridden instance of **${componentName}** in the file.${fanOutHint} Prefer a manual override on **this** instance when you only need a local fix. Use \`allowDefinitionWrite: true\` only when you intend to change **${componentName}** for all inheriting instances \u2014 it is not a neutral shortcut for a single-instance tweak.`;
  }
  function buildDefinitionWriteSkippedBody(args) {
    const {
      ruleId,
      sceneNodeId,
      componentName,
      reason,
      errorMessage,
      replicaCount,
      intent
    } = args;
    const ackIntent = intent ? {
      field: intent.field,
      value: intent.value,
      scope: intent.scope
    } : void 0;
    const sceneWriteOutcome = sceneOutcomeToAck("user-declined-propagation", "adr-012-opt-in-disabled");
    const codegenDirective = intent !== void 0 ? buildCodegenDirective({ sceneNodeId, intent }) : void 0;
    const jsonBlock = {
      v: 1,
      ruleId,
      nodeId: sceneNodeId,
      ...ackIntent ? { intent: ackIntent } : {},
      sceneWriteOutcome,
      ...codegenDirective ? { codegenDirective } : {}
    };
    const userAnswerLine = intent !== void 0 ? `**User answered:** ${formatIntentValueForDisplay(intent.value)} for **${intent.field}** (scope: ${intent.scope}).` : null;
    const outcomeLine = buildOutcomeHumanLine({
      reason,
      ...errorMessage !== void 0 ? { errorMessage } : {},
      skippedDefinitionDueToAdr012: true
    });
    const adrBlock = buildAdr012PropagationParagraph({
      componentName,
      ...replicaCount !== void 0 ? { replicaCount } : {}
    });
    const proseParts = [userAnswerLine, outcomeLine, adrBlock].filter(
      (p) => p !== null
    );
    const prose = proseParts.join("\n\n");
    return appendJsonFenceAndFooter(prose, jsonBlock, ruleId);
  }
  function buildNoDefinitionFallbackBody(args) {
    const { ruleId, sceneNodeId, reason, errorMessage, intent } = args;
    const ackIntent = intent ? { field: intent.field, value: intent.value, scope: intent.scope } : void 0;
    const outcomeResult = reason === "silent-ignore" ? "silent-ignored" : reason === "override-error" ? "api-rejected" : "api-rejected";
    const sceneWriteOutcome = sceneOutcomeToAck(
      outcomeResult,
      reason === "silent-ignore" ? "silent-ignore-no-definition" : "no-definition-escalation"
    );
    const codegenDirective = intent !== void 0 ? buildCodegenDirective({ sceneNodeId, intent }) : void 0;
    const jsonBlock = {
      v: 1,
      ruleId,
      nodeId: sceneNodeId,
      ...ackIntent ? { intent: ackIntent } : {},
      sceneWriteOutcome,
      ...codegenDirective ? { codegenDirective } : {}
    };
    const userAnswerLine = intent !== void 0 ? `**User answered:** ${formatIntentValueForDisplay(intent.value)} for **${intent.field}** (scope: ${intent.scope}).` : null;
    const outcomeLine = buildOutcomeHumanLine({
      reason,
      ...errorMessage !== void 0 ? { errorMessage } : {},
      skippedDefinitionDueToAdr012: false
    });
    const prose = [userAnswerLine, outcomeLine].filter((p) => p !== null).join("\n\n");
    return appendJsonFenceAndFooter(prose, jsonBlock, ruleId);
  }
  function buildDefinitionTierFailureBody(args) {
    const { ruleId, sceneNodeId, intent, kind, errorMessage } = args;
    const sceneWriteOutcome = sceneOutcomeToAck(
      kind === "read-only-library" ? "api-rejected" : "api-rejected",
      kind === "read-only-library" ? "definition-read-only" : "definition-write-failed"
    );
    const codegenDirective = intent !== void 0 ? buildCodegenDirective({ sceneNodeId, intent }) : void 0;
    const jsonBlock = {
      v: 1,
      ruleId,
      nodeId: sceneNodeId,
      ...intent ? {
        intent: {
          field: intent.field,
          value: intent.value,
          scope: intent.scope
        }
      } : {},
      sceneWriteOutcome,
      ...codegenDirective ? { codegenDirective } : {}
    };
    const human = kind === "read-only-library" ? "source component lives in an external library and is read-only from this file \u2014 apply the fix in the library file itself." : `could not apply at source definition: ${errorMessage}`;
    const userAnswerLine = intent !== void 0 ? `**User answered:** ${formatIntentValueForDisplay(intent.value)} for **${intent.field}** (scope: ${intent.scope}).` : null;
    const outcomeLine = `**Scene write outcome:** ${human}`;
    const prose = [userAnswerLine, outcomeLine].filter((p) => p !== null).join("\n\n");
    return appendJsonFenceAndFooter(prose, jsonBlock, ruleId);
  }
  function appendJsonFenceAndFooter(prose, jsonBlock, ruleId) {
    const footer = `\u2014 *${ruleId}*`;
    const hasIntent = jsonBlock.intent !== void 0;
    if (!hasIntent) {
      return `${prose}

${footer}`;
    }
    const jsonText = JSON.stringify(jsonBlock, null, 0);
    return `${prose}

${CANICODE_JSON_FENCE}
${jsonText}
\`\`\`

${footer}`;
  }
  var FENCED_JSON_RE = new RegExp(
    `${CANICODE_JSON_FENCE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*([\\s\\S]*?)\\s*\`\`\``,
    "m"
  );
  function parseCanicodeJsonPayloadFromMarkdown(text) {
    const m = FENCED_JSON_RE.exec(text);
    if (!m?.[1]) return void 0;
    try {
      const raw = JSON.parse(m[1].trim());
      if (!raw || typeof raw !== "object") return void 0;
      const o = raw;
      if (o.v !== 1 || typeof o.ruleId !== "string") return void 0;
      return raw;
    } catch {
      return void 0;
    }
  }

  // src/core/roundtrip/apply-with-instance-fallback.ts
  var DEFINITION_WRITE_SKIPPED_EVENT = "cic_roundtrip_definition_write_skipped";
  function categoryIdForAnnotate(categories, kind, roundtripIntent) {
    if (kind === "adr012-definition-skipped") {
      return categories.fallback;
    }
    if (roundtripIntent !== void 0) {
      return categories.gotcha;
    }
    return categories.flag;
  }
  function resolveSourceComponentName(definition, question) {
    if (definition && typeof definition.name === "string" && definition.name) {
      return definition.name;
    }
    const ic = question.instanceContext;
    if (ic && typeof ic.sourceComponentName === "string" && ic.sourceComponentName) {
      return ic.sourceComponentName;
    }
    return "the source component";
  }
  async function routeToDefinitionOrAnnotate(definition, writeFn, ctx) {
    if (definition && !ctx.allowDefinitionWrite && ctx.reason !== "non-override-error") {
      const componentName = resolveSourceComponentName(definition, ctx.question);
      const replicaCount = typeof ctx.question.replicas === "number" && Number.isInteger(ctx.question.replicas) ? ctx.question.replicas : void 0;
      if (ctx.categories) {
        upsertCanicodeAnnotation(ctx.scene, {
          ruleId: ctx.question.ruleId,
          markdown: buildDefinitionWriteSkippedBody({
            ruleId: ctx.question.ruleId,
            sceneNodeId: ctx.scene.id,
            componentName,
            reason: ctx.reason,
            ...ctx.errorMessage !== void 0 ? { errorMessage: ctx.errorMessage } : {},
            ...replicaCount !== void 0 ? { replicaCount } : {},
            ...ctx.roundtripIntent !== void 0 ? { intent: ctx.roundtripIntent } : {}
          }),
          categoryId: categoryIdForAnnotate(
            ctx.categories,
            "adr012-definition-skipped",
            ctx.roundtripIntent
          )
        });
      }
      ctx.telemetry?.(DEFINITION_WRITE_SKIPPED_EVENT, {
        ruleId: ctx.question.ruleId,
        reason: ctx.reason
      });
      return {
        icon: "\u{1F4DD}",
        label: "definition write skipped (opt-in disabled)"
      };
    }
    if (!definition) {
      if (ctx.categories) {
        const markdown = buildNoDefinitionFallbackBody({
          ruleId: ctx.question.ruleId,
          sceneNodeId: ctx.scene.id,
          reason: ctx.reason,
          ...ctx.errorMessage !== void 0 ? { errorMessage: ctx.errorMessage } : {},
          ...ctx.roundtripIntent !== void 0 ? { intent: ctx.roundtripIntent } : {}
        });
        upsertCanicodeAnnotation(ctx.scene, {
          ruleId: ctx.question.ruleId,
          markdown,
          categoryId: categoryIdForAnnotate(
            ctx.categories,
            "other-failure",
            ctx.roundtripIntent
          )
        });
      }
      return ctx.reason === "silent-ignore" ? { icon: "\u{1F4DD}", label: "silent-ignore, annotated" } : { icon: "\u{1F4DD}", label: `error: ${ctx.errorMessage ?? ""}` };
    }
    try {
      await writeFn(definition);
      return {
        icon: "\u{1F310}",
        label: ctx.reason === "silent-ignore" ? "source definition (silent-ignore fallback)" : "source definition"
      };
    } catch (defErr) {
      const defMsg = String(defErr?.message ?? defErr);
      const isRemoteReadOnly = definition.remote === true || /read-only/i.test(defMsg);
      if (ctx.categories) {
        upsertCanicodeAnnotation(ctx.scene, {
          ruleId: ctx.question.ruleId,
          markdown: buildDefinitionTierFailureBody({
            ruleId: ctx.question.ruleId,
            sceneNodeId: ctx.scene.id,
            ...ctx.roundtripIntent !== void 0 ? { intent: ctx.roundtripIntent } : {},
            kind: isRemoteReadOnly ? "read-only-library" : "definition-error",
            errorMessage: defMsg
          }),
          categoryId: categoryIdForAnnotate(
            ctx.categories,
            "other-failure",
            ctx.roundtripIntent
          )
        });
      }
      return {
        icon: "\u{1F4DD}",
        label: isRemoteReadOnly ? "external library (read-only)" : `definition error: ${defMsg}`
      };
    }
  }
  async function applyWithInstanceFallback(question, writeFn, context = {}) {
    const { categories, allowDefinitionWrite = false, telemetry, roundtripIntent } = context;
    const scene = await figma.getNodeByIdAsync(question.nodeId);
    if (!scene) return { icon: "\u{1F4DD}", label: "missing node" };
    const definition = question.sourceChildId ? await figma.getNodeByIdAsync(question.sourceChildId) : null;
    try {
      const changed = await writeFn(scene);
      if (changed === false) {
        return routeToDefinitionOrAnnotate(definition, writeFn, {
          question,
          scene,
          categories,
          reason: "silent-ignore",
          allowDefinitionWrite,
          telemetry,
          ...roundtripIntent !== void 0 ? { roundtripIntent } : {}
        });
      }
      return { icon: "\u2705", label: "instance/scene" };
    } catch (e) {
      const msg = String(e?.message ?? e);
      const looksLikeInstanceOverride = /cannot be overridden/i.test(msg) || /override/i.test(msg);
      if (!looksLikeInstanceOverride) {
        return routeToDefinitionOrAnnotate(null, writeFn, {
          question,
          scene,
          categories,
          reason: "non-override-error",
          errorMessage: msg,
          allowDefinitionWrite,
          telemetry,
          ...roundtripIntent !== void 0 ? { roundtripIntent } : {}
        });
      }
      return routeToDefinitionOrAnnotate(definition, writeFn, {
        question,
        scene,
        categories,
        reason: "override-error",
        errorMessage: msg,
        allowDefinitionWrite,
        telemetry,
        ...roundtripIntent !== void 0 ? { roundtripIntent } : {}
      });
    }
  }

  // src/core/roundtrip/apply-property-mod.ts
  async function resolveVariableByName(name) {
    const locals = await figma.variables.getLocalVariablesAsync();
    return locals.find((v) => v.name === name) ?? null;
  }
  function parseValue(raw) {
    if (raw && typeof raw === "object" && "variable" in raw) {
      const v = raw;
      const parsed = { kind: "binding", name: v.variable };
      if ("fallback" in v) parsed.fallback = v.fallback;
      return parsed;
    }
    if (raw && typeof raw === "object" && "fallback" in raw) {
      return { kind: "scalar", scalar: raw.fallback };
    }
    return { kind: "scalar", scalar: raw };
  }
  function isPaintProp(prop) {
    return prop === "fills" || prop === "strokes";
  }
  function applyPropertyBinding(target, prop, variable) {
    if (isPaintProp(prop)) {
      const current = target[prop];
      if (current === figma.mixed || !Array.isArray(current)) return false;
      const paints = current;
      const bound = paints.map(
        (paint) => figma.variables.setBoundVariableForPaint(paint, "color", variable)
      );
      target[prop] = bound;
      return true;
    }
    target.setBoundVariable(prop, variable);
    return true;
  }
  function buildRoundtripIntentFromPropertyAnswer(question, answerValue) {
    const raw = question.targetProperty;
    if (raw === void 0) return void 0;
    const props = Array.isArray(raw) ? raw : [raw];
    if (props.length === 0) return void 0;
    if (props.length === 1) {
      const prop = props[0];
      const perProp = answerValue && typeof answerValue === "object" && !("variable" in answerValue) && !Array.isArray(answerValue) ? answerValue[prop] : answerValue;
      const parsed = parseValueForIntent(perProp);
      if (parsed === void 0) return void 0;
      return { field: prop, value: parsed, scope: "instance" };
    }
    const obj = answerValue && typeof answerValue === "object" && !("variable" in answerValue) && !Array.isArray(answerValue) ? answerValue : void 0;
    const picked = {};
    for (const p of props) {
      if (obj && p in obj && obj[p] !== void 0) picked[p] = obj[p];
    }
    if (Object.keys(picked).length === 0) return void 0;
    return {
      field: props.join(", "),
      value: picked,
      scope: "instance"
    };
  }
  function parseValueForIntent(raw) {
    if (raw && typeof raw === "object" && "variable" in raw) {
      return { variable: raw.variable };
    }
    if (raw && typeof raw === "object" && "fallback" in raw) {
      return raw.fallback;
    }
    return raw;
  }
  function applyPropertyScalar(target, prop, scalar) {
    const rec = target;
    const before = rec[prop];
    rec[prop] = scalar;
    if (rec[prop] === before && before !== scalar) return false;
    return true;
  }
  async function applyPropertyMod(question, answerValue, context = {}) {
    const roundtripIntent = buildRoundtripIntentFromPropertyAnswer(
      question,
      answerValue
    );
    const props = Array.isArray(question.targetProperty) ? question.targetProperty : question.targetProperty !== void 0 ? [question.targetProperty] : [];
    return applyWithInstanceFallback(
      question,
      async (target) => {
        if (!target) return void 0;
        let changed = void 0;
        for (const prop of props) {
          if (!(prop in target)) continue;
          const perProp = answerValue && typeof answerValue === "object" && !("variable" in answerValue) && !Array.isArray(answerValue) ? answerValue[prop] : answerValue;
          const parsed = parseValue(perProp);
          if (parsed.kind === "binding") {
            const variable = await resolveVariableByName(parsed.name);
            if (variable) {
              applyPropertyBinding(target, prop, variable);
              continue;
            }
            if (parsed.fallback !== void 0) {
              if (!applyPropertyScalar(target, prop, parsed.fallback)) {
                changed = false;
              }
            }
            continue;
          }
          if (parsed.scalar === void 0) continue;
          if (!applyPropertyScalar(target, prop, parsed.scalar)) {
            changed = false;
          }
        }
        return changed;
      },
      {
        ...context,
        ...roundtripIntent !== void 0 ? { roundtripIntent } : {}
      }
    );
  }

  // src/core/roundtrip/probe-definition-writability.ts
  async function probeDefinitionWritability(questions) {
    const verdict = /* @__PURE__ */ new Map();
    const unwritableNames = [];
    const seenName = /* @__PURE__ */ new Set();
    for (const q of questions) {
      const id = q.sourceChildId;
      if (!id) continue;
      if (verdict.has(id)) continue;
      const node = await figma.getNodeByIdAsync(id);
      const writability = resolveWritability(node);
      const isUnwritable = writability.isUnwritable;
      verdict.set(id, isUnwritable ? "unwritable" : "writable");
      if (isUnwritable) {
        const name = typeof writability.componentName === "string" && writability.componentName || typeof node?.name === "string" && node.name || q.instanceContext?.sourceComponentName || id;
        if (!seenName.has(name)) {
          seenName.add(name);
          unwritableNames.push(name);
        }
      }
    }
    const totalCount = verdict.size;
    let unwritableCount = 0;
    for (const v of verdict.values()) if (v === "unwritable") unwritableCount++;
    return {
      totalCount,
      unwritableCount,
      unwritableSourceNames: unwritableNames,
      allUnwritable: totalCount > 0 && unwritableCount === totalCount,
      partiallyUnwritable: unwritableCount > 0 && unwritableCount < totalCount
    };
  }
  function resolveWritability(node) {
    if (node === null) return { isUnwritable: true };
    if ("remote" in node && typeof node.remote === "boolean") {
      return { isUnwritable: node.remote === true };
    }
    const containing = findContainingComponent(node);
    if (!containing) {
      return { isUnwritable: false };
    }
    const isUnwritable = "remote" in containing && containing.remote === true;
    return {
      isUnwritable,
      ...isUnwritable && typeof containing.name === "string" ? { componentName: containing.name } : {}
    };
  }
  function findContainingComponent(node) {
    let cur = node;
    for (let i = 0; i < 100 && cur; i++) {
      if (cur.type === "COMPONENT" || cur.type === "COMPONENT_SET") return cur;
      cur = cur.parent ?? null;
    }
    return null;
  }

  // src/core/roundtrip/read-acknowledgments.ts
  var FOOTER_RE = /—\s+\*([A-Za-z0-9-]+)\*\s*$/;
  var LEGACY_PREFIX_RE = /^\*\*\[canicode\]\s+([A-Za-z0-9-]+)\*\*/;
  function extractAcknowledgmentsFromNode(node, canicodeCategoryIds) {
    if (!node || !("annotations" in node)) return [];
    const annotations = node.annotations ?? [];
    if (annotations.length === 0) return [];
    const out = [];
    for (const a of annotations) {
      const text = (typeof a.labelMarkdown === "string" && a.labelMarkdown.length > 0 ? a.labelMarkdown : "") || (typeof a.label === "string" && a.label.length > 0 ? a.label : "");
      if (!text) continue;
      if (canicodeCategoryIds) {
        if (!a.categoryId || !canicodeCategoryIds.has(a.categoryId)) continue;
      }
      const ruleId = extractRuleId(text);
      if (!ruleId) continue;
      const payload = parseCanicodeJsonPayloadFromMarkdown(text);
      const payloadAligned = payload && payload.ruleId === ruleId;
      out.push({
        nodeId: node.id,
        ruleId,
        ...payloadAligned && payload.intent ? { intent: payload.intent } : {},
        ...payloadAligned && payload.sceneWriteOutcome ? { sceneWriteOutcome: payload.sceneWriteOutcome } : {},
        ...payloadAligned && payload.codegenDirective ? { codegenDirective: payload.codegenDirective } : {}
      });
    }
    return out;
  }
  function extractRuleId(text) {
    const footer = FOOTER_RE.exec(text);
    if (footer) return footer[1] ?? null;
    const legacy = LEGACY_PREFIX_RE.exec(text);
    if (legacy) return legacy[1] ?? null;
    return null;
  }
  async function readCanicodeAcknowledgments(rootNodeId, categories) {
    const root = await figma.getNodeByIdAsync(rootNodeId);
    if (!root) return [];
    const canicodeCategoryIds = categories ? new Set(
      [
        categories.gotcha,
        categories.flag,
        categories.fallback,
        categories.legacyAutoFix
      ].filter((id) => typeof id === "string" && id.length > 0)
    ) : void 0;
    const out = [];
    walk(root, canicodeCategoryIds, out);
    return out;
  }
  function safeChildren(node) {
    try {
      const c = node.children;
      return Array.isArray(c) ? c : [];
    } catch {
      return [];
    }
  }
  function walk(node, canicodeCategoryIds, out) {
    try {
      const local = extractAcknowledgmentsFromNode(node, canicodeCategoryIds);
      for (const a of local) out.push(a);
    } catch {
    }
    for (const child of safeChildren(node)) {
      if (child && typeof child === "object") walk(child, canicodeCategoryIds, out);
    }
  }

  // src/core/roundtrip/compute-roundtrip-tally.ts
  function computeRoundtripTally(args) {
    const { stepFourReport, reanalyzeResponse } = args;
    const { resolved, annotated, definitionWritten, skipped } = stepFourReport;
    const { issueCount, acknowledgedCount } = reanalyzeResponse;
    if (acknowledgedCount > issueCount) {
      throw new Error(
        `computeRoundtripTally: reanalyzeResponse.acknowledgedCount (${acknowledgedCount}) cannot exceed issueCount (${issueCount}). Acknowledged issues are a subset of remaining issues.`
      );
    }
    return {
      X: resolved,
      Y: annotated,
      Z: definitionWritten,
      W: skipped,
      N: resolved + annotated + definitionWritten + skipped,
      V: issueCount,
      V_ack: acknowledgedCount,
      V_open: issueCount - acknowledgedCount
    };
  }

  // src/core/roundtrip/apply-auto-fix.ts
  function pickNodeName(issue, resolved) {
    if (resolved && typeof resolved.name === "string" && resolved.name.length > 0) {
      return resolved.name;
    }
    if (typeof issue.nodePath === "string" && issue.nodePath.length > 0) {
      const segments = issue.nodePath.split(/\s*[›>/]\s*/);
      const tail = segments[segments.length - 1];
      if (tail && tail.length > 0) return tail;
    }
    return issue.nodeId;
  }
  function mapInstanceFallbackIcon(result) {
    if (result.icon === "\u2705") return "\u{1F527}";
    return result.icon;
  }
  async function applyAutoFix(issue, context) {
    const { categories } = context;
    const ruleId = issue.ruleId;
    if (issue.targetProperty === "name" && typeof issue.suggestedName === "string") {
      const suggestedName = issue.suggestedName;
      const question = {
        nodeId: issue.nodeId,
        ruleId,
        ...issue.sourceChildId ? { sourceChildId: issue.sourceChildId } : {}
      };
      const result = await applyWithInstanceFallback(
        question,
        (target) => {
          if (target) {
            target.name = suggestedName;
          }
        },
        {
          categories,
          ...context.allowDefinitionWrite !== void 0 ? { allowDefinitionWrite: context.allowDefinitionWrite } : {},
          ...context.telemetry !== void 0 ? { telemetry: context.telemetry } : {}
        }
      );
      const sceneAfter = await figma.getNodeByIdAsync(issue.nodeId);
      return {
        outcome: mapInstanceFallbackIcon(result),
        nodeId: issue.nodeId,
        nodeName: pickNodeName(issue, sceneAfter),
        ruleId,
        label: result.label
      };
    }
    const scene = await figma.getNodeByIdAsync(issue.nodeId);
    const markdown = issue.message ?? `Auto-flagged: ${ruleId}`;
    if (scene) {
      upsertCanicodeAnnotation(scene, {
        ruleId,
        markdown,
        categoryId: categories.flag,
        ...issue.annotationProperties && issue.annotationProperties.length > 0 ? { properties: issue.annotationProperties } : {}
      });
    }
    return {
      outcome: "\u{1F4DD}",
      nodeId: issue.nodeId,
      nodeName: pickNodeName(issue, scene),
      ruleId,
      label: scene ? `annotation added to canicode:flag \u2014 ${ruleId}` : `missing node (annotation skipped) \u2014 ${ruleId}`
    };
  }
  async function applyAutoFixes(issues, context) {
    const out = [];
    for (const issue of issues) {
      if (issue.applyStrategy !== "auto-fix") {
        out.push({
          outcome: "\u23ED\uFE0F",
          nodeId: issue.nodeId,
          nodeName: pickNodeName(issue, null),
          ruleId: issue.ruleId,
          label: `skipped \u2014 applyStrategy is ${issue.applyStrategy ?? "absent"}`
        });
        continue;
      }
      out.push(await applyAutoFix(issue, context));
    }
    return out;
  }

  // src/core/roundtrip/remove-canicode-annotations.ts
  var LEGACY_CANICODE_PREFIX = "**[canicode]";
  function isCanicodeAnnotation(annotation, categories) {
    const canicodeIds = new Set(
      [
        categories.gotcha,
        categories.flag,
        categories.fallback,
        categories.legacyAutoFix
      ].filter((id) => Boolean(id))
    );
    if (annotation.categoryId && canicodeIds.has(annotation.categoryId)) {
      return true;
    }
    if (annotation.labelMarkdown?.startsWith(LEGACY_CANICODE_PREFIX)) {
      return true;
    }
    return false;
  }
  function removeCanicodeAnnotations(annotations, categories) {
    return annotations.filter((a) => !isCanicodeAnnotation(a, categories));
  }

  exports.applyAutoFix = applyAutoFix;
  exports.applyAutoFixes = applyAutoFixes;
  exports.applyPropertyMod = applyPropertyMod;
  exports.applyWithInstanceFallback = applyWithInstanceFallback;
  exports.computeRoundtripTally = computeRoundtripTally;
  exports.ensureCanicodeCategories = ensureCanicodeCategories;
  exports.extractAcknowledgmentsFromNode = extractAcknowledgmentsFromNode;
  exports.isCanicodeAnnotation = isCanicodeAnnotation;
  exports.probeDefinitionWritability = probeDefinitionWritability;
  exports.readCanicodeAcknowledgments = readCanicodeAcknowledgments;
  exports.removeCanicodeAnnotations = removeCanicodeAnnotations;
  exports.resolveVariableByName = resolveVariableByName;
  exports.stripAnnotations = stripAnnotations;
  exports.upsertCanicodeAnnotation = upsertCanicodeAnnotation;

  return exports;

})({});

figma.root.setSharedPluginData("canicode", "helpersSrc", __CANICODE_HELPERS_SRC__);
figma.root.setSharedPluginData("canicode", "helpersVersion", __CANICODE_HELPERS_VERSION__);
