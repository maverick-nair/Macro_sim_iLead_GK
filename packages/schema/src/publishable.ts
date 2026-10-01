import { REPORT_SECTIONS } from "./areas/report";
import { type AreaKey, type SimulationTemplate, TemplateSchema } from "./template";

export interface PublishIssue {
  /** Path into the template as segments, e.g. ["cast", "npcs", 3, "stats"]. */
  path: (string | number)[];
  area: AreaKey;
  message: string;
}

type Path = (string | number)[];

/**
 * Cross-field rules a template must pass before it can be published (plan 4.1). Structural rules live in
 * TemplateSchema and are enforced on every save; these produce amber area status while editing and block publish.
 */
export function publishableIssues(t: SimulationTemplate): PublishIssue[] {
  const issues: PublishIssue[] = [];
  const add = (path: Path, message: string) => issues.push({ path, area: path[0] as AreaKey, message });

  const unique = <T>(items: readonly T[], key: (item: T) => string, path: Path, what: string) => {
    const seen = new Set<string>();
    items.forEach((item, i) => {
      const k = key(item);
      if (seen.has(k)) add([...path, i], `Duplicate ${what} "${k}"`);
      seen.add(k);
    });
  };

  const stageIds = new Set(t.process.stages.map((s) => s.id));
  const npcIds = new Set(t.cast.npcs.map((n) => n.id));
  const styleIds = new Set(t.leadership.styles.map((s) => s.id));
  const bandIds = new Set(t.leadership.readinessBands.map((b) => b.id));
  const actionIds = new Set(t.actions.catalogue.map((a) => a.id));
  const eventIds = new Set(t.events.deck.map((e) => e.id));
  const skillIds = new Set(t.report.skillsFramework.skills.map((s) => s.id));
  const levelIds = new Set(t.report.ratingScale.map((l) => l.id));
  const rewardIds = new Set(t.gamification.unlocks.rewards.map((r) => r.id));
  const liveActionIds = new Set(t.actions.catalogue.filter((a) => a.interaction).map((a) => a.id));

  // Context
  const lines = t.context.product.lines;
  unique(lines, (l) => l.id, ["context", "product", "lines"], "product line");
  unique(t.context.product.segments, (s) => s.id, ["context", "product", "segments"], "customer segment");
  if (!lines.some((l) => l.id === t.context.product.focusLineId))
    add(["context", "product", "focusLineId"], "Focus product must be one of the product lines");
  const sponsor = t.cast.npcs.find((n) => n.id === t.context.scenario.sponsorNpcId);
  if (!sponsor || sponsor.kind !== "sponsor")
    add(["context", "scenario", "sponsorNpcId"], "Sponsor must be a cast member of kind sponsor");

  // Cast
  unique(t.cast.npcs, (n) => n.id, ["cast", "npcs"], "NPC id");
  const team = t.cast.npcs.filter((n) => n.kind === "team_member");
  if (team.length !== t.cast.roster.teamSize)
    add(
      ["cast", "roster", "teamSize"],
      `Team size is ${t.cast.roster.teamSize} but the cast has ${team.length} team members`,
    );
  for (const stageId of Object.keys(t.cast.roster.membersPerRole.perStage))
    if (!stageIds.has(stageId))
      add(["cast", "roster", "membersPerRole", "perStage", stageId], `Unknown stage "${stageId}"`);
  const trustDefined = team.filter((n) => n.stats?.trust !== undefined).length;
  if (trustDefined !== 0 && trustDefined !== team.length)
    add(["cast", "npcs"], "Starting Trust must be set for every team member or for none");
  if (t.process.targets.kpiDials.includes("trust") && trustDefined === 0)
    add(["process", "targets", "kpiDials"], "The Trust dial needs a starting Trust for every team member");
  t.cast.npcs.forEach((n, i) => {
    const p: Path = ["cast", "npcs", i];
    const needsStats = n.kind === "team_member" || n.kind === "candidate";
    if (needsStats && !n.stats) add([...p, "stats"], `${n.identity.name} needs starting stats`);
    if (n.kind === "team_member") {
      if (!stageIds.has(n.profile.roleId))
        add([...p, "profile", "roleId"], `${n.identity.name} has an unknown stage`);
      if (n.stats)
        for (const s of stageIds)
          if (!n.stats.roleFit[s])
            add([...p, "stats", "roleFit"], `${n.identity.name} has no role fit for stage "${s}"`);
    }
    if (n.stats)
      for (const k of Object.keys(n.stats.roleFit))
        if (!stageIds.has(k)) add([...p, "stats", "roleFit", k], `Unknown stage "${k}"`);
    if (n.kind === "candidate" && !n.candidate)
      add([...p, "candidate"], `${n.identity.name} needs a true profile`);
    for (const e of n.profile.hiddenConcern.linkedEventIds)
      if (!eventIds.has(e)) add([...p, "profile", "hiddenConcern"], `Unknown event "${e}"`);
    for (const a of n.profile.hiddenConcern.linkedActionIds)
      if (!actionIds.has(a)) add([...p, "profile", "hiddenConcern"], `Unknown action "${a}"`);
    if (n.voice.source === "licensed" && !n.voice.consentRecordId)
      add(
        [...p, "voice", "consentRecordId"],
        `${n.identity.name} uses a licensed voice without a consent record`,
      );
  });
  for (const stage of t.process.stages) {
    const count = team.filter((n) => n.profile.roleId === stage.id).length;
    if (count > stage.maxMembers)
      add(
        ["process", "stages"],
        `Stage "${stage.name}" has ${count} members; the maximum is ${stage.maxMembers}`,
      );
    if (count === 0) add(["process", "stages"], `Stage "${stage.name}" has no team member`);
  }
  unique(t.cast.relationships, (r) => r.id, ["cast", "relationships"], "relationship id");
  t.cast.relationships.forEach((r, i) => {
    if (!npcIds.has(r.a) || !npcIds.has(r.b))
      add(["cast", "relationships", i], "Relationship refers to an unknown NPC");
    if (r.a === r.b) add(["cast", "relationships", i], "A relationship needs two different people");
  });
  unique(t.cast.rippleRules, (r) => r.id, ["cast", "rippleRules"], "ripple rule id");
  t.cast.rippleRules.forEach((r, i) => {
    const p: Path = ["cast", "rippleRules", i];
    if (r.source.kind === "npc" && !npcIds.has(r.source.npcId)) add(p, `Unknown NPC "${r.source.npcId}"`);
    if (r.source.kind === "role" && !stageIds.has(r.source.stageId))
      add(p, `Unknown stage "${r.source.stageId}"`);
    if (r.source.kind === "any_team_member")
      for (const x of r.source.except ?? []) if (!npcIds.has(x)) add(p, `Unknown NPC "${x}"`);
    if (r.affected.kind === "npc" && !npcIds.has(r.affected.npcId))
      add(p, `Unknown NPC "${r.affected.npcId}"`);
    if (r.affected.kind === "role" && !stageIds.has(r.affected.stageId))
      add(p, `Unknown stage "${r.affected.stageId}"`);
  });

  // Process
  unique(t.process.stages, (s) => s.id, ["process", "stages"], "stage id");
  t.process.stages.forEach((s, i) => {
    if (s.branchOf && !stageIds.has(s.branchOf))
      add(["process", "stages", i, "branchOf"], `Unknown stage "${s.branchOf}"`);
    if (s.branchOf && !t.process.branching.enabled)
      add(["process", "branching"], "Turn on branching to use a branching stage");
  });
  const w = t.process.throughput.weights;
  if (Math.abs(w.skill + w.morale + w.result - 1) > 0.001)
    add(["process", "throughput", "weights"], "Throughput weights must add up to 1");
  unique(t.process.targets.kpiDials, (d) => d, ["process", "targets", "kpiDials"], "KPI dial");
  if (
    t.process.targets.winCondition.kind === "target_and_morale" &&
    t.process.targets.winCondition.moraleFloor === undefined
  )
    add(["process", "targets", "winCondition"], "Set the morale floor for this win condition");

  // Leadership
  unique(t.leadership.styles, (s) => s.id, ["leadership", "styles"], "style id");
  unique(t.leadership.readinessBands, (b) => b.id, ["leadership", "readinessBands"], "band id");
  for (const b of t.leadership.readinessBands) {
    const style = t.leadership.fitMatrix[b.id];
    if (!style) add(["leadership", "fitMatrix"], `Band "${b.label}" has no needed style`);
    else if (!styleIds.has(style)) add(["leadership", "fitMatrix", b.id], `Unknown style "${style}"`);
    for (const r of [b.skill, b.morale, b.trust])
      if (r && r[0] > r[1])
        add(["leadership", "readinessBands"], `Band "${b.label}" has a range that runs backwards`);
  }
  for (const k of Object.keys(t.leadership.fitMatrix))
    if (!bandIds.has(k)) add(["leadership", "fitMatrix", k], `Unknown band "${k}"`);
  if (!t.leadership.readinessBands.some((b) => b.trust)) {
    // Every Skill and Morale pair must fall in exactly one band.
    outer: for (let s = 0; s <= 100; s++)
      for (let m = 0; m <= 100; m++) {
        const hits = t.leadership.readinessBands.filter(
          (b) => s >= b.skill[0] && s <= b.skill[1] && m >= b.morale[0] && m <= b.morale[1],
        ).length;
        if (hits !== 1) {
          add(
            ["leadership", "readinessBands"],
            `Skill ${s} and Morale ${m} fall in ${hits} bands; each pair needs exactly one`,
          );
          break outer;
        }
      }
  }
  t.leadership.memberExceptions.forEach((x, i) => {
    if (!npcIds.has(x.npcId)) add(["leadership", "memberExceptions", i], `Unknown NPC "${x.npcId}"`);
    if (!styleIds.has(x.styleId)) add(["leadership", "memberExceptions", i], `Unknown style "${x.styleId}"`);
    if (x.week > t.time.weeks)
      add(["leadership", "memberExceptions", i], `Week ${x.week} is after the last week`);
  });
  t.leadership.inferenceRules.forEach((r, i) => {
    if (!styleIds.has(r.styleId)) add(["leadership", "inferenceRules", i], `Unknown style "${r.styleId}"`);
  });

  // Actions
  unique(t.actions.catalogue, (a) => a.id, ["actions", "catalogue"], "action id");
  t.actions.catalogue.forEach((a, i) => {
    const p: Path = ["actions", "catalogue", i];
    unique(a.options, (o) => o.id, [...p, "options"], "option id");
    const tagged = a.options.filter((o) => o.styleTag).length;
    if (tagged > 0 && (a.options.length < 2 || a.options.length > 4))
      add([...p, "options"], `${a.name} needs 2 to 4 style tagged options`);
    a.options.forEach((o, j) => {
      const op: Path = [...p, "options", j];
      if (o.styleTag) {
        if (!styleIds.has(o.styleTag)) add([...op, "styleTag"], `Unknown style "${o.styleTag}"`);
        if (!o.consequences.match || !o.consequences.mismatch)
          add([...op, "consequences"], `"${o.label}" needs match and mismatch consequences`);
        if (!o.quotes.match || !o.quotes.mismatch)
          add([...op, "quotes"], `"${o.label}" needs match and mismatch quotes`);
      } else {
        if (!o.consequences.any) add([...op, "consequences"], `"${o.label}" needs consequences`);
        if (!o.quotes.any) add([...op, "quotes"], `"${o.label}" needs quotes`);
      }
      for (const e of o.effects)
        if (e.kind === "schedule_event" && !eventIds.has(e.eventId))
          add([...op, "effects"], `Unknown event "${e.eventId}"`);
    });
    if (a.limits.minTargets > a.limits.maxTargets)
      add([...p, "limits"], "Minimum targets is above the maximum");
    if (a.scope === "team" && a.limits.maxTargets !== 0)
      add([...p, "limits"], "Team actions target the whole team, so maximum targets must be 0");
    if (a.scope === "individual" && a.limits.maxTargets !== 1)
      add([...p, "limits"], "Individual actions target exactly one person");
    if (a.scope === "multi_select" && a.limits.maxTargets < 1)
      add([...p, "limits"], "Multi select actions need at least one target");
    for (const pr of a.prerequisites)
      if (!actionIds.has(pr.actionId)) add([...p, "prerequisites"], `Unknown action "${pr.actionId}"`);
    for (const e of a.effects)
      if (e.kind === "schedule_event" && !eventIds.has(e.eventId))
        add([...p, "effects"], `Unknown event "${e.eventId}"`);
    if (a.unlock.kind === "after_event" && !eventIds.has(a.unlock.eventId))
      add([...p, "unlock"], `Unknown event "${a.unlock.eventId}"`);
    if (a.unlock.kind === "sponsor_unlock" && !rewardIds.has(a.unlock.rewardId))
      add([...p, "unlock"], `Unknown reward "${a.unlock.rewardId}"`);
    if ((a.mode === "live" || a.mode === "hybrid") && !a.interaction)
      add([...p, "interaction"], `${a.name} is ${a.mode} and needs an interaction design`);
    if (a.mode === "static" && a.interaction && !a.interaction.optional)
      add([...p, "interaction"], `${a.name} is static, so its interaction must be optional`);
    const ix = a.interaction;
    if (ix) {
      const ip: Path = [...p, "interaction"];
      unique(ix.rubric.dimensions, (d) => d.skillId, [...ip, "rubric", "dimensions"], "rubric skill");
      unique(ix.rubric.redFlags, (f) => f.id, [...ip, "rubric", "redFlags"], "red flag id");
      unique(ix.calibrationSet, (c) => c.id, [...ip, "calibrationSet"], "calibration sample id");
      ix.rubric.dimensions.forEach((d, k) => {
        if (!skillIds.has(d.skillId)) add([...ip, "rubric", "dimensions", k], `Unknown skill "${d.skillId}"`);
        else if (!(t.report.linkage[d.skillId] ?? []).includes(a.id))
          add(
            [...ip, "rubric", "dimensions", k],
            `Skill "${d.skillId}" is not linked to ${a.name} in the linkage matrix`,
          );
      });
      for (const band of ["strong", "adequate", "weak", "harmful"] as const)
        for (const tr of ix.triggers[band])
          if ((tr.kind === "follow_up_event" || tr.kind === "escalate") && !eventIds.has(tr.eventId))
            add([...ip, "triggers", band], `Unknown event "${tr.eventId}"`);
      if (ix.format === "interview" && !ix.interview) add(ip, "Interviews need interview settings");
      if (ix.format === "email" && !ix.email) add(ip, "Emails need email settings");
      if (ix.format === "team_meeting" && !ix.meeting) add(ip, "Team meetings need meeting settings");
    }
  });

  // Events
  unique(t.events.deck, (e) => e.id, ["events", "deck"], "event id");
  t.events.deck.forEach((e, i) => {
    const p: Path = ["events", "deck", i];
    const tr = e.trigger;
    if (tr.kind === "fixed" && tr.week > t.time.weeks)
      add([...p, "trigger"], `Week ${tr.week} is after the last week`);
    if (tr.kind === "fixed" && tr.day !== undefined && tr.day > t.time.daysPerWeek)
      add([...p, "trigger"], `Day ${tr.day} is after the last day of the week`);
    if (tr.kind === "random" && tr.weeks[0] > tr.weeks[1])
      add([...p, "trigger"], "The random window runs backwards");
    if (tr.kind === "action" && !actionIds.has(tr.actionId))
      add([...p, "trigger"], `Unknown action "${tr.actionId}"`);
    if (e.target.kind === "npc" && !npcIds.has(e.target.npcId))
      add([...p, "target"], `Unknown NPC "${e.target.npcId}"`);
    if (e.target.kind === "role" && !stageIds.has(e.target.stageId))
      add([...p, "target"], `Unknown stage "${e.target.stageId}"`);
    if (e.impact.funnelChange && !stageIds.has(e.impact.funnelChange.stageId))
      add([...p, "impact"], `Unknown stage "${e.impact.funnelChange.stageId}"`);
    for (const a of e.expectedResponse?.actionIds ?? [])
      if (!actionIds.has(a)) add([...p, "expectedResponse"], `Unknown action "${a}"`);
    if (e.escalation && !eventIds.has(e.escalation.followUpEventId))
      add([...p, "escalation"], `Unknown event "${e.escalation.followUpEventId}"`);
    if (e.escalation && e.responseWindowDays === undefined)
      add([...p, "responseWindowDays"], "An escalation needs a response window");
    if (e.repeat.kind === "cooldown" && e.repeat.cooldownWeeks === undefined)
      add([...p, "repeat"], "Set the cooldown in weeks");
  });
  if (t.events.pacing.perWeek[0] > t.events.pacing.perWeek[1])
    add(["events", "pacing", "perWeek"], "Events per week runs backwards");

  // Time
  if (t.time.realTimeLimit.kind !== "off" && t.time.realTimeLimit.minutes === undefined)
    add(["time", "realTimeLimit"], "Set the real time limit in minutes");
  for (const wk of t.time.sittings.breakAfterWeeks)
    if (wk >= t.time.weeks) add(["time", "sittings"], `A break after week ${wk} leaves no week to play`);
  if (t.time.sittings.breakAfterWeeks.length !== t.time.sittings.count - 1)
    add(["time", "sittings"], "Give one break week for each sitting after the first");

  // Gamification
  const g = t.gamification;
  if (g.weights.business + g.weights.people + g.weights.leadership !== 100)
    add(["gamification", "weights"], "Score weights must add up to 100");
  if (!(g.stars[0] < g.stars[1] && g.stars[1] < g.stars[2]))
    add(["gamification", "stars"], "Star thresholds must rise");
  unique(g.badges, (b) => b.id, ["gamification", "badges"], "badge id");
  unique(g.unlocks.rewards, (r) => r.id, ["gamification", "unlocks", "rewards"], "reward id");
  if (g.unlocks.lowThreshold >= g.unlocks.threshold)
    add(["gamification", "unlocks"], "The low threshold must be below the unlock threshold");
  unique(g.tiers, (x) => x.id, ["gamification", "tiers"], "tier id");
  if (g.tiers[0]?.min !== 0) add(["gamification", "tiers"], "The first tier must start at 0");
  for (let i = 1; i < g.tiers.length; i++)
    if ((g.tiers[i]?.min ?? 0) <= (g.tiers[i - 1]?.min ?? 0))
      add(["gamification", "tiers", i], "Tier thresholds must rise");
  if (g.tiers.some((x) => x.min > g.scale.max))
    add(["gamification", "tiers"], "A tier threshold is above the score scale");

  // Report
  const r = t.report;
  unique(r.sections, (s) => s.id, ["report", "sections"], "report section");
  for (const id of REPORT_SECTIONS)
    if (!r.sections.some((s) => s.id === id)) add(["report", "sections"], `Missing section "${id}"`);
  unique(r.skillsFramework.skills, (s) => s.id, ["report", "skillsFramework", "skills"], "skill id");
  unique(r.ratingScale, (l) => l.id, ["report", "ratingScale"], "rating level id");
  if (r.ratingScale[0]?.minScore !== 0) add(["report", "ratingScale"], "The first level must start at 0");
  for (let i = 1; i < r.ratingScale.length; i++)
    if ((r.ratingScale[i]?.minScore ?? 0) <= (r.ratingScale[i - 1]?.minScore ?? 0))
      add(["report", "ratingScale", i], "Level thresholds must rise");
  if (!levelIds.has(r.harmfulCapLevelId))
    add(["report", "harmfulCapLevelId"], `Unknown level "${r.harmfulCapLevelId}"`);
  if (r.capabilityBands.midFrom >= r.capabilityBands.highFrom)
    add(["report", "capabilityBands"], "The mid band must start below the high band");
  for (const s of r.skillsFramework.skills) {
    for (const l of r.ratingScale)
      if (!r.anchors[s.id]?.[l.id])
        add(["report", "anchors", s.id], `"${s.name}" has no anchor for level "${l.label}"`);
    const linked = new Set((r.linkage[s.id] ?? []).filter((a) => liveActionIds.has(a)));
    if (linked.size < r.minObservations)
      add(
        ["report", "linkage", s.id],
        `"${s.name}" is observed in ${linked.size} interactions; it needs at least ${r.minObservations}`,
      );
    if (!r.developmentPlan.items.some((it) => it.skillId === s.id))
      add(["report", "developmentPlan", "items"], `"${s.name}" has no development plan item`);
  }
  for (const [skill, actions] of Object.entries(r.linkage)) {
    if (!skillIds.has(skill)) add(["report", "linkage", skill], `Unknown skill "${skill}"`);
    for (const a of actions)
      if (!liveActionIds.has(a))
        add(["report", "linkage", skill], `"${a}" is not a live or hybrid interaction`);
  }
  for (const k of Object.keys(r.anchors))
    if (!skillIds.has(k)) add(["report", "anchors", k], `Unknown skill "${k}"`);
  unique(r.narrativeBank, (n) => n.id, ["report", "narrativeBank"], "narrative id");
  r.narrativeBank.forEach((n, i) => {
    const k = n.key;
    if ((k.kind === "overall_level" || k.kind === "skill_level") && !levelIds.has(k.levelId))
      add(["report", "narrativeBank", i], `Unknown level "${k.levelId}"`);
    if (k.kind === "skill_level" && !skillIds.has(k.skillId))
      add(["report", "narrativeBank", i], `Unknown skill "${k.skillId}"`);
    if (k.kind === "dominant_style" && !styleIds.has(k.styleId))
      add(["report", "narrativeBank", i], `Unknown style "${k.styleId}"`);
  });
  r.developmentPlan.items.forEach((it, i) => {
    if (!skillIds.has(it.skillId))
      add(["report", "developmentPlan", "items", i], `Unknown skill "${it.skillId}"`);
  });

  // Governance
  unique(t.governance.locks, (l) => l.path, ["governance", "locks"], "lock path");

  return issues;
}

/** TemplateSchema plus every publishable rule. Use for publish and for quality checks, not for autosave. */
export const PublishableTemplateSchema = TemplateSchema.superRefine((t, ctx) => {
  for (const issue of publishableIssues(t))
    ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
});

export const issuesByArea = (issues: PublishIssue[]): Partial<Record<AreaKey, PublishIssue[]>> => {
  const out: Partial<Record<AreaKey, PublishIssue[]>> = {};
  for (const i of issues) (out[i.area] ??= []).push(i);
  return out;
};
