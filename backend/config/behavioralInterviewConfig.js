// Research rationale and HR review guide: docs/behavioral-interview-research.md.
// Keep topic labels stable for saved Set3Session competency enums.
const BEHAVIORAL_COMPETENCIES = [
  {
    topic: 'Teamwork & Collaboration',
    instruction: 'Ask about one occasion when the candidate contributed to a shared task with other people. Do not require leadership or a successful team outcome.',
    evidence: 'Look for an identifiable contribution to a shared goal, coordination, listening, sharing information, or supporting another person. Simply claiming to be a team player is insufficient.',
    examples: [
      'Tell me about a time you contributed to a task with other people.',
      'Describe a time you worked with others on a shared assignment.',
    ],
    questionMarkers: /\b(?:team|teammates?|group|classmates|peers?|collaborat\w*|others|other people|with people|shared|together)\b/i,
  },
  {
    topic: 'Adaptability & Learning Speed',
    instruction: 'Ask about one occasion of adjusting to a change OR learning something unfamiliar. Assess the response to learning or change, never speed, a new technology, or both tasks together.',
    evidence: 'Look for seeking guidance, using feedback, practicing, checking understanding, or adjusting an approach to changed circumstances. Learning quickly is not required.',
    examples: [
      'Tell me about a time you learned something unfamiliar for an assignment.',
      'Describe a time you adjusted to a change in a planned activity.',
    ],
    questionMarkers: /\b(?:learn\w*|unfamiliar|new|chang\w*|adapt\w*|adjust\w*|feedback)\b/i,
  },
  {
    topic: 'Conflict Resolution',
    instruction: 'Ask about responding to one ordinary difference of opinion with another person. Do not presume that it was resolved or demand confrontation, persuasion, or a serious conflict.',
    evidence: 'Look for listening to another view, communicating respectfully, clarifying a difference, seeking a workable compromise, or asking for appropriate help. Winning an argument and complete agreement are not required.',
    examples: [
      'Tell me about a time you dealt with a difference of opinion during a shared task.',
      'Describe a time you responded to a disagreement with someone in a group.',
    ],
    questionMarkers: /\b(?:disagree\w*|difference of opinion|different (?:ideas|views|opinions)|conflict|could not agree|couldn.t agree)\b/i,
    responseMarkers: /\b(?:respond\w*|deal\w*|dealt|handl\w*|approach\w*|worked through|address\w*)\b/i,
  },
  {
    topic: 'Resilience & Handling Failure',
    instruction: 'Ask about responding to one ordinary mistake OR small setback. Do not presume recovery or success, request a major failure, or ask about trauma or personal hardship.',
    evidence: 'Look for acknowledging a mistake, taking a reasonable corrective step, seeking support, or adjusting after a setback. Continuing at any cost is not resilience; an unsuccessful outcome can still show responsible behavior.',
    examples: [
      'Tell me about a time you responded to a mistake in an assignment.',
      'Describe a time you dealt with a small setback during an activity.',
    ],
    questionMarkers: /\b(?:mistake|setback|failure|went wrong|did not go|didn\x27t go|difficulty|disappoint\w*|delay\w*|postpon\w*|could not (?:finish|complete)|couldn.t (?:finish|complete)|did not work|didn.t work)\b/i,
    responseMarkers: /\b(?:respond\w*|deal\w*|dealt|handl\w*|approach\w*|address\w*|correct\w*|adjust\w*|kept working)\b/i,
  },
  {
    topic: 'Problem Solving & Initiative',
    instruction: 'Ask about one small problem the candidate acted on OR one useful action they initiated. Do not require both, an impressive invention, acting alone, or work beyond appropriate responsibilities.',
    evidence: 'Look for recognizing a need, gathering relevant information, choosing a reasonable action, checking its effect, or proposing a useful improvement. Appropriate help-seeking counts; acting without permission is not automatically initiative.',
    examples: [
      'Tell me about a time you took action on a small problem in an activity.',
      'Describe a time you noticed something that needed doing in a shared task.',
    ],
    questionMarkers: /\b(?:problem|solution|initiative|needed doing|need|improv\w*)\b/i,
  },
];

const BEHAVIORAL_QUESTION_STANDARD = `ENTRY-LEVEL BEHAVIORAL PRACTICE STANDARD:
- Ask for ONE actual past occasion and ONE target behavior, using Tell me about a time, Describe a time or situation, or Give me an example of a time.
- Ordinary assignments, group activities, hobbies, volunteering, personal projects, part-time work, and internships are equally acceptable. Leave the context open or give one familiar example; do not require that exact setting in the answer.
- Do not assume commercial experience, leadership, coding achievements, quick learning, or enthusiasm for a particular IT specialty.
- Do not require working alone, without help, or on your own. Asking for help and contributing with others are valid at entry level.
- Use neutral wording about how the candidate responded. Do not presume success, a completed resolution, an impressive achievement, or a happy ending; allow an honest unsuccessful experience.
- For a disagreement, mistake, delay, or unsuccessful attempt, explicitly ask about responding to, dealing with, or handling that event. Merely asking about a time the event happened does not focus on the response. These neutral response verbs do not prescribe an ideal action.
- Do not prescribe the ideal behavior in the question, such as listening patiently, communicating respectfully, or reaching a compromise. Those are possible evidence to evaluate, not instructions to copy.
- Use one past-event request followed by one short evidence probe about the candidate's own action and the outcome OR lesson from that SAME event. Aim for 30 to 45 words; never exceed 55 words or two sentences. A probe adds depth, not another competency or experience.
- Prefer recognizable entry-level IT interview themes: project contributions, changing requirements, feedback, different priorities, mistakes, missed expectations, unclear requirements, and process improvements. School and personal projects count; technical knowledge is never being tested here.
- Avoid abstract self-ratings, personality labels, generic strengths questions, future hypotheticals, superlatives, major crises, sensitive personal disclosures, or technical knowledge tasks.
- Stay within the selected competency; do not combine its two possible themes in one question or repeat an earlier question. Novelty is less important than clarity.
- These are practice questions. A single response is evidence from one event, not a diagnosis of personality or an established personal strength.`;

const BEHAVIORAL_SCORING_RUBRIC = `ENTRY-LEVEL BEHAVIORAL EVIDENCE RUBRIC:
Use the three existing STAR practice dimensions independently. Situation includes Task; there is no separate task_score.
STAR is an answer-organizing aid, not a requirement to say its headings or use a particular order.
Score only evidence in the answer that responds to the actual question. Do not invent missing actions, outcomes, or intentions, verify story truth, or infer personality, employability, or a stable strength.
An off-topic story or a purely hypothetical answer without a past event receives 1 on each dimension. A relevant event with missing information is scored dimension by dimension; do not lower all scores for one missing component.

Situation and Task:
1: No relevant past event or usable context.
2: A relevant event is mentioned but the need or task is unclear.
3: The event and basic need or task are understandable, with some missing context.
4: A specific relevant event and the candidate's goal or responsibility are clear.
5: Clear, sufficient context and responsibility make the behavior understandable, even in one concise sentence; names, dates, and lengthy background are unnecessary.
When the event, need, and candidate's responsibility are already clear, use 5; do not hold back a point for optional background.

Action:
1: No relevant personal action, or the only action described directly undermines the selected competency.
2: Vague activity or group actions with no identifiable individual contribution, or a clear action with little relevant behavioral evidence.
3: An identifiable relevant personal action is described, but how it addressed the need is partly unclear.
4: A specific, reasonable personal contribution demonstrates the selected behavior in context.
5: Concrete personal action and enough explanation of its purpose demonstrate the selected behavior clearly; one well-explained action is sufficient.
Use 5 when that evidence is present; do not cap a sufficient contribution at 4 because additional coordination, another action, or a more impressive example could be added.
Judge behavior as well as detail. A polished account of blame, disrespect, concealment, or reckless action does not earn a high Action score merely for being specific. Do not let this automatically reduce clear Situation or Result evidence.
The word I is not required. Collaborative we wording is acceptable when the candidate's own contribution is identifiable. Appropriate help-seeking is valid behavior; leadership, working alone, and multiple steps are unnecessary.

Result or Learning:
1: No relevant outcome or learning is stated.
2: A vague claim such as it was fine or I learned a lot, without specifics.
3: A relevant outcome or lesson is stated but its connection to the action is unclear.
4: A specific outcome OR a specific lesson is clearly linked to the experience.
5: A concrete outcome OR a specific, usable lesson shows the effect or learning from the action. Both are not required; numerical results, awards, perfect success, and later proof of improvement are unnecessary.
Use 5 when the relevant effect or usable learning is explicit; an ordinary outcome such as everyone arriving at the agreed time is concrete enough.
An honest negative or mixed outcome can earn 5. Do not assume a positive ending or punish circumstances outside the candidate's control.

Use the same anchors for every role and every requested difficulty. Accept short answers and equivalent ordinary experiences outside the question's example setting.
Do not penalize accent, grammar, filler words, hesitation, informal English, or lack of professional vocabulary when the meaning is understandable. Do not infer vocal confidence, emotion, body language, or authenticity from a transcript.
Do not reward length, prestige, jargon, or a memorized STAR template without relevant evidence.
If no suitable experience is recalled, coach the candidate to choose a small real event; never encourage inventing a story. Low scores describe missing evidence in this response, not a bad personality.`;

// Original proposed calibration cases, subject to school HR review.
const BEHAVIORAL_SCORING_CALIBRATION = `SCORING CALIBRATION EXAMPLES:
Teamwork answer: Our class group needed slides for a presentation. I combined everyone's slides and checked the order so each speaker could follow it. We finished the presentation on time.
Scores: Situation 5, Action 5, Result 5. The task and contribution are specific, the purpose is explicit, and the outcome is linked. Do not request additional coordination, conflict resolution, or detail about collecting slides. Reinforce the clear contribution and outcome.

Teamwork answer: We did a project and it was fine.
Scores: Situation 2, Action 1, Result 2. There is no identifiable contribution and little context or outcome detail. Coach one small real example with the person's true contribution.

Conflict answer: We disagreed about the poster layout. I compared both ideas with the assignment requirements so we could choose on that basis. We still disagreed, but I learned to agree on the criteria before comparing designs.
Scores: Situation 5, Action 5, Result 5. A specific disagreement, constructive action with purpose, and usable lesson suffice even without agreement.

Conflict answer: Our group disagreed on the poster layout. I told them their idea was stupid and took over. We finished the poster.
Scores: Situation 4, Action 1, Result 4. The account is clear but the action undermines the competency. Coach future conduct, for example: For future disagreements, try listening to the other view before discussing a shared decision. Do not tell the candidate to add unperformed listening to this story.

These examples clarify the anchors rather than require matching phrases or experiences. Use the same evidence standard for equivalent answers.`;

module.exports = { BEHAVIORAL_COMPETENCIES, BEHAVIORAL_QUESTION_STANDARD, BEHAVIORAL_SCORING_RUBRIC, BEHAVIORAL_SCORING_CALIBRATION };
