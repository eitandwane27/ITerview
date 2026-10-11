// Original spoken adaptations; sources and validation: docs/data-analyst-interview.md.
const scope = entries => ({ topicScope: entries.map(([name]) => name), topicKeywords: entries.map(([, words]) => words) });
const applied = (base, descriptions) => ({ ...base, topicScope: base.topicScope.map((name, i) => `${name}: ${descriptions[i]}`) });
const easy = scope([
  ['Tabular data', ['row', 'column', 'table', 'record', 'header']],
  ['Spreadsheet operations', ['spreadsheet', 'sort', 'sorting', 'filter', 'filtering']],
  ['Data quality', ['duplicate', 'missing value', 'blank', 'cleaning', 'quality']],
  ['Simple summaries', ['mean', 'median', 'total', 'count', 'summary']],
  ['Chart purposes', ['chart', 'bar', 'line', 'axis', 'label']],
  ['Query basics', ['SQL', 'query', 'database', 'retrieve', 'retrieving']],
]);
const medium = scope([
  ['Filtering and aggregation', ['filter', 'filtering', 'aggregate', 'aggregation', 'group', 'grouping']],
  ['Table matching', ['join', 'joining', 'match', 'matching', 'key', 'lookup']],
  ['Missing observations', ['null', 'missing', 'blank', 'zero', 'unreported']],
  ['Record granularity', ['grain', 'granularity', 'order', 'line item', 'distinct customer']],
  ['Distribution summaries', ['median', 'mean', 'outlier', 'skew', 'distribution']],
  ['Visual interpretation', ['chart', 'axis', 'axes', 'label', 'scale', 'visual', 'baseline', 'truncated']],
]);
const hard = scope([
  ['Join cardinality', ['join', 'joining', 'cardinality', 'matching row', 'matching rows', 'detail row', 'detail rows', 'fanout', 'repeated amount']],
  ['Metric comparability', ['rate', 'denominator', 'percentage', 'weighted', 'weighting', 'eligible', 'population size']],
  ['Sampling limits', ['sample', 'sampling', 'volunteer', 'volunteered', 'respondent', 'response bias', 'representative', 'coverage']],
  ['Causal evidence', ['correlation', 'causation', 'causal', 'confounder', 'confounding', 'observational', 'caused', 'self-selection', 'motivation', 'tutoring effect']],
  ['Missingness bias', ['missing', 'missingness', 'nonresponse', 'incomplete', 'unrecorded']],
  ['Analysis reproducibility', ['reproducibility', 'reproducible', 'reproduced', 'rerun', 'snapshot', 'transformation', 'refresh', 'provenance', 'source version']],
]);
const examples = {
  easy: {
    focus_clarity: [
      'What does a row represent in a table of students?',
      'What is a spreadsheet filter used for?',
      'What is data cleaning used for?',
      'What does the median describe in a list of numbers?',
      'What is a bar chart used for?',
      'What is a database query used for?',
    ],
    focus_correctness: [
      'How does a row differ from a column in a table?',
      'How does sorting differ from filtering in a spreadsheet?',
      'How does a missing value differ from a recorded zero?',
      'How does a total differ from a count?',
      'How does a bar chart differ from a line chart?',
      'How does retrieving database information differ from changing it?',
    ],
    focus_completeness: [
      'Name two useful column headers for a table of books?',
      'Name two directions for sorting numeric spreadsheet entries?',
      'Name two familiar data quality problems?',
      'Name two familiar numeric summary measures?',
      'Name two useful chart labels?',
      'Name two kinds of information a library database query could retrieve?',
    ],
  },
  medium: {
    focus_clarity: [
      'Why does filtering purchases before aggregation change which purchases contribute to a group total?',
      'How does a left join retain unmatched records from its left table?',
      'Why does treating an unreported measurement as zero change the meaning of a numeric summary?',
      'Why does an order with several line items occupy several rows in a line item table?',
      'Why can one very large outlier pull the mean above the median?',
      'Why does a truncated bar chart axis exaggerate apparent size differences?',
    ],
    focus_correctness: [
      'How does filtering individual purchases before grouping differ from filtering group totals after aggregation?',
      'A left join finds no matching lookup record; what happens to the unmatched left record?',
      'How does counting all records differ from counting non-null measurements?',
      'How does counting line item rows differ from counting distinct orders?',
      'How does the mean differ from the median in sensitivity to one extreme outlier?',
      'How does an axis starting at zero differ from a truncated axis in a bar chart?',
    ],
    focus_completeness: [
      'Name two filter checks before comparing grouped purchase totals?',
      'Name two key matching checks before joining a table to a lookup?',
      'Name two missing measurement checks before calculating an average?',
      'Name two grain checks before counting orders from line item records?',
      'Name two distribution checks before choosing a typical value summary?',
      'Name two chart axis checks before comparing displayed bar lengths?',
    ],
  },
  hard: {
    focus_clarity: [
      'Why can summing an order amount after joining it to several matching detail rows inflate the reported total?',
      'Why can an unweighted average of group percentages misrepresent an overall rate when eligible population sizes differ?',
      'Why does a large volunteer sample alone fail to establish that respondents represent all students?',
      'Why does an observational correlation alone fail to show that one measured variable caused the other?',
      'Why can excluding missing scores bias a summary when low scores are more likely to be unrecorded?',
      'Why can repeating identical transformations on a changed source snapshot produce a different analysis result?',
    ],
    focus_correctness: [
      'Each order joins to three detail rows; its unchanged amount appears once per match; what happens to the sum of those repeated amounts?',
      'How does weighting group rates by eligible population size differ from averaging them with equal weight?',
      'How does a randomly selected student sample differ from a volunteer sample in selection bias risk?',
      'How does evidence of correlation differ from evidence of causation in an observational study?',
      'Only scores below the original mean are missing and some scores remain; what happens to the mean of the retained scores?',
      'How does retaining a source snapshot differ from retaining only transformation instructions when source records can change?',
    ],
    focus_completeness: [
      'Name three join cardinality checks before summing order amounts across matching detail records?',
      'Name three denominator comparability checks before combining group rates into an overall percentage?',
      'Name three sampling evidence checks before generalizing a volunteer survey to all students?',
      'Name three causal evidence checks before attributing an observational correlation to a treatment?',
      'Name three missingness bias checks before excluding unrecorded survey scores from a summary?',
      'Name three analysis reproducibility details to preserve when source records may change?',
    ],
  },
};
const focusDetails = {
  easy: {
    focus_clarity: ['explain one record and its fields', 'explain a familiar sort or filter purpose', 'explain cleaning purpose without a procedure', 'explain one familiar numeric summary', 'explain a chart purpose', 'explain retrieving stored information'],
    focus_correctness: ['compare rows and columns', 'compare ordering with selecting visible entries', 'compare unknown values with measured zero', 'compare a sum with a count', 'compare category bars with time trends', 'compare retrieval with modification'],
    focus_completeness: ['name two familiar record headers', 'name two numeric sorting directions', 'name two familiar quality problems', 'name two summary measures', 'name two chart labels', 'name two retrievable library information categories'],
  },
  medium: {
    focus_clarity: ['explain row filtering before grouping', 'explain unmatched left records in a left join', 'explain unknown versus zero measurement meaning', 'explain one line item per row', 'explain outlier influence on mean', 'explain truncated bar axis perception'],
    focus_correctness: ['compare record filtering with grouped total filtering', 'predict preservation of an unmatched left record', 'compare all-record counts with non-null counts', 'compare row counts with distinct order counts', 'compare mean and median outlier sensitivity', 'compare zero baseline with truncated bar baseline'],
    focus_completeness: ['name two grouped total filter checks', 'name two lookup key checks', 'name two missing measurement checks', 'name two line item versus order grain checks', 'name two distribution checks', 'name two chart axis checks'],
  },
  hard: {
    focus_clarity: ['explain repeated order amount inflation after one-to-many join', 'explain denominator weighting of group rates', 'explain volunteer selection limits despite large size', 'explain observational confounding limits on causation', 'explain score-dependent missingness bias', 'explain changed inputs under unchanged transformations'],
    focus_correctness: ['predict repeated amount sum under stated match multiplicity', 'compare eligible-population weighting with equal weighting', 'compare random selection with self-selection risk without a guarantee', 'compare association evidence with causal evidence', 'predict retained mean after only below-mean scores are omitted', 'compare frozen inputs with instructions alone'],
    focus_completeness: ['name three join multiplicity and grain checks', 'name three denominator comparability checks', 'name three sample generalization checks', 'name three causal evidence checks', 'name three missingness mechanism checks', 'name three reproducibility details'],
  },
};
const focused = (base, difficulty) => ({ ...base, focusTopics: Object.fromEntries(Object.entries(focusDetails[difficulty]).map(([focus, descriptions]) => [focus, applied(base, descriptions)])) });
module.exports = {
  id: 'data-analyst', label: 'Data Analyst',
  avoidList: `DATA ANALYST SPOKEN SCOPE:
- Target students analyzing small classroom datasets. Ask original short questions about tabular records, spreadsheets, SQL reasoning, cleaning, summaries, charts, sampling and evidence. No code, SQL syntax, formulas, commands, product menu recall, advanced machine learning, warehouse architecture, certification trivia or commercial experience. Tool names do not constitute analysis skill.
- Ask one task only. Clarity explains one purpose or mechanism; correctness identifies one accurate behavior or compares two concepts; completeness names two items in easy and medium, three in hard. Never append and why, an example, a procedure, or another result. Do not embed list answers in the context. Aim for direct short wording; hard remains under 45 words.
- Start the requested task directly with Why does or How does in clarity, How does ... differ or What happens in correctness, and Name two or Name three in completeness. Never append naming two or naming three explanations to a clarity task. Do not begin every question with in a classroom; a one-clause premise is enough. Keep whole questions within 24 words for easy, 32 for medium and 45 for hard whenever the needed premises fit.
- Use plain spoken words: database query, mean, median, missing value, left join, eligible population, source snapshot. No mathematical notation or software function calls. Preserve whole records when sorting; filtering hides or selects records rather than necessarily deleting stored information.
- A row is one record at the stated grain; a column is a field. A count, total, mean and median are different summaries. For numerical outcomes supply every necessary value and ask at most one simple calculation; prefer conceptual reasoning. Do not require arithmetic in a naming task.
- A missing or null measurement is unknown or absent, not automatically zero. Counting all rows includes rows with missing fields; counting a non-null field excludes its null entries. State the count target explicitly. No universal rule to delete or impute every missing entry; check meaning and missingness before deciding.
- SQL filtering before aggregation selects contributing rows; filtering after aggregation selects groups. A left join preserves unmatched left rows with absent right-side values. Match multiplicity depends on keys, not the join name alone. No query writing, window function syntax or query optimization trivia.
- Line items and orders have different grain. Repeated customer or order identifiers may be legitimate records, not duplicates to delete. Duplicate removal requires a defined record identity. Do not equate equal values with accidental duplicates or assert a join always inflates sums.
- For join inflation state one stored amount per order and multiple matching detail rows that repeat that same amount; summing at detail grain then overcounts. Distinct amounts are not a general remedy because separate orders can have equal amounts. Pre-aggregate or use a verified unique lookup where appropriate, and preserve the intended grain.
- A large outlier influences the mean more than the median, but not every unusual value is an error to delete. State a numeric ordered dataset for precise median changes; do not claim the median never changes. A truncated bar axis may exaggerate magnitude differences; line chart axes need not always start at zero. Supply a chart purpose before choosing its type; no universally best chart.
- One extreme high outlier does not alone establish that the mean exceeds the median. Ask about relative sensitivity, or provide all values for a numerical ordering task. Do not ask how the mean compares with the median from a vague description such as mostly between two bounds. Equal-scale and label checks are sufficient for simple chart testing; avoid a broad trustworthy data audit.
- A rate needs an explicitly defined numerator, eligible denominator, population and period. Combine group percentages using corresponding denominator weights only for non-overlapping groups with the same metric definition and period. Do not average group percentages equally unless equal weights are justified. More events do not imply a higher rate without denominators.
- Unequal group sizes do not guarantee equal averaging gives a wrong result: identical group rates can still coincide. Say can misstate or can misrepresent, not does misstate or must be wrong, unless distinct rates and denominator sizes are given. Keep this topic about rates rather than silently switching to means based on unspecified observation counts.
- A large volunteer sample alone does not establish representativeness. Random selection reduces self-selection concerns but nonresponse and incomplete coverage can still bias results. Sample size affects precision; it does not automatically remove systematic selection bias. No statistical significance thresholds, confidence interval formulas, power calculations or universal minimum sample sizes.
- Volunteer selection leaves representativeness unproven; it does not prove the sample is unrepresentative. Say fails to establish representativeness or may be biased, not fails to represent the population as a definite claim. Large size cannot resolve this evidence gap by itself.
- Observational correlation alone does not establish causation. Other variables, selection and reverse direction may explain association. Random assignment can strengthen a causal design under relevant assumptions, but does not magically fix missing outcomes or poor measurement. A before-and-after increase alone does not prove a campaign caused it.
- Missingness can depend on the unobserved value. Never assert a definite direction of bias without specifying which values are omitted. For a higher retained mean state that only values below the original mean are removed and at least one remains. Otherwise ask about evidence limits or which missingness pattern to investigate, not an unsupported increase or decrease.
- Analysis reproducibility needs source version or snapshot, transformations and metric/filter definitions. Identical instructions on changed inputs can change results. A successful refresh proves completion, not freshness, completeness or correctness. State what changed before predicting an output; absent source-change evidence is not proof the data stayed identical.`,
  difficultyAvoidLists: {
    easy: 'Use familiar records, spreadsheet sort/filter, blank or duplicate entries, count/total/median meanings, chart purposes and retrieval. No joins, aggregation stages, skewed distributions, sampling bias, causal designs, weighted rates or source lineage. Easy count tasks count records, not non-null fields; do not provide irrelevant totals or require guessing which fields are missing. Testing asks two simple checks for a stated output, not whether a whole record is trustworthy. Give the record purpose or field requirement before a two-check task; prefer checking headers or chart labels.',
    medium: 'Use one applied filtering, left join, null count, grain, outlier or chart axis task. No join fanout correction, repeated-measure total inflation, weighted group rates, confounding, missingness bias mechanisms or causal inference claims. Grain tasks compare distinct order identifiers with line item counts; reserve repeated order amount correction for hard. Ask what row counts count at each grain; do not imply that changing grain necessarily changes a correctly calculated total quantity.',
    hard: 'Use one bounded advanced-junior join multiplicity, denominator comparability, sample generalization, causation evidence, missingness or reproducibility task. Three introductory facts alone are not hard. No enterprise analytics architecture or advanced inferential calculations.',
  },
  set1: { ...medium, difficultyTopics: { easy: focused(easy, 'easy'), medium: focused(medium, 'medium'), hard: focused(hard, 'hard') }, easyExamples: examples.easy, mediumExamples: examples.medium, hardExamples: examples.hard },
  set2: {
    ...medium,
    difficultyTopics: {
      easy: applied(easy, ['interpret a familiar record', 'select or order spreadsheet entries', 'recognize a basic quality issue', 'apply count or total meanings', 'choose charts for stated purposes', 'retrieve familiar stored information']),
      medium: applied(medium, ['reason about filtering stages and grouped summaries', 'retain unmatched left records and verify lookup keys', 'handle missing observations without treating unknown as zero', 'count at the intended order or line item grain', 'choose summaries under stated outliers', 'interpret chart scales and labels']),
      hard: applied(hard, ['avoid duplicated measures under stated join multiplicity', 'combine comparable non-overlapping rates using denominator weights', 'evaluate sample coverage and selection limits', 'distinguish observed association from justified causation', 'evaluate value-dependent missingness without guessing bias direction', 'retain inputs and definitions for reproducible analyses']),
    },
    easyExamples: [
      'What does a column header tell you about a table?',
      'Why is data cleaning useful before a summary?',
      'How does sorting differ from filtering in a spreadsheet?',
      'A query retrieves every book title from a database; what happens to the stored titles?',
      'Name two checks for labels on a bar chart?',
      'You need the number of books; which summary fits, a count or a total of prices?',
    ],
    mediumExamples: [
      'How does grouping purchases by category produce a separate total for each category?',
      'Why does a left join help retain records without matching lookup entries?',
      'How does counting all measurements differ from counting only non-null measurements?',
      'One order has three line items stored as separate rows; what happens to the row count for that order?',
      'Name two chart axis checks before comparing bar lengths?',
      'A distribution contains one unusually large value; which summary better resists that outlier when describing a typical value?',
      'A grouped total includes purchases outside the requested month; what filter condition should you check first?',
      'Why would you prefer counting distinct order identifiers over counting line item rows when reporting the number of orders?',
    ],
    hardExamples: [
      'How does a join repeat an order amount when that order has several matching detail rows?',
      'Why does a large volunteer sample alone leave uncertainty about representativeness?',
      'How does an observational correlation differ from evidence that a treatment caused an outcome?',
      'Only missing measurements below the original mean are omitted and at least one measurement remains; what happens to the mean of the retained measurements?',
      'Name two denominator checks before combining rates from non-overlapping groups?',
      'An analysis must be reproducible after source records change; which input version should be preserved?',
      'An order total doubles after a join; what matching-row cardinality should you check first?',
      'Why would you prefer denominator-weighted group rates over equal weighting when comparable groups have different eligible population sizes?',
    ],
  },
};
