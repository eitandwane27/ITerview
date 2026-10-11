// Different event demands within the same entry-level competency. These are
// proposed practice variants for HR review, not proven equivalent test forms.
const BEHAVIORAL_QUESTION_ANGLES = [
  [
    { id: 'peer-support', focus: 'Contributing when a teammate needed help to make progress on a project; ask about personal contribution and its effect without assuming success.', markers: /\b(?:help|support|struggl\w*)\b/i, example: 'Tell me about a time a teammate needed help making progress on a project.' },
    { id: 'different-availability', focus: 'Working together when group members were available at different times; no tight deadline required.', markers: /\b(?:available|availability|different times|schedules)\b/i, example: 'Describe a time you worked with a group whose members were available at different times.' },
    { id: 'unclear-responsibilities', focus: 'Contributing to a shared task when responsibilities were unclear.', markers: /\b(?:unclear|unsure|responsibilit\w*|who would|who should)\b/i, example: 'Tell me about a time you worked with others when it was unclear who should do each task.' },
    { id: 'shared-information', focus: 'Sharing project information or explaining it to someone with a different level of understanding; focus on communication and its effect, not a technical explanation.', markers: /\b(?:information|details|notes|explain\w*|understand\w*)\b/i, example: 'Describe a time you explained project information to a teammate who was unfamiliar with it.' },
    { id: 'unfamiliar-group', focus: 'Contributing to a task with people the candidate had not worked with before.', markers: /\b(?:before|unfamiliar|first time|new (?:group|team)|did not know)\b/i, example: 'Tell me about a time you worked on a task with people you had not worked with before.' },
    { id: 'different-approaches', focus: 'Working together with people who approached the shared task differently; no disagreement required.', markers: /\b(?:different\w*|approach\w*|ways of working)\b/i, example: 'Describe a time you worked with others who approached a shared task differently from you.' },
  ],
  [
    { id: 'changed-instructions', focus: 'Adapting when project requirements changed after work began; keep the focus on response and effect rather than asking for technical implementation.', markers: /\b(?:instructions|requirements|directions)\b/i, example: 'Tell me about a time project requirements changed after you had already started the work.' },
    { id: 'unfamiliar-task', focus: 'Learning an unfamiliar task or tool needed for a project; ask about the learning approach, not technical facts or learning speed.', markers: /\b(?:unfamiliar|new task|first time|never done|not done before|something new|new to you)\b/i, example: 'Describe a time you needed to learn an unfamiliar tool or task for a project.' },
    { id: 'feedback-change', focus: 'Responding to constructive feedback on project work; explore the response and learning without assuming the candidate agreed or changed the approach.', markers: /\bfeedback\b/i, example: 'Tell me about a time you received feedback that made you reconsider your approach to a project.' },
    { id: 'changed-plan', focus: 'Adjusting to a change in the plan for an activity.', markers: /\b(?:plan|planned|arrangement)\b/i, example: 'Describe a time you adjusted to a change in the plan for an activity.' },
    { id: 'limited-guidance', focus: 'Learning something unfamiliar with little guidance; asking for help is allowed.', markers: /\b(?:guidance|instructions|direction|help)\b/i, example: 'Tell me about a time you learned something unfamiliar when little guidance was available.' },
    { id: 'new-way', focus: 'Learning a different way to do a familiar task; do not presume the new way was better.', markers: /\b(?:different way|new way|another way|different approach|new approach)\b/i, example: 'Describe a time you learned a different way to do a familiar task.' },
  ],
  [
    { id: 'different-ideas', focus: 'Handling a disagreement with a teammate about an approach to a project; explore response and outcome without requiring agreement.', markers: /\b(?:ideas|approach\w*|how to|method|way to)\b/i, example: 'Tell me about a time you and a teammate disagreed about the approach to a project.' },
    { id: 'misunderstanding', focus: 'Responding to a disagreement involving a misunderstanding of what someone meant.', markers: /\b(?:misunderstand\w*|misunderstood|meant|understood)\b/i, example: 'Describe a time you responded to a disagreement caused by a misunderstanding.' },
    { id: 'task-division', focus: 'Responding to a difference of opinion about dividing a shared task.', markers: /\b(?:divid\w*|division|responsibilit\w*|who should|who would)\b/i, example: 'Tell me about a time you dealt with different opinions about dividing a group task.' },
    { id: 'priorities', focus: 'Handling conflicting team priorities when several tasks needed attention; probe the candidate response and effect, not a hypothetical prioritization exercise.', markers: /\b(?:first|priorit\w*|order)\b/i, example: 'Describe a time your team disagreed about which project task should take priority.' },
    { id: 'disagreed-feedback', focus: 'Responding to feedback the candidate disagreed with; do not require agreeing with it.', markers: /\b(?:feedback|comment\w*|suggestion\w*)\b/i, example: 'Tell me about a time you responded to feedback you disagreed with during an activity.' },
    { id: 'unsettled-decision', focus: 'Responding when a group could not agree on a decision; do not presume eventual agreement.', markers: /\b(?:decision|decide|could not agree|couldn.t agree)\b/i, example: 'Describe a time you handled a disagreement when your group could not decide what to do.' },
  ],
  [
    { id: 'own-mistake', focus: 'Taking responsibility after a mistake affected project work; ask about the response and outcome or lesson without implying recovery.', markers: /\bmistake\b/i, example: 'Tell me about a time a mistake you made affected a project or shared assignment.' },
    { id: 'unfinished-task', focus: 'Responding when a task was not completed by its planned deadline; allow an ordinary school deadline and an unsuccessful outcome.', markers: /\b(?:finish\w*|complete\w*|unfinished|deadline)\b/i, example: 'Describe a time you could not complete a project task by the planned deadline.' },
    { id: 'disappointing-outcome', focus: 'Responding when an ordinary activity had a disappointing outcome; no major failure.', markers: /\b(?:outcome|result|expected|disappoint\w*)\b/i, example: 'Tell me about a time you dealt with a disappointing result after working on an activity.' },
    { id: 'unsuccessful-attempt', focus: 'Responding to a setback when a first attempt at a task did not work.', markers: /\b(?:attempt|try|tried|first|did not work|didn.t work)\b/i, example: 'Describe a time you responded to a setback when your first attempt at a task did not work.' },
    { id: 'unexpected-delay', focus: 'Responding to an ordinary delay that disrupted an activity; no requirement to finish on time.', markers: /\b(?:delay\w*|postpon\w*|waiting|late)\b/i, example: 'Tell me about a time you handled a setback caused by an unexpected delay in an activity.' },
    { id: 'correction-not-working', focus: 'Responding when an attempted correction of a mistake did not work as intended.', markers: /\b(?:correct\w*|fix\w*|put.*right)\b/i, example: 'Describe a time you dealt with a mistake when your attempted correction did not work.' },
  ],
  [
    { id: 'missing-information', focus: 'Acting on a small problem caused by missing information.', markers: /\b(?:information|details|missing)\b/i, example: 'Tell me about a time you acted on a small problem caused by missing information.' },
    { id: 'unclear-task', focus: 'Acting on a problem when the task requirements were unclear; do not prescribe asking a particular person.', markers: /\b(?:unclear|unsure|requirements|instructions)\b/i, example: 'Describe a time you addressed a problem caused by unclear instructions for a task.' },
    { id: 'repeated-problem', focus: 'Taking action on a recurring problem in how a team worked; ask about the action and effect without requiring a technical fix.', markers: /\b(?:repeat\w*|kept happening|again|recurr\w*)\b/i, example: 'Tell me about a time you noticed a recurring problem in how your project team worked.' },
    { id: 'simpler-task', focus: 'Suggesting a process improvement to reduce repeated effort; explore initiative and effect without presuming adoption.', markers: /\b(?:simpl\w*|easier|improv\w*|effort)\b/i, example: 'Describe a time you suggested an improvement to reduce unnecessary effort in a project.' },
    { id: 'unassigned-need', focus: 'Responding to a useful task that needed doing but had not been assigned; initiative is not acting without permission.', markers: /\b(?:assigned|unassigned|responsib\w*|no one|nobody)\b/i, example: 'Tell me about a time you noticed a task that needed doing but had not been assigned.' },
    { id: 'choice-of-solutions', focus: 'Acting on a small problem with more than one possible solution; no demand to compare all options in the question.', markers: /\b(?:solution\w*|options|ways|approach\w*)\b/i, example: 'Describe a time you addressed a small problem with more than one possible solution.' },
  ],
].map(angles => angles.map(angle => ({
  ...angle,
  example: `${angle.example} What did you personally do, and what was the outcome or lesson?`,
})));

module.exports = { BEHAVIORAL_QUESTION_ANGLES };
