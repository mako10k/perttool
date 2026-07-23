import type {
  RecommendationAnalysis,
  RecommendationComparison,
  RecommendationDecisionStep,
  RecommendationDescription,
  RecommendationEntityReference,
  RecommendationExplanationTaskDecision,
  RecommendationExpression,
  RecommendationExpressionTerm,
  RecommendationFact,
  RecommendationProvenance,
  RecommendationReasonOccurrence,
  RecommendationResultDecision,
  RecommendationScalarValue,
  RecommendationUnit,
  RecommendationValue,
} from "./explanation-types.js";

function entityJson(
  value: RecommendationEntityReference,
): Readonly<Record<string, unknown>> {
  return {
    kind: value.kind,
    id: value.id,
  };
}

function scalarValueJson(
  value: RecommendationScalarValue,
): Readonly<Record<string, unknown>> {
  switch (value.type) {
    case "boolean":
    case "integer":
      return {
        type: value.type,
        value: value.value,
      };
    case "rational":
      return {
        type: value.type,
        numerator: value.numerator,
        denominator: value.denominator,
      };
    case "enum":
      return {
        type: value.type,
        enum_type: value.enumType,
        value: value.value,
      };
    case "entity":
      return {
        type: value.type,
        value: entityJson(value.value),
      };
  }
}

function valueJson(
  value: RecommendationValue,
): Readonly<Record<string, unknown>> {
  switch (value.type) {
    case "boolean":
    case "integer":
    case "rational":
    case "enum":
    case "entity":
      return scalarValueJson(value);
    case "list":
    case "set":
      return {
        type: value.type,
        item_type: value.itemType,
        items: value.items.map(scalarValueJson),
      };
    case "map":
      return {
        type: value.type,
        key_type: value.keyType,
        value_type: value.valueType,
        entries: value.entries.map(({ key, value: entryValue }) => ({
          key: scalarValueJson(key),
          value: scalarValueJson(entryValue),
        })),
      };
  }
}

function unitJson(
  unit: RecommendationUnit | null,
): Readonly<Record<string, unknown>> | null {
  if (unit === null) return null;
  switch (unit.kind) {
    case "duration":
      return {
        kind: unit.kind,
        value: unit.value,
      };
    case "resource":
      return {
        kind: unit.kind,
        resource: entityJson(unit.resource),
      };
    case "ratio":
      return { kind: unit.kind };
  }
}

function provenanceJson(
  provenance: RecommendationProvenance,
): Readonly<Record<string, unknown>> {
  return {
    kind: provenance.kind,
    source_digest: provenance.sourceDigest,
    entity_references: provenance.entityReferences.map(entityJson),
    producer: {
      id: provenance.producer.id,
      version: provenance.producer.version,
    },
    source_span: provenance.sourceSpan,
  };
}

function factJson(fact: RecommendationFact): Readonly<Record<string, unknown>> {
  return {
    id: fact.id,
    kind: fact.kind,
    subject: entityJson(fact.subject),
    value: valueJson(fact.value),
    unit: unitJson(fact.unit),
    provenance: provenanceJson(fact.provenance),
  };
}

function expressionTermJson(
  term: RecommendationExpressionTerm,
): Readonly<Record<string, unknown>> {
  if (term.kind === "fact") {
    return {
      kind: term.kind,
      fact_id: term.factId,
    };
  }
  return {
    kind: term.kind,
    value: valueJson(term.value),
    unit: unitJson(term.unit),
  };
}

function expressionJson(
  expression: RecommendationExpression,
): Readonly<Record<string, unknown>> {
  if (expression.kind === "compare") {
    return {
      kind: expression.kind,
      left: expressionTermJson(expression.left),
      relation: expression.relation,
      right: expressionTermJson(expression.right),
    };
  }
  return {
    kind: expression.kind,
    children: expression.children.map(expressionJson),
  };
}

function resultDecisionJson(
  decision: RecommendationResultDecision,
): Readonly<Record<string, unknown>> {
  return {
    id: decision.id,
    action: decision.action,
    recommended_task_ids: decision.recommendedTaskIds,
    joint_feasibility_fact_id: decision.jointFeasibilityFactId,
    step_ids: decision.stepIds,
    reason_occurrence_ids: decision.reasonOccurrenceIds,
  };
}

function taskDecisionJson(
  decision: RecommendationExplanationTaskDecision,
): Readonly<Record<string, unknown>> {
  return {
    id: decision.id,
    subject_task_id: decision.subjectTaskId,
    action: decision.action,
    classification: decision.classification,
    tier: decision.tier,
    recommended_set_member: decision.recommendedSetMember,
    step_ids: decision.stepIds,
    decisive_step_id: decision.decisiveStepId,
    reason_occurrence_ids: decision.reasonOccurrenceIds,
    comparison_ids: decision.comparisonIds,
    primary_higher_priority_task_id: decision.primaryHigherPriorityTaskId,
    summary_description_id: decision.summaryDescriptionId,
    description_ids: decision.descriptionIds,
  };
}

function decisionStepJson(
  step: RecommendationDecisionStep,
): Readonly<Record<string, unknown>> {
  return {
    id: step.id,
    phase: step.phase,
    rule: entityJson(step.rule),
    input_fact_ids: step.inputFactIds,
    expression: expressionJson(step.expression),
    result: step.result,
    effect: step.effect,
    role: step.role,
    reason_occurrence_ids: step.reasonOccurrenceIds,
    comparison_ids: step.comparisonIds,
    depends_on_step_ids: step.dependsOnStepIds,
  };
}

function comparisonJson(
  comparison: RecommendationComparison,
): Readonly<Record<string, unknown>> {
  return {
    id: comparison.id,
    scope: comparison.scope,
    subject_task_id: comparison.subjectTaskId,
    alternative_task_id: comparison.alternativeTaskId,
    winner_task_id: comparison.winnerTaskId,
    loser_task_id: comparison.loserTaskId,
    decisive_rule: entityJson(comparison.decisiveRule),
    decisive_expression: expressionJson(comparison.decisiveExpression),
    prior_tied_rule_ids: comparison.priorTiedRuleIds,
    contributing_rule_ids: comparison.contributingRuleIds,
    fact_ids: comparison.factIds,
  };
}

function reasonJson(
  reason: RecommendationReasonOccurrence,
): Readonly<Record<string, unknown>> {
  return {
    id: reason.id,
    code: reason.code,
    subject: entityJson(reason.subject),
    effect: reason.effect,
    role: reason.role,
    fact_ids: reason.factIds,
    emission_expression: expressionJson(reason.emissionExpression),
    decision_step_id: reason.decisionStepId,
    comparison_ids: reason.comparisonIds,
    description_id: reason.descriptionId,
  };
}

function descriptionJson(
  description: RecommendationDescription,
): Readonly<Record<string, unknown>> {
  return {
    id: description.id,
    key: description.key,
    registry_version: description.registryVersion,
    parameters: description.parameters.map((parameter) => ({
      name: parameter.name,
      value: valueJson(parameter.value),
      unit: unitJson(parameter.unit),
    })),
    source_reason_ids: description.sourceReasonIds,
    source_comparison_ids: description.sourceComparisonIds,
    locale: description.locale,
    text: description.text,
    render_status: description.renderStatus,
  };
}

export function recommendationAnalysisToJson(
  analysis: RecommendationAnalysis,
): Readonly<Record<string, unknown>> {
  return {
    action: analysis.action,
    algorithm: {
      id: analysis.algorithm.id,
      version: analysis.algorithm.version,
      optimal: analysis.algorithm.optimal,
    },
    reason_taxonomy_version: analysis.reasonTaxonomyVersion,
    explanation_model_version: analysis.explanationModelVersion,
    expression_version: analysis.expressionVersion,
    description_registry_version: analysis.descriptionRegistryVersion,
    description_locale: analysis.descriptionLocale,
    recommended_task_ids: analysis.recommendedTaskIds,
    result_decision: resultDecisionJson(analysis.resultDecision),
    task_decisions: analysis.taskDecisions.map(taskDecisionJson),
    decision_steps: analysis.decisionSteps.map(decisionStepJson),
    facts: analysis.facts.map(factJson),
    comparisons: analysis.comparisons.map(comparisonJson),
    reason_occurrences: analysis.reasonOccurrences.map(reasonJson),
    descriptions: analysis.descriptions.map(descriptionJson),
    explanation_status: {
      level: analysis.explanationStatus.level,
      complete: analysis.explanationStatus.complete,
      decisive_chain_complete: analysis.explanationStatus.decisiveChainComplete,
      truncated: analysis.explanationStatus.truncated,
      omitted_counts: {
        decision_steps: analysis.explanationStatus.omittedCounts.decisionSteps,
        facts: analysis.explanationStatus.omittedCounts.facts,
        comparisons: analysis.explanationStatus.omittedCounts.comparisons,
        reason_occurrences: analysis.explanationStatus.omittedCounts.reasonOccurrences,
        descriptions: analysis.explanationStatus.omittedCounts.descriptions,
      },
    },
  };
}
