// Targeted premise checks for defects seen in generated technical questions. These are
// wording checks, not a claim to validate all technical premises semantically.
function getTechnicalPremiseIssue(question) {
  if (/\b(?:clearing|cleared) (?:the )?local (?:DNS |name )?cache\b/i.test(question)
    && /\bearlier failure\b/i.test(question) && /\bresolver\b/i.test(question)
    && !/\b(?:captured|recorded|preserved|saved)\b.*\b(?:before|prior)\b/i.test(question)) {
    return 'Current tests after clearing a local name cache do not reconstruct the earlier failure. State preserved pre-change cache and resolver evidence or ask about current checks without promising a past cause.';
  }
  if (/\bother users\b.*\bstill\b/i.test(question)
    && /\bwhether\b.*\bworkaround\b.*\bor a wider incident\b/i.test(question)) {
    return 'A workaround for one user can coexist with a wider incident. Ask about remaining impact or restoration scope rather than treating those as exclusive alternatives.';
  }
  if (/\bunsaved\b/i.test(question) && /\brestarts?\b/i.test(question)
    && /\b(?:what happens|what outcome follows|what (?:would|will) happen)\b/i.test(question)
    && !/\b(?:discards?|loses?|lost|autosav\w*|automatically sav\w*)\b|\b(?:recovery (?:is )?disabled|no (?:session |document )?recovery|does not (?:offer |support )?(?:session |document )?recovery)\b|\b(?:sav\w*|recover\w*|retain\w*|persist\w*) (?:all |the |any )?unsaved\b/i.test(question)) {
    return 'State whether unsaved content is saved or recovered before predicting a restart outcome. A session restore label or ordinary close prompt alone does not determine unsaved data recovery.';
  }
  // IT Support live review: neither a ticket classification nor an unverified
  // channel label supplies a universal priority or account recovery rule.
  if (/\bclassif(?:ying|ication)\b/i.test(question)
    && /\bincident\b/i.test(question) && /\bservice request\b/i.test(question)
    && /\bprioriti[sz](?:ed|ation)|\bpriority\b/i.test(question)
    && !/\b(?:does not|not determine|not establish|cannot determine|impact|urgency)\b|\bpolicy (?:states|ranks|requires)\b/i.test(question)) {
    return 'Ticket classification alone does not determine priority. State the organization priority rule or ask about impact and urgency without assuming an automatic classification outcome.';
  }
  if (/\bmanager(?:s)? (?:verbal )?confirmation\b/i.test(question.replace(/['’]/g, ''))
    && /\bindependent trusted record\b/i.test(question)
    && /\b(?:account recovery|reset|identity)\b/i.test(question)
    && !/\b(?:unverified|verified channel|authenticated channel|authenticated manager|verified manager|verification status)\b/i.test(question)) {
    return 'State how the manager confirmation was authenticated before comparing recovery risks. A channel label alone does not establish weaker or stronger identity verification.';
  }
  if (/\bfine[ -]tun(?:ed|ing)\b/i.test(question) && /\bretrieval\b/i.test(question)
    && /\b(?:keep answers accurate|prevents? (?:that )?staleness|what outcome should you expect)\b/i.test(question)
    && !/\b(?:may|can help|not guarantee|application returns the supplied fact)\b/i.test(question)) {
    return 'Current retrieval evidence does not guarantee model accuracy or factual freshness. Ask about the evidence benefit or state an enforced rule returning the supplied fact before predicting the answer.';
  }
  if (/\b(?:differ|compare)\b.*\bin cause\b.*\band in (?:the )?fix\b/i.test(question)) {
    return 'Ask for one failure distinction; remove the appended comparison of remedies.';
  }
  if (/\b(?:bound|limit) the loop\b.*\b(?:keeping|keep) the cache valid\b/i.test(question)) {
    return 'Ask either for the loop stopping policy or cache validity; do not combine two separate safeguards.';
  }
  // AI Engineer pilot: a retry or adversarial instruction does not specify
  // application response handling or prove that private data was disclosed.
  if (/\bgeneration request\b/i.test(question) && /\btimes? out\b/i.test(question)
    && /\bwhat happens to (?:the )?answer\b/i.test(question)
    && !/\b(?:displays? only|discards?|first completed response|last completed response)\b/i.test(question)) {
    return 'State how the app selects or discards completed responses before predicting the answer after a generation retry, or ask which completion status to check.';
  }
  if ((/\b(?:prompt injection|hidden instructions)\b/i.test(question)
      || /\bretrieved document\b.*\binstructions?\b.*\b(?:ignore|reveal)\b/i.test(question))
    && /\b(?:what outcome follows|what happens)\b/i.test(question)
    && !/\b(?:actually (?:executes|includes|passes|reveals)|application (?:executes|blocks|rejects))\b/i.test(question)) {
    return 'An adversarial instruction alone does not establish compliance, access or disclosure. Ask about the risk or state actual private inputs and application enforcement before predicting exposure.';
  }
  if (/\btop (?:five|ten|\d+) passages\b/i.test(question)
    && /\branks? (?:eighth|eleventh|\d+)\b/i.test(question)
    && /\branking failure\b.*\bmissing candidate failure\b/i.test(question)) {
    return 'A passage outside the retrieved top results is already absent from reranker candidates. Contrast an included candidate ranked too low with an absent candidate, not two descriptions of the same exclusion.';
  }
  if (/\btimeout alone does not prove\b/i.test(question)
    && /\band why\b.*\bidempotency key\b/i.test(question)) {
    return 'Ask either why commit status is uncertain or how duplicate protection works; remove the appended explanation of a second safeguard.';
  }
  if (/\bvolunteer (?:sample|survey)\b/i.test(question)
    && /\bfail(?:s)? to represent\b/i.test(question)) {
    return 'Volunteer selection leaves representativeness unproven, rather than proving the sample is unrepresentative. Ask why it fails to establish representativeness.';
  }
  if (/\b(?:group|pass) rates\b/i.test(question) && /\bequally\b/i.test(question)
    && /\b(?:does|must)\b.*\bmisstate\b/i.test(question)
    && !/\b(?:different|distinct|unequal) (?:group )?(?:pass )?rates\b/i.test(question)) {
    return 'Unequal group sizes alone do not guarantee averaging rates equally is wrong. Ask why it can misstate the combined rate, or specify distinct rates and denominators.';
  }
  if (/\brow per order item\b/i.test(question) && /\btotal quantity represents\b/i.test(question)) {
    return 'Grain changes what a row count represents, not necessarily a correctly calculated total quantity. Ask about row counts or specify the measured quantity.';
  }
  // Data Analyst pilot: distribution shape and input changes alone do not
  // determine these outcomes. These narrow checks preserve sensitivity tasks.
  if (/\bmean\b/i.test(question) && /\bmedian\b/i.test(question)
    && /\b(?:outlier|one (?:house|value) (?:priced|at)|mostly between)\b/i.test(question)
    && /\bhow does (?:the )?mean compare (?:with|to) (?:the )?median\b/i.test(question)
    && !/\b(?:sensitivity|sensitive|influence|effect of)\b/i.test(question)) {
    return 'An outlier alone does not determine mean versus median ordering. Ask about sensitivity or supply a complete dataset for the calculation.';
  }
  if (/\b(?:identical|same) (?:cleaning|transformation) instructions\b/i.test(question)
    && /\b(?:updated|changed) (?:source |data )?file\b/i.test(question)
    && /\bhow do their results compare\b/i.test(question)) {
    return 'Changed input files do not guarantee different summary results. Compare source preservation with instructions alone, or state the specific input change and measured result.';
  }
  if (/\bsame (?:operation |idempotency )?(?:token|identifier|key)\b/i.test(question)
    && /\bnew (?:one|(?:operation |idempotency )?(?:token|identifier|key))\b/i.test(question)
    && /\b(?:differ|compare)\b/i.test(question) && /\bduplicate effects\b/i.test(question)
    && !/\b(?:server.supported|deduplication|idempotency contract|server supports)\b/i.test(question)) {
    return 'State the server-supported idempotency or deduplication contract before comparing duplicate effects for reused versus new operation tokens.';
  }
  // DevOps findings: require the specific conditions needed for these predictions.
  if (/\bcontainer\b/i.test(question) && /\bkeep\w* its data after removal\b/i.test(question)
    && /\bvolume\b/i.test(question) && !/\b(?:retained|not deleted|not removed)\b/i.test(question)) {
    return 'State that the mounted volume is retained rather than removed with the container before predicting surviving data.';
  }
  if (/\bprefer\b.*\brestarting a container\b.*\bover changing its environment variables\b/i.test(question)) {
    return 'A simple Docker container restart retains its configured environment. Compare recreating with new environment values against restarting with unchanged values.';
  }
  if (/\bstate locking\b/i.test(question) && /\bone plan from overwriting the other\b/i.test(question)) {
    return 'State locking coordinates cooperating writes to shared infrastructure state; it does not serialize replacement of one plan file by another.';
  }
  if (/\b(?:migration|migrated schema)\b/i.test(question) && /\bimage\b/i.test(question)
    && /\bfail to restore (?:the )?previous application behavior\b/i.test(question)
    && !/\b(?:incompatible|incompatibility)\b/i.test(question)) {
    return 'An image rollback leaves migrations unchanged but does not prove old behavior fails. Supply schema incompatibility or ask about the unchanged schema.';
  }
  if (/\breadiness probe\b.*\bfails?\b/i.test(question) && /\bliveness probe keeps passing\b/i.test(question)
    && /\bletting the restart policy\b.*\b(?:recreate|restart)\b/i.test(question)) {
    return 'Readiness failure alone does not trigger container restart while liveness passes. Ask about investigating readiness or state an actual exit or restart trigger.';
  }
  if (/\bliveness probe keeps passing\b/i.test(question) && /\bfirst two failures\b/i.test(question)
    && !/\bfirst two readiness (?:probe )?failures\b/i.test(question)) {
    return 'Identify which probe fails; do not state liveness keeps passing and then leave the numbered failures unspecified.';
  }
  if (/\bstated recovery point requirement\b/i.test(question) && /\b(?:outcome|compare)\b/i.test(question)
    && !/\b(?:maximum|at most|tolerance|requirement (?:is|allows|permits|of)|requires? (?:no more than|recovery within))\b/i.test(question)) {
    return 'Supply the maximum permitted data loss before predicting whether the restore meets a recovery point requirement, or ask which requirement to inspect.';
  }
  if (/\bstrong capture\b.*\breleased\b/i.test(question) && /\blater accesses\b/i.test(question)
    && /\bweak\b.*\bunowned\b/i.test(question) && !/\bdeallocated\b/i.test(question)) {
    return 'Releasing one strong capture does not establish target deallocation. State the target lifetime before comparing later weak and checked unowned access.';
  }
  if (/\bscreen reader\b/i.test(question) && /\bno accessible label\b/i.test(question)
    && /\bwhat does (?:the |a )?screen reader announce\b/i.test(question)) {
    return 'An absent explicit label alone does not determine the complete screen reader announcement. Ask which naming property is missing or what evidence must be inspected.';
  }
  if (/\bstored closure\b.*\bstrongly captures\b/i.test(question)
    && /\b(?:once|after) (?:the )?(?:controller|owning object|target) is deallocated\b/i.test(question)
    && !/\b(?:cleared|released|removed)\b/i.test(question)) {
    return 'An existing strong closure capture retains its target. Do not simultaneously assume target deallocation without releasing that capture; compare weak and checked unowned references instead.';
  }
  if (/\breuses? (?:a|the) view identity\b.*\bdifferent item\b/i.test(question)
    && /\breset\w*\b/i.test(question)) {
    return 'Reusing the same view identity can preserve state from the old item. State a changed identity for a reset, or ask about preserved state when identity is reused.';
  }
  if (/\bSwift task\b/i.test(question) && /\bleaves? the screen\b/i.test(question)
    && /\bnever checks\b/i.test(question) && /\bwhat happens\b/i.test(question)
    && !/\b(?:cancelled|canceled|view linked|linked to (?:the |that )?(?:view|screen))\b/i.test(question)) {
    return 'Screen departure alone does not establish Swift task cancellation. State the cancellation event or the task lifetime linkage before predicting its reaction.';
  }
  if (/\bnavigation path entry\b/i.test(question) && /\breset\w*\b.*\bstate\b/i.test(question)
    && !/\b(?:changes?|replaces?) (?:the |its )?view identity\b|\bview identity (?:changes|is changed|is replaced)\b/i.test(question)) {
    return 'Replacing a navigation entry alone does not establish a changed view identity. State the actual identity change before predicting locally owned state reset.';
  }
  if (/\bclosure\b.*\bcaptures?\b/i.test(question) && /\bwhat happens\b.*\blifetime\b/i.test(question)
    && !/\b(?:strongly|weakly|strong capture|weak capture|unowned)\b/i.test(question)) {
    return 'Specify the closure capture strength and ownership before predicting the captured object lifetime.';
  }
  if (/\buser defaults\b/i.test(question) && /\bdurably persisted\b/i.test(question)
    && /\b(?:checks|verify|confirm)\b/i.test(question) && !/\b(?:cannot|does not|fails? to)\b/i.test(question)) {
    return 'User defaults updates cached values before asynchronous disk writes. Do not invent durable save confirmation checks from cached readback; use an explicit persistent record save result or ask about the evidence limit.';
  }
  if (/\bbackground task\b/i.test(question) && /\bcancelled\b/i.test(question)
    && /\bnever checks\b/i.test(question) && /\bwhat happens\b/i.test(question)
    && !/\bSwift task\b/i.test(question)) {
    return 'Identify a Swift task for cooperative cancellation predictions; operating system background task expiration has different lifecycle limits.';
  }
  // A path update can be a push. The requested comparison must name the
  // actual different path operations rather than imply these are opposites.
  if (/\bhow does updating (?:a|the) navigation path differ from pushing\b/i.test(question)) {
    return 'A navigation path update can itself push a destination. Compare explicit append, removal or replacement operations.';
  }
  if (/\bwhat happens to (?:the )?screen\b.*\bleave behind\b/i.test(question)
    && /\bnavigation stack\b/i.test(question)) {
    return 'A navigation entry remaining in history does not prove a screen object remains alive. Ask about the path entry or supply lifecycle ownership.';
  }
  // Android review findings. These recognize specific missing conditions;
  // they do not establish factual correctness for arbitrary Android wording.
  if (/\b(?:camera|runtime)\b/i.test(question) && /\bpermission\b/i.test(question)
    && /\b(?:denied|denies|denial)\b/i.test(question)
    && /\bwhat happens\b.*\b(?:tries?|attempts?|opens?|uses?)\b/i.test(question)) {
    return 'Permission denial establishes unavailable protected access, not a universal launch or crash outcome. Ask about permitted access instead.';
  }
  if (/\b(?:list|collection)\b/i.test(question)
    && /\b(?:without (?:any )?(?:observed|observable) state update|unobserved)\b/i.test(question)
    && /\bwhat (?:does|will)\b.*\b(?:display|screen|list|show)\b/i.test(question)
    && !/\b(?:no other|without other) (?:recomposition|refresh)|\b(?:alone|by itself|guarantee)\b/i.test(question)) {
    return 'Unobserved mutation does not schedule a refresh, but another recomposition can read changed data. Exclude other triggers or ask what notification the mutation alone supplies.';
  }
  if (/\b(?:coroutine|child)\b/i.test(question) && /\b(?:scope|view model)\b/i.test(question)
    && /\b(?:cleared|cancelled|canceled|cancelling|canceling)\b/i.test(question)
    && (/\bwhat happens\b/i.test(question) || /\bstop\b.*\bsuspended child\b/i.test(question))
    && !/\b(?:cooperative|cancellable|cancelable|cancellation checking)\b/i.test(question)) {
    return 'State that the child operation is cooperative or cancellable before predicting its reaction to scope cancellation.';
  }
  if (/\bview model scope\b/i.test(question) && /\b(?:screen|activity)\b.*\bdestroyed\b/i.test(question)
    && !/\b(?:cleared|cancelled|canceled|permanently finished)\b/i.test(question)) {
    return 'Screen destruction alone does not establish that a retained view model is cleared. Specify the actual owner scope and its cancellation or clearing.';
  }
  if (/\beffect\b/i.test(question) && /\bprevent\b.*\brepeating\b/i.test(question)
    && /\bkey changes\b/i.test(question)) {
    return 'A changed composition effect key intentionally restarts the coroutine effect. Ask about stable keys, or about the restart caused by a changed key.';
  }
  if (/^(?:name|list) three\b/i.test(question) && /\b(?:draft|saved state)\b/i.test(question)
    && /\brestoration\b/i.test(question) && /\b(?:ordinary )?rotation\b/i.test(question)
    && !/\bprocess death\b/i.test(question)) {
    return 'Keep ordinary rotation retention in medium; hard draft restoration must address system initiated process death.';
  }
  if (/^(?:name|list) three\b/i.test(question)
    && (/\bcovering\b[^?]*,[^?]*,\s*(?:and\s+)?/i.test(question)
      || /\b(?:exposes?|exposing)\b[^?]*\bname,\s*role,?\s*and\s*activation\b/i.test(question))) {
    return 'Leave the three requested checks for the student; remove the clause that supplies the list items.';
  }
  if (/\b(?:offline|pending)\b/i.test(question)
    && /\b(?:worker|work manager)\b.*\breports? success\b/i.test(question)
    && /\bwhat outcome\b/i.test(question)
    && /\b(?:server|remote)\b/i.test(question)
    && !/\b(?:server|remote service)\b.*\b(?:confirms|acknowledges|accepted)\b|\b(?:received|receives)\b.*\bserver confirmation\b/i.test(question)) {
    return 'A worker success result alone does not establish remote acceptance. State that the server confirms the write before predicting its confirmed synchronization status.';
  }
  if ((/\bwork manager\b/i.test(question) && /^why\b/i.test(question)
    && /\band how\b/i.test(question))
    || (/\bcoroutine\b/i.test(question) && /\band why\b.*\bserver write\b/i.test(question))) {
    return 'Ask one Android mechanism: persistence, eligibility, cancellation, or remote write confirmation, without appending another probe.';
  }
  if (/\b(?:network error|timeout|times? out|response (?:is |was )?lost)\b/i.test(question)
    && /\b(?:retries|retried|retrying)\b/i.test(question)
    && /\bwhat (?:recovery )?outcome (?:should|would|will)\b/i.test(question)
    && !/\b(?:retry|retried|retries)\b.*\b(?:accepted|rejected|confirmed|confirms success|succeeds|succeeded)\b|\b(?:possible|might|unknown)\b/i.test(question)) {
    return 'Retrying after an unknown network result does not establish a recovery outcome. State the retry result or ask which confirmation is needed.';
  }
  if (/\b(?:modal|dialog)\b/i.test(question)
    && /\bmust\b.*\bfocus\b.*\breturn\b.*\btrigger\b/i.test(question)
    && !/\b(?:still exists|available|present|remains|not removed)\b/i.test(question)) {
    return 'Focus cannot always return to a removed trigger. State that the original trigger remains available or ask about a logical alternative.';
  }
  if (/\bplaceholder\b/i.test(question) && /\b(?:disappear\w*|vanish\w*)\b/i.test(question)
    && /\bwhat happens\b.*\b(?:visible )?label\b/i.test(question)
    && !/\b(?:separate|persistent|permanent|external|no visible label|only visible)\b/i.test(question)) {
    return 'A disappearing placeholder does not establish what happens to a separate label. State whether a persistent visible label exists or the placeholder is the only description.';
  }
  if (/\bpooled\b/i.test(question) && /\b(?:lifetime|countdown)\b/i.test(question)
    && /\b(?:reus\w*|reactivat\w*)\b/i.test(question)
    && /\bwhat happens|\b(?:what|which)\s+\w*\s*outcome\b/i.test(question)
    && !/\b(?:resum\w*|continues?|keeps (?:running|counting)|counts? down)\b/i.test(question)) {
    return 'State whether the retained pooled-object countdown resumes or remains stopped on activation before predicting its lifetime.';
  }
  if (/\binterpolat\w*\b/i.test(question)
    && /\bframe\b.*\b(?:much longer|longer than usual|long delay)\b/i.test(question)
    && /\bwhat (?:does|will) (?:the )?(?:player|display|displayed (?:pose|position)) (?:see|show)|\bwhat happens to (?:the )?displayed\b/i.test(question)
    && !/\bno (?:additional |new )?physics (?:ticks|steps)\b|\bsimulation (?:is paused|does not advance)\b/i.test(question)) {
    return 'A long render frame alone does not determine the interpolated pose. State simulation advancement and available snapshots, or ask how interpolation works without a long-frame prediction.';
  }
  if (/\b(?:persist|survive|remain|keep|last)\w*\b.*\b(?:clos\w*|shut\w*)\b.*\bbrowser\b/i.test(question)
    && /\b(?:clear|remov|delet|end|disappear)\w*\b.*\btab\b/i.test(question)) {
    return 'Use one consistent storage lifetime: survive page reloads until tab closure, or persist across browser sessions.';
  }
  const fields = question.match(/\b(?:field (?:named |called )?|sends (?:a field (?:named |called )?)?)([a-z][a-z ]*?)\s*(?:,|but)\s*(?:but\s+)?(?:the\s+)?(?:backend|server) expects\s+(?:a field (?:named |called )?)?([a-z][a-z ]*?)(?:[,;?]|$)/i);
  if (fields && fields[1].trim().toLowerCase() === fields[2].trim().toLowerCase()) {
    return 'The field names are identical in spoken English; state genuinely different names or ask about field agreement without inventing a mismatch.';
  }
  if (/\b(?:class|field|selector|name)\b/i.test(question) && /\bmismatch\b/i.test(question)
    && /\b(?:underscore|hyphen|capitalization|capitalisation|camel case)\b/i.test(question)) {
    return 'Use a distinction that survives spoken delivery, not punctuation or identifier spelling.';
  }
  if (/\bfirewall\b/i.test(question) && /\brepl(?:y|ies)\b/i.test(question)
    && (/\bbypass\w*\b/i.test(question) && /\b(?:drop\w*|reject\w*)\b/i.test(question)
      || /\bdifferent interface\b/i.test(question) && /\b(?:drop\w*|reject\w*|differ|comparison)\b/i.test(question))) {
    return 'Bypassing a firewall or entering another interface does not itself prove rejection. State that the reply crosses an enforcing firewall requiring connection state that is absent.';
  }
  if (/\bblocked (?:redundant )?link\b.*\b(?:later )?fails?\b/i.test(question)
    && /\brestor\w*\b.*\bconnectivity\b/i.test(question)) {
    return 'Failure of an already blocked link does not require restoration of the active path. If asking failover, state that the forwarding link fails and an alternate path can converge.';
  }
  if (/\bping\b/i.test(question) && /\bhostname\b/i.test(question)
    && /\b(?:suggest|prove|confirm|must)\b/i.test(question)
    && !/\b(?:lookup|resolution)\b.*\bfail\w*\b/i.test(question)) {
    return 'Ping by address and failed hostname access do not establish a DNS failure. State an observed failed lookup and use the same hostname-independent service when isolating name resolution.';
  }
  if (/\b(?:more specific|longer prefix)\b/i.test(question) && /\bnext hop\b/i.test(question)
    && /\b(?:unusable|unreachable)\b/i.test(question)
    && !/\b(?:withdrawn|not installed|removed from)\b/i.test(question)) {
    return 'An unusable next hop alone does not prove that a more specific route was removed from forwarding. Use two installed usable matching routes or explicitly state withdrawal of the unusable route.';
  }
  return null;
}

module.exports = { getTechnicalPremiseIssue };
